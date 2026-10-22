import { kvGet, now, type Env, type EngineMeta } from "./db";
import type { AccountState } from "../core/engine";

// Informe mensual automático. Se genera el día 1 de cada mes para el mes
// anterior y queda guardado en la base de datos (visible en el panel).

export interface MonthlyReport {
  month: string;
  generatedAt: number;
  mode: string;
  startEquity: number | null;
  endEquity: number | null;
  pnl: number | null;
  pnlPct: number | null;
  maxDrawdown: number;
  trades: number;
  wins: number;
  winRate: number;
  grossPnl: number;
  fees: number;
  funding: number;
  netPnl: number;
  bestTrade: { id: string; net: number } | null;
  worstTrade: { id: string; net: number } | null;
  riskRejections: number;
  halts: number;
  errors: number;
  uptimePct: number;
  strategyChanges: string[];
  learningEvents: number;
  btcStart: number | null;
  btcEnd: number | null;
  btcChangePct: number | null;
  eurusd: number;
  notes: string[];
}

export function monthBounds(month: string): [number, number] {
  const [y, m] = month.split("-").map(Number);
  return [Date.UTC(y, m - 1, 1) / 1000, Date.UTC(y, m, 1) / 1000];
}

export function previousMonth(t = now()): string {
  const d = new Date(t * 1000);
  const p = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - 1, 1));
  return `${p.getUTCFullYear()}-${String(p.getUTCMonth() + 1).padStart(2, "0")}`;
}

export async function buildMonthlyReport(env: Env, month: string): Promise<MonthlyReport> {
  const [a, b] = monthBounds(month);
  const db = env.DB;
  const [eq, trades, rejects, halts, errors, ticks, promotions, learning, meta, account] = await Promise.all([
    db.prepare("SELECT ts, equity, price FROM equity WHERE ts >= ? AND ts <= ? ORDER BY ts").bind(a, b).all<{ ts: number; equity: number; price: number }>(),
    db.prepare("SELECT trade_id, gross, fees, funding, net FROM trades WHERE exit_ts >= ? AND exit_ts < ?").bind(a, b).all<{ trade_id: string; gross: number; fees: number; funding: number; net: number }>(),
    db.prepare("SELECT COUNT(*) n FROM events WHERE type = 'risk_reject' AND ts >= ? AND ts < ?").bind(a, b).first<{ n: number }>(),
    db.prepare("SELECT COUNT(*) n FROM events WHERE type = 'halt' AND ts >= ? AND ts < ?").bind(a, b).first<{ n: number }>(),
    db.prepare("SELECT COUNT(*) n FROM events WHERE level = 'error' AND ts >= ? AND ts < ?").bind(a, b).first<{ n: number }>(),
    db.prepare("SELECT COUNT(*) n FROM equity WHERE ts > ? AND ts <= ?").bind(a, b).first<{ n: number }>(),
    db.prepare("SELECT summary FROM learning WHERE kind = 'promotion' AND ts >= ? AND ts < ?").bind(a, b).all<{ summary: string }>(),
    db.prepare("SELECT COUNT(*) n FROM learning WHERE ts >= ? AND ts < ?").bind(a, b).first<{ n: number }>(),
    kvGet<EngineMeta>(db, "meta"),
    kvGet<AccountState>(db, "account"),
  ]);
  const rows = eq.results ?? [];
  const tr = trades.results ?? [];
  let peak = -Infinity;
  let mdd = 0;
  for (const r of rows) {
    peak = Math.max(peak, r.equity);
    mdd = Math.max(mdd, 1 - r.equity / peak);
  }
  const startEquity = rows[0]?.equity ?? null;
  const endEquity = rows.at(-1)?.equity ?? null;
  const sorted = [...tr].sort((x, y) => x.net - y.net);
  const hoursInMonth = (b - a) / 3600;
  const startedAt = meta?.startedAt ?? a;
  const expectedHours = Math.max(1, (b - Math.max(a, startedAt)) / 3600);
  const notes: string[] = [];
  if (!rows.length) notes.push("Sin datos de capital en el periodo (el motor no estaba en marcha).");
  if ((halts?.n ?? 0) > 0) notes.push("Se activó la suspensión por caída acumulada: requiere revisión del propietario.");
  if (account?.halted) notes.push(`La operativa sigue suspendida: ${account.haltReason}`);
  return {
    month,
    generatedAt: now(),
    mode: "paper",
    startEquity,
    endEquity,
    pnl: startEquity !== null && endEquity !== null ? endEquity - startEquity : null,
    pnlPct: startEquity && endEquity !== null ? endEquity / startEquity - 1 : null,
    maxDrawdown: mdd,
    trades: tr.length,
    wins: tr.filter((t) => t.net > 0).length,
    winRate: tr.length ? tr.filter((t) => t.net > 0).length / tr.length : 0,
    grossPnl: tr.reduce((s, t) => s + t.gross, 0),
    fees: tr.reduce((s, t) => s + t.fees, 0),
    funding: tr.reduce((s, t) => s + t.funding, 0),
    netPnl: tr.reduce((s, t) => s + t.net, 0),
    bestTrade: sorted.length ? { id: sorted.at(-1)!.trade_id, net: sorted.at(-1)!.net } : null,
    worstTrade: sorted.length ? { id: sorted[0].trade_id, net: sorted[0].net } : null,
    riskRejections: rejects?.n ?? 0,
    halts: halts?.n ?? 0,
    errors: errors?.n ?? 0,
    uptimePct: Math.min(1, (ticks?.n ?? 0) / Math.min(hoursInMonth, expectedHours)),
    strategyChanges: (promotions.results ?? []).map((p) => p.summary),
    learningEvents: learning?.n ?? 0,
    btcStart: rows[0]?.price ?? null,
    btcEnd: rows.at(-1)?.price ?? null,
    btcChangePct: rows.length ? rows.at(-1)!.price / rows[0].price - 1 : null,
    eurusd: meta?.eurusd ?? 1.16,
    notes,
  };
}

export async function saveMonthlyReport(env: Env, month: string): Promise<MonthlyReport> {
  const r = await buildMonthlyReport(env, month);
  await env.DB.prepare("INSERT INTO reports (month, created_at, data) VALUES (?, ?, ?) ON CONFLICT(month) DO UPDATE SET created_at = excluded.created_at, data = excluded.data")
    .bind(month, r.generatedAt, JSON.stringify(r))
    .run();
  return r;
}
