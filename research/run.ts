// Investigación cuantitativa de APEX.
// Uso: npx tsx research/run.ts [--quick] [--assets BTC,GOLD]
// Produce research/out/results.json, research/out/champion.json y docs/INVESTIGACION.md

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Candle, CostModel, StrategyConfig } from "../src/core/types";
import { DEFAULT_COSTS, DEFAULT_LIMITS } from "../src/core/types";
import { backtest } from "../src/core/backtest";
import { computeMetrics, type Metrics } from "../src/core/metrics";
import { FAMILIES, defaultGrid, type WalkForwardResult } from "../src/core/walkforward";
import { GATES } from "../src/core/gates";
import { makeConfig } from "../src/core/strategies";
import { loadCandles, loadSeries, fundingFn, fmt, fmtPct, date } from "./lib";
import { evaluateFamily, WF, type FamilyReport } from "./evaluate";

const args = process.argv.slice(2);
const QUICK = args.includes("--quick");
const assetArg = args.includes("--assets") ? args[args.indexOf("--assets") + 1].split(",") : null;
const OUT = join(import.meta.dirname, "out");
mkdirSync(OUT, { recursive: true });

const ASSETS = [
  { key: "BTC", file: "BTC_binance_1h", label: "Bitcoin (BTCUSDT, Binance spot como proxy del perpetuo)", funding: "BTC_binance_funding" },
  { key: "GOLD", file: "GOLD_oanda_1h", label: "Oro (XAU/USD, OANDA)", daily: false },
  { key: "SILVER", file: "SILVER_oanda_1h", label: "Plata (XAG/USD, OANDA)", daily: false },
  { key: "COPPER", file: "COPPER_oanda_1h", label: "Cobre (XCU/USD, OANDA)", daily: false },
  { key: "PLATINUM", file: "PLATINUM_oanda_1h", label: "Platino (XPT/USD, OANDA)", daily: false },
  { key: "OIL", file: "OIL_oanda_1h", label: "Petróleo WTI (OANDA)", daily: false },
  { key: "NATGAS", file: "NATGAS_oanda_1h", label: "Gas natural (OANDA)", daily: false },
].filter((a) => !assetArg || assetArg.includes(a.key));

const eurusdSeries = loadCandles("EURUSD_oanda_1h");
const EURUSD = eurusdSeries.at(-1)?.close ?? 1.16;
const CAPITAL_EUR = 200;
const CAPITAL = CAPITAL_EUR * EURUSD; // la cuenta del exchange se lleva en USD
// Para la investigación estadística se usa un capital nominal grande (ver
// evaluate.ts) para que el lote mínimo no distorsione los resultados; la prueba
// "realidad 200 €" se hace aparte con el capital real.

interface AssetReport {
  asset: string;
  label: string;
  from: string;
  to: string;
  hours: number;
  buyHold: Metrics;
  families: FamilyReport[];
}

function buyHold(hourly: Candle[], start: number): Metrics {
  const daily: { ts: number; equity: number }[] = [];
  let last = -1;
  for (const b of hourly) {
    if (b.ts < start) continue;
    const d = Math.floor(b.ts / 86400);
    if (d !== last) {
      daily.push({ ts: d * 86400, equity: b.close });
      last = d;
    } else daily[daily.length - 1].equity = b.close;
  }
  return computeMetrics(daily, []);
}

function runAsset(a: (typeof ASSETS)[number]): { report: AssetReport; wfByFamily: Record<string, WalkForwardResult>; hourly: Candle[]; funding: (ts: number) => number } | null {
  let hourly = loadCandles(a.file);
  const daily = "daily" in a && a.daily;
  if (hourly.length < (daily ? 365 * 3 : 24 * 365 * 3)) {
    console.log(`(sin datos suficientes para ${a.key}: ${hourly.length} velas)`);
    return null;
  }
  if (QUICK) hourly = hourly.slice(daily ? -365 * 6 : -24 * 365 * 5);
  const funding = a.funding ? fundingFn(loadSeries(a.funding)) : () => 0;
  const costs: CostModel = { ...DEFAULT_COSTS };
  const start = hourly[0].ts + 365 * 86400;
  const families: FamilyReport[] = [];
  const wfByFamily: Record<string, WalkForwardResult> = {};
  for (const fam of FAMILIES) {
    const t0 = Date.now();
    // Con velas diarias cada vela se trata como un paso del motor: los
    // parámetros se cuentan en días y la orden se ejecuta en la apertura siguiente.
    const grid = daily ? defaultGrid(fam).map((c) => makeConfig(c.family, "1h", c.params)) : defaultGrid(fam);
    const { report, wf } = evaluateFamily(hourly, grid, costs, funding, grid.length * FAMILIES.length, !daily);
    wfByFamily[fam] = wf;
    families.push(report);
    const gates = report.gates;
    console.log(`${a.key} ${fam}: OOS Sharpe ${fmt(wf.oosMetrics.sharpe)} CAGR ${fmtPct(wf.oosMetrics.cagr)} MDD ${fmtPct(wf.oosMetrics.maxDrawdown)} trades ${wf.oosTrades} gates ${gates.passed ? "OK" : "NO"} (${((Date.now() - t0) / 1000).toFixed(0)} s)`);
  }
  const wfStart = wfByFamily[FAMILIES[0]]?.oosDaily[0]?.ts ?? start;
  return {
    report: { asset: a.key, label: a.label, from: date(hourly[0].ts), to: date(hourly.at(-1)!.ts), hours: hourly.length, buyHold: buyHold(hourly, wfStart), families },
    wfByFamily,
    hourly,
    funding,
  };
}

// Prueba de realidad con 200 €: tamaño mínimo de lote, euros reales, comisiones.
function reality200(hourly: Candle[], cfg: StrategyConfig, funding: (ts: number) => number) {
  const start = hourly.at(-1)!.ts - 2 * 365 * 86400;
  const r = backtest(hourly, cfg, { initialCapital: CAPITAL, limits: DEFAULT_LIMITS, costs: DEFAULT_COSTS, funding, start });
  const m = computeMetrics(r.daily, r.trades);
  const notionals = r.trades.map((t) => t.qty * t.entryPrice);
  return {
    config: cfg.id,
    period: `${date(start)} → ${date(hourly.at(-1)!.ts)}`,
    capitalUsd: CAPITAL,
    finalUsd: r.finalEquity,
    pnlEur: (r.finalEquity - CAPITAL) / EURUSD,
    feesEur: r.feesPaid / EURUSD,
    fundingEur: r.fundingPaid / EURUSD,
    trades: r.trades.length,
    rejectedTooSmallOrOther: r.rejects,
    avgNotionalUsd: notionals.length ? notionals.reduce((a, b) => a + b, 0) / notionals.length : 0,
    avgLeverage: notionals.length ? notionals.reduce((a, b) => a + b, 0) / notionals.length / CAPITAL : 0,
    metrics: m,
  };
}

const t0 = Date.now();
const reports: AssetReport[] = [];
let btcCtx: ReturnType<typeof runAsset> = null;
for (const a of ASSETS) {
  const r = runAsset(a);
  if (!r) continue;
  reports.push(r.report);
  if (a.key === "BTC") btcCtx = r;
}

// Selección del campeón: entre las familias BTC que superan TODOS los criterios,
// la de mayor Sharpe OOS. Se usa la configuración elegida en la última ventana.
const btc = reports.find((r) => r.asset === "BTC");
const passing = (btc?.families ?? []).filter((f) => f.gates.passed && f.latestConfig).sort((x, y) => y.wf.oosMetrics.sharpe - x.wf.oosMetrics.sharpe);
const champion = passing[0] ?? null;
let reality = null;
if (btcCtx) {
  const cand = champion ?? [...btcCtx.report.families].sort((x, y) => y.wf.oosMetrics.sharpe - x.wf.oosMetrics.sharpe)[0];
  if (cand?.latestConfig) reality = reality200(btcCtx.hourly, cand.latestConfig, btcCtx.funding);
}

// Contratos de materias primas en Coinbase (CDE): nocional mínimo frente al capital.
// Tamaños de contrato verificados en la API pública de Coinbase (research/data/coinbase_futures_products.json).
const SPECS: Record<string, { unit: string; size: number; source: string }> = {
  BTC: { unit: "BTC", size: 0.01, source: "nano Bitcoin BIT/BIP, 0,01 BTC" },
  GOLD: { unit: "oz", size: 1, source: "Gold GOL, 1 onza troy" },
  SILVER: { unit: "oz", size: 50, source: "Silver SLR, 50 onzas" },
  COPPER: { unit: "lb", size: 2000, source: "Copper CU, 2.000 libras" },
  PLATINUM: { unit: "oz", size: 10, source: "Platinum PT, 10 onzas" },
  OIL: { unit: "barriles", size: 10, source: "Oil NOL, 10 barriles" },
  NATGAS: { unit: "MMBtu", size: 1000, source: "Natural Gas NGS, 1.000 MMBtu" },
};
const SCREENSHOT_PRICES: Record<string, number> = { BTC: 84355, GOLD: 4141.6, SILVER: 57.665, COPPER: 6.55, PLATINUM: 1627.9, OIL: 97.92, NATGAS: 2.778 };
const contractCheck = Object.entries(SPECS).map(([k, s]) => {
  const px = SCREENSHOT_PRICES[k];
  const notional = px * s.size;
  return { asset: k, contract: s.source, price: px, notionalUsd: notional, leverageNeeded: notional / CAPITAL, fitsWithin2x: notional <= CAPITAL * 2 };
});

const results = {
  generatedAt: new Date().toISOString(),
  quick: QUICK,
  capital: { eur: CAPITAL_EUR, eurusd: EURUSD, usd: CAPITAL },
  costs: DEFAULT_COSTS,
  limits: DEFAULT_LIMITS,
  walkForward: WF,
  gates: GATES,
  reports,
  champion: champion ? { family: champion.family, config: champion.latestConfig, oosSharpe: champion.wf.oosMetrics.sharpe } : null,
  reality200: reality,
  contractCheck,
  runtimeSec: (Date.now() - t0) / 1000,
};
writeFileSync(join(OUT, "results.json"), JSON.stringify(results, null, 1));
writeFileSync(
  join(OUT, "champion.json"),
  JSON.stringify(
    champion
      ? { approved: true, config: champion.latestConfig, family: champion.family, gates: champion.gates, oosSharpe: champion.wf.oosMetrics.sharpe, generatedAt: results.generatedAt }
      : { approved: false, reason: "Ninguna estrategia BTC superó todos los criterios de aceptación", generatedAt: results.generatedAt },
    null,
    1,
  ),
);
if (!QUICK) writeFileSync(join(import.meta.dirname, "..", "docs", "INVESTIGACION.md"), renderMarkdown(results));
console.log(`Hecho en ${results.runtimeSec.toFixed(0)} s. Campeón: ${champion ? champion.latestConfig?.id : "ninguno"}`);

function renderMarkdown(r: typeof results): string {
  const L: string[] = [];
  L.push(`# APEX — Informe de investigación cuantitativa`, ``);
  L.push(`Generado automáticamente por \`research/run.ts\` el ${r.generatedAt.slice(0, 16).replace("T", " ")} UTC. No editar a mano.`, ``);
  L.push(`## Metodología`, ``);
  L.push(`- **Datos reales horarios.** BTC: velas de 1 h de Binance (BTCUSDT) como proxy del perpetuo, con la serie histórica de *funding* de Binance aplicada hora a hora. Materias primas: velas de 1 h de OANDA (contado/CFD).`);
  L.push(`- **Mismo código que en producción.** El backtest usa la misma función \`processHour()\` que ejecuta el motor real: mismas señales, mismo dimensionado, mismo motor de riesgo.`);
  L.push(`- **Sin mirar al futuro.** Las señales se calculan con velas cerradas y se ejecutan en la apertura de la vela siguiente. Los stops se evalúan contra el máximo/mínimo de cada hora; si hay hueco, se ejecutan al precio de apertura.`);
  L.push(`- **Costes:** comisión taker ${fmtPct(r.costs.takerFee, 2)} por lado + deslizamiento ${fmtPct(r.costs.slippage, 2)} por lado + funding real. Prueba de estrés con costes ×2.`);
  L.push(`- **Riesgo:** ${fmtPct(r.limits.riskPerTrade, 0)} del capital hasta el stop, apalancamiento máximo ${r.limits.maxLeverage}x, una posición, suspensión con caída del ${fmtPct(r.limits.maxDrawdown, 0)}.`);
  L.push(`- **Walk-forward:** optimiza en ${r.walkForward.trainDays} días, evalúa los ${r.walkForward.testDays} siguientes fuera de muestra (OOS) y avanza. Solo cuenta el tramo OOS encadenado.`);
  L.push(`- **Sobreajuste:** ratio de Sharpe deflactado (Bailey y López de Prado) con el número total de configuraciones probadas; estabilidad = fracción de configuraciones de la familia con Sharpe > 0.`);
  L.push(`- **Monte Carlo:** 2.000 remuestreos por bloques de 10 días de los rendimientos OOS, horizonte de 1 año.`, ``);
  L.push(`### Criterios de aceptación (fijados antes de ver resultados)`, ``);
  L.push(`| Criterio | Umbral |`, `|---|---|`);
  L.push(`| Sharpe OOS | ≥ ${r.gates.minOosSharpe} |`, `| PSR OOS (prob. Sharpe > 0) | ≥ ${r.gates.minOosPsr} |`, `| Ventanas OOS con beneficio | ≥ ${fmtPct(r.gates.minPositiveFolds, 0)} |`);
  L.push(`| P(caída ≥ 20 % en 1 año), Monte Carlo | ≤ ${fmtPct(r.gates.maxProbDD20, 0)} |`, `| Operaciones OOS | ≥ ${r.gates.minOosTrades} |`, `| Estabilidad de parámetros | ≥ ${fmtPct(r.gates.minNeighborPositive, 0)} |`);
  L.push(`| Caída máxima OOS | ≤ ${fmtPct(r.gates.maxOosDrawdown, 0)} |`, `| Sharpe OOS con costes ×2 | > ${r.gates.minStressSharpe} |`, ``);
  for (const rep of r.reports) {
    L.push(`## ${rep.label}`, ``);
    L.push(`Datos: ${rep.from} → ${rep.to} (${rep.hours.toLocaleString("es-ES")} velas de 1 h).`, ``);
    L.push(`**Alternativa pasiva (comprar y mantener, mismo periodo OOS):** CAGR ${fmtPct(rep.buyHold.cagr)}, Sharpe ${fmt(rep.buyHold.sharpe)}, caída máxima ${fmtPct(rep.buyHold.maxDrawdown)}.`, ``);
    L.push(`| Familia | Sharpe OOS | CAGR OOS | Caída máx. OOS | Ops OOS | Ventanas + | PSR | P(DD≥20 %) | Sharpe costes×2 | DSR muestra completa | Estabilidad | ¿Aprobada? |`);
    L.push(`|---|---|---|---|---|---|---|---|---|---|---|---|`);
    for (const f of rep.families) {
      L.push(`| ${f.family} | ${fmt(f.wf.oosMetrics.sharpe)} | ${fmtPct(f.wf.oosMetrics.cagr)} | ${fmtPct(f.wf.oosMetrics.maxDrawdown)} | ${f.wf.oosTrades} | ${fmtPct(f.wf.positiveFolds, 0)} | ${fmt(f.wf.oosPsr)} | ${fmtPct(f.wf.monteCarlo.probDD20, 0)} | ${fmt(f.stressSharpe)} | ${fmt(f.fullSample.dsr)} | ${fmtPct(f.fullSample.neighborPositive, 0)} | ${f.gates.passed ? "**Sí**" : "No"} |`);
    }
    L.push(``);
    const failing = rep.families.filter((f) => !f.gates.passed);
    if (failing.length) {
      L.push(`<details><summary>Motivos de rechazo</summary>`, ``);
      for (const f of failing) L.push(`- **${f.family}**: ${f.gates.checks.filter((c) => !c.ok).map((c) => `${c.name} = ${fmt(c.value)} (umbral ${fmt(c.threshold)})`).join("; ")}`);
      L.push(``, `</details>`, ``);
    }
  }
  L.push(`## Resultado`, ``);
  if (r.champion) {
    L.push(`**Estrategia aprobada para paper trading:** \`${r.champion.config?.id}\` (familia ${r.champion.family}, Sharpe OOS ${fmt(r.champion.oosSharpe)}).`, ``);
  } else {
    L.push(`**Ninguna estrategia BTC superó todos los criterios.** El motor queda en modo observación: registra señales y datos, pero no abre operaciones simuladas con una estrategia no aprobada. El ciclo de aprendizaje semanal seguirá evaluando candidatas.`, ``);
  }
  if (r.reality200) {
    const x = r.reality200;
    L.push(`### Prueba de realidad con ${r.capital.eur} € (${x.period})`, ``);
    L.push(`Configuración: \`${x.config}\`. Capital ${fmt(x.capitalUsd)} USD (EUR/USD ${fmt(r.capital.eurusd, 4)}).`, ``);
    L.push(`| Métrica | Valor |`, `|---|---|`);
    L.push(`| Resultado neto | ${fmt(x.pnlEur)} € |`, `| Comisiones pagadas | ${fmt(x.feesEur)} € |`, `| Funding pagado | ${fmt(x.fundingEur)} € |`, `| Operaciones | ${x.trades} |`, `| Órdenes rechazadas por riesgo/tamaño | ${x.rejectedTooSmallOrOther} |`, `| Nocional medio por operación | ${fmt(x.avgNotionalUsd)} USD |`, `| Apalancamiento medio | ${fmt(x.avgLeverage)}x |`, `| CAGR | ${fmtPct(x.metrics.cagr)} |`, `| Caída máxima | ${fmtPct(x.metrics.maxDrawdown)} |`, ``);
  }
  L.push(`## Viabilidad de los contratos de Coinbase con ${r.capital.eur} € y apalancamiento máximo 2x`, ``);
  L.push(`| Activo | Contrato | Precio (captura) | Nocional por contrato | Apalancamiento necesario | ¿Cabe en 2x? |`, `|---|---|---|---|---|---|`);
  for (const c of r.contractCheck) L.push(`| ${c.asset} | ${c.contract} | ${c.price.toLocaleString("es-ES")} | ${fmt(c.notionalUsd, 0)} USD | ${fmt(c.leverageNeeded, 1)}x | ${c.fitsWithin2x ? "Sí" : "**No**"} |`);
  L.push(``, `Ningún contrato de Coinbase Derivatives cabe en el límite de 2x con ${r.capital.eur} €: un solo contrato ya supera el apalancamiento permitido. Además, con un riesgo del 1 % (≈ ${fmt(r.capital.usd * 0.01)} USD) y un contrato nano de BTC (0,01 BTC), el stop tendría que estar a ≈ ${fmt((r.capital.usd * 0.01) / 0.01, 0)} USD del precio (≈ ${fmtPct((r.capital.usd * 0.01) / 0.01 / 84355, 2)}), muy por debajo del ruido horario de BTC.`, ``);
  return L.join("\n");
}
