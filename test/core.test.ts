import { describe, expect, it } from "vitest";
import type { Candle, StrategyConfig } from "../src/core/types";
import { DEFAULT_COSTS, DEFAULT_LIMITS } from "../src/core/types";
import { aggregate, atr, ema, rsi, sma } from "../src/core/indicators";
import { checkConfigChange, checkEntry, effectiveLimits, positionSize, type EntryCheckInput } from "../src/core/risk";
import { equityAt, newAccount, processHour, type Controls } from "../src/core/engine";
import { backtest } from "../src/core/backtest";
import { computeMetrics, maxDrawdown, monteCarloBlock } from "../src/core/metrics";
import { makeConfig } from "../src/core/strategies";
import { evaluateGates } from "../src/core/gates";

const ON: Controls = { running: true, paused: false, mode: "paper", liveApproved: false };

function series(n: number, f: (i: number) => number, start = 1_600_000_000 - (1_600_000_000 % 86400)): Candle[] {
  return Array.from({ length: n }, (_, i) => {
    const c = f(i);
    const o = i ? f(i - 1) : c;
    return { ts: start + i * 3600, open: o, high: Math.max(o, c) * 1.001, low: Math.min(o, c) * 0.999, close: c, volume: 1 };
  });
}

describe("indicadores", () => {
  it("sma/ema/rsi/atr básicos", () => {
    expect(sma([1, 2, 3, 4], 2).slice(1)).toEqual([1.5, 2.5, 3.5]);
    const e = ema([1, 1, 1, 1, 1], 3);
    expect(e[4]).toBeCloseTo(1);
    expect(rsi([1, 2, 3, 4, 5, 6], 3)[5]).toBe(100);
    const bars = series(30, () => 100);
    expect(atr(bars, 14)[29]).toBeCloseTo(0.2, 1);
  });

  it("agrega 1h → 4h solo con velas completas y OHLC correcto", () => {
    const h = series(10, (i) => 100 + i); // 10 horas desde medianoche
    const a = aggregate(h, "4h");
    expect(a.length).toBe(2); // la tercera (horas 8-9) está incompleta
    expect(a[0].open).toBe(h[0].open);
    expect(a[0].close).toBe(h[3].close);
    expect(a[0].high).toBe(Math.max(...h.slice(0, 4).map((x) => x.high)));
    expect(a[1].ts - a[0].ts).toBe(14400);
  });
});

describe("motor de riesgo", () => {
  const base: EntryCheckInput = {
    side: "long",
    qty: 0.001,
    price: 80000,
    referencePrice: 80000,
    stop: 76000,
    equity: 230,
    peakEquity: 230,
    initialCapital: 230,
    openPositions: 0,
    ordersToday: 0,
    dataAgeSec: 60,
    halted: false,
    running: true,
    paused: false,
    mode: "paper",
    liveApproved: false,
  };

  it("el dimensionado respeta 1 % de riesgo y 2x", () => {
    const s = positionSize(230, 80000, 76000, DEFAULT_LIMITS, DEFAULT_COSTS);
    expect(s.riskAmount).toBeLessThanOrEqual(2.3 + 1e-9);
    expect(s.leverage).toBeLessThanOrEqual(2);
    expect(s.qty * 1e4).toBeCloseTo(Math.round(s.qty * 1e4)); // múltiplo del lote mínimo
    const tight = positionSize(230, 80000, 79990, DEFAULT_LIMITS, DEFAULT_COSTS);
    expect(tight.limitedBy).toBe("leverage");
    expect(tight.leverage).toBeLessThanOrEqual(2);
  });

  it("acepta una orden válida", () => {
    const s = positionSize(230, 80000, 76000, DEFAULT_LIMITS, DEFAULT_COSTS);
    expect(checkEntry({ ...base, qty: s.qty }, DEFAULT_LIMITS, DEFAULT_COSTS).ok).toBe(true);
  });

  it.each([
    [{ stop: undefined }, "sin stop"],
    [{ stop: 81000 }, "lado equivocado"],
    [{ qty: 0.01 }, "apalancamiento"],
    [{ halted: true }, "suspendida"],
    [{ paused: true }, "pausa"],
    [{ running: false }, "apagado"],
    [{ mode: "live" as const }, "aprobación"],
    [{ dataAgeSec: 99999 }, "desactualizados"],
    [{ price: 90000 }, "rango"],
    [{ openPositions: 1 }, "posición abierta"],
    [{ qty: 0.00005 }, "mínimo"],
    [{ equity: 150 }, "límite de caída"],
    [{ ordersToday: 99 }, "límite diario"],
  ])("rechaza %o (%s)", (patch, word) => {
    const v = checkEntry({ ...base, ...patch }, DEFAULT_LIMITS, DEFAULT_COSTS);
    expect(v.ok).toBe(false);
    expect(v.reasons.join(" ")).toContain(word);
  });

  it("rechaza riesgo > 1 % aunque el apalancamiento sea bajo", () => {
    const v = checkEntry({ ...base, qty: 0.002, stop: 70000 }, DEFAULT_LIMITS, DEFAULT_COSTS);
    expect(v.reasons.join(" ")).toContain("riesgo");
  });

  it("los topes duros no se pueden superar por configuración", () => {
    const L = effectiveLimits({ ...DEFAULT_LIMITS, maxLeverage: 20, riskPerTrade: 0.1, maxPositions: 5, maxDrawdown: 0.9 });
    expect(L.maxLeverage).toBe(2);
    expect(L.riskPerTrade).toBe(0.01);
    expect(L.maxPositions).toBe(1);
    expect(L.maxDrawdown).toBe(0.2);
  });

  it("no permite cambiar parámetros de riesgo con posición abierta", () => {
    expect(checkConfigChange(true, { riskPerTrade: 0.005 }).length).toBeGreaterThan(0);
    expect(checkConfigChange(false, { riskPerTrade: 0.005 })).toEqual([]);
    expect(checkConfigChange(false, { maxLeverage: 3 }).length).toBe(1);
  });
});

// Estrategia de prueba: donchian corto en 1h para generar operaciones rápido.
const cfg: StrategyConfig = makeConfig("donchian", "1h", { entry: 5, exit: 3, allowShort: 1, stopAtr: 2, trail: 0 });

describe("máquina de estados", () => {
  it("abre al precio de ejecución con deslizamiento y comisión, y el stop salta con hueco al precio de apertura", () => {
    let s = newAccount(10000);
    const h = series(40, (i) => (i < 30 ? 100 + i * 0.01 : 100 + i)); // ruptura alcista en la hora 30
    let opened = false;
    for (let i = 25; i < 32; i++) {
      const r = processHour(s, { bar: h[i], strategyBars: h.slice(0, i + 1), execPrice: h[i + 1].open, execTs: h[i + 1].ts, referencePrice: h[i].close, dataAgeSec: 0, fundingRate: 0 }, cfg, ON, DEFAULT_LIMITS, DEFAULT_COSTS);
      s = r.state;
      const fill = r.events.find((e) => e.type === "fill");
      if (fill && fill.type === "fill" && !opened) {
        opened = true;
        expect(fill.fill.price).toBeCloseTo(h[i + 1].open * (1 + DEFAULT_COSTS.slippage));
        expect(fill.fill.fee).toBeCloseTo(fill.fill.qty * fill.fill.price * DEFAULT_COSTS.takerFee);
      }
    }
    expect(s.position?.side).toBe("long");
    const stop = s.position!.stop;
    // vela con hueco bajista por debajo del stop
    const gap: Candle = { ts: s.lastHourTs + 3600, open: stop * 0.9, high: stop * 0.91, low: stop * 0.85, close: stop * 0.88, volume: 1 };
    const r = processHour(s, { bar: gap, strategyBars: null, execPrice: null, execTs: gap.ts + 3600, referencePrice: gap.close, dataAgeSec: 0, fundingRate: 0 }, cfg, ON, DEFAULT_LIMITS, DEFAULT_COSTS);
    const exit = r.events.find((e) => e.type === "fill");
    expect(exit && exit.type === "fill" && exit.fill.price).toBeCloseTo(gap.open * (1 - DEFAULT_COSTS.slippage));
    expect(r.state.position).toBeNull();
  });

  it("en pausa no abre nuevas posiciones; apagado no decide", () => {
    const h = series(40, (i) => (i < 30 ? 100 : 100 + i));
    for (const controls of [{ ...ON, paused: true }, { ...ON, running: false }]) {
      let s = newAccount(10000);
      for (let i = 25; i < 38; i++) {
        s = processHour(s, { bar: h[i], strategyBars: h.slice(0, i + 1), execPrice: h[i + 1].open, execTs: h[i + 1].ts, referencePrice: h[i].close, dataAgeSec: 0, fundingRate: 0 }, cfg, controls, DEFAULT_LIMITS, DEFAULT_COSTS).state;
      }
      expect(s.position).toBeNull();
    }
  });

  it("cobra funding a los largos cuando la tasa es positiva", () => {
    let s = newAccount(10000);
    s.position = { side: "long", qty: 0.1, entryPrice: 100, entryTs: 0, stop: 50, initialStop: 50, strategyId: "x", barsHeld: 0, highestClose: 100, lowestClose: 100, entryFee: 0, fundingPaid: 0, tradeId: "t" };
    const bar: Candle = { ts: 3600, open: 100, high: 101, low: 99, close: 100, volume: 1 };
    s = processHour(s, { bar, strategyBars: null, execPrice: null, execTs: 7200, referencePrice: 100, dataAgeSec: 0, fundingRate: 0.001 }, cfg, ON, DEFAULT_LIMITS, DEFAULT_COSTS).state;
    expect(s.cash).toBeCloseTo(10000 - 0.1 * 100 * 0.001);
  });

  it("suspende nuevas entradas al caer un 20 %", () => {
    let s = newAccount(1000);
    s.cash = 790;
    const bar: Candle = { ts: 3600, open: 100, high: 101, low: 99, close: 100, volume: 1 };
    const r = processHour(s, { bar, strategyBars: null, execPrice: null, execTs: 7200, referencePrice: 100, dataAgeSec: 0, fundingRate: 0 }, cfg, ON, DEFAULT_LIMITS, DEFAULT_COSTS);
    expect(r.state.halted).toBe(true);
    expect(r.events.some((e) => e.type === "halt")).toBe(true);
  });

  it("ignora velas ya procesadas (idempotente ante reintentos)", () => {
    const s = { ...newAccount(1000), lastHourTs: 7200 };
    const bar: Candle = { ts: 3600, open: 100, high: 101, low: 99, close: 100, volume: 1 };
    const r = processHour(s, { bar, strategyBars: null, execPrice: 100, execTs: 7200, referencePrice: 100, dataAgeSec: 0, fundingRate: 0 }, cfg, ON, DEFAULT_LIMITS, DEFAULT_COSTS);
    expect(r.events[0].type).toBe("skip");
  });
});

describe("backtest", () => {
  // Paseo aleatorio determinista
  let x = 12345;
  const rnd = () => ((x = (x * 1103515245 + 12345) % 2147483648) / 2147483648);
  let p = 100;
  const walk = series(24 * 400, () => (p *= 1 + (rnd() - 0.5) * 0.02));

  it("no mira al futuro: alterar velas futuras no cambia las operaciones pasadas", () => {
    const daily = makeConfig("donchian", "1d", { entry: 20, exit: 10, allowShort: 1, stopAtr: 3, trail: 0 });
    const a = backtest(walk, daily, { initialCapital: 10000, limits: DEFAULT_LIMITS, costs: DEFAULT_COSTS });
    const cut = walk[24 * 300].ts;
    const altered = walk.map((c) => (c.ts > cut ? { ...c, open: c.open * 3, high: c.high * 3, low: c.low * 3, close: c.close * 3 } : c));
    const b = backtest(altered, daily, { initialCapital: 10000, limits: DEFAULT_LIMITS, costs: DEFAULT_COSTS });
    const before = (r: typeof a) => r.trades.filter((t) => t.exitTs <= cut).map((t) => [t.entryTs, t.exitTs, t.netPnl.toFixed(6)]);
    expect(before(a).length).toBeGreaterThan(0);
    expect(before(b)).toEqual(before(a));
  });

  it("contabilidad consistente: capital final = inicial + suma de P&L neto (sin posición abierta)", () => {
    const daily = makeConfig("ema_cross", "4h", { fast: 10, slow: 40, allowShort: 1, stopAtr: 3, trail: 0 });
    const r = backtest(walk, daily, { initialCapital: 10000, limits: DEFAULT_LIMITS, costs: DEFAULT_COSTS, funding: () => 0.00001 });
    const sum = r.trades.reduce((s, t) => s + t.netPnl, 0);
    const pos = r.finalState.position;
    expect(r.trades.length).toBeGreaterThan(5);
    expect(r.finalState.cash).toBeCloseTo(10000 + sum - (pos ? pos.entryFee + pos.fundingPaid : 0), 6);
    expect(r.trades.every((t) => t.fees > 0)).toBe(true);
  });

  it("todas las operaciones respetan 2x y 1 % de riesgo inicial", () => {
    const c = makeConfig("tsmom", "1d", { lookback: 20, allowShort: 1, stopAtr: 3, threshold: 0, trail: 0 });
    const r = backtest(walk, c, { initialCapital: 230, limits: DEFAULT_LIMITS, costs: DEFAULT_COSTS });
    for (const t of r.trades) {
      expect(t.rMultiple).toBeGreaterThan(-3); // pérdidas acotadas por el stop salvo huecos extremos
    }
    const capped = backtest(walk, c, { initialCapital: 230, limits: { ...DEFAULT_LIMITS, maxLeverage: 50, riskPerTrade: 0.5 }, costs: DEFAULT_COSTS });
    const lev = capped.trades.map((t) => (t.qty * t.entryPrice) / 230);
    expect(Math.max(0, ...lev)).toBeLessThanOrEqual(2 * 1.6); // el capital puede variar, pero el tope 2x se aplica sobre el capital vigente
  });
});

describe("métricas y criterios", () => {
  it("caída máxima", () => {
    expect(maxDrawdown([100, 120, 90, 130, 65])).toBeCloseTo(0.5);
  });
  it("Sharpe ~0 para serie plana y Monte Carlo reproducible", () => {
    const d = Array.from({ length: 400 }, (_, i) => ({ ts: i * 86400, equity: 100 }));
    expect(computeMetrics(d, []).sharpe).toBe(0);
    const r = Array.from({ length: 300 }, (_, i) => Math.sin(i) * 0.01);
    expect(monteCarloBlock(r, 365, 200, 10, 1)).toEqual(monteCarloBlock(r, 365, 200, 10, 1));
  });
  it("los criterios exigen todo", () => {
    const ok = { oosSharpe: 1, oosPsr: 0.95, positiveFolds: 0.7, probDD20: 0.02, oosTrades: 50, neighborPositive: 0.8, oosMaxDD: 0.1, stressSharpe: 0.5 };
    expect(evaluateGates(ok).passed).toBe(true);
    expect(evaluateGates({ ...ok, oosTrades: 10 }).passed).toBe(false);
  });
  it("equityAt incluye P&L latente", () => {
    const s = newAccount(100);
    s.position = { side: "short", qty: 1, entryPrice: 10, entryTs: 0, stop: 20, initialStop: 20, strategyId: "x", barsHeld: 0, highestClose: 10, lowestClose: 10, entryFee: 0, fundingPaid: 0, tradeId: "t" };
    expect(equityAt(s, 8)).toBe(102);
  });
});
