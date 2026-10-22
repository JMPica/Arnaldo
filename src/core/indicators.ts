import type { Candle, Timeframe } from "./types";
import { TF_SECONDS } from "./types";

// Indicadores calculados sobre la ventana completa. Devuelven NaN mientras no
// hay datos suficientes. Son O(n) para que el motor quepa en el límite de CPU
// del plan gratuito de Cloudflare.

export function sma(values: number[], n: number): number[] {
  const out = new Array<number>(values.length).fill(NaN);
  let sum = 0;
  for (let i = 0; i < values.length; i++) {
    sum += values[i];
    if (i >= n) sum -= values[i - n];
    if (i >= n - 1) out[i] = sum / n;
  }
  return out;
}

export function ema(values: number[], n: number): number[] {
  const out = new Array<number>(values.length).fill(NaN);
  const k = 2 / (n + 1);
  let prev = NaN;
  for (let i = 0; i < values.length; i++) {
    if (i === n - 1) {
      let s = 0;
      for (let j = 0; j < n; j++) s += values[j];
      prev = s / n;
      out[i] = prev;
    } else if (i >= n) {
      prev = values[i] * k + prev * (1 - k);
      out[i] = prev;
    }
  }
  return out;
}

export function trueRange(bars: Candle[]): number[] {
  return bars.map((b, i) => {
    if (i === 0) return b.high - b.low;
    const pc = bars[i - 1].close;
    return Math.max(b.high - b.low, Math.abs(b.high - pc), Math.abs(b.low - pc));
  });
}

// ATR de Wilder
export function atr(bars: Candle[], n: number): number[] {
  const tr = trueRange(bars);
  const out = new Array<number>(bars.length).fill(NaN);
  let prev = NaN;
  for (let i = 0; i < bars.length; i++) {
    if (i === n - 1) {
      let s = 0;
      for (let j = 0; j < n; j++) s += tr[j];
      prev = s / n;
      out[i] = prev;
    } else if (i >= n) {
      prev = (prev * (n - 1) + tr[i]) / n;
      out[i] = prev;
    }
  }
  return out;
}

// RSI de Wilder
export function rsi(values: number[], n: number): number[] {
  const out = new Array<number>(values.length).fill(NaN);
  let gain = 0;
  let loss = 0;
  for (let i = 1; i < values.length; i++) {
    const d = values[i] - values[i - 1];
    const g = Math.max(d, 0);
    const l = Math.max(-d, 0);
    if (i <= n) {
      gain += g;
      loss += l;
      if (i === n) {
        gain /= n;
        loss /= n;
        out[i] = loss === 0 ? 100 : 100 - 100 / (1 + gain / loss);
      }
    } else {
      gain = (gain * (n - 1) + g) / n;
      loss = (loss * (n - 1) + l) / n;
      out[i] = loss === 0 ? 100 : 100 - 100 / (1 + gain / loss);
    }
  }
  return out;
}

// Máximo/mínimo de las n velas ANTERIORES a i (excluye la vela i).
export function highestPrior(values: number[], n: number): number[] {
  const out = new Array<number>(values.length).fill(NaN);
  for (let i = n; i < values.length; i++) {
    let m = -Infinity;
    for (let j = i - n; j < i; j++) if (values[j] > m) m = values[j];
    out[i] = m;
  }
  return out;
}

export function lowestPrior(values: number[], n: number): number[] {
  const out = new Array<number>(values.length).fill(NaN);
  for (let i = n; i < values.length; i++) {
    let m = Infinity;
    for (let j = i - n; j < i; j++) if (values[j] < m) m = values[j];
    out[i] = m;
  }
  return out;
}

export function stdev(values: number[], n: number): number[] {
  const out = new Array<number>(values.length).fill(NaN);
  for (let i = n - 1; i < values.length; i++) {
    let s = 0;
    for (let j = i - n + 1; j <= i; j++) s += values[j];
    const m = s / n;
    let v = 0;
    for (let j = i - n + 1; j <= i; j++) v += (values[j] - m) ** 2;
    out[i] = Math.sqrt(v / n);
  }
  return out;
}

// Agrega velas de 1h a un timeframe mayor. Solo devuelve velas COMPLETAS:
// una vela de 4h/1d se emite cuando existe la última hora de su intervalo.
// Tolera huecos (horas sin datos) siempre que la última hora exista.
export function aggregate(hourly: Candle[], tf: Timeframe): Candle[] {
  if (tf === "1h") return hourly;
  const span = TF_SECONDS[tf];
  const out: Candle[] = [];
  let cur: Candle | null = null;
  let curBucket = -1;
  let lastTs = -1;
  const flush = () => {
    if (cur && lastTs === curBucket + span - 3600) out.push(cur);
  };
  for (const h of hourly) {
    const bucket = Math.floor(h.ts / span) * span;
    if (bucket !== curBucket) {
      flush();
      curBucket = bucket;
      cur = { ts: bucket, open: h.open, high: h.high, low: h.low, close: h.close, volume: h.volume };
    } else if (cur) {
      cur.high = Math.max(cur.high, h.high);
      cur.low = Math.min(cur.low, h.low);
      cur.close = h.close;
      cur.volume += h.volume;
    }
    lastTs = h.ts;
  }
  flush();
  return out;
}

export function isBarClose(hourTs: number, tf: Timeframe): boolean {
  const span = TF_SECONDS[tf];
  return (hourTs + 3600) % span === 0;
}

// Variantes que solo calculan el último valor (lo único que necesita decide()).
export function lastHighestPrior(values: number[], n: number): number {
  const i = values.length - 1;
  if (i < n) return NaN;
  let m = -Infinity;
  for (let j = i - n; j < i; j++) if (values[j] > m) m = values[j];
  return m;
}

export function lastLowestPrior(values: number[], n: number): number {
  const i = values.length - 1;
  if (i < n) return NaN;
  let m = Infinity;
  for (let j = i - n; j < i; j++) if (values[j] < m) m = values[j];
  return m;
}

export function lastStdev(values: number[], n: number): number {
  const i = values.length - 1;
  if (i < n - 1) return NaN;
  let s = 0;
  for (let j = i - n + 1; j <= i; j++) s += values[j];
  const m = s / n;
  let v = 0;
  for (let j = i - n + 1; j <= i; j++) v += (values[j] - m) ** 2;
  return Math.sqrt(v / n);
}
