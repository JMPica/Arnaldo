import type { Candle, ClosedTrade, CostModel, Fill, Position, RiskLimits, Side, Signal, StrategyConfig } from "./types";
import { getStrategy } from "./strategies";
import { checkEntry, drawdownBreach, positionSize } from "./risk";

// Máquina de estados de trading. La misma función processHour() se usa en:
//  - el backtest (research/), alimentada con velas históricas, y
//  - el motor real (src/worker/), alimentada con velas del exchange.
// Garantiza que lo que se prueba es exactamente lo que se ejecuta.

export interface AccountState {
  initialCapital: number;
  cash: number; // colateral realizado: incluye P&L cerrado, comisiones y funding
  peakEquity: number;
  position: Position | null;
  halted: boolean;
  haltReason: string | null;
  lastHourTs: number; // última vela de 1h procesada
  orderDay: number;
  ordersToday: number;
  tradeSeq: number;
  feesPaid: number;
  fundingPaid: number;
}

export interface Controls {
  running: boolean; // bot encendido
  paused: boolean; // sin nuevas entradas
  mode: "paper" | "live";
  liveApproved: boolean;
}

export type EngineEvent =
  | { type: "decision"; ts: number; strategyId: string; signal: Signal; acted: boolean; note?: string }
  | { type: "fill"; fill: Fill }
  | { type: "trade_closed"; trade: ClosedTrade }
  | { type: "risk_reject"; ts: number; reasons: string[]; side: Side; qty: number; price: number }
  | { type: "stop_update"; ts: number; from: number; to: number }
  | { type: "halt"; ts: number; reason: string }
  | { type: "skip"; ts: number; reason: string };

export function newAccount(initialCapital: number): AccountState {
  return {
    initialCapital,
    cash: initialCapital,
    peakEquity: initialCapital,
    position: null,
    halted: false,
    haltReason: null,
    lastHourTs: 0,
    orderDay: 0,
    ordersToday: 0,
    tradeSeq: 0,
    feesPaid: 0,
    fundingPaid: 0,
  };
}

export function unrealized(pos: Position | null, price: number): number {
  if (!pos) return 0;
  return (pos.side === "long" ? price - pos.entryPrice : pos.entryPrice - price) * pos.qty;
}

export function equityAt(s: AccountState, price: number): number {
  return s.cash + unrealized(s.position, price);
}

function countOrder(s: AccountState, ts: number) {
  const day = Math.floor(ts / 86400);
  if (day !== s.orderDay) {
    s.orderDay = day;
    s.ordersToday = 0;
  }
  s.ordersToday++;
}

export function closePosition(s: AccountState, rawPrice: number, ts: number, reason: string, costs: CostModel, slipMult = 1): EngineEvent[] {
  const pos = s.position;
  if (!pos) return [];
  const dir = pos.side === "long" ? 1 : -1;
  const price = rawPrice * (1 - dir * costs.slippage * slipMult);
  const fee = pos.qty * price * costs.takerFee;
  const gross = dir * (price - pos.entryPrice) * pos.qty;
  s.cash += gross - fee;
  s.feesPaid += fee;
  countOrder(s, ts);
  const equityAtEntry = s.cash - gross + fee + pos.entryFee + pos.fundingPaid; // reconstruye equity previa a la operación
  const initialRisk = Math.abs(pos.entryPrice - pos.initialStop) * pos.qty;
  const net = gross - fee - pos.entryFee - pos.fundingPaid;
  const trade: ClosedTrade = {
    tradeId: pos.tradeId,
    strategyId: pos.strategyId,
    side: pos.side,
    qty: pos.qty,
    entryPrice: pos.entryPrice,
    exitPrice: price,
    entryTs: pos.entryTs,
    exitTs: ts,
    grossPnl: gross,
    fees: fee + pos.entryFee,
    funding: pos.fundingPaid,
    netPnl: net,
    returnOnEquity: equityAtEntry > 0 ? net / equityAtEntry : 0,
    rMultiple: initialRisk > 0 ? net / initialRisk : 0,
    exitReason: reason,
    entryReason: (pos as Position & { entryReason?: string }).entryReason ?? "",
  };
  s.position = null;
  return [
    { type: "fill", fill: { tradeId: pos.tradeId, kind: "exit", reason, side: pos.side, qty: pos.qty, price, fee, ts } },
    { type: "trade_closed", trade },
  ];
}

function openPosition(s: AccountState, side: Side, qty: number, rawPrice: number, stop: number, ts: number, cfg: StrategyConfig, reason: string, costs: CostModel): EngineEvent[] {
  const dir = side === "long" ? 1 : -1;
  const price = rawPrice * (1 + dir * costs.slippage);
  const fee = qty * price * costs.takerFee;
  s.cash -= fee;
  s.feesPaid += fee;
  s.tradeSeq++;
  countOrder(s, ts);
  const tradeId = `T${ts}-${s.tradeSeq}`;
  const pos: Position & { entryReason: string } = {
    side,
    qty,
    entryPrice: price,
    entryTs: ts,
    stop,
    initialStop: stop,
    strategyId: cfg.id,
    barsHeld: 0,
    highestClose: price,
    lowestClose: price,
    entryFee: fee,
    fundingPaid: 0,
    tradeId,
    entryReason: reason,
  };
  s.position = pos;
  return [{ type: "fill", fill: { tradeId, kind: "entry", reason, side, qty, price, fee, ts } }];
}

export interface HourInput {
  bar: Candle; // vela de 1h recién cerrada
  strategyBars: Candle[] | null; // ventana de velas del timeframe si esta hora cierra una; si no, null
  execPrice: number | null; // precio al que se ejecutaría una orden ahora (apertura siguiente / precio vivo)
  execTs: number;
  referencePrice: number; // precio de referencia independiente para la validación de riesgo
  dataAgeSec: number;
  fundingRate: number; // tasa de funding de esta hora (fracción del nocional; >0 pagan los largos)
}

export function processHour(
  state: AccountState,
  input: HourInput,
  cfg: StrategyConfig,
  controls: Controls,
  limits: RiskLimits,
  costs: CostModel,
): { state: AccountState; events: EngineEvent[] } {
  const s: AccountState = structuredClone(state);
  const events: EngineEvent[] = [];
  const { bar } = input;
  if (bar.ts <= s.lastHourTs) return { state: s, events: [{ type: "skip", ts: bar.ts, reason: "vela ya procesada" }] };
  s.lastHourTs = bar.ts;
  const closeTs = bar.ts + 3600;

  // 1) Stop de protección: se evalúa contra el rango de la vela. Si hay hueco
  //    se ejecuta al precio de apertura (peor que el stop).
  if (s.position) {
    const p = s.position;
    if (p.side === "long" && bar.low <= p.stop) {
      events.push(...closePosition(s, Math.min(p.stop, bar.open), closeTs, "stop de protección", costs));
    } else if (p.side === "short" && bar.high >= p.stop) {
      events.push(...closePosition(s, Math.max(p.stop, bar.open), closeTs, "stop de protección", costs));
    }
  }

  // 2) Funding horario de la posición abierta.
  if (s.position) {
    const p = s.position;
    const f = (p.side === "long" ? 1 : -1) * input.fundingRate * p.qty * bar.close;
    s.cash -= f;
    p.fundingPaid += f;
    s.fundingPaid += f;
    p.highestClose = Math.max(p.highestClose, bar.close);
    p.lowestClose = Math.min(p.lowestClose, bar.close);
  }

  // 3) Control de caída acumulada (al cierre de cada hora).
  const eq = equityAt(s, bar.close);
  s.peakEquity = Math.max(s.peakEquity, eq);
  if (!s.halted) {
    const breach = drawdownBreach(eq, s.peakEquity, s.initialCapital, limits);
    if (breach) {
      s.halted = true;
      s.haltReason = breach;
      events.push({ type: "halt", ts: closeTs, reason: breach });
    }
  }

  // 4) Decisión de la estrategia al cierre de su vela.
  if (!input.strategyBars || !controls.running) return { state: s, events };
  const strat = getStrategy(cfg);
  if (input.strategyBars.length < strat.warmup(cfg.params)) {
    events.push({ type: "skip", ts: closeTs, reason: "historial insuficiente" });
    return { state: s, events };
  }
  if (s.position) s.position.barsHeld++;
  const signal = strat.decide({ bars: input.strategyBars, position: s.position, params: cfg.params });
  const canExec = input.execPrice !== null && input.execPrice > 0;

  if (s.position) {
    if (signal.action === "exit" || (signal.action === "enter_long" && s.position.side === "short") || (signal.action === "enter_short" && s.position.side === "long")) {
      if (canExec) {
        events.push({ type: "decision", ts: closeTs, strategyId: cfg.id, signal, acted: true });
        events.push(...closePosition(s, input.execPrice!, input.execTs, signal.reason, costs));
      } else events.push({ type: "decision", ts: closeTs, strategyId: cfg.id, signal, acted: false, note: "sin precio de ejecución" });
      return { state: s, events };
    }
    if (signal.action === "hold" && signal.stop !== undefined && Number.isFinite(signal.stop)) {
      const p = s.position;
      const better = p.side === "long" ? signal.stop > p.stop : signal.stop < p.stop;
      if (better) {
        events.push({ type: "stop_update", ts: closeTs, from: p.stop, to: signal.stop });
        p.stop = signal.stop;
      }
    }
    events.push({ type: "decision", ts: closeTs, strategyId: cfg.id, signal, acted: false });
    return { state: s, events };
  }

  if (signal.action !== "enter_long" && signal.action !== "enter_short") {
    events.push({ type: "decision", ts: closeTs, strategyId: cfg.id, signal, acted: false });
    return { state: s, events };
  }
  if (!canExec) {
    events.push({ type: "decision", ts: closeTs, strategyId: cfg.id, signal, acted: false, note: "sin precio de ejecución" });
    return { state: s, events };
  }

  const side: Side = signal.action === "enter_long" ? "long" : "short";
  const px = input.execPrice!;
  // El stop se traslada al precio de ejecución conservando la distancia propuesta.
  const dist = signal.stop !== undefined ? Math.abs(bar.close - signal.stop) : NaN;
  const stop = side === "long" ? px - dist : px + dist;
  const equity = equityAt(s, px);
  const size = positionSize(equity, px, stop, limits, costs);
  const day = Math.floor(input.execTs / 86400);
  const verdict = checkEntry(
    {
      side,
      qty: size.qty,
      price: px,
      referencePrice: input.referencePrice,
      stop,
      equity,
      peakEquity: s.peakEquity,
      initialCapital: s.initialCapital,
      openPositions: 0,
      ordersToday: day === s.orderDay ? s.ordersToday : 0,
      dataAgeSec: input.dataAgeSec,
      halted: s.halted,
      running: controls.running,
      paused: controls.paused,
      mode: controls.mode,
      liveApproved: controls.liveApproved,
    },
    limits,
    costs,
  );
  if (!verdict.ok) {
    events.push({ type: "decision", ts: closeTs, strategyId: cfg.id, signal, acted: false, note: verdict.reasons.join("; ") });
    events.push({ type: "risk_reject", ts: closeTs, reasons: verdict.reasons, side, qty: size.qty, price: px });
    return { state: s, events };
  }
  events.push({ type: "decision", ts: closeTs, strategyId: cfg.id, signal, acted: true, note: `tamaño ${size.qty} BTC, ${size.leverage.toFixed(2)}x, riesgo ${(verdict.riskPct * 100).toFixed(2)} %` });
  events.push(...openPosition(s, side, size.qty, px, stop, input.execTs, cfg, signal.reason, costs));
  return { state: s, events };
}
