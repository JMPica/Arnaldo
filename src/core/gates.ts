// Criterios de aceptación de una estrategia. Fijados ANTES de ver los
// resultados y compartidos por la investigación inicial y por el aprendizaje
// automático: ninguna estrategia nueva sustituye a la vigente sin superarlos.

export const GATES = Object.freeze({
  minOosSharpe: 0.5, // Sharpe anualizado fuera de muestra (walk-forward)
  minOosPsr: 0.9, // probabilidad de que el Sharpe OOS real sea > 0
  minPositiveFolds: 0.55, // fracción de ventanas OOS con beneficio
  maxProbDD20: 0.1, // Monte Carlo: P(caída ≥ 20 % en 1 año)
  minOosTrades: 30,
  minNeighborPositive: 0.6, // estabilidad: fracción de configuraciones vecinas con Sharpe > 0
  maxOosDrawdown: 0.2,
  minStressSharpe: 0, // Sharpe OOS con costes ×2
});

export interface GateInput {
  oosSharpe: number;
  oosPsr: number;
  positiveFolds: number;
  probDD20: number;
  oosTrades: number;
  neighborPositive: number;
  oosMaxDD: number;
  stressSharpe: number;
}

export interface GateResult {
  passed: boolean;
  checks: { name: string; value: number; threshold: number; ok: boolean }[];
}

export function evaluateGates(i: GateInput): GateResult {
  const checks = [
    { name: "Sharpe OOS", value: i.oosSharpe, threshold: GATES.minOosSharpe, ok: i.oosSharpe >= GATES.minOosSharpe },
    { name: "PSR OOS", value: i.oosPsr, threshold: GATES.minOosPsr, ok: i.oosPsr >= GATES.minOosPsr },
    { name: "Ventanas OOS positivas", value: i.positiveFolds, threshold: GATES.minPositiveFolds, ok: i.positiveFolds >= GATES.minPositiveFolds },
    { name: "P(caída ≥20 %) Monte Carlo", value: i.probDD20, threshold: GATES.maxProbDD20, ok: i.probDD20 <= GATES.maxProbDD20 },
    { name: "Operaciones OOS", value: i.oosTrades, threshold: GATES.minOosTrades, ok: i.oosTrades >= GATES.minOosTrades },
    { name: "Estabilidad de parámetros", value: i.neighborPositive, threshold: GATES.minNeighborPositive, ok: i.neighborPositive >= GATES.minNeighborPositive },
    { name: "Caída máxima OOS", value: i.oosMaxDD, threshold: GATES.maxOosDrawdown, ok: i.oosMaxDD <= GATES.maxOosDrawdown },
    { name: "Sharpe OOS con costes ×2", value: i.stressSharpe, threshold: GATES.minStressSharpe, ok: i.stressSharpe > GATES.minStressSharpe },
  ];
  return { passed: checks.every((c) => c.ok), checks };
}
