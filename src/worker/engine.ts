import type { Candle, StrategyConfig, Timeframe } from "../core/types";
import { DEFAULT_COSTS, TF_SECONDS } from "../core/types";
import { closePosition, equityAt, newAccount, processHour, type AccountState, type EngineEvent } from "../core/engine";
import { isBarClose } from "../core/indicators";
import { windowSize } from "../core/strategies";
import { KrakenPublic, type Fetcher, type Ticker } from "./market";
import { event, kvGet, kvPut, lastBars, loadControls, loadLimits, loadStrategy, now, persistEvents, upsertBar, type EngineMeta, type Env, type Heartbeat } from "./db";
import { notify } from "./notify";

const LOCK_TTL = 240;

export async function acquireLock(env: Env, owner: string): Promise<boolean> {
  const t = now();
  const r = await env.DB.prepare(
    "INSERT INTO kv (key, value, updated_at) VALUES ('lock', ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at WHERE kv.updated_at < ? OR kv.value = '\"free\"'",
  )
    .bind(JSON.stringify(owner), t, t - LOCK_TTL)
    .run();
  return (r.meta.changes ?? 0) > 0;
}

export async function releaseLock(env: Env): Promise<void> {
  await env.DB.prepare("UPDATE kv SET value = '\"free\"', updated_at = ? WHERE key = 'lock'").bind(now()).run();
}

async function ensureMeta(env: Env, mk: KrakenPublic): Promise<EngineMeta> {
  let meta = await kvGet<EngineMeta>(env.DB, "meta");
  const t = now();
  if (!meta || t - meta.eurusdTs > 86400) {
    let fx = meta?.eurusd ?? 1.16;
    try {
      fx = await mk.eurusd();
    } catch {
      /* se conserva el último valor conocido */
    }
    meta = { eurusd: fx, eurusdTs: t, startedAt: meta?.startedAt ?? t, ticks: meta?.ticks ?? 0, errors: meta?.errors ?? 0 };
  }
  return meta;
}

// Garantiza que hay suficientes velas del timeframe de la estrategia.
async function ensureBars(env: Env, mk: KrakenPublic, tf: Timeframe, uptoTs: number, need: number, t: number): Promise<Candle[]> {
  let bars = await lastBars(env.DB, tf, uptoTs, need);
  const span = TF_SECONDS[tf];
  const missingLatest = !bars.length || bars.at(-1)!.ts < uptoTs;
  if (bars.length < need || missingLatest) {
    const from = bars.length >= need ? bars.at(-1)!.ts + span : uptoTs - (need + 5) * span;
    const fresh = await mk.candles(env.SYMBOL, tf, from, uptoTs + span, t);
    if (fresh.length) {
      await env.DB.batch(fresh.map((c) => upsertBar(env.DB, tf, c)));
      bars = await lastBars(env.DB, tf, uptoTs, need);
    }
  }
  return bars;
}

export interface TickResult {
  ok: boolean;
  processedHours: number;
  events: number;
  message: string;
}

export async function runTick(env: Env, fetcher: Fetcher = (u, i) => fetch(u, i)): Promise<TickResult> {
  const started = Date.now();
  const t = now();
  if (!(await acquireLock(env, `tick-${t}`))) return { ok: true, processedHours: 0, events: 0, message: "otro ciclo en curso" };
  const mk = new KrakenPublic(fetcher, env.KRAKEN_BASE || undefined, env.KRAKEN_SPOT_BASE || undefined);
  let meta: EngineMeta | null = null;
  try {
    meta = await ensureMeta(env, mk);
    meta.ticks++;
    const [controls, limits] = await Promise.all([loadControls(env), loadLimits(env)]);
    let strat = await loadStrategy(env);
    let account = (await kvGet<AccountState>(env.DB, "account")) ?? newAccount(Number(env.INITIAL_CAPITAL_EUR || "200") * meta.eurusd);

    let ticker: Ticker;
    try {
      ticker = await mk.ticker(env.SYMBOL);
    } catch (e) {
      throw new Error(`sin datos de mercado: ${(e as Error).message}`);
    }
    const stmts: D1PreparedStatement[] = [];
    const allEvents: EngineEvent[] = [];

    // Velas de 1h cerradas desde la última procesada.
    const from = account.lastHourTs ? account.lastHourTs + 3600 : t - 48 * 3600;
    const hours = (await mk.candles(env.SYMBOL, "1h", Math.max(from, t - 7 * 86400), t, t)).filter((h) => h.ts > account.lastHourTs);
    if (hours.length) stmts.push(...hours.map((h) => upsertBar(env.DB, "1h", h)));

    // Promoción de estrategia pendiente: se aplica antes de evaluar las velas
    // nuevas y solo si no hay posición abierta.
    const pending = await kvGet<{ config: StrategyConfig; reason: string }>(env.DB, "pending_strategy");
    if (pending && !account.position) {
      strat = { config: pending.config, approved: true };
      stmts.push(kvPut(env.DB, "strategy", strat));
      stmts.push(kvPut(env.DB, "pending_strategy", null));
      stmts.push(env.DB.prepare("UPDATE strategies SET status = 'retired', retired_at = ? WHERE status = 'active'").bind(t));
      stmts.push(env.DB.prepare("UPDATE strategies SET status = 'active', activated_at = ? WHERE id = ?").bind(t, pending.config.id));
      stmts.push(env.DB.prepare("INSERT INTO learning (ts, kind, summary, data) VALUES (?, 'promotion', ?, ?)").bind(t, `Estrategia activada: ${pending.config.id}`, JSON.stringify(pending)));
      stmts.push(event(env.DB, "audit", "promotion", `Nueva estrategia activa: ${pending.config.id} (${pending.reason})`));
    }

    const cfg = strat.approved ? strat.config : null;
    // Sin estrategia aprobada: modo observación (gestiona stops pero no abre).
    const effControls = cfg ? controls : { ...controls, running: false };
    const runCfg = cfg ?? strat.config ?? { id: "observacion", family: "tsmom", timeframe: "1d" as const, params: { lookback: 60, allowShort: 0, stopAtr: 3, threshold: 0, trail: 0 } };

    const recent1h = cfg?.timeframe === "1h" && hours.length ? await lastBars(env.DB, "1h", hours[0].ts - 3600, windowSize(cfg) - 1) : [];
    for (const h of hours) {
      let strategyBars: Candle[] | null = null;
      if (cfg?.timeframe === "1h") recent1h.push(h);
      if (cfg && isBarClose(h.ts, cfg.timeframe)) {
        const span = TF_SECONDS[cfg.timeframe];
        const bucket = Math.floor(h.ts / span) * span;
        strategyBars = cfg.timeframe === "1h" ? recent1h.slice(-windowSize(cfg)) : await ensureBars(env, mk, cfg.timeframe, bucket, windowSize(cfg), t);
        if (strategyBars && (!strategyBars.length || strategyBars.at(-1)!.ts !== bucket)) {
          strategyBars = null;
          stmts.push(event(env.DB, "warn", "missing_bars", `No hay vela ${cfg.timeframe} cerrada de las ${new Date(bucket * 1000).toISOString()} en Kraken: decisión omitida`));
        }
      }
      const dataAge = t - (h.ts + 3600);
      const fresh = dataAge <= limits.maxDataAgeSec;
      const r = processHour(
        account,
        {
          bar: h,
          strategyBars,
          execPrice: fresh && !ticker.suspended ? ticker.last : null,
          execTs: t,
          referencePrice: ticker.index,
          dataAgeSec: dataAge,
          fundingRate: ticker.fundingHourly,
        },
        runCfg,
        effControls,
        limits,
        DEFAULT_COSTS,
      );
      account = r.state;
      allEvents.push(...r.events);
      stmts.push(
        env.DB.prepare("INSERT INTO equity (ts, equity, cash, price, position) VALUES (?, ?, ?, ?, ?) ON CONFLICT(ts) DO UPDATE SET equity=excluded.equity, cash=excluded.cash, price=excluded.price, position=excluded.position").bind(
          h.ts + 3600,
          equityAt(account, h.close),
          account.cash,
          h.close,
          account.position ? JSON.stringify({ side: account.position.side, qty: account.position.qty }) : null,
        ),
      );
    }

    // Stop dentro de la hora en curso con el último precio (entre cierres).
    if (account.position) {
      const p = account.position;
      const hit = p.side === "long" ? ticker.last <= p.stop : ticker.last >= p.stop;
      if (hit) {
        const evs = closePosition(account, p.stop, t, "stop de protección (intrahora)", DEFAULT_COSTS);
        allEvents.push(...evs);
      }
    }

    // Parada de emergencia solicitada mientras otro ciclo tenía el bloqueo.
    if (await kvGet<boolean>(env.DB, "emergency_pending")) {
      if (account.position) allEvents.push(...closePosition(account, ticker.last, t, "parada de emergencia", DEFAULT_COSTS));
      stmts.push(kvPut(env.DB, "emergency_pending", false));
      stmts.push(event(env.DB, "audit", "emergency", "Parada de emergencia completada por el ciclo del motor"));
    }

    stmts.push(...persistEvents(env.DB, allEvents, controls.mode));
    const hb: Heartbeat = { ts: t, ok: true, price: ticker.last, durationMs: Date.now() - started };
    stmts.push(kvPut(env.DB, "account", account));
    stmts.push(kvPut(env.DB, "market", { ...ticker, ts: t }));
    stmts.push(kvPut(env.DB, "heartbeat", hb));
    stmts.push(kvPut(env.DB, "meta", meta));
    await env.DB.batch(stmts); // atómico: o se guarda todo o nada
    await notifyEvents(env, allEvents);
    return { ok: true, processedHours: hours.length, events: allEvents.length, message: "ok" };
  } catch (e) {
    const msg = (e as Error).message;
    const hb: Heartbeat = { ts: t, ok: false, error: msg, durationMs: Date.now() - started };
    const st = [kvPut(env.DB, "heartbeat", hb), event(env.DB, "error", "tick_error", `Error en el ciclo del motor: ${msg}`)];
    if (meta) st.push(kvPut(env.DB, "meta", { ...meta, errors: meta.errors + 1 }));
    await env.DB.batch(st);
    return { ok: false, processedHours: 0, events: 0, message: msg };
  } finally {
    await releaseLock(env);
  }
}

async function notifyEvents(env: Env, events: EngineEvent[]) {
  for (const e of events) {
    if (e.type === "fill") await notify(env, `APEX ${e.fill.kind === "entry" ? "entrada" : "salida"} ${e.fill.side} ${e.fill.qty} BTC @ ${e.fill.price.toFixed(0)} — ${e.fill.reason}`);
    if (e.type === "halt") await notify(env, `APEX: nuevas operaciones suspendidas — ${e.reason}`);
  }
}

// Parada de emergencia: apaga el bot y cierra la posición (simulada) al
// precio actual. Si un ciclo del motor tiene el bloqueo, queda programada y
// el ciclo la ejecuta antes de guardar.
export async function emergencyStop(env: Env, fetcher: Fetcher = (u, i) => fetch(u, i)): Promise<{ done: boolean; message: string }> {
  const controls = await loadControls(env);
  await env.DB.batch([
    kvPut(env.DB, "controls", { ...controls, running: false, paused: true, liveApproved: false }),
    kvPut(env.DB, "emergency_pending", true),
    event(env.DB, "audit", "emergency", "Parada de emergencia solicitada por el propietario"),
  ]);
  for (let i = 0; i < 20; i++) {
    if (await acquireLock(env, "emergency")) {
      try {
        const account = await kvGet<AccountState>(env.DB, "account");
        const st: D1PreparedStatement[] = [kvPut(env.DB, "emergency_pending", false)];
        let msg = "Bot detenido. No había posición abierta.";
        if (account?.position) {
          const mk = new KrakenPublic(fetcher, env.KRAKEN_BASE || undefined, env.KRAKEN_SPOT_BASE || undefined);
          const ticker = await mk.ticker(env.SYMBOL);
          const evs = closePosition(account, ticker.last, now(), "parada de emergencia", DEFAULT_COSTS);
          st.push(...persistEvents(env.DB, evs, controls.mode), kvPut(env.DB, "account", account));
          msg = `Bot detenido y posición cerrada a ${ticker.last.toFixed(1)}.`;
        }
        st.push(event(env.DB, "audit", "emergency", msg));
        await env.DB.batch(st);
        await notify(env, `APEX: ${msg}`);
        return { done: true, message: msg };
      } finally {
        await releaseLock(env);
      }
    }
    await new Promise((r) => setTimeout(r, 300));
  }
  return { done: false, message: "Bot detenido. El cierre de la posición se completará en el próximo ciclo (≤ 5 min)." };
}

