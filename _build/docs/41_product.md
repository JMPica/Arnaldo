---
title: "Arquitectura de producto ARNALDO"
subtitle: "Vitola inicial, extensiones, parámetros de calidad medibles, documentación de liga, conservación, control de pliegos y papel del torcedor"
short: "Product Architecture"
kicker: "01 · BRAND"
out: ["01_BRAND/Product Architecture.pdf"]
---

# Principios

1. **Una sola vitola de lanzamiento** hasta demostrar consistencia en al menos tres pliegos consecutivos.
2. **Nada inventado**: no se describen ligas, fincas ni añadas cubanas concretas; esos datos sólo puede aportarlos la fábrica y se documentan en la ficha técnica (`Technical Specification Template.xlsx`).
3. **Todo medible**: cada atributo de calidad tiene método, frecuencia y criterio de aceptación.
4. El torcedor es **colaborador técnico vía la entidad autorizada**, no proveedor independiente.

# Gama propuesta

| Nombre ARNALDO | Vitola de referencia | Dimensiones orientativas | Calendario | Complejidad de fabricación |
|---|---|---|---|---|
| **Nº 1** | Robusto | ≈124 mm × cepo 50 | Lanzamiento (2028, sólo si C1–C8) | Media: formato versátil, consumo de capa moderado, tiro estable |
| Nº 2 | Toro / Gordito | ≈150–156 mm × 50–52 | Extensión 2029 | Media-alta: cepos grandes tienden a irregularidades de tiro y combustión |
| Nº 3 | Churchill (Julieta No. 2) | ≈178 mm × 47 | Edición limitada 2030 | Alta: capa larga sin defectos, menor rendimiento de capa, torcedores de máxima categoría |

Las dimensiones son referencias habituales del sector [PROBABLE]; la «vitola de galera» exacta la fija la fábrica.

**Por qué Nº 1 primero**: es el formato con mayor rotación en expendedurías especialistas y el más comparable con referencias de precio conocidas (p.ej. Partagás Serie D No. 4, ≈21,20 € en 2026) [PROBABLE] (S37), lo que permite medir la aceptación del precio de forma limpia.

# Parámetros de calidad medibles

| Atributo | Método | Criterio (a cerrar con la fábrica) |
|---|---|---|
| Longitud / cepo | Calibre y regla | ±2 mm / ±1 cepo [HIPÓTESIS] |
| Peso | Balanza 0,1 g | Tolerancia de ficha |
| Tiro | Medidor de resistencia al tiro | Rango de ficha; 0 tiros bloqueados |
| Combustión | Cata técnica | Uniforme, sin reencendidos frecuentes, ceniza compacta |
| Construcción | Inspección visual / corte | Perilla correcta, sin bolsas de aire ni capa rota |
| Consistencia | Catas ciegas de 3 catadores, 5 u por pliego | Desviación entre unidades por debajo del umbral acordado |
| Humedad | Higrómetro / pesada | Rango de ficha; almacenamiento 16–18 °C y 65–70% HR [PROBABLE] |
| Plagas | Tratamiento antiplagas documentado (congelación controlada) | 0 indicios |

Muestreo por pliego: ISO 2859-1, nivel II, AQL 1,0 (defectos mayores) y 2,5 (menores); defectos críticos 0. **Tasa de rechazo**: se propone que, por encima del 3%, la reposición sea a cargo del fabricante.

# Documentación de la liga

La ficha técnica registra, sin inventar contenidos: origen y tipo de capa, capote y tripa (proporción ligero/seco/volado), tiempos de fermentación y añejamiento, método de bonchado, perilla, ingredientes (para EU-CEG) y disponibilidad garantizada de hoja para N pliegos. La disponibilidad de hoja depende del sistema estatal cubano y se considera [BLOQUEADO] hasta que el contrato la garantice.

# Conservación, estabilización y expedición

1. Reposo tras torcido antes de anillar (días a definir con la fábrica).
2. Escogida de colores por caja.
3. Tratamiento antiplagas documentado antes del embalaje.
4. Embalaje en cedro, retractilado, cartón exterior con indicadores de humedad.
5. Transporte con control de temperatura/humedad en la medida posible; inspección a la llegada.
6. Almacén en España a 16–18 °C / 65–70% HR, rotación FIFO por pliego.

# Control de lotes («pliegos»)

Cada pliego tiene: número, vitola, fecha de torcido, unidades torcidas/rechazadas/expedidas, rango de cajas, tratamiento antiplagas, puntuación de cata, factura y DUA. El **colofón** de cada caja reproduce pliego, fecha y nº de caja / total. Plantilla: hoja «Registro de pliego».

# Torcedor no es igual a mezclador

| Función | Qué aporta | ¿Lo cubre el torcedor? |
|---|---|---|
| Torcedor | Construcción, consistencia física, tiro | Sí |
| Mezclador / ligador | Diseño y reproducción de la liga entre cosechas | No necesariamente |
| Escogedor de capas | Homogeneidad de color y calidad | No |
| Control de calidad | Muestreo, medición, liberación de pliegos | No |
| Almacén de hoja | Disponibilidad y fermentación | No (depende de Tabacuba) |
| Responsable regulatorio UE | Ingredientes, etiquetado, trazabilidad | No (SL española) |

El valor del contacto con el torcedor es real —acceso, criterio de construcción, interlocución con la fábrica—, pero el producto requiere una organización completa que sólo una fábrica autorizada puede aportar.

# Ficha técnica editable

`01_BRAND/Technical Specification Template.xlsx` contiene: ficha de vitola (27 campos con responsable y verificación), arquitectura de vitolas, plan de QC por pliego, registro de pliego, ficha de cata y matriz de roles técnicos. Está pensada para completarse en una sesión de trabajo con el torcedor y la fábrica (agenda en `08_COMMUNICATIONS/Meeting Agendas.docx`).
