import type { Candle, Timeframe } from "../core/types";

// Cliente de datos públicos de Kraken Futures (sin claves).
// Se inyecta fetch para poder probarlo sin red.

export interface Ticker {
  symbol: string;
  last: number;
  mark: number;
  index: number;
  bid: number;
  ask: number;
  fundingHourly: number; // tasa relativa por hora (>0 pagan los largos)
  serverTime: number; // s
  suspended: boolean;
}

export type Fetcher = (url: string, init?: RequestInit) => Promise<Response>;

export class KrakenPublic {
  constructor(
    private fetcher: Fetcher,
    private base = "https://futures.kraken.com",
    private spotBase = "https://api.kraken.com",
  ) {}

  private async json(url: string): Promise<any> {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 8000);
    try {
      const r = await this.fetcher(url, { signal: ctrl.signal, headers: { "User-Agent": "apex/1.0" } });
      if (!r.ok) throw new Error(`HTTP ${r.status} en ${new URL(url).pathname}`);
      return await r.json();
    } finally {
      clearTimeout(t);
    }
  }

  async ticker(symbol: string): Promise<Ticker> {
    const j = await this.json(`${this.base}/derivatives/api/v3/tickers/${symbol}`);
    const t = j.ticker;
    if (!t || j.result !== "success") throw new Error("respuesta de ticker inválida");
    const num = (x: unknown) => Number(x);
    const out: Ticker = {
      symbol,
      last: num(t.last),
      mark: num(t.markPrice),
      index: num(t.indexPrice),
      bid: num(t.bid),
      ask: num(t.ask),
      fundingHourly: Number.isFinite(num(t.relativeFundingRate)) ? num(t.relativeFundingRate) : 0,
      serverTime: Math.floor(Date.parse(j.serverTime) / 1000),
      suspended: !!t.suspended,
    };
    if (!(out.last > 0) || !(out.mark > 0)) throw new Error("precio de ticker inválido");
    if (!(out.index > 0)) out.index = out.mark;
    return out;
  }

  // Velas OHLC. Devuelve solo velas cerradas respecto a nowSec.
  async candles(symbol: string, tf: Timeframe, fromSec: number, toSec: number, nowSec: number): Promise<Candle[]> {
    const span = tf === "1h" ? 3600 : tf === "4h" ? 14400 : 86400;
    const j = await this.json(`${this.base}/api/charts/v1/trade/${symbol}/${tf}?from=${fromSec}&to=${toSec}`);
    const list: any[] = j.candles ?? [];
    return list
      .map((c) => ({
        ts: Math.floor(Number(c.time) / 1000),
        open: Number(c.open),
        high: Number(c.high),
        low: Number(c.low),
        close: Number(c.close),
        volume: Number(c.volume ?? 0),
      }))
      .filter((c) => c.ts % span === 0 && c.ts + span <= nowSec && c.close > 0 && c.high >= c.low)
      .sort((a, b) => a.ts - b.ts);
  }

  // Tipo de cambio EUR/USD desde la API pública de Kraken (spot).
  async eurusd(): Promise<number> {
    const j = await this.json(`${this.spotBase}/0/public/Ticker?pair=EURUSD`);
    const v = Number(Object.values<any>(j.result ?? {})[0]?.c?.[0]);
    if (!(v > 0.5 && v < 2)) throw new Error("EUR/USD inválido");
    return v;
  }
}
