import type { Candle, ClosedTrade, CostModel, RiskLimits, StrategyConfig } from "./types";
import { TF_SECONDS } from "./types";
import { aggregate, isBarClose } from "./indicators";
import { equityAt, newAccount, processHour, type AccountState, type Controls } from "./engine";
import { windowSize } from "./strategies";

export interface BacktestOptions {
  initialCapital: number;
  limits: RiskLimits;
  costs: CostModel;
  funding?: (ts: number) => number; // tasa por hora
  start?: number; // ts desde el que se permite operar (las velas previas solo calientan indicadores)
  end?: number;
}

export interface BacktestResult {
  config: StrategyConfig;
  trades: ClosedTrade[];
  daily: { ts: number; equity: number }[];
  finalEquity: number;
  feesPaid: number;
  fundingPaid: number;
  halted: boolean;
  haltTs: number | null;
  exposure: number; // fracción de horas con posición
  rejects: number;
}

const ALWAYS_ON: Controls = { running: true, paused: false, mode: "paper", liveApproved: false };

export function backtest(hourly: Candle[], cfg: StrategyConfig, opt: BacktestOptions): BacktestResult {
  const tf = cfg.timeframe;
  const agg = aggregate(hourly, tf);
  const aggIndex = new Map<number, number>();
  agg.forEach((b, i) => aggIndex.set(b.ts, i));
  const win = windowSize(cfg);
  const span = TF_SECONDS[tf];
  const start = opt.start ?? hourly[0].ts;
  const end = opt.end ?? Infinity;

  let state: AccountState = newAccount(opt.initialCapital);
  const trades: ClosedTrade[] = [];
  const daily: { ts: number; equity: number }[] = [];
  let lastDay = -1;
  let hoursIn = 0;
  let hoursPos = 0;
  let rejects = 0;
  let haltTs: number | null = null;

  for (let i = 0; i < hourly.length; i++) {
    const bar = hourly[i];
    if (bar.ts > end) break;
    if (bar.ts < start) continue;
    let strategyBars: Candle[] | null = null;
    if (isBarClose(bar.ts, tf)) {
      const bucket = Math.floor(bar.ts / span) * span;
      const idx = aggIndex.get(bucket);
      if (idx !== undefined) strategyBars = agg.slice(Math.max(0, idx - win + 1), idx + 1);
    }
    const next = hourly[i + 1];
    // La orden se ejecuta en la apertura de la siguiente vela, solo si es contigua.
    const execPrice = next && next.ts === bar.ts + 3600 && next.ts <= end ? next.open : null;
    const r = processHour(
      state,
      {
        bar,
        strategyBars,
        execPrice,
        execTs: bar.ts + 3600,
        referencePrice: bar.close,
        dataAgeSec: 0,
        fundingRate: opt.funding ? opt.funding(bar.ts) : opt.costs.fundingPerHour ?? 0,
      },
      cfg,
      ALWAYS_ON,
      opt.limits,
      opt.costs,
    );
    state = r.state;
    for (const e of r.events) {
      if (e.type === "trade_closed") trades.push(e.trade);
      else if (e.type === "risk_reject") rejects++;
      else if (e.type === "halt" && haltTs === null) haltTs = e.ts;
    }
    hoursIn++;
    if (state.position) hoursPos++;
    const day = Math.floor(bar.ts / 86400);
    if (day !== lastDay) {
      daily.push({ ts: day * 86400, equity: equityAt(state, bar.close) });
      lastDay = day;
    } else daily[daily.length - 1].equity = equityAt(state, bar.close);
  }
  const lastBar = hourly.filter((b) => b.ts <= end).at(-1)!;
  return {
    config: cfg,
    trades,
    daily,
    finalEquity: equityAt(state, lastBar.close),
    feesPaid: state.feesPaid,
    fundingPaid: state.fundingPaid,
    halted: state.halted,
    haltTs,
    exposure: hoursIn ? hoursPos / hoursIn : 0,
    rejects,
  };
}
