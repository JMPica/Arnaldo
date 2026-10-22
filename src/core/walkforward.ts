import type { Candle, CostModel, RiskLimits, StrategyConfig } from "./types";
import { backtest, type BacktestResult } from "./backtest";
import { computeMetrics, dailyReturns, monteCarloBlock, probabilisticSharpe, type Metrics, type MonteCarloResult } from "./metrics";
import { makeConfig } from "./strategies";

export interface Fold {
  trainStart: number;
  trainEnd: number;
  testStart: number;
  testEnd: number;
  chosen: string;
  trainSharpe: number;
  testReturn: number;
  testSharpe: number;
  testTrades: number;
}

export interface WalkForwardResult {
  family: string;
  folds: Fold[];
  oosDaily: { ts: number; equity: number }[];
  oosMetrics: Metrics;
  oosPsr: number;
  positiveFolds: number;
  oosTrades: number;
  monteCarlo: MonteCarloResult;
  configsTested: number;
}

export interface WFOptions {
  trainDays: number;
  testDays: number;
  minTrainTrades: number;
  limits: RiskLimits;
  costs: CostModel;
  funding?: (ts: number) => number;
  initialCapital: number;
  requireContiguous?: boolean;
}

export function sharpeOf(r: BacktestResult): number {
  return computeMetrics(r.daily, r.trades).sharpe;
}

export function walkForward(hourly: Candle[], grid: StrategyConfig[], opt: WFOptions): WalkForwardResult {
  const D = 86400;
  const first = hourly[0].ts;
  const lastTs = hourly.at(-1)!.ts;
  // Un año inicial solo para calentar indicadores lentos.
  let trainStart = first + 365 * D;
  const folds: Fold[] = [];
  const oos: { ts: number; equity: number }[] = [];
  let oosTrades = 0;
  let scale = 1;
  while (trainStart + (opt.trainDays + opt.testDays) * D <= lastTs + D) {
    const trainEnd = trainStart + opt.trainDays * D;
    const testEnd = Math.min(trainEnd + opt.testDays * D, lastTs);
    let best: { cfg: StrategyConfig; sharpe: number } | null = null;
    for (const cfg of grid) {
      const r = backtest(hourly, cfg, { initialCapital: opt.initialCapital, limits: opt.limits, costs: opt.costs, funding: opt.funding, start: trainStart, end: trainEnd, requireContiguous: opt.requireContiguous });
      if (r.trades.length < opt.minTrainTrades) continue;
      const s = sharpeOf(r);
      if (!best || s > best.sharpe) best = { cfg, sharpe: s };
    }
    if (best) {
      const t = backtest(hourly, best.cfg, { initialCapital: opt.initialCapital, limits: opt.limits, costs: opt.costs, funding: opt.funding, start: trainEnd, end: testEnd, requireContiguous: opt.requireContiguous });
      const m = computeMetrics(t.daily, t.trades);
      folds.push({ trainStart, trainEnd, testStart: trainEnd, testEnd, chosen: best.cfg.id, trainSharpe: best.sharpe, testReturn: m.totalReturn, testSharpe: m.sharpe, testTrades: t.trades.length });
      oosTrades += t.trades.length;
      // Encadena la curva OOS: cada tramo empieza donde acabó el anterior.
      const base = t.daily[0]?.equity ?? opt.initialCapital;
      for (const d of t.daily) oos.push({ ts: d.ts, equity: (scale * d.equity) / base });
      scale = oos.at(-1)?.equity ?? scale;
    } else {
      folds.push({ trainStart, trainEnd, testStart: trainEnd, testEnd, chosen: "(ninguna con suficientes operaciones)", trainSharpe: 0, testReturn: 0, testSharpe: 0, testTrades: 0 });
      for (let ts = trainEnd; ts < testEnd; ts += D) oos.push({ ts, equity: scale });
    }
    trainStart += opt.testDays * D;
  }
  const rets = dailyReturns(oos);
  return {
    family: grid[0]?.family ?? "",
    folds,
    oosDaily: oos,
    oosMetrics: computeMetrics(oos, []),
    oosPsr: probabilisticSharpe(rets, 0),
    positiveFolds: folds.length ? folds.filter((f) => f.testReturn > 0).length / folds.length : 0,
    oosTrades,
    monteCarlo: monteCarloBlock(rets, 365),
    configsTested: grid.length,
  };
}

// Rejillas de parámetros por familia. Deliberadamente pequeñas: menos pruebas
// = menos sobreajuste (y el DSR lo penaliza igualmente).
export function defaultGrid(family: string): StrategyConfig[] {
  const out: StrategyConfig[] = [];
  const push = (tf: StrategyConfig["timeframe"], p: Record<string, number>) => out.push(makeConfig(family, tf, p));
  if (family === "tsmom") {
    for (const lookback of [20, 40, 60, 90, 120]) for (const allowShort of [0, 1]) for (const stopAtr of [3, 5]) push("1d", { lookback, allowShort, stopAtr, threshold: 0, trail: 0 });
  } else if (family === "donchian") {
    for (const [entry, exit] of [[20, 10], [40, 20], [55, 20], [100, 50]]) for (const allowShort of [0, 1]) for (const stopAtr of [2, 4]) push("1d", { entry, exit, allowShort, stopAtr, trail: 0 });
  } else if (family === "ema_cross") {
    for (const [fast, slow] of [[10, 40], [20, 50], [20, 100], [50, 200]]) for (const allowShort of [0, 1]) for (const stopAtr of [3, 5]) push("1d", { fast, slow, allowShort, stopAtr, trail: 0 });
  } else if (family === "rsi_mr") {
    for (const oversold of [10, 20, 30]) for (const trend of [100, 200]) for (const stopAtr of [2, 3]) push("4h", { rsiLen: 2, oversold, trend, exitMa: 5, maxBars: 12, stopAtr, allowShort: 0 });
  } else if (family === "boll_mr") {
    for (const len of [20, 40]) for (const k of [2, 2.5]) for (const trend of [0, 200]) for (const stopAtr of [2, 3]) push("4h", { len, k, trend, maxBars: 18, stopAtr, allowShort: 0 });
  }
  return out;
}

export const FAMILIES = ["tsmom", "donchian", "ema_cross", "rsi_mr", "boll_mr"];
