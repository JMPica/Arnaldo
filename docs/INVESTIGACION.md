# APEX — Informe de investigación cuantitativa

Generado automáticamente por `research/run.ts` el 2026-10-22 01:53 UTC. No editar a mano.

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

## Oro (XAU/USD, OANDA)

Datos: 2006-03-19 → 2026-10-21 (125.297 velas de 1 h).

**Alternativa pasiva (comprar y mantener, mismo periodo OOS):** CAGR 8.8 %, Sharpe 0.59, caída máxima 44.8 %.

| Familia | Sharpe OOS | CAGR OOS | Caída máx. OOS | Ops OOS | Ventanas + | PSR | P(DD≥20 %) | Sharpe costes×2 | DSR muestra completa | Estabilidad | ¿Aprobada? |
|---|---|---|---|---|---|---|---|---|---|---|---|
| tsmom | 0.66 | 2.4 % | 9.5 % | 186 | 63 % | 1.00 | 0 % | 0.50 | 0.83 | 100 % | **Sí** |
| donchian | 0.53 | 2.4 % | 10.1 % | 76 | 60 % | 0.98 | 0 % | 0.46 | 0.91 | 100 % | **Sí** |
| ema_cross | 0.47 | 1.7 % | 9.9 % | 94 | 63 % | 0.97 | 0 % | 0.49 | 0.91 | 100 % | No |
| rsi_mr | -1.32 | -3.9 % | 50.3 % | 679 | 23 % | 0.00 | 0 % | -2.92 | 0.00 | 0 % | No |
| boll_mr | -0.23 | -0.6 % | 16.5 % | 159 | 46 % | 0.16 | 0 % | -0.58 | 0.04 | 25 % | No |

<details><summary>Motivos de rechazo</summary>

- **ema_cross**: Sharpe OOS = 0.47 (umbral 0.50)
- **rsi_mr**: Sharpe OOS = -1.32 (umbral 0.50); PSR OOS = 0.00 (umbral 0.90); Ventanas OOS positivas = 0.23 (umbral 0.55); Estabilidad de parámetros = 0.00 (umbral 0.60); Caída máxima OOS = 0.50 (umbral 0.20); Sharpe OOS con costes ×2 = -2.92 (umbral 0.00)
- **boll_mr**: Sharpe OOS = -0.23 (umbral 0.50); PSR OOS = 0.16 (umbral 0.90); Ventanas OOS positivas = 0.46 (umbral 0.55); Estabilidad de parámetros = 0.25 (umbral 0.60); Sharpe OOS con costes ×2 = -0.58 (umbral 0.00)

</details>

## Plata (XAG/USD, OANDA)

Datos: 2006-03-19 → 2026-10-21 (124.964 velas de 1 h).

**Alternativa pasiva (comprar y mantener, mismo periodo OOS):** CAGR 8.8 %, Sharpe 0.43, caída máxima 74.9 %.

| Familia | Sharpe OOS | CAGR OOS | Caída máx. OOS | Ops OOS | Ventanas + | PSR | P(DD≥20 %) | Sharpe costes×2 | DSR muestra completa | Estabilidad | ¿Aprobada? |
|---|---|---|---|---|---|---|---|---|---|---|---|
| tsmom | 0.27 | 1.4 % | 17.6 % | 208 | 46 % | 0.85 | 0 % | 0.21 | 0.57 | 90 % | No |
| donchian | 0.13 | 0.4 % | 15.7 % | 98 | 34 % | 0.70 | 0 % | 0.17 | 0.63 | 94 % | No |
| ema_cross | 0.18 | 0.8 % | 21.6 % | 109 | 37 % | 0.76 | 1 % | 0.20 | 0.56 | 88 % | No |
| rsi_mr | -0.89 | -3.3 % | 44.2 % | 838 | 29 % | 0.00 | 0 % | -1.37 | 0.00 | 0 % | No |
| boll_mr | -0.04 | -0.1 % | 10.8 % | 136 | 51 % | 0.43 | 0 % | -0.08 | 0.08 | 19 % | No |

<details><summary>Motivos de rechazo</summary>

- **tsmom**: Sharpe OOS = 0.27 (umbral 0.50); PSR OOS = 0.85 (umbral 0.90); Ventanas OOS positivas = 0.46 (umbral 0.55)
- **donchian**: Sharpe OOS = 0.13 (umbral 0.50); PSR OOS = 0.70 (umbral 0.90); Ventanas OOS positivas = 0.34 (umbral 0.55)
- **ema_cross**: Sharpe OOS = 0.18 (umbral 0.50); PSR OOS = 0.76 (umbral 0.90); Ventanas OOS positivas = 0.37 (umbral 0.55); Caída máxima OOS = 0.22 (umbral 0.20)
- **rsi_mr**: Sharpe OOS = -0.89 (umbral 0.50); PSR OOS = 0.00 (umbral 0.90); Ventanas OOS positivas = 0.29 (umbral 0.55); Estabilidad de parámetros = 0.00 (umbral 0.60); Caída máxima OOS = 0.44 (umbral 0.20); Sharpe OOS con costes ×2 = -1.37 (umbral 0.00)
- **boll_mr**: Sharpe OOS = -0.04 (umbral 0.50); PSR OOS = 0.43 (umbral 0.90); Ventanas OOS positivas = 0.51 (umbral 0.55); Estabilidad de parámetros = 0.19 (umbral 0.60); Sharpe OOS con costes ×2 = -0.08 (umbral 0.00)

</details>

## Cobre (XCU/USD, OANDA)

Datos: 2003-03-28 → 2026-10-21 (127.073 velas de 1 h).

**Alternativa pasiva (comprar y mantener, mismo periodo OOS):** CAGR 4.9 %, Sharpe 0.31, caída máxima 69.0 %.

| Familia | Sharpe OOS | CAGR OOS | Caída máx. OOS | Ops OOS | Ventanas + | PSR | P(DD≥20 %) | Sharpe costes×2 | DSR muestra completa | Estabilidad | ¿Aprobada? |
|---|---|---|---|---|---|---|---|---|---|---|---|
| tsmom | -0.09 | -0.3 % | 15.2 % | 206 | 44 % | 0.34 | 0 % | -0.13 | 0.44 | 80 % | No |
| donchian | 0.25 | 0.9 % | 9.8 % | 81 | 46 % | 0.87 | 0 % | 0.20 | 0.69 | 100 % | No |
| ema_cross | -0.07 | -0.2 % | 12.5 % | 101 | 34 % | 0.38 | 0 % | -0.10 | 0.63 | 88 % | No |
| rsi_mr | -0.76 | -2.5 % | 44.0 % | 856 | 29 % | 0.00 | 0 % | -1.69 | 0.02 | 0 % | No |
| boll_mr | 0.09 | 0.2 % | 11.6 % | 264 | 56 % | 0.66 | 0 % | 0.04 | 0.27 | 50 % | No |

<details><summary>Motivos de rechazo</summary>

- **tsmom**: Sharpe OOS = -0.09 (umbral 0.50); PSR OOS = 0.34 (umbral 0.90); Ventanas OOS positivas = 0.44 (umbral 0.55); Sharpe OOS con costes ×2 = -0.13 (umbral 0.00)
- **donchian**: Sharpe OOS = 0.25 (umbral 0.50); PSR OOS = 0.87 (umbral 0.90); Ventanas OOS positivas = 0.46 (umbral 0.55)
- **ema_cross**: Sharpe OOS = -0.07 (umbral 0.50); PSR OOS = 0.38 (umbral 0.90); Ventanas OOS positivas = 0.34 (umbral 0.55); Sharpe OOS con costes ×2 = -0.10 (umbral 0.00)
- **rsi_mr**: Sharpe OOS = -0.76 (umbral 0.50); PSR OOS = 0.00 (umbral 0.90); Ventanas OOS positivas = 0.29 (umbral 0.55); Estabilidad de parámetros = 0.00 (umbral 0.60); Caída máxima OOS = 0.44 (umbral 0.20); Sharpe OOS con costes ×2 = -1.69 (umbral 0.00)
- **boll_mr**: Sharpe OOS = 0.09 (umbral 0.50); PSR OOS = 0.66 (umbral 0.90); Estabilidad de parámetros = 0.50 (umbral 0.60)

</details>

## Platino (XPT/USD, OANDA)

Datos: 2005-01-03 → 2026-10-21 (125.732 velas de 1 h).

**Alternativa pasiva (comprar y mantener, mismo periodo OOS):** CAGR 0.2 %, Sharpe 0.15, caída máxima 73.5 %.

| Familia | Sharpe OOS | CAGR OOS | Caída máx. OOS | Ops OOS | Ventanas + | PSR | P(DD≥20 %) | Sharpe costes×2 | DSR muestra completa | Estabilidad | ¿Aprobada? |
|---|---|---|---|---|---|---|---|---|---|---|---|
| tsmom | 0.01 | -0.0 % | 18.3 % | 204 | 38 % | 0.52 | 0 % | -0.11 | 0.61 | 90 % | No |
| donchian | -0.07 | -0.4 % | 24.7 % | 108 | 49 % | 0.38 | 0 % | -0.04 | 0.43 | 69 % | No |
| ema_cross | -0.22 | -0.8 % | 27.6 % | 112 | 43 % | 0.17 | 0 % | -0.22 | 0.19 | 75 % | No |
| rsi_mr | -1.14 | -3.4 % | 48.5 % | 698 | 22 % | 0.00 | 0 % | -1.83 | 0.01 | 0 % | No |
| boll_mr | -0.54 | -1.7 % | 28.9 % | 207 | 32 % | 0.01 | 0 % | -0.67 | 0.02 | 0 % | No |

<details><summary>Motivos de rechazo</summary>

- **tsmom**: Sharpe OOS = 0.01 (umbral 0.50); PSR OOS = 0.52 (umbral 0.90); Ventanas OOS positivas = 0.38 (umbral 0.55); Sharpe OOS con costes ×2 = -0.11 (umbral 0.00)
- **donchian**: Sharpe OOS = -0.07 (umbral 0.50); PSR OOS = 0.38 (umbral 0.90); Ventanas OOS positivas = 0.49 (umbral 0.55); Caída máxima OOS = 0.25 (umbral 0.20); Sharpe OOS con costes ×2 = -0.04 (umbral 0.00)
- **ema_cross**: Sharpe OOS = -0.22 (umbral 0.50); PSR OOS = 0.17 (umbral 0.90); Ventanas OOS positivas = 0.43 (umbral 0.55); Caída máxima OOS = 0.28 (umbral 0.20); Sharpe OOS con costes ×2 = -0.22 (umbral 0.00)
- **rsi_mr**: Sharpe OOS = -1.14 (umbral 0.50); PSR OOS = 0.00 (umbral 0.90); Ventanas OOS positivas = 0.22 (umbral 0.55); Estabilidad de parámetros = 0.00 (umbral 0.60); Caída máxima OOS = 0.48 (umbral 0.20); Sharpe OOS con costes ×2 = -1.83 (umbral 0.00)
- **boll_mr**: Sharpe OOS = -0.54 (umbral 0.50); PSR OOS = 0.01 (umbral 0.90); Ventanas OOS positivas = 0.32 (umbral 0.55); Estabilidad de parámetros = 0.00 (umbral 0.60); Caída máxima OOS = 0.29 (umbral 0.20); Sharpe OOS con costes ×2 = -0.67 (umbral 0.00)

</details>

## Petróleo WTI (OANDA)

Datos: 2003-01-22 → 2026-10-21 (139.876 velas de 1 h).

**Alternativa pasiva (comprar y mantener, mismo periodo OOS):** CAGR 2.0 %, Sharpe 0.25, caída máxima 91.7 %.

| Familia | Sharpe OOS | CAGR OOS | Caída máx. OOS | Ops OOS | Ventanas + | PSR | P(DD≥20 %) | Sharpe costes×2 | DSR muestra completa | Estabilidad | ¿Aprobada? |
|---|---|---|---|---|---|---|---|---|---|---|---|
| tsmom | 0.06 | 0.2 % | 23.0 % | 280 | 44 % | 0.61 | 0 % | 0.01 | 0.76 | 100 % | No |
| donchian | 0.31 | 1.0 % | 10.7 % | 80 | 39 % | 0.92 | 0 % | 0.28 | 0.89 | 100 % | No |
| ema_cross | -0.07 | -0.3 % | 22.2 % | 110 | 41 % | 0.38 | 0 % | -0.13 | 0.68 | 94 % | No |
| rsi_mr | -1.16 | -4.3 % | 59.1 % | 1051 | 22 % | 0.00 | 0 % | -1.82 | 0.01 | 0 % | No |
| boll_mr | -0.36 | -1.2 % | 29.4 % | 269 | 44 % | 0.05 | 0 % | -0.37 | 0.11 | 25 % | No |

<details><summary>Motivos de rechazo</summary>

- **tsmom**: Sharpe OOS = 0.06 (umbral 0.50); PSR OOS = 0.61 (umbral 0.90); Ventanas OOS positivas = 0.44 (umbral 0.55); Caída máxima OOS = 0.23 (umbral 0.20)
- **donchian**: Sharpe OOS = 0.31 (umbral 0.50); Ventanas OOS positivas = 0.39 (umbral 0.55)
- **ema_cross**: Sharpe OOS = -0.07 (umbral 0.50); PSR OOS = 0.38 (umbral 0.90); Ventanas OOS positivas = 0.41 (umbral 0.55); Caída máxima OOS = 0.22 (umbral 0.20); Sharpe OOS con costes ×2 = -0.13 (umbral 0.00)
- **rsi_mr**: Sharpe OOS = -1.16 (umbral 0.50); PSR OOS = 0.00 (umbral 0.90); Ventanas OOS positivas = 0.22 (umbral 0.55); Estabilidad de parámetros = 0.00 (umbral 0.60); Caída máxima OOS = 0.59 (umbral 0.20); Sharpe OOS con costes ×2 = -1.82 (umbral 0.00)
- **boll_mr**: Sharpe OOS = -0.36 (umbral 0.50); PSR OOS = 0.05 (umbral 0.90); Ventanas OOS positivas = 0.44 (umbral 0.55); Estabilidad de parámetros = 0.25 (umbral 0.60); Caída máxima OOS = 0.29 (umbral 0.20); Sharpe OOS con costes ×2 = -0.37 (umbral 0.00)

</details>

## Gas natural (OANDA)

Datos: 2003-01-30 → 2026-10-21 (136.274 velas de 1 h).

**Alternativa pasiva (comprar y mantener, mismo periodo OOS):** CAGR -5.3 %, Sharpe 0.15, caída máxima 89.4 %.

| Familia | Sharpe OOS | CAGR OOS | Caída máx. OOS | Ops OOS | Ventanas + | PSR | P(DD≥20 %) | Sharpe costes×2 | DSR muestra completa | Estabilidad | ¿Aprobada? |
|---|---|---|---|---|---|---|---|---|---|---|---|
| tsmom | 0.13 | 0.4 % | 7.7 % | 222 | 59 % | 0.72 | 0 % | 0.09 | 0.51 | 55 % | No |
| donchian | 0.15 | 0.6 % | 11.7 % | 104 | 56 % | 0.76 | 0 % | 0.11 | 0.48 | 75 % | No |
| ema_cross | -0.08 | -0.3 % | 13.1 % | 113 | 29 % | 0.35 | 0 % | -0.05 | 0.24 | 25 % | No |
| rsi_mr | -0.86 | -3.0 % | 47.2 % | 901 | 22 % | 0.00 | 0 % | -1.39 | 0.00 | 0 % | No |
| boll_mr | -0.17 | -0.5 % | 11.7 % | 198 | 37 % | 0.23 | 0 % | -0.33 | 0.05 | 0 % | No |

<details><summary>Motivos de rechazo</summary>

- **tsmom**: Sharpe OOS = 0.13 (umbral 0.50); PSR OOS = 0.72 (umbral 0.90); Estabilidad de parámetros = 0.55 (umbral 0.60)
- **donchian**: Sharpe OOS = 0.15 (umbral 0.50); PSR OOS = 0.76 (umbral 0.90)
- **ema_cross**: Sharpe OOS = -0.08 (umbral 0.50); PSR OOS = 0.35 (umbral 0.90); Ventanas OOS positivas = 0.29 (umbral 0.55); Estabilidad de parámetros = 0.25 (umbral 0.60); Sharpe OOS con costes ×2 = -0.05 (umbral 0.00)
- **rsi_mr**: Sharpe OOS = -0.86 (umbral 0.50); PSR OOS = 0.00 (umbral 0.90); Ventanas OOS positivas = 0.22 (umbral 0.55); Estabilidad de parámetros = 0.00 (umbral 0.60); Caída máxima OOS = 0.47 (umbral 0.20); Sharpe OOS con costes ×2 = -1.39 (umbral 0.00)
- **boll_mr**: Sharpe OOS = -0.17 (umbral 0.50); PSR OOS = 0.23 (umbral 0.90); Ventanas OOS positivas = 0.37 (umbral 0.55); Estabilidad de parámetros = 0.00 (umbral 0.60); Sharpe OOS con costes ×2 = -0.33 (umbral 0.00)

</details>

## Resultado

**Estrategia aprobada para paper trading:** `donchian:1d:allowShort=1,entry=20,exit=10,stopAtr=2,trail=0` (familia donchian, Sharpe OOS 0.94).

### Prueba de realidad con 200 € (2024-10-20 → 2026-10-20)

Configuración: `donchian:1d:allowShort=1,entry=20,exit=10,stopAtr=2,trail=0`. Capital 224.45 USD (EUR/USD 1.1222).

| Métrica | Valor |
|---|---|
| Resultado neto | 13.29 € |
| Comisiones pagadas | 0.63 € |
| Funding pagado | 2.06 € |
| Operaciones | 20 |
| Órdenes rechazadas por riesgo/tamaño | 0 |
| Nocional medio por operación | 35.12 USD |
| Apalancamiento medio | 0.16x |
| CAGR | 3.3 % |
| Caída máxima | 6.9 % |

## Viabilidad de los contratos de Coinbase con 200 € y apalancamiento máximo 2x

| Activo | Contrato | Precio (captura) | Nocional por contrato | Apalancamiento necesario | ¿Cabe en 2x? |
|---|---|---|---|---|---|
| BTC | nano Bitcoin BIT/BIP, 0,01 BTC | 84.355 | 844 USD | 3.8x | **No** |
| GOLD | Gold GOL, 1 onza troy | 4141,6 | 4142 USD | 18.5x | **No** |
| SILVER | Silver SLR, 50 onzas | 57,665 | 2883 USD | 12.8x | **No** |
| COPPER | Copper CU, 2.000 libras | 6,55 | 13100 USD | 58.4x | **No** |
| PLATINUM | Platinum PT, 10 onzas | 1627,9 | 16279 USD | 72.5x | **No** |
| OIL | Oil NOL, 10 barriles | 97,92 | 979 USD | 4.4x | **No** |
| NATGAS | Natural Gas NGS, 1.000 MMBtu | 2,778 | 2778 USD | 12.4x | **No** |

Ningún contrato de Coinbase Derivatives cabe en el límite de 2x con 200 €: un solo contrato ya supera el apalancamiento permitido. Además, con un riesgo del 1 % (≈ 2.24 USD) y un contrato nano de BTC (0,01 BTC), el stop tendría que estar a ≈ 224 USD del precio (≈ 0.27 %), muy por debajo del ruido horario de BTC.
