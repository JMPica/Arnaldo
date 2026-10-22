import type { StrategyConfig } from "../core/types";
import { evaluateGates, type GateInput } from "../core/gates";
import { makeConfig } from "../core/strategies";
import type { AccountState } from "../core/engine";
import { event, kvGet, kvPut, loadStrategy, now, type Env } from "./db";
import seed from "../../research/out/champion.json";

// Ciclo de aprendizaje.
// La investigación pesada (walk-forward, Monte Carlo) se ejecuta cada semana en
// GitHub Actions (gratis) con el MISMO código del núcleo y envía aquí los
// resultados. El Worker vuelve a comprobar los criterios, registra todo en el
// historial y solo programa un cambio de estrategia si la candidata supera los
// criterios y mejora a la vigente. El cambio se aplica cuando no hay posición
// abierta y nunca toca los parámetros de riesgo.

export interface CandidateReport {
  family: string;
  config: StrategyConfig;
  oosSharpe: number;
  oosCagr: number;
  oosMaxDD: number;
  oosTrades: number;
  gateInput: GateInput;
}

export interface ResearchPayload {
  generatedAt: string;
  dataFrom: string;
  dataTo: string;
  configsTested: number;
  candidates: CandidateReport[];
  drift?: { trades: number; matched: number; note: string };
  exploration?: string[];
}

const MIN_IMPROVEMENT = 0.2; // mejora mínima de Sharpe OOS para sustituir una estrategia vigente que sigue aprobada

function validConfig(c: StrategyConfig): StrategyConfig | null {
  try {
    const params = Object.fromEntries(Object.entries(c.params).map(([k, v]) => [k, Number(v)]));
    if (!["1h", "4h", "1d"].includes(c.timeframe)) return null;
    if (Object.values(params).some((v) => !Number.isFinite(v))) return null;
    return makeConfig(c.family, c.timeframe, params);
  } catch {
    return null;
  }
}

export async function ingestResearch(env: Env, p: ResearchPayload): Promise<{ promoted: string | null; summary: string }> {
  const t = now();
  const db = env.DB;
  const st: D1PreparedStatement[] = [];
  const evaluated = p.candidates
    .map((c) => ({ ...c, config: validConfig(c.config), gates: evaluateGates(c.gateInput) }))
    .filter((c): c is typeof c & { config: StrategyConfig } => c.config !== null);
  for (const c of evaluated) {
    st.push(
      db
        .prepare(
          "INSERT INTO strategies (id, family, timeframe, params, status, oos_sharpe, metrics, gates, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET oos_sharpe = excluded.oos_sharpe, metrics = excluded.metrics, gates = excluded.gates, status = CASE WHEN strategies.status IN ('active','retired') THEN strategies.status ELSE excluded.status END",
        )
        .bind(c.config.id, c.family, c.config.timeframe, JSON.stringify(c.config.params), c.gates.passed ? "approved" : "rejected", c.oosSharpe, JSON.stringify({ cagr: c.oosCagr, maxDD: c.oosMaxDD, trades: c.oosTrades }), JSON.stringify(c.gates), t),
    );
  }
  const passing = evaluated.filter((c) => c.gates.passed).sort((a, b) => b.oosSharpe - a.oosSharpe);
  const best = passing[0];
  const current = await loadStrategy(env);
  const currentEval = current.config ? evaluated.find((c) => c.family === current.config!.family) : undefined;
  let promoted: string | null = null;
  let reason = "";
  if (best) {
    if (!current.config || !current.approved) {
      promoted = best.config.id;
      reason = "no había estrategia aprobada";
    } else if (best.config.id !== current.config.id) {
      if (!currentEval || !currentEval.gates.passed) {
        promoted = best.config.id;
        reason = "la familia vigente ya no supera los criterios con los datos nuevos";
      } else if (best.oosSharpe >= currentEval.oosSharpe + MIN_IMPROVEMENT || (best.family === current.config.family && best.config.id !== current.config.id)) {
        promoted = best.config.id;
        reason = best.family === current.config.family ? "reajuste walk-forward de parámetros de la misma familia" : `mejora de Sharpe OOS ${currentEval.oosSharpe.toFixed(2)} → ${best.oosSharpe.toFixed(2)}`;
      }
    }
  } else if (current.config && current.approved && currentEval && !currentEval.gates.passed) {
    // Ninguna supera los criterios y la vigente tampoco: modo observación.
    st.push(kvPut(db, "strategy", { config: current.config, approved: false }));
    st.push(event(db, "audit", "strategy_suspended", "La estrategia vigente ya no supera los criterios: el motor pasa a modo observación (sin nuevas entradas)."));
  }
  if (promoted && best) st.push(kvPut(db, "pending_strategy", { config: best.config, reason }));
  const summary = `Investigación ${p.dataTo}: ${p.configsTested} configuraciones, ${passing.length}/${evaluated.length} familias aprobadas${promoted ? `; programado cambio a ${promoted} (${reason})` : "; sin cambios"}${p.drift ? `; control de deriva: ${p.drift.note}` : ""}`;
  st.push(db.prepare("INSERT INTO learning (ts, kind, summary, data) VALUES (?, 'research', ?, ?)").bind(t, summary, JSON.stringify(p)));
  st.push(event(db, "info", "research", summary));
  await db.batch(st);
  return { promoted, summary };
}

// Primera puesta en marcha: carga la estrategia aprobada por la investigación
// incluida en el despliegue.
export async function seedStrategy(env: Env): Promise<void> {
  if (await kvGet(env.DB, "strategy")) return;
  const s = seed as { approved: boolean; config?: StrategyConfig; family?: string; oosSharpe?: number; reason?: string; gates?: unknown };
  const t = now();
  const st: D1PreparedStatement[] = [kvPut(env.DB, "strategy", { config: s.config ?? null, approved: !!s.approved })];
  if (s.config) {
    st.push(
      env.DB.prepare("INSERT OR IGNORE INTO strategies (id, family, timeframe, params, status, oos_sharpe, gates, created_at, activated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)").bind(
        s.config.id,
        s.config.family,
        s.config.timeframe,
        JSON.stringify(s.config.params),
        s.approved ? "active" : "rejected",
        s.oosSharpe ?? null,
        JSON.stringify(s.gates ?? null),
        t,
        s.approved ? t : null,
      ),
    );
  }
  st.push(env.DB.prepare("INSERT INTO learning (ts, kind, summary, data) VALUES (?, 'promotion', ?, ?)").bind(t, s.approved ? `Estrategia inicial aprobada por la investigación: ${s.config?.id}` : `Sin estrategia aprobada: ${s.reason}`, JSON.stringify(s)));
  await env.DB.batch(st);
}

export async function exportForResearch(env: Env) {
  const [trades, decisions, account, strategy] = await Promise.all([
    env.DB.prepare("SELECT * FROM trades ORDER BY exit_ts").all(),
    env.DB.prepare("SELECT ts, strategy_id, action, acted FROM decisions WHERE acted = 1 ORDER BY ts").all(),
    kvGet<AccountState>(env.DB, "account"),
    loadStrategy(env),
  ]);
  return { trades: trades.results, decisions: decisions.results, account, strategy };
}
