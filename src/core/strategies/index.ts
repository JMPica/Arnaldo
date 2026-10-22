import type { Candle, Position, Signal, Strategy, StrategyConfig, StrategyContext } from "../types";
import { trendline } from "./trendline";
import { atr, ema, lastHighestPrior, lastLowestPrior, lastStdev, rsi, sma } from "../indicators";

// Familias de estrategias sistemáticas con evidencia publicada:
//  - tsmom:     momentum de serie temporal (Moskowitz, Ooi y Pedersen 2012; Liu y Tsyvinski 2021 para cripto)
//  - donchian:  ruptura de canal / "Turtle" (seguimiento de tendencia clásico; Hurst, Ooi y Pedersen 2017)
//  - ema_cross: cruce de medias exponenciales (Brock, Lakonishok y LeBaron 1992)
//  - rsi_mr:    reversión a la media a corto plazo dentro de la tendencia (Connors RSI-2)
//  - boll_mr:   reversión a la media con bandas de Bollinger
// Todas usan un stop de protección basado en ATR que el motor de riesgo exige.

type P = Record<string, number>;

const last = <T>(a: T[]) => a[a.length - 1];

function trailStop(pos: Position, a: number, mult: number): number {
  // Stop "chandelier": se mueve solo a favor de la posición, nunca en contra.
  if (pos.side === "long") return Math.max(pos.stop, pos.highestClose - mult * a);
  return Math.min(pos.stop, pos.lowestClose + mult * a);
}

function holdWithTrail(ctx: StrategyContext<P>, a: number, reason = "mantener"): Signal {
  const pos = ctx.position!;
  const mult = ctx.params.trail ?? 0;
  if (mult > 0 && Number.isFinite(a)) {
    const s = trailStop(pos, a, mult);
    if (s !== pos.stop) return { action: "hold", stop: s, reason: `${reason}; stop dinámico ajustado` };
  }
  return { action: "hold", reason };
}

const tsmom: Strategy<P> = {
  family: "tsmom",
  timeframe: "1d",
  description: "Momentum de serie temporal: posición en la dirección del rendimiento de las últimas N velas.",
  warmup: (p) => Math.max(p.lookback, 20) + 2,
  decide(ctx) {
    const { bars, position, params: p } = ctx;
    const closes = bars.map((b) => b.close);
    const i = closes.length - 1;
    const ret = closes[i] / closes[i - p.lookback] - 1;
    const a = last(atr(bars, 20));
    const features = { ret, atr: a, close: closes[i] };
    const thr = p.threshold ?? 0;
    const want = ret > thr ? "long" : ret < -thr && p.allowShort ? "short" : null;
    if (!position) {
      if (want === "long") return { action: "enter_long", stop: closes[i] - p.stopAtr * a, reason: `rendimiento ${p.lookback}v = ${(ret * 100).toFixed(1)} % > umbral`, features };
      if (want === "short") return { action: "enter_short", stop: closes[i] + p.stopAtr * a, reason: `rendimiento ${p.lookback}v = ${(ret * 100).toFixed(1)} % < -umbral`, features };
      return { action: "hold", reason: "sin señal de momentum", features };
    }
    if (want !== position.side) return { action: "exit", reason: `el momentum ya no favorece ${position.side} (${(ret * 100).toFixed(1)} %)`, features };
    return { ...holdWithTrail(ctx, a, "momentum vigente"), features };
  },
};

const donchian: Strategy<P> = {
  family: "donchian",
  timeframe: "1d",
  description: "Ruptura de canal de Donchian: entra al superar el máximo/mínimo de N velas y sale con el canal corto de M velas.",
  warmup: (p) => Math.max(p.entry, p.exit, 20) + 2,
  decide(ctx) {
    const { bars, position, params: p } = ctx;
    const highs = bars.map((b) => b.high);
    const lows = bars.map((b) => b.low);
    const c = last(bars).close;
    const upE = lastHighestPrior(highs, p.entry);
    const dnE = lastLowestPrior(lows, p.entry);
    const upX = lastHighestPrior(highs, p.exit);
    const dnX = lastLowestPrior(lows, p.exit);
    const a = last(atr(bars, 20));
    const features = { close: c, upE, dnE, upX, dnX, atr: a };
    if (!position) {
      if (c > upE) return { action: "enter_long", stop: c - p.stopAtr * a, reason: `cierre ${c.toFixed(0)} rompe máximo de ${p.entry} velas (${upE.toFixed(0)})`, features };
      if (p.allowShort && c < dnE) return { action: "enter_short", stop: c + p.stopAtr * a, reason: `cierre ${c.toFixed(0)} rompe mínimo de ${p.entry} velas (${dnE.toFixed(0)})`, features };
      return { action: "hold", reason: "dentro del canal", features };
    }
    if (position.side === "long" && c < dnX) return { action: "exit", reason: `cierre bajo el mínimo de ${p.exit} velas`, features };
    if (position.side === "short" && c > upX) return { action: "exit", reason: `cierre sobre el máximo de ${p.exit} velas`, features };
    return { ...holdWithTrail(ctx, a, "tendencia intacta"), features };
  },
};

const emaCross: Strategy<P> = {
  family: "ema_cross",
  timeframe: "1d",
  description: "Cruce de medias exponenciales: largo si la media rápida está por encima de la lenta (corto en el caso contrario si se permite).",
  warmup: (p) => p.slow * 3,
  decide(ctx) {
    const { bars, position, params: p } = ctx;
    const closes = bars.map((b) => b.close);
    const f = last(ema(closes, p.fast));
    const s = last(ema(closes, p.slow));
    const c = last(closes);
    const a = last(atr(bars, 20));
    const features = { fast: f, slow: s, close: c, atr: a };
    const want = f > s ? "long" : p.allowShort ? "short" : null;
    if (!position) {
      if (want === "long") return { action: "enter_long", stop: c - p.stopAtr * a, reason: `EMA${p.fast} ${f.toFixed(0)} > EMA${p.slow} ${s.toFixed(0)}`, features };
      if (want === "short") return { action: "enter_short", stop: c + p.stopAtr * a, reason: `EMA${p.fast} ${f.toFixed(0)} < EMA${p.slow} ${s.toFixed(0)}`, features };
      return { action: "hold", reason: "medias sin tendencia alcista", features };
    }
    if (want !== position.side) return { action: "exit", reason: "cruce de medias en contra", features };
    return { ...holdWithTrail(ctx, a, "medias alineadas"), features };
  },
};

const rsiMr: Strategy<P> = {
  family: "rsi_mr",
  timeframe: "4h",
  description: "Reversión a la media: compra sobreventa extrema (RSI corto) solo a favor de la tendencia larga; sale al recuperar la media corta.",
  warmup: (p) => p.trend + 5,
  decide(ctx) {
    const { bars, position, params: p } = ctx;
    const closes = bars.map((b) => b.close);
    const r = last(rsi(closes, p.rsiLen));
    const trend = last(sma(closes, p.trend));
    const exitMa = last(sma(closes, p.exitMa));
    const c = last(closes);
    const a = last(atr(bars, 14));
    const features = { rsi: r, trend, exitMa, close: c, atr: a };
    if (!position) {
      if (c > trend && r < p.oversold) return { action: "enter_long", stop: c - p.stopAtr * a, reason: `RSI${p.rsiLen} = ${r.toFixed(1)} < ${p.oversold} con tendencia alcista`, features };
      if (p.allowShort && c < trend && r > 100 - p.oversold) return { action: "enter_short", stop: c + p.stopAtr * a, reason: `RSI${p.rsiLen} = ${r.toFixed(1)} > ${100 - p.oversold} con tendencia bajista`, features };
      return { action: "hold", reason: "sin sobreventa en tendencia", features };
    }
    if (position.side === "long" && c > exitMa) return { action: "exit", reason: `recupera la media de ${p.exitMa}`, features };
    if (position.side === "short" && c < exitMa) return { action: "exit", reason: `pierde la media de ${p.exitMa}`, features };
    if (position.barsHeld >= p.maxBars) return { action: "exit", reason: `tiempo máximo (${p.maxBars} velas)`, features };
    return { action: "hold", reason: "esperando reversión", features };
  },
};

const bollMr: Strategy<P> = {
  family: "boll_mr",
  timeframe: "4h",
  description: "Reversión a la media con bandas de Bollinger: compra cierres bajo la banda inferior y sale en la media.",
  warmup: (p) => Math.max(p.len, p.trend) + 5,
  decide(ctx) {
    const { bars, position, params: p } = ctx;
    const closes = bars.map((b) => b.close);
    const m = last(sma(closes, p.len));
    const sd = lastStdev(closes, p.len);
    const trend = p.trend > 0 ? last(sma(closes, p.trend)) : -Infinity;
    const c = last(closes);
    const a = last(atr(bars, 14));
    const lower = m - p.k * sd;
    const upper = m + p.k * sd;
    const features = { mid: m, lower, upper, close: c, atr: a };
    if (!position) {
      if (c < lower && c > trend) return { action: "enter_long", stop: c - p.stopAtr * a, reason: `cierre bajo banda inferior (${lower.toFixed(0)})`, features };
      if (p.allowShort && c > upper && (p.trend <= 0 || c < last(sma(closes, p.trend)))) return { action: "enter_short", stop: c + p.stopAtr * a, reason: `cierre sobre banda superior (${upper.toFixed(0)})`, features };
      return { action: "hold", reason: "dentro de las bandas", features };
    }
    if (position.side === "long" && c >= m) return { action: "exit", reason: "vuelta a la media", features };
    if (position.side === "short" && c <= m) return { action: "exit", reason: "vuelta a la media", features };
    if (position.barsHeld >= p.maxBars) return { action: "exit", reason: `tiempo máximo (${p.maxBars} velas)`, features };
    return { action: "hold", reason: "esperando vuelta a la media", features };
  },
};

export const STRATEGIES: Record<string, Strategy<P>> = {
  tsmom,
  donchian,
  ema_cross: emaCross,
  rsi_mr: rsiMr,
  boll_mr: bollMr,
  trendline,
};

export function getStrategy(cfg: StrategyConfig): Strategy<P> {
  const s = STRATEGIES[cfg.family];
  if (!s) throw new Error(`estrategia desconocida: ${cfg.family}`);
  return { ...s, timeframe: cfg.timeframe };
}

// Ventana fija de velas que se pasa a decide(). Se usa la misma en backtest y
// en producción para que indicadores recursivos (EMA, ATR) den el mismo valor.
export function windowSize(cfg: StrategyConfig): number {
  return Math.max(getStrategy(cfg).warmup(cfg.params) + 50, 250);
}

export function configId(family: string, timeframe: string, params: Record<string, number>): string {
  const keys = Object.keys(params).sort();
  return `${family}:${timeframe}:${keys.map((k) => `${k}=${params[k]}`).join(",")}`;
}

export function makeConfig(family: string, timeframe: StrategyConfig["timeframe"], params: Record<string, number>): StrategyConfig {
  return { id: configId(family, timeframe, params), family, timeframe, params };
}

export type { Candle };
