// Ciclo de aprendizaje semanal (se ejecuta en GitHub Actions).
//  1. Reevalúa todas las familias con los datos más recientes (walk-forward,
//     Monte Carlo, estrés de costes) e investiga variantes nuevas de parámetros.
//  2. Compara las operaciones simuladas reales del motor con lo que el backtest
//     habría hecho en el mismo periodo (control de deriva).
//  3. Envía los resultados al Worker, que vuelve a aplicar los criterios y
//     decide si programa un cambio de estrategia.
// Uso: APEX_URL=https://... RESEARCH_TOKEN=... npx tsx research/learn.ts [--dry]

import type { StrategyConfig } from "../src/core/types";
import { DEFAULT_COSTS, DEFAULT_LIMITS } from "../src/core/types";
import { FAMILIES, defaultGrid } from "../src/core/walkforward";
import { makeConfig } from "../src/core/strategies";
import { backtest } from "../src/core/backtest";
import { rng } from "../src/core/metrics";
import { loadCandles, loadSeries, fundingFn, date } from "./lib";
import { evaluateFamily } from "./evaluate";

const DRY = process.argv.includes("--dry");
const URL_ = process.env.APEX_URL?.replace(/\/$/, "");
const TOKEN = process.env.RESEARCH_TOKEN;

// Variantes exploratorias: cada semana se prueban unas pocas combinaciones
// nuevas dentro de rangos razonables (semilla = semana ISO, reproducible).
function explore(family: string, seed: number, n = 4): StrategyConfig[] {
  const r = rng(seed);
  const pick = (a: number[]) => a[Math.floor(r() * a.length)];
  const out: StrategyConfig[] = [];
  for (let i = 0; i < n; i++) {
    if (family === "tsmom") out.push(makeConfig(family, "1d", { lookback: pick([15, 30, 45, 75, 100, 150]), allowShort: pick([0, 1]), stopAtr: pick([2.5, 3, 4, 5]), threshold: pick([0, 0.02, 0.05]), trail: pick([0, 3]) }));
    if (family === "donchian") {
      const entry = pick([15, 25, 30, 50, 70, 90]);
      out.push(makeConfig(family, "1d", { entry, exit: Math.max(5, Math.round(entry * pick([0.3, 0.5]))), allowShort: pick([0, 1]), stopAtr: pick([1.5, 2, 3, 4]), trail: pick([0, 3]) }));
    }
    if (family === "ema_cross") {
      const fast = pick([5, 10, 15, 20, 30]);
      out.push(makeConfig(family, "1d", { fast, slow: fast * pick([3, 4, 5]), allowShort: pick([0, 1]), stopAtr: pick([2, 3, 4, 5]), trail: pick([0, 3]) }));
    }
    if (family === "rsi_mr") out.push(makeConfig(family, "4h", { rsiLen: pick([2, 3, 4]), oversold: pick([5, 10, 15, 25]), trend: pick([50, 100, 200]), exitMa: pick([3, 5, 10]), maxBars: pick([6, 12, 24]), stopAtr: pick([1.5, 2, 3]), allowShort: 0 }));
    if (family === "boll_mr") out.push(makeConfig(family, "4h", { len: pick([15, 20, 30, 40]), k: pick([1.5, 2, 2.5, 3]), trend: pick([0, 100, 200]), maxBars: pick([12, 18, 30]), stopAtr: pick([1.5, 2, 3]), allowShort: 0 }));
  }
  return out;
}

async function main() {
  const hourly = loadCandles("BTC_binance_1h");
  if (hourly.length < 24 * 365 * 3) throw new Error("datos insuficientes");
  const funding = fundingFn(loadSeries("BTC_binance_funding"));
  const week = Math.floor(Date.now() / (7 * 86400 * 1000));
  // Rejilla base (fijada de antemano) y rejilla ampliada con variantes nuevas.
  // La ampliada solo sustituye a la base si supera los criterios Y mejora el
  // Sharpe fuera de muestra en al menos 0,2: explorar más combinaciones no debe
  // empeorar las decisiones por sobreajuste.
  const base = Object.fromEntries(FAMILIES.map((f) => [f, defaultGrid(f)]));
  const extra = Object.fromEntries(FAMILIES.map((f) => [f, explore(f, week * 31 + f.length)]));
  const totalTrials = FAMILIES.reduce((s, f) => s + base[f].length + extra[f].length, 0);
  const candidates = [];
  const exploration: string[] = [];
  for (const fam of FAMILIES) {
    const b = evaluateFamily(hourly, base[fam], DEFAULT_COSTS, funding, totalTrials).report;
    const x = evaluateFamily(hourly, [...base[fam], ...extra[fam]], DEFAULT_COSTS, funding, totalTrials).report;
    const useExtended = x.gates.passed && x.wf.oosMetrics.sharpe >= b.wf.oosMetrics.sharpe + 0.2;
    const report = useExtended ? x : b;
    exploration.push(`${fam}: base ${b.wf.oosMetrics.sharpe.toFixed(2)}${b.gates.passed ? "✓" : "✗"} / ampliada ${x.wf.oosMetrics.sharpe.toFixed(2)}${x.gates.passed ? "✓" : "✗"}${useExtended ? " → se adopta la ampliada" : ""}`);
    console.log(exploration.at(-1), "→", report.latestConfig?.id, report.gates.checks.filter((c) => !c.ok).map((c) => c.name).join(", "));
    if (!report.latestConfig) continue;
    candidates.push({
      family: fam,
      config: report.latestConfig,
      oosSharpe: report.wf.oosMetrics.sharpe,
      oosCagr: report.wf.oosMetrics.cagr,
      oosMaxDD: report.wf.oosMetrics.maxDrawdown,
      oosTrades: report.wf.oosTrades,
      gateInput: report.gateInput,
    });
  }

  // Control de deriva: ¿coinciden las entradas simuladas del motor con las del
  // backtest sobre los mismos datos de Kraken?
  let drift: { trades: number; matched: number; note: string } | undefined;
  if (URL_ && TOKEN) {
    const r = await fetch(`${URL_}/api/research/export`, { headers: { authorization: `Bearer ${TOKEN}` } });
    if (r.ok) {
      const ex = (await r.json()) as { trades: { entry_ts: number; strategy_id: string; side: string }[]; strategy: { config: StrategyConfig | null } };
      const kraken = loadCandles("BTC_kraken_pf_1h");
      const cfg = ex.strategy?.config;
      const paper = ex.trades.filter((t) => cfg && t.strategy_id === cfg.id);
      if (cfg && paper.length && kraken.length) {
        const from = paper[0].entry_ts - 3600;
        const bt = backtest(kraken, cfg, { initialCapital: 230, limits: DEFAULT_LIMITS, costs: DEFAULT_COSTS, start: from });
        const matched = paper.filter((p) => bt.trades.some((b) => b.side === p.side && Math.abs(b.entryTs - p.entry_ts) <= 2 * 3600)).length;
        drift = { trades: paper.length, matched, note: `${matched}/${paper.length} entradas simuladas coinciden con el backtest` };
      } else drift = { trades: paper.length, matched: 0, note: "sin operaciones suficientes para comparar" };
    }
  }

  const payload = { generatedAt: new Date().toISOString(), dataFrom: date(hourly[0].ts), dataTo: date(hourly.at(-1)!.ts), configsTested: totalTrials, candidates, drift, exploration };
  if (DRY || !URL_ || !TOKEN) {
    console.log(JSON.stringify({ ...payload, candidates: candidates.map((c) => ({ id: c.config.id, sharpe: c.oosSharpe })) }, null, 1));
    if (!DRY) console.log("APEX_URL/RESEARCH_TOKEN no configurados: resultados no enviados");
    return;
  }
  const res = await fetch(`${URL_}/api/research`, { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${TOKEN}` }, body: JSON.stringify(payload) });
  const body = await res.text();
  console.log(res.status, body);
  if (!res.ok) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
