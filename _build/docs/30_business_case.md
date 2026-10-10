---
title: "Business Case — Marca propia ARNALDO"
subtitle: "Economía unitaria, necesidades de capital, rentabilidad y punto muerto 2027–2031, construidos desde cero y auditables en el modelo XLSX"
short: "Business Case"
kicker: "03 · BUSINESS CASE"
toc: true
out: ["03_BUSINESS_CASE/Business Case.pdf"]
---

# Conclusión financiera

> Con los supuestos actuales —ninguno de ellos confirmado por cotización— **la marca propia fabricada en Cuba no es rentable en el escenario Base**: la contribución por unidad a PVP 24 € es de sólo {{base_contrib}}, el punto muerto exige {{base_be}} y la necesidad máxima de financiación alcanza {{base_need}}. Sólo el escenario Optimista (PVP 28 €, FOB 5 USD, 12.000 u en 2031) genera VAN positivo ({{opt_npv}}) y TIR {{opt_irr}}, y aun así requiere {{opt_need}} de financiación.

La causa es estructural: con origen Cuba, el Estado (IVA + impuesto especial + arancel) se lleva ≈{{state_pct_base}} del PVP y el canal (expendedor + distribuidor) ≈14%. Con un coste en destino de {{base_landed}} por unidad, la marca necesita PVP ≥ 25 € **y** FOB ≤ ≈5 USD para que el negocio funcione. La variable decisiva —el precio FOB— está [BLOQUEADO] hasta recibir una cotización formal.

# Qué tiene que ser verdad para invertir más allá de la Fase 0

| Condición | Umbral | Situación a 10/10/2026 |
|---|---|---|
| Precio FOB | ≤ ≈5 USD por unidad ({{ue25_fobmax}} es el máximo para un margen del 25% a PVP 25 €) | [BLOQUEADO] — sin cotización |
| PVP aceptado por el canal | ≥ 25 € | [HIPÓTESIS] — sin cartas de interés |
| Volumen | Por encima del punto muerto: ≈{{ue25_be}} u/año a 25 € y ≈{{ue30_be}} u/año a 30 € | [HIPÓTESIS] — demanda accesible estimada 1.600–6.000 u/año |
| Vía legal y titularidad de la marca | C1 y C2 por escrito | [BLOQUEADO] |
| Pagos y sanciones | Canal bancario + dictamen de sanciones (C4) | [BLOQUEADO] |

**Escala del negocio.** A PVP 24 €, cada unidad deja a la marca {{base_rev_u}} de ingreso antes de impuesto especial. La demanda accesible estimada (1.600–6.000 u/año) equivale a **{{sam_rev_low}}–{{sam_rev_high}}** de ingresos anuales de la marca: es un negocio de nicho, cuyo atractivo para un inversor depende de la calidad del margen y de la propiedad del activo, no del volumen.

**Origen alternativo.** Con origen República Dominicana y el mismo FOB, el coste en destino baja ≈{{ct_diff10k}} por cada 10.000 unidades (arancel 0% con prueba de origen [PROBABLE]), según `Customs and Tax Model.xlsx`. Es la principal palanca económica si la vía cubana no se abre, a costa de cambiar el posicionamiento (ver Business Plan §7).

# Arquitectura del modelo

- Archivo: `03_BUSINESS_CASE/Financial Model 2027–2031.xlsx` (17 pestañas exigidas + «Engine»).
- **Un único motor** calcula los cuatro escenarios con fórmulas idénticas; las hojas de estados leen el escenario elegido en `Assumptions!C4`.
- Inputs en azul sobre crema; fórmulas en negro; resultados en verde. Ningún total está introducido a mano.
- **Controles automáticos** (hoja «Sources & Validation»): balance cuadrado en los 4 escenarios, reparto del PVP = 100%, conciliación de caja, forma cerrada de sensibilidad = motor, stock nunca negativo. Todos «OK» en la versión entregada.
- Recalculado con LibreOffice: 0 errores de fórmula en los 11 libros XLSX.

# Cadena de valor de una unidad (escenario Base, 2028)

| Destino del PVP (24 €) | % del PVP |
|---|---|
| IVA | {{split_vat}} |
| Impuesto especial | {{split_iee}} |
| Margen del expendedor | {{split_rm}} |
| Tarifa del distribuidor | {{split_dist}} |
| Arancel | {{split_duty}} |
| Fabricación, packaging, control de calidad, flete y seguro | {{split_cif}} |
| Marcas fiscales, honorario técnico, merma y muestras | resto |
| **Contribución de la marca antes de gastos fijos** | **{{split_contrib}} ({{split_contrib_eur}})** |

Coste en destino Base: FOB {{base_fob_eur}} + packaging {{base_pack}} + QC y flete + arancel {{base_duty_u}} + marcas fiscales y honorario técnico = **{{base_landed}}** por unidad (sin IEE ni IVA).

# Economía unitaria por PVP (costes Base)

| PVP | Ingreso marca neto de IEE | Contribución/u | Punto muerto EBITDA (u/año) | FOB máx. para margen 25% |
|---|---|---|---|---|
| 12 € | {{ue12_net}} | {{ue12_contrib}} | {{ue12_be}} | {{ue12_fobmax}} |
| 15 € | {{ue15_net}} | {{ue15_contrib}} | {{ue15_be}} | {{ue15_fobmax}} |
| 18 € | {{ue18_net}} | {{ue18_contrib}} | {{ue18_be}} | {{ue18_fobmax}} |
| 20 € | {{ue20_net}} | {{ue20_contrib}} | {{ue20_be}} | {{ue20_fobmax}} |
| 25 € | {{ue25_net}} | {{ue25_contrib}} | {{ue25_be}} | {{ue25_fobmax}} |
| 30 € | {{ue30_net}} | {{ue30_contrib}} | {{ue30_be}} | {{ue30_fobmax}} |
| 35 € | {{ue35_net}} | {{ue35_contrib}} | {{ue35_be}} | {{ue35_fobmax}} |

**Lectura.** Por debajo de 20 € la marca pierde dinero en cada unidad con un FOB de 6 USD. A 25–30 € el negocio es posible, pero exige vender 5.000–11.000 unidades/año de una marca nueva por encima del precio de Partagás Serie D No. 4 (≈21,20 €) o Montecristo No. 2 (21,80 €) (S37). Esta es la tensión central del proyecto.

# Escenarios

| Métrica | Conservador | Base | Optimista | Estrés |
|---|---|---|---|---|
| PVP / FOB | 20 € / 7,0 USD | 24 € / 6,0 USD | 28 € / 5,0 USD | 24 € / 7,5 USD |
| Unidades 2027–2031 | {{cons_units_total}} | {{base_units_total}} | {{opt_units_total}} | {{stress_units_total}} |
| EBITDA 2028 | {{cons_ebitda_2028}} | {{base_ebitda_2028}} | {{opt_ebitda_2028}} | {{stress_ebitda_2028}} |
| EBITDA 2031 | {{cons_ebitda_2031}} | {{base_ebitda_2031}} | {{opt_ebitda_2031}} | {{stress_ebitda_2031}} |
| EBITDA acumulado | {{cons_ebitda_cum}} | {{base_ebitda_cum}} | {{opt_ebitda_cum}} | {{stress_ebitda_cum}} |
| Resultado neto acumulado | {{cons_ni_cum}} | {{base_ni_cum}} | {{opt_ni_cum}} | {{stress_ni_cum}} |
| Necesidad máxima de financiación | {{cons_need}} | {{base_need}} | {{opt_need}} | {{stress_need}} |
| VAN (18%) | {{cons_npv}} | {{base_npv}} | {{opt_npv}} | {{stress_npv}} |
| TIR (con valor terminal) | n/c | n/c | {{opt_irr}} | n/c |
| Payback | {{cons_payback}} | {{base_payback}} | {{opt_payback}} | {{stress_payback}} |

No se asignan probabilidades a los escenarios. El detalle está en `Scenario Analysis.pdf`.

# Capital inicial: ¿qué es viable con 15–100 k€?

Ninguno de los cinco niveles de capital (15, 30, 50, 75 y 100 k€) cubre la necesidad máxima de ningún escenario con un colchón del 25% (hoja «Scenarios»). Traducción operativa:

| Capital | Qué permite realmente |
|---|---|
| 15.000 € | Fase 0 completa (due diligence jurídica Cuba ≈6–10 k€), informe de marcas y solicitud EUIPO, estudio regulatorio España. **Recomendado como techo de gasto hasta el Go.** |
| 30.000 € | Lo anterior + constitución de SL, habilitaciones, artes finales y prototipos. No alcanza para un lote de 3.000 u (≈{{wc_peak}} de necesidad de caja de un pedido). |
| 50.000 € | Un lote piloto de 1.000–3.000 unidades con IEE en depósito fiscal y fijos de un año, sólo si C1–C8 se cumplen; sin margen para retrasos. |
| 75.000 € | Piloto + segundo pedido; insuficiente en todos los escenarios sin financiación ajena. |
| 100.000 € | Sigue por debajo de la necesidad del escenario Optimista ({{opt_need}}) y muy por debajo del Base ({{base_need}}). |

**Implicación**: con el capital disponible, la marca propia sólo es razonable como **opción** que se ejerce tras validar FOB, precio y demanda; la vía B3 (importación no cubana) es compatible con 40–60 k€.

# Desajuste temporal de caja

Pedido piloto de 3.000 unidades (hoja «Working Capital»): el primer pago a Cuba precede al primer cobro en ≈{{wc_months}} meses; la necesidad máxima de caja del ciclo es {{wc_peak}} (incluye anticipo del 50%, saldo antes de embarque, arancel, IEE e IVA de importación en frontera, devolución del IVA a 3 meses y gastos fijos mensuales). Palancas: depósito fiscal para diferir el IEE, anticipo menor, lote más pequeño, pago contra documentos.

# Punto muerto

- Base: contribución 2030 {{base_contrib}} → punto muerto {{base_be}} frente a 5.000 unidades de demanda supuesta en 2030.
- Optimista: {{opt_contrib}} → {{opt_be}}.
- Conservador y Estrés: contribución negativa → no hay punto muerto alcanzable.
- Gastos fijos Base: {{base_opex_2028}} (2028) y {{base_opex_2030}} (2030), **sin** remuneración del promotor. Cada 10.000 €/año de remuneración añade ≈{{base_be_per10k}} al punto muerto Base.

# Sensibilidad

La hoja «Sensitivity Analysis» incluye: tornado sobre EBITDA 2030 (volumen ±20%, PVP ±10%, FOB ±20%, tipo de cambio ±10%, tarifa del distribuidor ±2 pp, merma), tablas PVP × FOB y volumen × tarifa del distribuidor, y el coste de retrasos (meses de fijos sin ingresos) a tipos del 5–12%. La variable de mayor impacto es el **PVP**, seguida del **FOB** y del **volumen**.

# Supuestos críticos y su estado

| Supuesto | Valor Base | Estado |
|---|---|---|
| FOB por unidad | 6,0 USD | [BLOQUEADO] — cotización |
| PVP | 24 € | [HIPÓTESIS] — validar con expendedurías |
| Demanda | 2.000 → 6.500 u/año | [HIPÓTESIS] — cartas de interés |
| Tarifa distribuidor | 5% PVP | [HIPÓTESIS] |
| Packaging | 16,50 €/caja de 10 | [HIPÓTESIS] |
| Arancel | 26% | [PROBABLE] |
| IEE | 15,8% PVP; mín. 47 €/1.000 | [VERIFICADO] |
| Margen expendedor | 9% | [PROBABLE] |
| Tipo de cambio | 1,15 USD/€ | [HIPÓTESIS] |
| Impuesto sobre Sociedades | 25% (sin aplicar el 15% de nueva creación: conservador) | [PROBABLE] |
| Tasa de descuento | 18% | [HIPÓTESIS] |
| Valor terminal | 5× EBITDA 2031 si positivo | [HIPÓTESIS] |

# Auditoría financiera (resumen)

- Los impuestos se tratan correctamente: IVA neutro (sólo caja), IEE deducido del ingreso de la marca y adelantado en caja si se paga al importar, arancel como coste, IVA de importación sobre valor en aduana + arancel + IEE.
- Ingresos separados: consumidor (PVP), detallista (9%), distribuidor (tarifa) y marca.
- Costes incluidos que suelen omitirse: merma y muestras con su IEE, marcas fiscales y trazabilidad, despachos por envío, viajes de control, renovación de marcas, imprevistos 10%.
- No incluidos (riesgo a la baja): remuneración del promotor, coste de oportunidad de su tiempo, posibles tasas cubanas no conocidas, seguros de crédito, costes de una eventual licencia de sanciones.

Fuentes de parámetros: S14, S15, S32, S37, S38 y supuestos del equipo (consulta 10/10/2026).
