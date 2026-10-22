import { equityAt, type AccountState } from "../core/engine";
import { checkConfigChange, effectiveLimits, HARD_CAPS, lossPerUnit } from "../core/risk";
import { DEFAULT_COSTS, type RiskLimits } from "../core/types";
import { GATES } from "../core/gates";
import { bearerOk, createSession, destroyAllSessions, destroySession, isAuthenticated, recordFailure, sameOrigin, tooManyAttempts, verifyPassword, verifyTotp } from "./auth";
import { event, kvGet, kvPut, loadControls, loadLimits, loadStrategy, now, type EngineMeta, type Env, type Heartbeat } from "./db";
import { emergencyStop, runTick } from "./engine";
import { exportForResearch, ingestResearch, seedStrategy, type ResearchPayload } from "./learning";
import { previousMonth, saveMonthlyReport } from "./reports";
import type { Ticker } from "./market";

const SECURITY_HEADERS: Record<string, string> = {
  "content-security-policy": "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'",
  "x-content-type-options": "nosniff",
  "referrer-policy": "no-referrer",
  "x-frame-options": "DENY",
  "strict-transport-security": "max-age=31536000; includeSubDomains",
  "permissions-policy": "camera=(), microphone=(), geolocation=()",
};

function json(data: unknown, status = 200, extra: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...SECURITY_HEADERS, ...extra } });
}

const HEARTBEAT_STALE = 15 * 60;

async function status(env: Env) {
  const [controls, limits, strategy, account, hb, market, meta, pending] = await Promise.all([
    loadControls(env),
    loadLimits(env),
    loadStrategy(env),
    kvGet<AccountState>(env.DB, "account"),
    kvGet<Heartbeat>(env.DB, "heartbeat"),
    kvGet<Ticker & { ts: number }>(env.DB, "market"),
    kvGet<EngineMeta>(env.DB, "meta"),
    kvGet<{ config: { id: string }; reason: string }>(env.DB, "pending_strategy"),
  ]);
  const price = market?.last ?? null;
  const eq = account && price ? equityAt(account, price) : account?.cash ?? null;
  const pos = account?.position ?? null;
  const t = now();
  const fx = meta?.eurusd ?? 1.16;
  return {
    serverTime: t,
    controls,
    engine: {
      heartbeat: hb,
      heartbeatAgeSec: hb ? t - hb.ts : null,
      healthy: !!hb && hb.ok && t - hb.ts < HEARTBEAT_STALE,
      ticks: meta?.ticks ?? 0,
      errors: meta?.errors ?? 0,
      startedAt: meta?.startedAt ?? null,
    },
    market: market ? { price: market.last, mark: market.mark, index: market.index, fundingHourly: market.fundingHourly, ts: market.ts, symbol: market.symbol } : null,
    account: account
      ? {
          currency: "USD",
          eurusd: fx,
          initialCapital: account.initialCapital,
          cash: account.cash,
          equity: eq,
          peakEquity: account.peakEquity,
          pnl: eq !== null ? eq - account.initialCapital : null,
          pnlPct: eq !== null ? eq / account.initialCapital - 1 : null,
          drawdown: eq !== null ? 1 - eq / Math.max(account.peakEquity, eq) : null,
          feesPaid: account.feesPaid,
          fundingPaid: account.fundingPaid,
          halted: account.halted,
          haltReason: account.haltReason,
          lastHourTs: account.lastHourTs,
        }
      : null,
    position:
      pos && price && eq
        ? {
            ...pos,
            markPrice: price,
            unrealized: (pos.side === "long" ? price - pos.entryPrice : pos.entryPrice - price) * pos.qty,
            notional: pos.qty * price,
            leverage: (pos.qty * price) / eq,
            riskToStop: pos.qty * lossPerUnit(price, pos.stop, DEFAULT_COSTS),
            riskFromEntry: Math.max(0, pos.qty * (pos.side === "long" ? pos.entryPrice - pos.stop : pos.stop - pos.entryPrice) + pos.entryFee + pos.qty * pos.stop * (DEFAULT_COSTS.takerFee + DEFAULT_COSTS.slippage)),
            riskFromEntryPct: Math.max(0, pos.qty * (pos.side === "long" ? pos.entryPrice - pos.stop : pos.stop - pos.entryPrice) + pos.entryFee + pos.qty * pos.stop * (DEFAULT_COSTS.takerFee + DEFAULT_COSTS.slippage)) / Math.max(account!.initialCapital, 1e-9),
            riskToStopPct: (pos.qty * Math.max(0, pos.side === "long" ? price - pos.stop : pos.stop - price)) / eq,
          }
        : null,
    strategy: { ...strategy, pending },
    limits: effectiveLimits(limits),
    hardCaps: HARD_CAPS,
    gates: GATES,
  };
}

async function control(env: Env, action: string, req: Request): Promise<Response> {
  const c = await loadControls(env);
  const account = await kvGet<AccountState>(env.DB, "account");
  const ip = req.headers.get("cf-connecting-ip") ?? "";
  let next = { ...c };
  let msg = "";
  switch (action) {
    case "start":
      next = { ...c, running: true, paused: false };
      msg = "Bot encendido";
      break;
    case "stop":
      next = { ...c, running: false };
      msg = account?.position ? "Bot apagado. La posición abierta conserva su stop de protección." : "Bot apagado";
      break;
    case "pause":
      next = { ...c, paused: true };
      msg = "Nuevas operaciones en pausa (la posición abierta se sigue gestionando)";
      break;
    case "resume":
      next = { ...c, paused: false };
      msg = "Nuevas operaciones reanudadas";
      break;
    case "emergency": {
      const r = await emergencyStop(env);
      return json({ ok: true, message: r.message, done: r.done });
    }
    case "reset_halt": {
      if (!account?.halted) return json({ ok: false, message: "La operativa no está suspendida" }, 400);
      const market = await kvGet<Ticker>(env.DB, "market");
      const eqNow = market ? equityAt(account, market.last) : account.cash;
      const reset: AccountState = { ...account, halted: false, haltReason: null, peakEquity: eqNow, initialCapital: Math.min(account.initialCapital, eqNow) };
      await env.DB.batch([kvPut(env.DB, "account", reset), event(env.DB, "audit", "reset_halt", `El propietario reanuda tras revisar la suspensión (${account.haltReason}). Nuevo máximo de referencia: ${reset.peakEquity.toFixed(2)}`, { ip })]);
      return json({ ok: true, message: "Suspensión revisada y levantada. El límite de caída vuelve a medirse desde el capital actual." });
    }
    default:
      return json({ ok: false, message: "acción desconocida" }, 400);
  }
  if (action === "start") {
    const s = await loadStrategy(env);
    if (!s.approved) msg += " — sin estrategia aprobada: modo observación (no abrirá operaciones)";
  }
  await env.DB.batch([kvPut(env.DB, "controls", { ...next, liveApproved: false }), event(env.DB, "audit", `control_${action}`, msg, { ip })]);
  return json({ ok: true, message: msg, controls: await loadControls(env) });
}

async function api(req: Request, env: Env, url: URL, ctx: ExecutionContext): Promise<Response> {
  const path = url.pathname;
  const method = req.method;

  // Público mínimo: salud (sin datos financieros) para el vigilante externo.
  if (path === "/api/health") {
    const hb = await kvGet<Heartbeat>(env.DB, "heartbeat");
    const age = hb ? now() - hb.ts : null;
    const ok = !!hb && hb.ok && age !== null && age < HEARTBEAT_STALE;
    return json({ ok, heartbeatAgeSec: age }, ok ? 200 : 503);
  }

  if (path === "/api/login" && method === "POST") {
    if (!sameOrigin(req)) return json({ ok: false, message: "origen no permitido" }, 403);
    const ip = req.headers.get("cf-connecting-ip") ?? "local";
    if (await tooManyAttempts(env, ip)) return json({ ok: false, message: "Demasiados intentos. Espera 15 minutos." }, 429);
    if (!env.OWNER_PASSWORD_HASH) return json({ ok: false, message: "Contraseña del propietario no configurada" }, 503);
    const body = (await req.json().catch(() => ({}))) as { password?: string; code?: string };
    let ok = await verifyPassword(String(body.password ?? ""), env.OWNER_PASSWORD_HASH);
    if (ok && env.TOTP_SECRET) ok = await verifyTotp(env.TOTP_SECRET, String(body.code ?? ""));
    if (!ok) {
      await recordFailure(env, ip);
      await event(env.DB, "warn", "login_failed", "Intento de acceso fallido", { ip }).run();
      return json({ ok: false, message: "Credenciales incorrectas" }, 401);
    }
    const cookie = await createSession(env, req);
    await event(env.DB, "audit", "login", "Acceso del propietario", { ip }).run();
    return json({ ok: true }, 200, { "set-cookie": cookie });
  }
  if (path === "/api/auth-info") return json({ totp: !!env.TOTP_SECRET, configured: !!env.OWNER_PASSWORD_HASH, authenticated: await isAuthenticated(env, req) });

  // Endpoints de máquina (ciclo de aprendizaje en GitHub Actions)
  if (path === "/api/research" && method === "POST") {
    if (!(await bearerOk(req, env.RESEARCH_TOKEN))) return json({ ok: false }, 401);
    const p = (await req.json()) as ResearchPayload;
    if (!Array.isArray(p?.candidates)) return json({ ok: false, message: "formato inválido" }, 400);
    return json({ ok: true, ...(await ingestResearch(env, p)) });
  }
  if (path === "/api/research/export" && method === "GET") {
    if (!(await bearerOk(req, env.RESEARCH_TOKEN))) return json({ ok: false }, 401);
    return json(await exportForResearch(env));
  }

  // Todo lo demás requiere sesión del propietario.
  if (!(await isAuthenticated(env, req))) return json({ ok: false, message: "no autenticado" }, 401);
  if (method !== "GET" && !sameOrigin(req)) return json({ ok: false, message: "origen no permitido" }, 403);

  if (path === "/api/logout" && method === "POST") return json({ ok: true }, 200, { "set-cookie": await destroySession(env, req) });
  if (path === "/api/logout-all" && method === "POST") {
    await destroyAllSessions(env);
    return json({ ok: true }, 200, { "set-cookie": await destroySession(env, req) });
  }
  if (path === "/api/status") return json(await status(env));
  if (path === "/api/control" && method === "POST") {
    const body = (await req.json().catch(() => ({}))) as { action?: string };
    return control(env, String(body.action ?? ""), req);
  }
  if (path === "/api/tick" && method === "POST") {
    // Ejecución manual de un ciclo (útil tras encender): misma lógica que el cron.
    const r = await runTick(env);
    return json(r, r.ok ? 200 : 500);
  }
  if (path === "/api/trades") {
    const r = await env.DB.prepare("SELECT * FROM trades ORDER BY exit_ts DESC LIMIT 200").all();
    return json(r.results);
  }
  if (path.startsWith("/api/trades/")) {
    const id = decodeURIComponent(path.slice("/api/trades/".length));
    const trade = await env.DB.prepare("SELECT * FROM trades WHERE trade_id = ?").bind(id).first<{ entry_ts: number; exit_ts: number }>();
    const orders = await env.DB.prepare("SELECT * FROM orders WHERE trade_id = ? ORDER BY ts").bind(id).all();
    if (!trade) return json({ ok: false, message: "no encontrada" }, 404);
    const decisions = await env.DB.prepare("SELECT * FROM decisions WHERE ts BETWEEN ? AND ? ORDER BY ts").bind(trade.entry_ts - 7200, trade.exit_ts + 3600).all();
    const events = await env.DB.prepare("SELECT * FROM events WHERE ts BETWEEN ? AND ? AND type IN ('entry','exit','stop_update','risk_reject','emergency') ORDER BY ts").bind(trade.entry_ts - 3600, trade.exit_ts + 3600).all();
    return json({ trade, orders: orders.results, decisions: decisions.results, events: events.results });
  }
  if (path === "/api/decisions") {
    const r = await env.DB.prepare("SELECT * FROM decisions ORDER BY ts DESC, id DESC LIMIT 100").all();
    return json(r.results);
  }
  if (path === "/api/events") {
    const r = await env.DB.prepare("SELECT * FROM events ORDER BY ts DESC, id DESC LIMIT 200").all();
    return json(r.results);
  }
  if (path === "/api/equity") {
    const days = Math.min(Number(url.searchParams.get("days") ?? 90), 3650);
    const r = await env.DB.prepare("SELECT ts, equity, price FROM equity WHERE ts > ? ORDER BY ts").bind(now() - days * 86400).all();
    return json(r.results);
  }
  if (path === "/api/strategies") {
    const r = await env.DB.prepare("SELECT * FROM strategies ORDER BY CASE status WHEN 'active' THEN 0 WHEN 'approved' THEN 1 ELSE 2 END, oos_sharpe DESC LIMIT 100").all();
    const perf = await env.DB.prepare("SELECT strategy_id, COUNT(*) n, SUM(net) net, SUM(CASE WHEN net > 0 THEN 1 ELSE 0 END) wins FROM trades GROUP BY strategy_id").all();
    return json({ strategies: r.results, performance: perf.results });
  }
  if (path === "/api/learning") {
    const r = await env.DB.prepare("SELECT id, ts, kind, summary FROM learning ORDER BY ts DESC LIMIT 100").all();
    return json(r.results);
  }
  if (path === "/api/reports") {
    const r = await env.DB.prepare("SELECT month, created_at, data FROM reports ORDER BY month DESC LIMIT 36").all<{ month: string; created_at: number; data: string }>();
    return json((r.results ?? []).map((x) => ({ month: x.month, createdAt: x.created_at, ...JSON.parse(x.data) })));
  }
  if (path === "/api/reports/generate" && method === "POST") {
    const body = (await req.json().catch(() => ({}))) as { month?: string };
    const month = /^\d{4}-\d{2}$/.test(String(body.month)) ? String(body.month) : previousMonth();
    return json(await saveMonthlyReport(env, month));
  }
  if (path === "/api/limits" && method === "POST") {
    const body = (await req.json().catch(() => ({}))) as Partial<RiskLimits>;
    const account = await kvGet<AccountState>(env.DB, "account");
    const allowed: (keyof RiskLimits)[] = ["riskPerTrade", "maxLeverage", "maxDrawdown"];
    const patch: Partial<RiskLimits> = {};
    for (const k of allowed) if (body[k] !== undefined) (patch as Record<string, number>)[k] = Number(body[k]);
    const errs = checkConfigChange(!!account?.position, patch);
    if (Object.values(patch).some((v) => !(Number(v) > 0))) errs.push("valores inválidos");
    if (errs.length) return json({ ok: false, message: errs.join("; ") }, 400);
    const current = (await kvGet<Partial<RiskLimits>>(env.DB, "limits")) ?? {};
    await env.DB.batch([kvPut(env.DB, "limits", { ...current, ...patch }), event(env.DB, "audit", "limits", `Límites de riesgo actualizados: ${JSON.stringify(patch)}`)]);
    return json({ ok: true, limits: effectiveLimits(await loadLimits(env)) });
  }
  return json({ ok: false, message: "no encontrado" }, 404);
}

export default {
  async fetch(req: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(req.url);
    if (url.pathname.startsWith("/api/")) {
      try {
        await seedStrategy(env);
        return await api(req, env, url, ctx);
      } catch (e) {
        return json({ ok: false, message: `error interno: ${(e as Error).message}` }, 500);
      }
    }
    const res = await env.ASSETS.fetch(req);
    const h = new Headers(res.headers);
    for (const [k, v] of Object.entries(SECURITY_HEADERS)) h.set(k, v);
    return new Response(res.body, { status: res.status, headers: h });
  },

  async scheduled(controller: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
    await seedStrategy(env);
    if (controller.cron === "7 6 1 * *") {
      await saveMonthlyReport(env, previousMonth());
      return;
    }
    await runTick(env);
  },
};
