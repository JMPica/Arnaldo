---
title: "Hoja de ruta regulatoria en España"
subtitle: "Importar, habilitar y distribuir cigarros en el mercado regulado español: obligaciones, impuestos, plazos y secuencia"
short: "Spain Regulatory Roadmap"
kicker: "05 · SPAIN IMPORT"
toc: true
out: ["05_SPAIN_IMPORT/Spain Regulatory Roadmap.pdf"]
---

# Resumen

En España el tabaco se vende al consumidor **sólo** a través de la red de expendedurías (≈13.000, en régimen de concesión) y a precios publicados en el BOE; la fabricación, la importación y la distribución mayorista son libres pero requieren **habilitación previa** del Comisionado para el Mercado de Tabacos (CMT) [VERIFICADO] (S16, S17, S26). Para una marca nueva la secuencia mínima es:

1. Sociedad + EORI.
2. Habilitación ante el CMT como **fabricante** (incluye a titulares de marca e importadores) — resolución en ≤15 días hábiles [VERIFICADO] (S17).
3. Notificación de **ingredientes en EU-CEG** por marca y tipo antes de comercializar [VERIFICADO] (S29); plazo previo concreto [BLOQUEADO — confirmar con Sanidad].
4. Alta en el sistema de **trazabilidad** (identificadores únicos y elemento de seguridad, obligatorio para cigarros desde 20/05/2024) y suministro de **marcas fiscales** (Orden HAC/66/2024) [VERIFICADO] (S27, S28).
5. Envases con advertencias sanitarias conformes al RD 579/2017 [VERIFICADO norma; porcentajes exactos PENDIENTES] (S30, N03).
6. Solicitud y **publicación del PVP en el BOE** [VERIFICADO] (S18).
7. Importación (DUA: arancel + IVA; IEE al importar o en depósito fiscal) y entrega al **distribuidor mayorista habilitado**, que sirve a las expendedurías.

Ninguna venta puede iniciarse antes de la publicación del PVP: el calendario comercial debe construirse hacia atrás desde esa fecha.

# Marco normativo aplicable

| Norma | Materia | Relevancia | Estado |
|---|---|---|---|
| Ley 13/1998 de Ordenación del Mercado de Tabacos | Libertad de fabricación, importación y mayorista; monopolio minorista; márgenes | Estructura del canal; margen del expendedor | [VERIFICADO] (S15) |
| RD 1199/1999 (consolidado 10/07/2025) | Desarrollo de la Ley 13/1998; estatuto de expendedurías | Habilitaciones y concesiones | [VERIFICADO] (S16) |
| Ley 38/1992 de Impuestos Especiales (mod. Ley 7/2024) | IEE de labores del tabaco | Cigarros: 15,8% PVP, mínimo 47 €/1.000 u | [VERIFICADO] (S14) |
| RD 1165/1995 (mod. RD 1171/2023) + Orden HAC/66/2024 | Marcas fiscales para todas las labores | Cigarros con precinta desde 20/05/2024 | [VERIFICADO] (S27) |
| Directiva 2014/40/UE + RD 579/2017 | Ingredientes, etiquetado, advertencias, trazabilidad, venta a distancia | Obligaciones del titular/importador | [VERIFICADO] (S29, S30) |
| Reglamento de Ejecución (UE) 2018/574 | Trazabilidad | Identificadores únicos y elementos de seguridad | [VERIFICADO] (S28) |
| Arancel Aduanero Común (TARIC 2402 10 00) | Derecho de importación | 26% convencional sin preferencia (origen Cuba) | [PROBABLE] (S32) |
| Ley 37/1992 del IVA | IVA de importación e interior | 21% | [VERIFICADO] |
| Ley 28/2005 | Publicidad, promoción y patrocinio | Prohibición de publicidad al consumidor | [PROBABLE] |
| LO 12/1995 | Contrabando | Delito en labores de tabaco desde 15.000 € | [PROBABLE] (N01) |
| Revisión de la Directiva de fiscalidad del tabaco (propuesta 16/07/2025) | Mínimos y estructura | Efectos previstos 01/01/2028; en negociación | [PROBABLE] (S31, S48) |

# Obligaciones por figura

Una misma sociedad puede reunir varias figuras; las obligaciones se acumulan.

| Figura | Obligaciones | Quién en el proyecto |
|---|---|---|
| **Titular de la marca / fabricante** (aunque fabrique un tercero) | Habilitación CMT como fabricante; notificación EU-CEG; conformidad de etiquetado; solicitud de PVP al CMT para su publicación; obligaciones de información al CMT; responsabilidad sobre el producto puesto en el mercado. | SL española (ARNALDO VALLÉS) |
| **Importador** | EORI; DUA; arancel e IVA de importación; IEE (al importar, o suspensión en depósito fiscal / destinatario registrado); marcas fiscales; registro de operador e instalación en trazabilidad; prueba de origen. | SL española o depositario autorizado contratado |
| **Distribuidor mayorista** | Habilitación CMT como distribuidor; neutralidad frente a expendedurías; información mensual (10 primeros días) y anual de ventas; comunicación de condiciones generales. | Operador habilitado subcontratado (p.ej. Logista u otro del listado CMT) |
| **Expendedor** | Venta al PVP publicado; margen legal; prohibiciones de promoción. | Clientes (expendedurías) |

# Fiscalidad de una unidad (escenario Base del modelo)

| Concepto | Regla | Importe por unidad a PVP 24 € | Estado |
|---|---|---|---|
| IVA | 21% incluido en PVP | ≈ 4,17 € | [VERIFICADO] |
| Impuesto especial | máx(15,8% × PVP; 0,047 €) | {{base_iee_u}} | [VERIFICADO] (S14) |
| Margen expendedor | 9% × PVP | ≈ 2,16 € | [PROBABLE] (S15) |
| Tarifa del distribuidor | Negociable (supuesto 5% PVP) | ≈ 1,20 € | [HIPÓTESIS] |
| Arancel | 26% × valor CIF | {{base_duty_u}} | [PROBABLE] (S32) |
| **Peso del Estado (IVA + IEE + arancel) sobre el PVP** | | **{{ct_state_pct}}** | Calculado |

Reglas de contabilización aplicadas en los modelos:

- El **IVA** es neutro: el de importación se recupera vía liquidación (efecto de caja de ≈1 trimestre, no de coste).
- El **IEE** no es coste de la marca sino un impuesto que se repercute en el precio, pero **se adelanta** si se paga al importar; con depósito fiscal se paga al salir a consumo. El modelo usa el caso conservador (pago al importar) y permite cambiarlo.
- El **arancel** sí es coste definitivo y forma parte de la base del IVA de importación junto con el IEE.

Comparativa de origen (misma fábrica y PVP): coste definitivo por unidad {{ct_cuba}} con origen Cuba frente a {{ct_dr}} con origen preferente (R. Dominicana/Centroamérica, si se acredita el origen y se confirma en TARIC) → diferencia de {{ct_diff10k}} por cada 10.000 unidades (`Customs and Tax Model.xlsx`).

# Etiquetado y presentación

- **Advertencias**: para productos del tabaco para fumar distintos de cigarrillos, picadura y pipa de agua, la Directiva permite eximir de las advertencias combinadas (imagen); se exige la advertencia general y un mensaje de texto [PROBABLE] (N03). El RD 579/2017 fija textos («Fumar mata», etc.), superficies y rotación; los **porcentajes exactos** deben comprobarse en el texto consolidado antes de cerrar las artes [BLOQUEADO hasta revisión].
- **Unidad de envasado**: la advertencia, la marca fiscal y el identificador único van en la unidad de envasado (la caja). Cigarros vendidos sueltos por el expendedor: consulta tributaria V0809-25 sobre la precinta en cigarros sueltos — leer antes de decidir formato [PENDIENTE] (S27).
- **Prohibidos**: elementos que sugieran beneficios, menor nocividad, sabores característicos; colores o símbolos que imiten marcas de terceros o la DO «Habanos».
- **Información de origen**: el «Hecho en Cuba» debe validarse jurídicamente (ver Cuba Legal Feasibility).

# Comunicación comercial permitida

- Comunicación **entre profesionales** (fichas técnicas, listas de precios, catas técnicas para estanqueros y distribuidores) [PROBABLE].
- Prohibido: publicidad al consumidor, patrocinio, promociones, redes sociales de consumo, regalos, venta online al consumidor y venta a distancia transfronteriza.
- El PVP comunicado es siempre el **publicado en BOE**; no puede anunciarse antes ni modificarse por el canal.

# Secuencia y plazos

| # | Hito | Depende de | Plazo orientativo | Estado |
|---|---|---|---|---|
| 1 | Constitución SL, NIF, EORI | Go Fase 0 | 2–4 semanas | [HIPÓTESIS] |
| 2 | Habilitación CMT como fabricante | 1 | ≤15 días hábiles desde solicitud completa | [VERIFICADO] (S17) |
| 3 | Contrato con distribuidor habilitado (o habilitación propia como distribuidor) | 2 | 4–8 semanas de negociación | [HIPÓTESIS] |
| 4 | Ficha técnica + ingredientes de la fábrica | Contrato Cuba | 4 semanas | [BLOQUEADO] |
| 5 | Notificación EU-CEG | 2, 4 | Antes de comercializar; plazo previo por confirmar | [BLOQUEADO] |
| 6 | Alta trazabilidad y pedido de marcas fiscales | 2 | 2–4 semanas | [HIPÓTESIS] |
| 7 | Artes finales validadas | Informe de marca, RD 579/2017 | 4 semanas | [HIPÓTESIS] |
| 8 | Solicitud de PVP → publicación BOE | 2, 5 | Las resoluciones del CMT se publican varias veces al mes (p.ej. 30/01, 13/02, 06/03, 27/03, 17/04, 24/04, 22/05, 12/06 de 2026) | [VERIFICADO] frecuencia (S18) |
| 9 | Importación y despacho (DUA) | 6, 7, contrato | 1–2 semanas tras llegada | [HIPÓTESIS] |
| 10 | Primera venta a expendedurías | 8, 9 | — | — |

# Riesgos y puntos abiertos

- Plazo de EU-CEG previo a la comercialización y tasas: confirmar con el Ministerio de Sanidad.
- Margen del expendedor vigente para cigarros (texto consolidado de la Ley 13/1998).
- Arancel exacto en TARIC y documentación de origen exigible a Cuba.
- Coste unitario de marcas fiscales e identificadores únicos (FNMT / emisor de identificadores).
- Condiciones reales de los distribuidores (tarifa, mínimos, depósito fiscal).
- Evolución de la Directiva de fiscalidad (posibles mínimos de 143 €/1.000 u en cigarros según borrador filtrado; impacto bajo a PVP ≥ 12 € porque el ad valorem ya supera el mínimo) [PROBABLE] (S31).

Fuentes: S14–S18, S25–S32, S38, S48, N01, N03 (consulta 10/10/2026). Ver `09_RESEARCH/Source Register.xlsx`.
