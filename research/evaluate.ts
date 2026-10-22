// Evaluación completa de una familia de estrategias (compartida por la
// investigación inicial y el ciclo de aprendizaje semanal).
import type { Candle, CostModel, StrategyConfig } from "../src/core/types";
import { DEFAULT_LIMITS } from "../src/core/types";
import { backtest } from "../src/core/backtest";
import { computeMetrics, dailyReturns, deflatedSharpe, std, type Metrics } from "../src/core/metrics";
import { walkForward, type WalkForwardResult } from "../src/core/walkforward";
import { evaluateGates, type GateInput, type GateResult } from "../src/core/gates";

export const RESEARCH_CAPITAL = 100_000;
export const WF = { trainDays: 730, testDays: 182, minTrainTrades: 6 };

export interface FamilyReport {
  family: string;
  fullSample: { best: string; metrics: Metrics; dsr: number; neighborPositive: number; trials: number };
  wf: Omit<WalkForwardResult, "oosDaily"> & { oosDailyCount: number };
  stressSharpe: number;
  gateInput: GateInput;
  gates: GateResult;
  latestConfig: StrategyConfig | null;
}

export function evaluateFamily(
  hourly: Candle[],
  grid: StrategyConfig[],
  costs: CostModel,
  funding: (ts: number) => number,
  totalTrials: number,
  requireContiguous = true,
): { report: FamilyReport; wf: WalkForwardResult } {
  const fam = grid[0].family;
  const start = hourly[0].ts + 365 * 86400;
  const full = grid.map((cfg) => {
    const r = backtest(hourly, cfg, { initialCapital: RESEARCH_CAPITAL, limits: DEFAULT_LIMITS, costs, funding, start, requireContiguous });
    return { cfg, r, m: computeMetrics(r.daily, r.trades) };
  });
  const sharpes = full.map((f) => f.m.sharpe);
  const best = full.reduce((x, y) => (y.m.sharpe > x.m.sharpe ? y : x));
  const perPeriod = sharpes.map((s) => s / Math.sqrt(365));
  const dsr = deflatedSharpe(dailyReturns(best.r.daily), totalTrials, std(perPeriod) ** 2);
  const neighborPositive = sharpes.filter((s) => s > 0).length / sharpes.length;
  const wf = walkForward(hourly, grid, { ...WF, limits: DEFAULT_LIMITS, costs, funding, initialCapital: RESEARCH_CAPITAL, requireContiguous });
  const stressCosts: CostModel = { takerFee: costs.takerFee * 2, slippage: costs.slippage * 2, fundingPerHour: null };
  const wfStress = walkForward(hourly, grid, { ...WF, limits: DEFAULT_LIMITS, costs: stressCosts, funding: (ts) => funding(ts) * 2, initialCapital: RESEARCH_CAPITAL, requireContiguous });
  const gateInput: GateInput = {
    oosSharpe: wf.oosMetrics.sharpe,
    oosPsr: wf.oosPsr,
    positiveFolds: wf.positiveFolds,
    probDD20: wf.monteCarlo.probDD20,
    oosTrades: wf.oosTrades,
    neighborPositive,
    oosMaxDD: wf.oosMetrics.maxDrawdown,
    stressSharpe: wfStress.oosMetrics.sharpe,
  };
  // Configuración para operar a partir de ahora: la mejor en los últimos
  // trainDays días (el mismo criterio que usa cada ventana del walk-forward).
  const lastTs = hourly.at(-1)!.ts;
  let latestConfig: StrategyConfig | null = null;
  let bestRecent = -Infinity;
  for (const cfg of grid) {
    const r = backtest(hourly, cfg, { initialCapital: RESEARCH_CAPITAL, limits: DEFAULT_LIMITS, costs, funding, start: lastTs - WF.trainDays * 86400, requireContiguous });
    if (r.trades.length < WF.minTrainTrades) continue;
    const sh = computeMetrics(r.daily, r.trades).sharpe;
    if (sh > bestRecent) {
      bestRecent = sh;
      latestConfig = cfg;
    }
  }
  const { oosDaily, ...wfRest } = wf;
  return {
    wf,
    report: {
      family: fam,
      fullSample: { best: best.cfg.id, metrics: best.m, dsr, neighborPositive, trials: totalTrials },
      wf: { ...wfRest, oosDailyCount: oosDaily.length },
      stressSharpe: wfStress.oosMetrics.sharpe,
      gateInput,
      gates: evaluateGates(gateInput),
      latestConfig,
    },
  };
}
