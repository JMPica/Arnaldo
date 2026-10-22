# APEX — Informe de investigación cuantitativa

Generado automáticamente por `research/run.ts` el 2026-10-22 00:16 UTC. No editar a mano.

## Metodología

- **Datos reales horarios.** BTC: velas de 1 h de Binance (BTCUSDT) como proxy del perpetuo, con la serie histórica de *funding* de Binance aplicada hora a hora. Materias primas: velas de 1 h de OANDA (contado/CFD).
- **Mismo código que en producción.** El backtest usa la misma función `processHour()` que ejecuta el motor real: mismas señales, mismo dimensionado, mismo motor de riesgo.
- **Sin mirar al futuro.** Las señales se calculan con velas cerradas y se ejecutan en la apertura de la vela siguiente. Los stops se evalúan contra el máximo/mínimo de cada hora; si hay hueco, se ejecutan al precio de apertura.
- **Costes:** comisión taker 0.05 % por lado + deslizamiento 0.03 % por lado + funding real. Prueba de estrés con costes ×2.
- **Riesgo:** 1 % del capital hasta el stop, apalancamiento máximo 2x, una posición, suspensión con caída del 20 %.
- **Walk-forward:** optimiza en 730 días, evalúa los 182 siguientes fuera de muestra (OOS) y avanza. Solo cuenta el tramo OOS encadenado.
- **Sobreajuste:** ratio de Sharpe deflactado (Bailey y López de Prado) con el número total de configuraciones probadas; estabilidad = fracción de configuraciones de la familia con Sharpe > 0.
- **Monte Carlo:** 2.000 remuestreos por bloques de 10 días de los rendimientos OOS, horizonte de 1 año.

### Criterios de aceptación (fijados antes de ver resultados)

| Criterio | Umbral |
|---|---|
| Sharpe OOS | ≥ 0.5 |
| PSR OOS (prob. Sharpe > 0) | ≥ 0.9 |
| Ventanas OOS con beneficio | ≥ 55 % |
| P(caída ≥ 20 % en 1 año), Monte Carlo | ≤ 10 % |
| Operaciones OOS | ≥ 30 |
| Estabilidad de parámetros | ≥ 60 % |
| Caída máxima OOS | ≤ 20 % |
| Sharpe OOS con costes ×2 | > 0 |

## Bitcoin (BTCUSDT, Binance spot como proxy del perpetuo)

Datos: 2017-08-17 → 2026-10-20 (80.317 velas de 1 h).

**Alternativa pasiva (comprar y mantener, mismo periodo OOS):** CAGR 36.9 %, Sharpe 0.84, caída máxima 76.6 %.

| Familia | Sharpe OOS | CAGR OOS | Caída máx. OOS | Ops OOS | Ventanas + | PSR | P(DD≥20 %) | Sharpe costes×2 | DSR muestra completa | Estabilidad | ¿Aprobada? |
|---|---|---|---|---|---|---|---|---|---|---|---|
| tsmom | 0.48 | 2.2 % | 7.3 % | 109 | 75 % | 0.88 | 0 % | 0.26 | 0.89 | 100 % | No |
| donchian | 0.94 | 7.9 % | 11.6 % | 41 | 58 % | 0.99 | 0 % | 0.74 | 0.90 | 100 % | **Sí** |
| ema_cross | 0.82 | 5.1 % | 8.6 % | 47 | 58 % | 0.98 | 0 % | 0.61 | 0.88 | 100 % | **Sí** |
| rsi_mr | -1.28 | -5.7 % | 31.4 % | 509 | 17 % | 0.00 | 0 % | -1.74 | 0.01 | 0 % | No |
| boll_mr | -0.54 | -1.8 % | 12.4 % | 75 | 33 % | 0.09 | 0 % | -0.73 | 0.01 | 0 % | No |

<details><summary>Motivos de rechazo</summary>

- **tsmom**: Sharpe OOS = 0.48 (umbral 0.50); PSR OOS = 0.88 (umbral 0.90)
- **rsi_mr**: Sharpe OOS = -1.28 (umbral 0.50); PSR OOS = 0.00 (umbral 0.90); Ventanas OOS positivas = 0.17 (umbral 0.55); Estabilidad de parámetros = 0.00 (umbral 0.60); Caída máxima OOS = 0.31 (umbral 0.20); Sharpe OOS con costes ×2 = -1.74 (umbral 0.00)
- **boll_mr**: Sharpe OOS = -0.54 (umbral 0.50); PSR OOS = 0.09 (umbral 0.90); Ventanas OOS positivas = 0.33 (umbral 0.55); Estabilidad de parámetros = 0.00 (umbral 0.60); Sharpe OOS con costes ×2 = -0.73 (umbral 0.00)

</details>

## Resultado

**Estrategia aprobada para paper trading:** `donchian:1d:allowShort=0,entry=20,exit=10,stopAtr=2,trail=0` (familia donchian, Sharpe OOS 0.94).

### Prueba de realidad con 200 € (2024-10-20 → 2026-10-20)

Configuración: `donchian:1d:allowShort=0,entry=20,exit=10,stopAtr=2,trail=0`. Capital 232.00 USD (EUR/USD 1.1600).

| Métrica | Valor |
|---|---|
| Resultado neto | 9.67 € |
| Comisiones pagadas | 0.36 € |
| Funding pagado | 2.33 € |
| Operaciones | 11 |
| Órdenes rechazadas por riesgo/tamaño | 0 |
| Nocional medio por operación | 36.91 USD |
| Apalancamiento medio | 0.16x |
| CAGR | 2.4 % |
| Caída máxima | 5.0 % |

## Viabilidad de los contratos de Coinbase con 200 € y apalancamiento máximo 2x

| Activo | Contrato | Precio (captura) | Nocional por contrato | Apalancamiento necesario | ¿Cabe en 2x? |
|---|---|---|---|---|---|
| BTC | nano Bitcoin (BIT), 1/100 BTC | 84.355 | 844 USD | 3.6x | **No** |
| GOLD | Gold futures CDE, 1 onza troy | 4141,6 | 4142 USD | 17.9x | **No** |
| SILVER | Silver futures CDE, 50 onzas | 57,665 | 2883 USD | 12.4x | **No** |
| COPPER | nano Copper CDE, 500 libras | 6,55 | 3275 USD | 14.1x | **No** |
| PLATINUM | Platinum futures CDE, 10 onzas | 1627,9 | 16279 USD | 70.2x | **No** |
| OIL | nano Crude Oil CDE, 10 barriles | 97,92 | 979 USD | 4.2x | **No** |
| NATGAS | Natural Gas CDE, 1.000 MMBtu | 2,778 | 2778 USD | 12.0x | **No** |

Ningún contrato de Coinbase Derivatives cabe en el límite de 2x con 200 €: un solo contrato ya supera el apalancamiento permitido. Además, con un riesgo del 1 % (≈ 2.32 USD) y un contrato nano de BTC (0,01 BTC), el stop tendría que estar a ≈ 232 USD del precio (≈ 0.28 %), muy por debajo del ruido horario de BTC.
