import type { Candle, Signal, Strategy, StrategyContext } from "../types";
import { atr } from "../indicators";

// Versión mecánica de la estrategia de líneas de tendencia que Tori Trades
// (Victoria Duke) describe públicamente. Fuentes: su checklist en PDF, sus
// publicaciones en X y resúmenes de terceros (TradeZella, FX Replay, Chart
// Fanatics). Reglas recogidas:
//  - Velas de 4 horas, sin indicadores.
//  - "Línea de acción": línea de tendencia con 2-3 o más toques (mechas),
//    separados por 6 o más velas y trazada durante 3 semanas o más.
//  - Ruptura (reversión): entrar cuando una vela cierra al otro lado de la línea
//    (con o sin confirmación de la vela siguiente).
//  - Rebote (continuación): la misma línea es de acción y de seguridad.
//  - "Línea de seguridad": la línea de tendencia opuesta; el stop va donde la
//    4ª vela tras la ruptura tocaría esa línea. Se sale si una vela cierra al
//    otro lado de la línea de seguridad.
//  - Objetivo: primer soporte/resistencia que dé 2R o más, o dejar correr la
//    tendencia.
//  - Riesgo de 1-2 % por operación (lo aplica el motor de riesgo, no la estrategia).
// Lo que no se puede automatizar del todo: el criterio visual al trazar las
// líneas, el contexto de marcos temporales mayores y las noticias.

type P = Record<string, number>;

interface Line {
  a: number; // índice del primer toque
  b: number; // índice del segundo toque
  slope: number;
  base: number; // valor en a
  touches: number;
}

const at = (l: Line, x: number) => l.base + l.slope * (x - l.a);

function pivots(bars: Candle[], k: number, upto: number, kind: "high" | "low"): number[] {
  const out: number[] = [];
  for (let i = k; i <= upto - k; i++) {
    const v = kind === "high" ? bars[i].high : bars[i].low;
    let ok = true;
    for (let j = i - k; j <= i + k && ok; j++) {
      if (j === i) continue;
      const w = kind === "high" ? bars[j].high : bars[j].low;
      if (kind === "high" ? (j < i ? w >= v : w > v) : j < i ? w <= v : w < v) ok = false;
    }
    if (ok) out.push(i);
  }
  return out;
}

// Líneas que se han respetado (ningún cierre al otro lado) desde su primer toque
// hasta validUntil. kind "resistance" = línea por encima del precio (máximos).
function findLines(bars: Candle[], piv: number[], kind: "resistance" | "support", validUntil: number, p: P, tol: number, maxPivots = 12): Line[] {
  const recent = piv.slice(-maxPivots);
  const val = (i: number) => (kind === "resistance" ? bars[i].high : bars[i].low);
  const lines: Line[] = [];
  for (let x = 0; x < recent.length; x++) {
    for (let y = x + 1; y < recent.length; y++) {
      const a = recent[x];
      const b = recent[y];
      if (b - a < p.minGap) continue;
      const slope = (val(b) - val(a)) / (b - a);
      const l: Line = { a, b, slope, base: val(a), touches: 0 };
      let valid = true;
      for (let i = a; i <= validUntil; i++) {
        const c = bars[i].close;
        const v = at(l, i);
        if (kind === "resistance" ? c > v + 1e-9 : c < v - 1e-9) {
          valid = false;
          break;
        }
      }
      if (!valid) continue;
      // Toques: pivotes cerca de la línea, separados al menos minGap velas.
      let last = -Infinity;
      for (const q of piv) {
        if (q < a || q > validUntil) continue;
        if (Math.abs(val(q) - at(l, q)) <= tol && q - last >= p.minGap) {
          l.touches++;
          last = q;
        }
      }
      lines.push(l);
    }
  }
  return lines;
}

function nearestSafety(bars: Candle[], k: number, kind: "support" | "resistance", t: number, p: P, tol: number): Line | null {
  const piv = pivots(bars, k, t, kind === "support" ? "low" : "high");
  const lines = findLines(bars, piv, kind, t, { ...p, minGap: Math.max(3, Math.floor(p.minGap / 2)) }, tol);
  let best: Line | null = null;
  for (const l of lines) {
    const v = at(l, t);
    if (kind === "support" ? v >= bars[t].close : v <= bars[t].close) continue;
    if (!best || (kind === "support" ? v > at(best, t) : v < at(best, t))) best = l;
  }
  return best;
}

export const trendline: Strategy<P> = {
  family: "trendline",
  timeframe: "4h",
  description: "Líneas de tendencia al estilo Tori Trades: ruptura de una línea de acción con varios toques, stop en la línea de seguridad opuesta y objetivo de 2R o más.",
  warmup: () => 300,
  decide(ctx: StrategyContext<P>): Signal {
    const { bars, position, params: p } = ctx;
    const t = bars.length - 1;
    const k = p.piv;
    const a = atr(bars, 14)[t];
    const tol = p.tol * a;
    const c = bars[t].close;
    const features: Record<string, number> = { close: c, atr: a };
    if (!Number.isFinite(a)) return { action: "hold", reason: "sin datos suficientes" };

    if (position) {
      const long = position.side === "long";
      // Objetivo: primer nivel de resistencia/soporte previo a 2R o más.
      if (p.tp) {
        const r = Math.abs(position.entryPrice - position.initialStop);
        const levels = pivots(bars, k, t, long ? "high" : "low").map((i) => (long ? bars[i].high : bars[i].low));
        const goal = long ? levels.filter((v) => v >= position.entryPrice + 2 * r).sort((x, y) => x - y)[0] : levels.filter((v) => v <= position.entryPrice - 2 * r).sort((x, y) => y - x)[0];
        if (goal !== undefined && (long ? c >= goal : c <= goal)) return { action: "exit", reason: `objetivo ≥ 2R en ${long ? "resistencia" : "soporte"} ${goal.toFixed(2)}`, features };
      }
      // Línea de seguridad: se sale con un cierre al otro lado; si no, se arrastra el stop.
      const safety = nearestSafety(bars, k, long ? "support" : "resistance", t - 1, p, tol);
      if (safety) {
        const v = at(safety, t);
        features.safety = v;
        if (long ? c < v : c > v) return { action: "exit", reason: "cierre al otro lado de la línea de seguridad", features };
        return { action: "hold", stop: v, reason: "tendencia dentro de la línea de seguridad", features };
      }
      return { action: "hold", reason: "sin línea de seguridad nueva", features };
    }

    const confirm = p.confirm ? 1 : 0;
    const validUntil = t - 1 - confirm; // la línea se respetó hasta antes de la ruptura
    const breakBar = t - confirm;
    const sides: ("long" | "short")[] = p.allowShort ? ["long", "short"] : ["long"];
    for (const side of sides) {
      const long = side === "long";
      const piv = pivots(bars, k, validUntil, long ? "high" : "low");
      const lines = findLines(bars, piv, long ? "resistance" : "support", validUntil, p, tol);
      // Ruptura: el cierre de la vela de ruptura (y, si hay confirmación, el actual) al otro lado.
      const broken = lines.filter((l) => {
        if (l.touches < p.minTouches || breakBar - l.a < p.minSpan) return false;
        if (long ? l.slope >= 0 : l.slope <= 0) return false; // ruptura de una tendencia contraria
        const beyond = (i: number) => (long ? bars[i].close > at(l, i) : bars[i].close < at(l, i));
        return beyond(breakBar) && (!confirm || beyond(t));
      });
      if (!broken.length) continue;
      const action = broken.sort((x, y) => y.touches - x.touches)[0];
      const safety = nearestSafety(bars, k, long ? "support" : "resistance", breakBar, p, tol);
      let stop = safety ? at(safety, breakBar + 4) : NaN;
      if (!Number.isFinite(stop) || (long ? stop >= c : stop <= c)) {
        // Sin línea de seguridad útil: último mínimo/máximo relevante.
        const pl = pivots(bars, k, t, long ? "low" : "high").map((i) => (long ? bars[i].low : bars[i].high)).filter((v) => (long ? v < c : v > c));
        stop = pl.length ? pl[pl.length - 1] : long ? c - 2 * a : c + 2 * a;
      }
      features.actionLine = at(action, t);
      features.touches = action.touches;
      features.safety = stop;
      return {
        action: long ? "enter_long" : "enter_short",
        stop,
        reason: `ruptura ${long ? "alcista" : "bajista"} de línea de tendencia con ${action.touches} toques${confirm ? " (confirmada)" : ""}; stop en la línea de seguridad`,
        features,
      };
    }

    // Rebote (continuación): toque de una línea de tendencia a favor y cierre de rechazo.
    if (p.bounce) {
      for (const side of sides) {
        const long = side === "long";
        const piv = pivots(bars, k, t - 1, long ? "low" : "high");
        const lines = findLines(bars, piv, long ? "support" : "resistance", t, p, tol).filter((l) => l.touches >= p.minTouches && t - l.a >= p.minSpan && (long ? l.slope > 0 : l.slope < 0));
        for (const l of lines) {
          const v = at(l, t);
          const touched = long ? bars[t].low <= v + tol : bars[t].high >= v - tol;
          const rejected = long ? c > v && c > bars[t].open : c < v && c < bars[t].open;
          if (touched && rejected) {
            return {
              action: long ? "enter_long" : "enter_short",
              stop: long ? v - tol : v + tol,
              reason: `rebote en línea de tendencia con ${l.touches} toques`,
              features: { ...features, actionLine: v, touches: l.touches },
            };
          }
        }
      }
    }
    return { action: "hold", reason: "sin ruptura ni rebote válidos", features };
  },
};
