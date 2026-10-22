import type { ClosedTrade } from "./types";

export interface Metrics {
  totalReturn: number;
  cagr: number;
  annVol: number;
  sharpe: number;
  sortino: number;
  maxDrawdown: number;
  calmar: number;
  trades: number;
  winRate: number;
  profitFactor: number;
  avgTradeReturn: number;
  avgR: number;
  years: number;
}

export function dailyReturns(daily: { equity: number }[]): number[] {
  const r: number[] = [];
  for (let i = 1; i < daily.length; i++) r.push(daily[i].equity / daily[i - 1].equity - 1);
  return r;
}

export function mean(a: number[]): number {
  return a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0;
}

export function std(a: number[]): number {
  if (a.length < 2) return 0;
  const m = mean(a);
  return Math.sqrt(a.reduce((s, x) => s + (x - m) ** 2, 0) / (a.length - 1));
}

export function maxDrawdown(equity: number[]): number {
  let peak = -Infinity;
  let mdd = 0;
  for (const e of equity) {
    peak = Math.max(peak, e);
    mdd = Math.max(mdd, 1 - e / peak);
  }
  return mdd;
}

// Los periodos por año se deducen de las fechas (cripto cotiza 365 días; las
// materias primas ~6 días por semana en los datos de OANDA).
export function computeMetrics(daily: { ts: number; equity: number }[], trades: ClosedTrade[]): Metrics {
  const rets = dailyReturns(daily);
  const first = daily[0]?.equity ?? 1;
  const lastE = daily.at(-1)?.equity ?? 1;
  const span = daily.length > 1 ? daily.at(-1)!.ts - daily[0].ts : 86400;
  const years = Math.max(span, 86400) / (365.25 * 86400);
  const periodsPerYear = Math.max(rets.length, 1) / years;
  const totalReturn = lastE / first - 1;
  const cagr = lastE > 0 ? (lastE / first) ** (1 / years) - 1 : -1;
  const sd = std(rets);
  const downside = Math.sqrt(mean(rets.map((r) => Math.min(r, 0) ** 2)));
  const sharpe = sd > 0 ? (mean(rets) / sd) * Math.sqrt(periodsPerYear) : 0;
  const sortino = downside > 0 ? (mean(rets) / downside) * Math.sqrt(periodsPerYear) : 0;
  const mdd = maxDrawdown(daily.map((d) => d.equity));
  const wins = trades.filter((t) => t.netPnl > 0);
  const grossWin = wins.reduce((s, t) => s + t.netPnl, 0);
  const grossLoss = -trades.filter((t) => t.netPnl <= 0).reduce((s, t) => s + t.netPnl, 0);
  return {
    totalReturn,
    cagr,
    annVol: sd * Math.sqrt(periodsPerYear),
    sharpe,
    sortino,
    maxDrawdown: mdd,
    calmar: mdd > 0 ? cagr / mdd : 0,
    trades: trades.length,
    winRate: trades.length ? wins.length / trades.length : 0,
    profitFactor: grossLoss > 0 ? grossWin / grossLoss : grossWin > 0 ? Infinity : 0,
    avgTradeReturn: mean(trades.map((t) => t.returnOnEquity)),
    avgR: mean(trades.map((t) => t.rMultiple)),
    years,
  };
}

// Generador pseudoaleatorio con semilla (mulberry32) para resultados reproducibles.
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface MonteCarloResult {
  runs: number;
  medianReturn: number;
  p5Return: number;
  p95Return: number;
  medianMaxDD: number;
  p95MaxDD: number;
  probLoss: number;
  probDD20: number; // probabilidad de tocar el límite de caída del 20 %
}

function pct(a: number[], q: number): number {
  const s = [...a].sort((x, y) => x - y);
  return s[Math.min(s.length - 1, Math.max(0, Math.floor(q * (s.length - 1))))];
}

// Remuestreo por bloques de rendimientos diarios (conserva la autocorrelación
// de corto plazo) sobre un horizonte dado.
export function monteCarloBlock(rets: number[], horizon: number, runs = 2000, block = 10, seed = 42): MonteCarloResult {
  const rand = rng(seed);
  const finals: number[] = [];
  const dds: number[] = [];
  if (rets.length < block) return { runs: 0, medianReturn: 0, p5Return: 0, p95Return: 0, medianMaxDD: 0, p95MaxDD: 0, probLoss: 0, probDD20: 0 };
  for (let r = 0; r < runs; r++) {
    let e = 1;
    let peak = 1;
    let mdd = 0;
    let n = 0;
    while (n < horizon) {
      const start = Math.floor(rand() * (rets.length - block));
      for (let k = 0; k < block && n < horizon; k++, n++) {
        e *= 1 + rets[start + k];
        peak = Math.max(peak, e);
        mdd = Math.max(mdd, 1 - e / peak);
      }
    }
    finals.push(e - 1);
    dds.push(mdd);
  }
  return {
    runs,
    medianReturn: pct(finals, 0.5),
    p5Return: pct(finals, 0.05),
    p95Return: pct(finals, 0.95),
    medianMaxDD: pct(dds, 0.5),
    p95MaxDD: pct(dds, 0.95),
    probLoss: finals.filter((x) => x < 0).length / runs,
    probDD20: dds.filter((x) => x >= 0.2).length / runs,
  };
}

// Remuestreo del orden de las operaciones (rendimiento sobre capital por operación).
export function monteCarloTrades(trades: ClosedTrade[], runs = 2000, seed = 7): MonteCarloResult {
  const rets = trades.map((t) => t.returnOnEquity);
  const rand = rng(seed);
  const finals: number[] = [];
  const dds: number[] = [];
  if (!rets.length) return { runs: 0, medianReturn: 0, p5Return: 0, p95Return: 0, medianMaxDD: 0, p95MaxDD: 0, probLoss: 0, probDD20: 0 };
  for (let r = 0; r < runs; r++) {
    let e = 1;
    let peak = 1;
    let mdd = 0;
    for (let k = 0; k < rets.length; k++) {
      e *= 1 + rets[Math.floor(rand() * rets.length)];
      peak = Math.max(peak, e);
      mdd = Math.max(mdd, 1 - e / peak);
    }
    finals.push(e - 1);
    dds.push(mdd);
  }
  return {
    runs,
    medianReturn: pct(finals, 0.5),
    p5Return: pct(finals, 0.05),
    p95Return: pct(finals, 0.95),
    medianMaxDD: pct(dds, 0.5),
    p95MaxDD: pct(dds, 0.95),
    probLoss: finals.filter((x) => x < 0).length / runs,
    probDD20: dds.filter((x) => x >= 0.2).length / runs,
  };
}

// --- Ratio de Sharpe deflactado (Bailey y López de Prado, 2014) ---
function normCdf(x: number): number {
  // Aproximación de Abramowitz-Stegun 26.2.17
  const t = 1 / (1 + 0.2316419 * Math.abs(x));
  const d = 0.3989422804014327 * Math.exp((-x * x) / 2);
  const p = d * t * (0.31938153 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
  return x >= 0 ? 1 - p : p;
}

function normInv(p: number): number {
  // Acklam
  const a = [-39.69683028665376, 220.9460984245205, -275.9285104469687, 138.357751867269, -30.66479806614716, 2.506628277459239];
  const b = [-54.47609879822406, 161.5858368580409, -155.6989798598866, 66.80131188771972, -13.28068155288572];
  const c = [-0.007784894002430293, -0.3223964580411365, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783];
  const d = [0.007784695709041462, 0.3224671290700398, 2.445134137142996, 3.754408661907416];
  const pl = 0.02425;
  if (p < pl) {
    const q = Math.sqrt(-2 * Math.log(p));
    return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  }
  if (p > 1 - pl) return -normInv(1 - p);
  const q = p - 0.5;
  const r = q * q;
  return ((((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q) / (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
}

function moments(r: number[]) {
  const m = mean(r);
  const s = std(r);
  const n = r.length;
  const skew = s > 0 ? r.reduce((a, x) => a + ((x - m) / s) ** 3, 0) / n : 0;
  const kurt = s > 0 ? r.reduce((a, x) => a + ((x - m) / s) ** 4, 0) / n : 3;
  return { m, s, skew, kurt, n };
}

// Probabilidad de que el Sharpe real (por periodo) supere srBenchmark.
export function probabilisticSharpe(r: number[], srBenchmark = 0): number {
  const { m, s, skew, kurt, n } = moments(r);
  if (s === 0 || n < 3) return 0;
  const sr = m / s;
  const denom = Math.sqrt(1 - skew * sr + ((kurt - 1) / 4) * sr * sr);
  return normCdf(((sr - srBenchmark) * Math.sqrt(n - 1)) / denom);
}

// DSR: corrige por el número de configuraciones probadas (trials) y la varianza
// de sus Sharpe. Devuelve la probabilidad de que el mejor Sharpe no sea suerte.
export function deflatedSharpe(r: number[], trials: number, sharpeVarAcrossTrials: number): number {
  const N = Math.max(trials, 1);
  const g = 0.5772156649;
  const sd = Math.sqrt(Math.max(sharpeVarAcrossTrials, 1e-12));
  const sr0 = N > 1 ? sd * ((1 - g) * normInv(1 - 1 / N) + g * normInv(1 - 1 / (N * Math.E))) : 0;
  return probabilisticSharpe(r, sr0);
}
