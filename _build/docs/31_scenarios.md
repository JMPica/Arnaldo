---
title: "Análisis de escenarios"
subtitle: "Conservador, Base, Optimista y Estrés: definición, resultados, disparadores de cambio y lectura para la decisión"
short: "Scenario Analysis"
kicker: "03 · BUSINESS CASE"
out: ["03_BUSINESS_CASE/Scenario Analysis.pdf"]
---

# Definición de escenarios

Ningún escenario lleva probabilidad asignada: no existen datos que la sustenten. Todos comparten gastos fijos base (ajustados por un factor) y la misma estructura fiscal.

| Parámetro | Conservador | Base | Optimista | Estrés |
|---|---|---|---|---|
| Lógica | Baja aceptación, costes altos | Desarrollo gradual con distribuidor habilitado | Distribución estable y volúmenes crecientes | Bloqueo de Cuba desde 2029, retrasos y costes altos |
| PVP | 20 € | 24 € | 28 € | 24 € |
| FOB | 7,0 USD | 6,0 USD | 5,0 USD | 7,5 USD |
| Demanda 2028 → 2031 | 1.000 → 2.500 | 2.000 → 6.500 | 3.500 → 12.000 | 2.000 → 6.500 (sin suministro desde 2029) |
| Tarifa distribuidor | 6% | 5% | 4,5% | 6% |
| Merma | 5% | 3% | 2% | 8% |
| Plazo pedido→llegada | 6 meses | 5 meses | 4 meses | 10 meses |
| Factor de gastos fijos | 1,15 | 1,00 | 1,10 | 1,20 |

# Resultados

| Métrica | Conservador | Base | Optimista | Estrés |
|---|---|---|---|---|
| Unidades 2027–2031 | {{cons_units_total}} | {{base_units_total}} | {{opt_units_total}} | {{stress_units_total}} |
| Ingresos de la marca 2027–2031 (antes de IEE) | {{cons_rev_total}} | {{base_rev_total}} | {{opt_rev_total}} | {{stress_rev_total}} |
| EBITDA 2029 | {{cons_ebitda_2029}} | {{base_ebitda_2029}} | {{opt_ebitda_2029}} | {{stress_ebitda_2029}} |
| EBITDA 2030 | {{cons_ebitda_2030}} | {{base_ebitda_2030}} | {{opt_ebitda_2030}} | {{stress_ebitda_2030}} |
| EBITDA 2031 | {{cons_ebitda_2031}} | {{base_ebitda_2031}} | {{opt_ebitda_2031}} | {{stress_ebitda_2031}} |
| FCF acumulado | {{cons_fcf_cum}} | {{base_fcf_cum}} | {{opt_fcf_cum}} | {{stress_fcf_cum}} |
| Necesidad máxima de financiación | {{cons_need}} | {{base_need}} | {{opt_need}} | {{stress_need}} |
| VAN al 18% | {{cons_npv}} | {{base_npv}} | {{opt_npv}} | {{stress_npv}} |
| Contribución/u 2030 | {{cons_contrib}} | {{base_contrib}} | {{opt_contrib}} | {{stress_contrib}} |
| Punto muerto 2030 | {{cons_be}} | {{base_be}} | {{opt_be}} | {{stress_be}} |

# Lectura por escenario

**Conservador.** A 20 € y 7 USD de FOB cada unidad destruye valor ({{cons_contrib}}). Vender más empeora el resultado. Es el retrato de una marca que entra por precio sin escala.

**Base.** La contribución positiva pero pequeña ({{base_contrib}}) no cubre unos fijos de ≈23–24 k€ anuales; la necesidad de financiación ({{base_need}}) excede cualquier nivel de capital considerado. Para hacerlo viable bastaría combinar FOB ≤ 5 USD y PVP ≥ 25 € o volumen ≥ {{base_be}}.

**Optimista.** Es el único escenario con EBITDA positivo desde 2029 y VAN positivo ({{opt_npv}}, TIR {{opt_irr}}), pero depende de supuestos encadenados: precio de 28 € aceptado por expendedurías, FOB de 5 USD, 12.000 unidades en 2031 y suministro sin interrupciones. Incluso así necesita {{opt_need}} de financiación y el FCF acumulado sigue negativo en 2031 ({{opt_fcf_cum}}): el valor depende del valor terminal.

**Estrés.** El bloqueo del suministro desde 2029 deja la estructura sin producto: el stock se agota en 2029 y los gastos fijos continúan. Pérdida acumulada de {{stress_ni_cum}}. Muestra por qué el lote inicial debe ser pequeño y los gastos fijos, variables o cancelables.

# Coherencia con la demanda y con la retribución del promotor

| | Conservador | Base | Optimista |
|---|---|---|---|
| Unidades 2031 | {{cons_units_2031}} | {{base_units_2031}} | {{opt_units_2031}} |
| Puntos de venta activos necesarios en 2031 (4 cajas de 10 u por punto y año) | {{cons_pos_2031}} | {{base_pos_2031}} | {{opt_pos_2031}} |
| Unidades de punto muerto adicionales por cada 10.000 €/año de remuneración del promotor | {{cons_be_per10k}} | {{base_be_per10k}} | {{opt_be_per10k}} |

**Lectura.** La demanda accesible estimada de abajo arriba (`Brand Strategy.pdf`) es de 1.600–6.000 u/año: 800–1.500 expendedurías relevantes × 5–10% que incorporan la marca × 4 cajas de 10 u, es decir, 40–150 puntos activos [HIPÓTESIS]. El escenario Base en 2031 ({{base_units_2031}} u, {{base_pos_2031}} puntos) supera ligeramente ese techo; el Optimista ({{opt_units_2031}} u, {{opt_pos_2031}} puntos) lo **duplica**, y además a un PVP de 28 €, superior al de los Habanos clásicos de referencia. El único escenario con VAN positivo descansa, por tanto, sobre una demanda que el propio estudio no considera accesible. Antes de comprometer capital más allá de la Fase 0 hay que demostrar con cartas de interés que la demanda supera las 6.000 u/año a ≥ 25 €.

**Retribución.** Los resultados se muestran antes de retribuir al promotor. Cada 10.000 €/año de remuneración eleva el punto muerto en ≈{{base_be_per10k}} (Base) o ≈{{opt_be_per10k}} (Optimista); en Conservador y Estrés no existe punto muerto.

# Disparadores para cambiar de escenario o de decisión

| Señal observable | Lectura | Acción |
|---|---|---|
| Cotización FOB ≤ 5 USD con packaging incluido o por separado ≤ 1,7 €/u | Se acerca al Optimista | Continuar a Fase 3 si C1–C2 |
| Cotización FOB ≥ 7 USD | Conservador/Estrés | NO-GO salvo PVP ≥ 30 € validado |
| ≥10 expendedurías aceptan PVP ≥ 25 € por escrito | Valida precio | Mantener posicionamiento B |
| Distribuidor exige > 6% del PVP o mínimos altos | Reduce contribución | Renegociar o usar otro distribuidor |
| Retrasos de producción > 8 meses en el piloto | Estrés | Congelar segundo pedido |
| Cualquier condición de titularidad de marca a favor de la contraparte | Riesgo de pérdida del activo | NO-GO |
| Cambio normativo cubano que habilite exportación privada de tabaco torcido | Nueva vía | Reevaluar V3 con abogado |

# Comparación con la vía B3

Con 40–60 k€ la vía B3 (importación de marcas no cubanas) obtiene una contribución de {{b3_contrib}} por unidad a PVP 15 € y un punto muerto de ≈{{b3_be}} unidades/año, con arancel 0% [PROBABLE] y sin dependencia del sistema estatal cubano. Es el principal argumento para la estrategia secuencial recomendada (E3).

Modelo: `03_BUSINESS_CASE/Financial Model 2027–2031.xlsx` · cambiar el escenario en `Assumptions!C4`.
