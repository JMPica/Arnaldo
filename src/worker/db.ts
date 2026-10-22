import type { AccountState, Controls, EngineEvent } from "../core/engine";
import type { Candle, RiskLimits, StrategyConfig, Timeframe } from "../core/types";
import { DEFAULT_LIMITS } from "../core/types";

export interface Env {
  DB: D1Database;
  ASSETS: Fetcher;
  SYMBOL: string;
  INITIAL_CAPITAL_EUR: string;
  OWNER_PASSWORD_HASH?: string; // pbkdf2:iteraciones:sal:hash
  TOTP_SECRET?: string; // base32, opcional
  RESEARCH_TOKEN?: string; // token del ciclo de aprendizaje (GitHub Actions)
  LIVE_TRADING_APPROVED?: string; // debe valer exactamente "SI-APRUEBO-DINERO-REAL"
  TELEGRAM_BOT_TOKEN?: string;
  TELEGRAM_CHAT_ID?: string;
  KRAKEN_BASE?: string; // solo para pruebas (servidor simulado)
  KRAKEN_SPOT_BASE?: string;
}

export interface Heartbeat {
  ts: number;
  ok: boolean;
  price?: number;
  error?: string;
  durationMs?: number;
}

export interface EngineMeta {
  eurusd: number;
  eurusdTs: number;
  startedAt: number;
  ticks: number;
  errors: number;
}

export const now = () => Math.floor(Date.now() / 1000);

export async function kvGet<T>(db: D1Database, key: string): Promise<T | null> {
  const r = await db.prepare("SELECT value FROM kv WHERE key = ?").bind(key).first<{ value: string }>();
  return r ? (JSON.parse(r.value) as T) : null;
}

export function kvPut(db: D1Database, key: string, value: unknown): D1PreparedStatement {
  return db
    .prepare("INSERT INTO kv (key, value, updated_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at")
    .bind(key, JSON.stringify(value), now());
}

export const DEFAULT_CONTROLS: Controls = { running: false, paused: false, mode: "paper", liveApproved: false };

export async function loadControls(env: Env): Promise<Controls> {
  const c = (await kvGet<Controls>(env.DB, "controls")) ?? DEFAULT_CONTROLS;
  // La aprobación de dinero real solo puede venir de un secreto de despliegue,
  // nunca del panel.
  return { ...c, liveApproved: c.mode === "live" && env.LIVE_TRADING_APPROVED === "SI-APRUEBO-DINERO-REAL" };
}

export async function loadLimits(env: Env): Promise<RiskLimits> {
  return { ...DEFAULT_LIMITS, ...((await kvGet<Partial<RiskLimits>>(env.DB, "limits")) ?? {}) };
}

export async function loadStrategy(env: Env): Promise<{ config: StrategyConfig | null; approved: boolean }> {
  const s = await kvGet<{ config: StrategyConfig | null; approved: boolean }>(env.DB, "strategy");
  return s ?? { config: null, approved: false };
}

export function event(db: D1Database, level: "info" | "warn" | "error" | "audit", type: string, message: string, data?: unknown, ts = now()): D1PreparedStatement {
  return db.prepare("INSERT INTO events (ts, level, type, message, data) VALUES (?, ?, ?, ?, ?)").bind(ts, level, type, message, data === undefined ? null : JSON.stringify(data));
}

export function upsertBar(db: D1Database, tf: Timeframe, c: Candle): D1PreparedStatement {
  return db
    .prepare("INSERT INTO bars (tf, ts, open, high, low, close, volume) VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT(tf, ts) DO UPDATE SET open=excluded.open, high=excluded.high, low=excluded.low, close=excluded.close, volume=excluded.volume")
    .bind(tf, c.ts, c.open, c.high, c.low, c.close, c.volume);
}

export async function lastBars(db: D1Database, tf: Timeframe, uptoTs: number, n: number): Promise<Candle[]> {
  const r = await db.prepare("SELECT ts, open, high, low, close, volume FROM bars WHERE tf = ? AND ts <= ? ORDER BY ts DESC LIMIT ?").bind(tf, uptoTs, n).all<Candle>();
  return (r.results ?? []).reverse();
}

// Convierte los eventos del motor en sentencias de persistencia.
export function persistEvents(db: D1Database, events: EngineEvent[], mode: string): D1PreparedStatement[] {
  const st: D1PreparedStatement[] = [];
  for (const e of events) {
    switch (e.type) {
      case "decision":
        st.push(
          db
            .prepare("INSERT INTO decisions (ts, strategy_id, action, acted, reason, note, features) VALUES (?, ?, ?, ?, ?, ?, ?)")
            .bind(e.ts, e.strategyId, e.signal.action, e.acted ? 1 : 0, e.signal.reason, e.note ?? null, e.signal.features ? JSON.stringify(e.signal.features) : null),
        );
        break;
      case "fill": {
        const f = e.fill;
        st.push(
          db
            .prepare("INSERT OR IGNORE INTO orders (id, trade_id, ts, kind, side, qty, price, fee, status, reason, mode) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'filled', ?, ?)")
            .bind(`${f.tradeId}-${f.kind}`, f.tradeId, f.ts, f.kind, f.side, f.qty, f.price, f.fee, f.reason, mode),
        );
        st.push(event(db, "info", f.kind === "entry" ? "entry" : "exit", `${f.kind === "entry" ? "Entrada" : "Salida"} ${f.side} ${f.qty} BTC a ${f.price.toFixed(1)} — ${f.reason}`, f, f.ts));
        break;
      }
      case "trade_closed": {
        const t = e.trade;
        st.push(
          db
            .prepare(
              "INSERT OR IGNORE INTO trades (trade_id, strategy_id, side, qty, entry_price, exit_price, entry_ts, exit_ts, gross, fees, funding, net, r_multiple, return_on_equity, entry_reason, exit_reason, mode) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            )
            .bind(t.tradeId, t.strategyId, t.side, t.qty, t.entryPrice, t.exitPrice, t.entryTs, t.exitTs, t.grossPnl, t.fees, t.funding, t.netPnl, t.rMultiple, t.returnOnEquity, t.entryReason, t.exitReason, mode),
        );
        break;
      }
      case "risk_reject":
        st.push(event(db, "warn", "risk_reject", `Orden rechazada por el motor de riesgo: ${e.reasons.join("; ")}`, e, e.ts));
        break;
      case "halt":
        st.push(event(db, "warn", "halt", `Nuevas operaciones suspendidas: ${e.reason}`, e, e.ts));
        break;
      case "stop_update":
        st.push(event(db, "info", "stop_update", `Stop ajustado de ${e.from.toFixed(1)} a ${e.to.toFixed(1)}`, e, e.ts));
        break;
    }
  }
  return st;
}

export function initialAccountCapitalUsd(env: Env, eurusd: number): number {
  return Number(env.INITIAL_CAPITAL_EUR || "400") * eurusd;
}

export type { AccountState };
