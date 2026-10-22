import type { CostModel, RiskLimits, Side } from "./types";

// Motor de riesgo independiente.
// No confía en ningún número calculado por la estrategia ni por el ejecutor:
// recalcula apalancamiento, riesgo hasta el stop y estado de la cuenta a partir
// de los datos crudos y rechaza cualquier orden que incumpla un límite duro.
// Los límites máximos absolutos (HARD_CAPS) no se pueden superar ni siquiera
// cambiando la configuración.
// Interés compuesto: el tamaño se calcula siempre sobre el capital vigente, de
// modo que las ganancias se reinvierten solas (y tras pérdidas el tamaño baja).

export const HARD_CAPS = Object.freeze({
  maxLeverage: 2,
  riskPerTrade: 0.02,
  maxPositions: 1,
  maxDrawdown: 0.2,
});

export function effectiveLimits(l: RiskLimits): RiskLimits {
  return {
    ...l,
    maxLeverage: Math.min(l.maxLeverage, HARD_CAPS.maxLeverage),
    riskPerTrade: Math.min(l.riskPerTrade, HARD_CAPS.riskPerTrade),
    maxPositions: Math.min(l.maxPositions, HARD_CAPS.maxPositions),
    maxDrawdown: Math.min(l.maxDrawdown, HARD_CAPS.maxDrawdown),
  };
}

export function roundDownToStep(qty: number, step: number): number {
  const n = Math.floor(qty / step + 1e-9);
  return +(n * step).toFixed(10);
}

// Pérdida por unidad si salta el stop, incluyendo comisiones y deslizamiento
// de entrada y salida.
export function lossPerUnit(price: number, stop: number, costs: CostModel): number {
  return Math.abs(price - stop) + price * 2 * (costs.takerFee + costs.slippage);
}

export interface SizeResult {
  qty: number;
  riskAmount: number;
  notional: number;
  leverage: number;
  limitedBy: "risk" | "leverage";
}

export function positionSize(equity: number, price: number, stop: number, limits: RiskLimits, costs: CostModel): SizeResult {
  const L = effectiveLimits(limits);
  const byRisk = (equity * L.riskPerTrade) / lossPerUnit(price, stop, costs);
  const byLev = (equity * L.maxLeverage) / price;
  const raw = Math.min(byRisk, byLev);
  const qty = roundDownToStep(raw * 0.999, L.lotStep); // margen para redondeos
  return {
    qty,
    riskAmount: qty * lossPerUnit(price, stop, costs),
    notional: qty * price,
    leverage: equity > 0 ? (qty * price) / equity : Infinity,
    limitedBy: byRisk <= byLev ? "risk" : "leverage",
  };
}

export interface EntryCheckInput {
  side: Side;
  qty: number;
  price: number; // precio de referencia de ejecución
  referencePrice: number; // último precio de mercado independiente
  stop: number | undefined;
  equity: number;
  peakEquity: number;
  initialCapital: number;
  openPositions: number;
  ordersToday: number;
  dataAgeSec: number;
  halted: boolean;
  running: boolean;
  paused: boolean;
  mode: "paper" | "live";
  liveApproved: boolean;
}

export interface RiskVerdict {
  ok: boolean;
  reasons: string[];
  leverage: number;
  riskPct: number;
}

export function checkEntry(i: EntryCheckInput, limits: RiskLimits, costs: CostModel): RiskVerdict {
  const L = effectiveLimits(limits);
  const reasons: string[] = [];
  const notional = i.qty * i.price;
  const leverage = i.equity > 0 ? notional / i.equity : Infinity;
  const riskPct = i.stop === undefined || i.equity <= 0 ? Infinity : (i.qty * lossPerUnit(i.price, i.stop, costs)) / i.equity;

  if (!i.running) reasons.push("el bot está apagado");
  if (i.paused) reasons.push("nuevas operaciones en pausa");
  if (i.halted) reasons.push("operativa suspendida por el límite de caída");
  if (i.mode === "live" && !i.liveApproved) reasons.push("modo real sin aprobación expresa del propietario");
  if (!(i.qty > 0) || !Number.isFinite(i.qty)) reasons.push("tamaño inválido");
  if (i.qty < L.minLot) reasons.push(`tamaño ${i.qty} menor que el mínimo ${L.minLot}`);
  if (i.openPositions >= L.maxPositions) reasons.push("ya hay una posición abierta");
  if (i.stop === undefined || !Number.isFinite(i.stop)) reasons.push("orden sin stop de protección");
  else if (i.side === "long" ? i.stop >= i.price : i.stop <= i.price) reasons.push("stop en el lado equivocado del precio");
  if (leverage > L.maxLeverage + 1e-9) reasons.push(`apalancamiento ${leverage.toFixed(2)}x > ${L.maxLeverage}x`);
  if (riskPct > L.riskPerTrade * 1.001) reasons.push(`riesgo ${(riskPct * 100).toFixed(2)} % > ${(L.riskPerTrade * 100).toFixed(2)} %`);
  if (i.equity <= i.initialCapital * (1 - L.maxDrawdown) + 1e-9) reasons.push("capital por debajo del límite de caída sobre el inicial");
  if (i.peakEquity > 0 && i.equity <= i.peakEquity * (1 - L.maxDrawdown) + 1e-9) reasons.push("caída desde máximos ≥ límite");
  if (i.ordersToday >= L.maxOrdersPerDay) reasons.push("límite diario de órdenes alcanzado");
  if (i.dataAgeSec > L.maxDataAgeSec) reasons.push(`datos de mercado desactualizados (${Math.round(i.dataAgeSec / 60)} min)`);
  if (!(i.referencePrice > 0) || Math.abs(i.price / i.referencePrice - 1) > L.maxPriceDeviation) reasons.push("precio fuera del rango de referencia");

  return { ok: reasons.length === 0, reasons, leverage, riskPct };
}

// Comprobación de caída acumulada. Devuelve el motivo si hay que suspender.
export function drawdownBreach(equity: number, peak: number, initial: number, limits: RiskLimits): string | null {
  const L = effectiveLimits(limits);
  if (equity <= initial * (1 - L.maxDrawdown)) return `capital ${equity.toFixed(2)} ≤ ${(100 * (1 - L.maxDrawdown)).toFixed(0)} % del inicial`;
  if (equity <= peak * (1 - L.maxDrawdown)) return `caída del ${((1 - equity / peak) * 100).toFixed(1)} % desde máximos`;
  return null;
}

// Validación de cambios de configuración: nunca durante una operación abierta
// y nunca por encima de los topes duros.
export function checkConfigChange(hasOpenPosition: boolean, next: Partial<RiskLimits>): string[] {
  const errs: string[] = [];
  if (hasOpenPosition) errs.push("no se pueden cambiar parámetros de riesgo con una posición abierta");
  if (next.maxLeverage !== undefined && next.maxLeverage > HARD_CAPS.maxLeverage) errs.push("apalancamiento por encima del tope");
  if (next.riskPerTrade !== undefined && next.riskPerTrade > HARD_CAPS.riskPerTrade) errs.push("riesgo por operación por encima del tope");
  if (next.maxPositions !== undefined && next.maxPositions > HARD_CAPS.maxPositions) errs.push("más posiciones que el tope");
  if (next.maxDrawdown !== undefined && next.maxDrawdown > HARD_CAPS.maxDrawdown) errs.push("límite de caída por encima del tope");
  return errs;
}
