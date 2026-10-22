import { readFileSync, existsSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { join } from "node:path";
import type { Candle } from "../src/core/types";

export const DATA_DIR = join(import.meta.dirname, "data");

export function loadCandles(name: string): Candle[] {
  const p = join(DATA_DIR, `${name}.csv.gz`);
  if (!existsSync(p)) return [];
  const lines = gunzipSync(readFileSync(p)).toString().trim().split("\n").slice(1);
  const out: Candle[] = [];
  for (const l of lines) {
    const [ts, o, h, lo, c, v] = l.split(",").map(Number);
    if (![ts, o, h, lo, c].every(Number.isFinite) || c <= 0) continue;
    out.push({ ts: Math.floor(ts / 3600) * 3600, open: o, high: h, low: lo, close: c, volume: v || 0 });
  }
  out.sort((a, b) => a.ts - b.ts);
  // elimina duplicados
  return out.filter((c, i) => i === 0 || c.ts !== out[i - 1].ts);
}

export function loadSeries(name: string): { ts: number; v: number }[] {
  const p = join(DATA_DIR, `${name}.csv.gz`);
  if (!existsSync(p)) return [];
  return gunzipSync(readFileSync(p))
    .toString()
    .trim()
    .split("\n")
    .slice(1)
    .map((l) => {
      const [ts, v] = l.split(",").map(Number);
      return { ts, v };
    })
    .filter((x) => Number.isFinite(x.ts) && Number.isFinite(x.v))
    .sort((a, b) => a.ts - b.ts);
}

// Funding de Binance (cada 8 h) convertido a tasa horaria. Antes del inicio de
// la serie se usa el valor de referencia del mercado (0,01 % cada 8 h).
export function fundingFn(series: { ts: number; v: number }[]): (ts: number) => number {
  const DEFAULT = 0.0001 / 8;
  if (!series.length) return () => DEFAULT;
  const ts = series.map((s) => s.ts);
  return (t: number) => {
    if (t < ts[0]) return DEFAULT;
    let lo = 0;
    let hi = ts.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (ts[mid] <= t) lo = mid;
      else hi = mid - 1;
    }
    return series[lo].v / 8;
  };
}

export const fmtPct = (x: number, d = 1) => (Number.isFinite(x) ? `${(x * 100).toFixed(d)} %` : "—");
export const fmt = (x: number, d = 2) => (Number.isFinite(x) ? x.toFixed(d) : "—");
export const date = (ts: number) => new Date(ts * 1000).toISOString().slice(0, 10);
