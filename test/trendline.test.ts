import { describe, expect, it } from "vitest";
import type { Candle } from "../src/core/types";
import { trendline } from "../src/core/strategies/trendline";
import { backtest } from "../src/core/backtest";
import { DEFAULT_COSTS, DEFAULT_LIMITS } from "../src/core/types";
import { makeConfig } from "../src/core/strategies";

const P = { piv: 3, minTouches: 3, confirm: 0, tp: 0, bounce: 0, allowShort: 0, tol: 0.3, minGap: 6, minSpan: 126 };

// Serie de 4 h: tendencia bajista con tres máximos que tocan la misma línea y
// un suelo ascendente; la última vela cierra por encima de la línea.
function setup(breakout: boolean): Candle[] {
  const bars: Candle[] = [];
  const line = (i: number) => 200 - 0.2 * i; // resistencia descendente
  for (let i = 0; i < 320; i++) {
    const phase = (i % 40) / 40; // ondas de 40 velas
    const top = line(i);
    let close = top - 6 - 10 * Math.abs(Math.sin(Math.PI * phase));
    let high = close + 1;
    if (i % 40 === 0 && i >= 80) high = top - 0.1; // toque en la línea
    const low = close - 1 + 0 * i;
    bars.push({ ts: i * 14400, open: close + 0.3, high: Math.max(high, close + 0.5), low, close, volume: 1 });
  }
  if (breakout) {
    const last = bars.length - 1;
    const v = line(last);
    bars[last] = { ...bars[last], open: v - 2, close: v + 3, high: v + 4 };
  }
  return bars;
}

describe("estrategia de líneas de tendencia (Tori Trades)", () => {
  it("entra en largo al cerrar por encima de una línea bajista con 3+ toques y pone el stop por debajo", () => {
    const s = trendline.decide({ bars: setup(true), position: null, params: P });
    expect(s.action).toBe("enter_long");
    expect(s.stop!).toBeLessThan(setup(true).at(-1)!.close);
    expect(s.features!.touches).toBeGreaterThanOrEqual(3);
  });

  it("no entra si no hay ruptura", () => {
    expect(trendline.decide({ bars: setup(false), position: null, params: P }).action).toBe("hold");
  });

  it("con confirmación exige que la vela siguiente también cierre por encima", () => {
    expect(trendline.decide({ bars: setup(true), position: null, params: { ...P, confirm: 1 } }).action).toBe("hold");
  });

  it("no mira al futuro en el backtest", () => {
    let x = 7;
    const rnd = () => ((x = (x * 1103515245 + 12345) % 2147483648) / 2147483648);
    let p = 100;
    const h: Candle[] = Array.from({ length: 24 * 300 }, (_, i) => {
      const o = p;
      p *= 1 + (rnd() - 0.5) * 0.02;
      return { ts: 1_600_000_000 - (1_600_000_000 % 86400) + i * 3600, open: o, high: Math.max(o, p) * 1.002, low: Math.min(o, p) * 0.998, close: p, volume: 1 };
    });
    const cfg = makeConfig("trendline", "4h", { ...P, allowShort: 1 });
    const a = backtest(h, cfg, { initialCapital: 10000, limits: DEFAULT_LIMITS, costs: DEFAULT_COSTS });
    const cut = h[24 * 220].ts;
    const altered = h.map((c) => (c.ts > cut ? { ...c, open: c.open * 2, high: c.high * 2, low: c.low * 2, close: c.close * 2 } : c));
    const b = backtest(altered, cfg, { initialCapital: 10000, limits: DEFAULT_LIMITS, costs: DEFAULT_COSTS });
    const before = (r: typeof a) => r.trades.filter((t) => t.exitTs <= cut).map((t) => [t.entryTs, t.exitTs, t.netPnl.toFixed(6)]);
    expect(before(a).length).toBeGreaterThan(0);
    expect(before(b)).toEqual(before(a));
  });
});
