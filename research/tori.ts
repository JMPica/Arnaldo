// Prueba específica de la estrategia de líneas de tendencia (Tori Trades).
// Uso: npx tsx research/tori.ts [BTC,PLATINUM,...]
import { DEFAULT_COSTS } from "../src/core/types";
import { defaultGrid, FAMILIES } from "../src/core/walkforward";
import { makeConfig } from "../src/core/strategies";
import { loadCandles, loadSeries, fundingFn, fmt, fmtPct } from "./lib";
import { evaluateFamily } from "./evaluate";

const files: Record<string, string> = { BTC: "BTC_binance_1h", PLATINUM: "PLATINUM_oanda_1h", OIL: "OIL_oanda_1h", GOLD: "GOLD_oanda_1h", SILVER: "SILVER_oanda_1h" };
const assets = (process.argv[2] ?? "PLATINUM,OIL,BTC,GOLD,SILVER").split(",");
const variants: [string, number][] = [["solo rupturas", 0], ["rupturas + rebotes", 1]];
for (const asset of assets) {
  const h = loadCandles(files[asset]);
  const funding = asset === "BTC" ? fundingFn(loadSeries("BTC_binance_funding")) : () => 0;
  for (const [label, bounce] of variants) {
    const t0 = Date.now();
    const grid = defaultGrid("trendline").map((c) => makeConfig(c.family, c.timeframe, { ...c.params, bounce }));
    const { report } = evaluateFamily(h, grid, DEFAULT_COSTS, funding, grid.length * FAMILIES.length * 2);
    const w = report.wf;
    console.log(`${asset} (${label}): Sharpe OOS ${fmt(w.oosMetrics.sharpe)} | CAGR OOS ${fmtPct(w.oosMetrics.cagr)} | caída máx ${fmtPct(w.oosMetrics.maxDrawdown)} | ops ${w.oosTrades} | ventanas+ ${fmtPct(w.positiveFolds, 0)} | P(DD≥20%) ${fmtPct(w.monteCarlo.probDD20, 0)} | ${report.gates.passed ? "APROBADA" : "rechazada: " + report.gates.checks.filter((c) => !c.ok).map((c) => c.name).join(", ")} (${((Date.now() - t0) / 1000).toFixed(0)} s)`);
  }
}
