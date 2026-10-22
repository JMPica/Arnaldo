# APEX — Informe de investigación cuantitativa

Generado automáticamente por `research/run.ts` el 2026-10-22 11:01 UTC. No editar a mano.

## Metodología

- **Datos reales horarios.** BTC: velas de 1 h de Binance (BTCUSDT) como proxy del perpetuo, con la serie histórica de *funding* de Binance aplicada hora a hora. Materias primas: velas de 1 h de OANDA (contado/CFD).
- **Mismo código que en producción.** El backtest usa la misma función `processHour()` que ejecuta el motor real: mismas señales, mismo dimensionado, mismo motor de riesgo.
- **Sin mirar al futuro.** Las señales se calculan con velas cerradas y se ejecutan en la apertura de la vela siguiente. Los stops se evalúan contra el máximo/mínimo de cada hora; si hay hueco, se ejecutan al precio de apertura.
- **Costes:** comisión taker 0.05 % por lado + deslizamiento 0.03 % por lado + funding real. Prueba de estrés con costes ×2.
- **Riesgo:** 2 % del capital hasta el stop, apalancamiento máximo 2x, una posición, suspensión con caída del 20 %.
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
| tsmom | 0.53 | 4.6 % | 14.0 % | 106 | 83 % | 0.90 | 0 % | 0.58 | 0.79 | 100 % | **Sí** |
| donchian | 0.93 | 13.2 % | 18.1 % | 41 | 58 % | 0.99 | 3 % | 0.56 | 0.88 | 100 % | **Sí** |
| ema_cross | 0.82 | 9.2 % | 14.2 % | 47 | 58 % | 0.98 | 1 % | 0.63 | 0.65 | 94 % | **Sí** |
| rsi_mr | -1.34 | -13.2 % | 59.4 % | 598 | 17 % | 0.00 | 32 % | -2.15 | 0.07 | 0 % | No |
| boll_mr | -0.54 | -3.6 % | 23.7 % | 75 | 33 % | 0.09 | 0 % | -0.73 | 0.01 | 0 % | No |

<details><summary>Motivos de rechazo</summary>

- **rsi_mr**: Sharpe OOS = -1.34 (umbral 0.50); PSR OOS = 0.00 (umbral 0.90); Ventanas OOS positivas = 0.17 (umbral 0.55); P(caída ≥20 %) Monte Carlo = 0.32 (umbral 0.10); Estabilidad de parámetros = 0.00 (umbral 0.60); Caída máxima OOS = 0.59 (umbral 0.20); Sharpe OOS con costes ×2 = -2.15 (umbral 0.00)
- **boll_mr**: Sharpe OOS = -0.54 (umbral 0.50); PSR OOS = 0.09 (umbral 0.90); Ventanas OOS positivas = 0.33 (umbral 0.55); Estabilidad de parámetros = 0.00 (umbral 0.60); Caída máxima OOS = 0.24 (umbral 0.20); Sharpe OOS con costes ×2 = -0.73 (umbral 0.00)

</details>

## Oro (XAU/USD, OANDA)

Datos: 2006-03-19 → 2026-10-21 (125.297 velas de 1 h).

**Alternativa pasiva (comprar y mantener, mismo periodo OOS):** CAGR 8.8 %, Sharpe 0.59, caída máxima 44.8 %.

| Familia | Sharpe OOS | CAGR OOS | Caída máx. OOS | Ops OOS | Ventanas + | PSR | P(DD≥20 %) | Sharpe costes×2 | DSR muestra completa | Estabilidad | ¿Aprobada? |
|---|---|---|---|---|---|---|---|---|---|---|---|
| tsmom | 0.66 | 4.5 % | 18.1 % | 187 | 63 % | 1.00 | 0 % | 0.54 | 0.72 | 95 % | **Sí** |
| donchian | 0.55 | 4.5 % | 19.2 % | 76 | 60 % | 0.99 | 0 % | 0.47 | 0.75 | 94 % | **Sí** |
| ema_cross | 0.50 | 3.5 % | 20.4 % | 94 | 60 % | 0.98 | 0 % | 0.41 | 0.76 | 100 % | No |
| rsi_mr | -1.63 | -10.8 % | 86.6 % | 823 | 14 % | 0.00 | 13 % | -3.26 | 0.01 | 0 % | No |
| boll_mr | -0.17 | -1.0 % | 26.8 % | 154 | 49 % | 0.24 | 0 % | -0.60 | 0.09 | 25 % | No |

<details><summary>Motivos de rechazo</summary>

- **ema_cross**: Caída máxima OOS = 0.20 (umbral 0.20)
- **rsi_mr**: Sharpe OOS = -1.63 (umbral 0.50); PSR OOS = 0.00 (umbral 0.90); Ventanas OOS positivas = 0.14 (umbral 0.55); P(caída ≥20 %) Monte Carlo = 0.13 (umbral 0.10); Estabilidad de parámetros = 0.00 (umbral 0.60); Caída máxima OOS = 0.87 (umbral 0.20); Sharpe OOS con costes ×2 = -3.26 (umbral 0.00)
- **boll_mr**: Sharpe OOS = -0.17 (umbral 0.50); PSR OOS = 0.24 (umbral 0.90); Ventanas OOS positivas = 0.49 (umbral 0.55); Estabilidad de parámetros = 0.25 (umbral 0.60); Caída máxima OOS = 0.27 (umbral 0.20); Sharpe OOS con costes ×2 = -0.60 (umbral 0.00)

</details>

## Plata (XAG/USD, OANDA)

Datos: 2006-03-19 → 2026-10-21 (124.964 velas de 1 h).

**Alternativa pasiva (comprar y mantener, mismo periodo OOS):** CAGR 8.8 %, Sharpe 0.43, caída máxima 74.9 %.

| Familia | Sharpe OOS | CAGR OOS | Caída máx. OOS | Ops OOS | Ventanas + | PSR | P(DD≥20 %) | Sharpe costes×2 | DSR muestra completa | Estabilidad | ¿Aprobada? |
|---|---|---|---|---|---|---|---|---|---|---|---|
| tsmom | 0.29 | 2.4 % | 29.8 % | 209 | 46 % | 0.87 | 5 % | 0.23 | 0.54 | 90 % | No |
| donchian | 0.13 | 0.7 % | 29.2 % | 98 | 34 % | 0.70 | 1 % | 0.19 | 0.49 | 81 % | No |
| ema_cross | 0.17 | 1.2 % | 40.0 % | 111 | 37 % | 0.76 | 6 % | 0.20 | 0.64 | 100 % | No |
| rsi_mr | -0.98 | -7.3 % | 73.5 % | 877 | 26 % | 0.00 | 8 % | -1.67 | 0.02 | 0 % | No |
| boll_mr | -0.04 | -0.3 % | 20.9 % | 136 | 51 % | 0.43 | 0 % | -0.08 | 0.10 | 19 % | No |

<details><summary>Motivos de rechazo</summary>

- **tsmom**: Sharpe OOS = 0.29 (umbral 0.50); PSR OOS = 0.87 (umbral 0.90); Ventanas OOS positivas = 0.46 (umbral 0.55); Caída máxima OOS = 0.30 (umbral 0.20)
- **donchian**: Sharpe OOS = 0.13 (umbral 0.50); PSR OOS = 0.70 (umbral 0.90); Ventanas OOS positivas = 0.34 (umbral 0.55); Caída máxima OOS = 0.29 (umbral 0.20)
- **ema_cross**: Sharpe OOS = 0.17 (umbral 0.50); PSR OOS = 0.76 (umbral 0.90); Ventanas OOS positivas = 0.37 (umbral 0.55); Caída máxima OOS = 0.40 (umbral 0.20)
- **rsi_mr**: Sharpe OOS = -0.98 (umbral 0.50); PSR OOS = 0.00 (umbral 0.90); Ventanas OOS positivas = 0.26 (umbral 0.55); Estabilidad de parámetros = 0.00 (umbral 0.60); Caída máxima OOS = 0.73 (umbral 0.20); Sharpe OOS con costes ×2 = -1.67 (umbral 0.00)
- **boll_mr**: Sharpe OOS = -0.04 (umbral 0.50); PSR OOS = 0.43 (umbral 0.90); Ventanas OOS positivas = 0.51 (umbral 0.55); Estabilidad de parámetros = 0.19 (umbral 0.60); Caída máxima OOS = 0.21 (umbral 0.20); Sharpe OOS con costes ×2 = -0.08 (umbral 0.00)

</details>

## Cobre (XCU/USD, OANDA)

Datos: 2003-03-28 → 2026-10-21 (127.073 velas de 1 h).

**Alternativa pasiva (comprar y mantener, mismo periodo OOS):** CAGR 4.9 %, Sharpe 0.31, caída máxima 69.0 %.

| Familia | Sharpe OOS | CAGR OOS | Caída máx. OOS | Ops OOS | Ventanas + | PSR | P(DD≥20 %) | Sharpe costes×2 | DSR muestra completa | Estabilidad | ¿Aprobada? |
|---|---|---|---|---|---|---|---|---|---|---|---|
| tsmom | -0.09 | -0.7 % | 28.6 % | 206 | 44 % | 0.34 | 0 % | -0.13 | 0.69 | 90 % | No |
| donchian | 0.26 | 1.7 % | 18.2 % | 81 | 46 % | 0.88 | 1 % | 0.20 | 0.74 | 100 % | No |
| ema_cross | -0.05 | -0.4 % | 23.1 % | 101 | 34 % | 0.41 | 0 % | -0.10 | 0.51 | 75 % | No |
| rsi_mr | -0.87 | -5.8 % | 73.7 % | 855 | 29 % | 0.00 | 3 % | -1.82 | 0.07 | 0 % | No |
| boll_mr | 0.09 | 0.4 % | 21.9 % | 264 | 56 % | 0.66 | 0 % | 0.04 | 0.44 | 56 % | No |

<details><summary>Motivos de rechazo</summary>

- **tsmom**: Sharpe OOS = -0.09 (umbral 0.50); PSR OOS = 0.34 (umbral 0.90); Ventanas OOS positivas = 0.44 (umbral 0.55); Caída máxima OOS = 0.29 (umbral 0.20); Sharpe OOS con costes ×2 = -0.13 (umbral 0.00)
- **donchian**: Sharpe OOS = 0.26 (umbral 0.50); PSR OOS = 0.88 (umbral 0.90); Ventanas OOS positivas = 0.46 (umbral 0.55)
- **ema_cross**: Sharpe OOS = -0.05 (umbral 0.50); PSR OOS = 0.41 (umbral 0.90); Ventanas OOS positivas = 0.34 (umbral 0.55); Caída máxima OOS = 0.23 (umbral 0.20); Sharpe OOS con costes ×2 = -0.10 (umbral 0.00)
- **rsi_mr**: Sharpe OOS = -0.87 (umbral 0.50); PSR OOS = 0.00 (umbral 0.90); Ventanas OOS positivas = 0.29 (umbral 0.55); Estabilidad de parámetros = 0.00 (umbral 0.60); Caída máxima OOS = 0.74 (umbral 0.20); Sharpe OOS con costes ×2 = -1.82 (umbral 0.00)
- **boll_mr**: Sharpe OOS = 0.09 (umbral 0.50); PSR OOS = 0.66 (umbral 0.90); Estabilidad de parámetros = 0.56 (umbral 0.60); Caída máxima OOS = 0.22 (umbral 0.20)

</details>

## Platino (XPT/USD, OANDA)

Datos: 2005-01-03 → 2026-10-21 (125.732 velas de 1 h).

**Alternativa pasiva (comprar y mantener, mismo periodo OOS):** CAGR 0.2 %, Sharpe 0.15, caída máxima 73.5 %.

| Familia | Sharpe OOS | CAGR OOS | Caída máx. OOS | Ops OOS | Ventanas + | PSR | P(DD≥20 %) | Sharpe costes×2 | DSR muestra completa | Estabilidad | ¿Aprobada? |
|---|---|---|---|---|---|---|---|---|---|---|---|
| tsmom | 0.01 | -0.2 % | 34.6 % | 205 | 35 % | 0.51 | 1 % | -0.11 | 0.70 | 95 % | No |
| donchian | -0.06 | -0.8 % | 42.4 % | 108 | 49 % | 0.39 | 2 % | -0.07 | 0.60 | 81 % | No |
| ema_cross | -0.18 | -1.5 % | 46.6 % | 107 | 43 % | 0.22 | 1 % | -0.22 | 0.23 | 75 % | No |
| rsi_mr | -1.23 | -8.1 % | 80.2 % | 828 | 16 % | 0.00 | 7 % | -2.22 | 0.11 | 0 % | No |
| boll_mr | -0.63 | -3.9 % | 54.8 % | 210 | 32 % | 0.00 | 1 % | -0.84 | 0.04 | 0 % | No |

<details><summary>Motivos de rechazo</summary>

- **tsmom**: Sharpe OOS = 0.01 (umbral 0.50); PSR OOS = 0.51 (umbral 0.90); Ventanas OOS positivas = 0.35 (umbral 0.55); Caída máxima OOS = 0.35 (umbral 0.20); Sharpe OOS con costes ×2 = -0.11 (umbral 0.00)
- **donchian**: Sharpe OOS = -0.06 (umbral 0.50); PSR OOS = 0.39 (umbral 0.90); Ventanas OOS positivas = 0.49 (umbral 0.55); Caída máxima OOS = 0.42 (umbral 0.20); Sharpe OOS con costes ×2 = -0.07 (umbral 0.00)
- **ema_cross**: Sharpe OOS = -0.18 (umbral 0.50); PSR OOS = 0.22 (umbral 0.90); Ventanas OOS positivas = 0.43 (umbral 0.55); Caída máxima OOS = 0.47 (umbral 0.20); Sharpe OOS con costes ×2 = -0.22 (umbral 0.00)
- **rsi_mr**: Sharpe OOS = -1.23 (umbral 0.50); PSR OOS = 0.00 (umbral 0.90); Ventanas OOS positivas = 0.16 (umbral 0.55); Estabilidad de parámetros = 0.00 (umbral 0.60); Caída máxima OOS = 0.80 (umbral 0.20); Sharpe OOS con costes ×2 = -2.22 (umbral 0.00)
- **boll_mr**: Sharpe OOS = -0.63 (umbral 0.50); PSR OOS = 0.00 (umbral 0.90); Ventanas OOS positivas = 0.32 (umbral 0.55); Estabilidad de parámetros = 0.00 (umbral 0.60); Caída máxima OOS = 0.55 (umbral 0.20); Sharpe OOS con costes ×2 = -0.84 (umbral 0.00)

</details>

## Petróleo WTI (OANDA)

Datos: 2003-01-22 → 2026-10-21 (139.876 velas de 1 h).

**Alternativa pasiva (comprar y mantener, mismo periodo OOS):** CAGR 2.0 %, Sharpe 0.25, caída máxima 91.7 %.

| Familia | Sharpe OOS | CAGR OOS | Caída máx. OOS | Ops OOS | Ventanas + | PSR | P(DD≥20 %) | Sharpe costes×2 | DSR muestra completa | Estabilidad | ¿Aprobada? |
|---|---|---|---|---|---|---|---|---|---|---|---|
| tsmom | 0.04 | 0.1 % | 40.9 % | 280 | 44 % | 0.57 | 0 % | 0.01 | 0.57 | 95 % | No |
| donchian | 0.34 | 2.1 % | 19.8 % | 80 | 41 % | 0.94 | 0 % | 0.29 | 0.80 | 94 % | No |
| ema_cross | -0.05 | -0.5 % | 39.7 % | 107 | 44 % | 0.40 | 0 % | -0.08 | 0.69 | 94 % | No |
| rsi_mr | -1.22 | -9.3 % | 86.2 % | 1099 | 15 % | 0.00 | 15 % | -2.13 | 0.05 | 0 % | No |
| boll_mr | -0.33 | -2.3 % | 48.0 % | 256 | 44 % | 0.06 | 3 % | -0.46 | 0.30 | 31 % | No |

<details><summary>Motivos de rechazo</summary>

- **tsmom**: Sharpe OOS = 0.04 (umbral 0.50); PSR OOS = 0.57 (umbral 0.90); Ventanas OOS positivas = 0.44 (umbral 0.55); Caída máxima OOS = 0.41 (umbral 0.20)
- **donchian**: Sharpe OOS = 0.34 (umbral 0.50); Ventanas OOS positivas = 0.41 (umbral 0.55)
- **ema_cross**: Sharpe OOS = -0.05 (umbral 0.50); PSR OOS = 0.40 (umbral 0.90); Ventanas OOS positivas = 0.44 (umbral 0.55); Caída máxima OOS = 0.40 (umbral 0.20); Sharpe OOS con costes ×2 = -0.08 (umbral 0.00)
- **rsi_mr**: Sharpe OOS = -1.22 (umbral 0.50); PSR OOS = 0.00 (umbral 0.90); Ventanas OOS positivas = 0.15 (umbral 0.55); P(caída ≥20 %) Monte Carlo = 0.15 (umbral 0.10); Estabilidad de parámetros = 0.00 (umbral 0.60); Caída máxima OOS = 0.86 (umbral 0.20); Sharpe OOS con costes ×2 = -2.13 (umbral 0.00)
- **boll_mr**: Sharpe OOS = -0.33 (umbral 0.50); PSR OOS = 0.06 (umbral 0.90); Ventanas OOS positivas = 0.44 (umbral 0.55); Estabilidad de parámetros = 0.31 (umbral 0.60); Caída máxima OOS = 0.48 (umbral 0.20); Sharpe OOS con costes ×2 = -0.46 (umbral 0.00)

</details>

## Gas natural (OANDA)

Datos: 2003-01-30 → 2026-10-21 (136.274 velas de 1 h).

**Alternativa pasiva (comprar y mantener, mismo periodo OOS):** CAGR -5.3 %, Sharpe 0.15, caída máxima 89.4 %.

| Familia | Sharpe OOS | CAGR OOS | Caída máx. OOS | Ops OOS | Ventanas + | PSR | P(DD≥20 %) | Sharpe costes×2 | DSR muestra completa | Estabilidad | ¿Aprobada? |
|---|---|---|---|---|---|---|---|---|---|---|---|
| tsmom | 0.14 | 0.7 % | 14.9 % | 222 | 56 % | 0.73 | 0 % | 0.09 | 0.50 | 40 % | No |
| donchian | 0.15 | 0.9 % | 22.3 % | 104 | 56 % | 0.74 | 1 % | 0.10 | 0.44 | 44 % | No |
| ema_cross | -0.08 | -0.8 % | 25.3 % | 113 | 29 % | 0.36 | 0 % | -0.04 | 0.19 | 25 % | No |
| rsi_mr | -0.85 | -6.6 % | 76.3 % | 1002 | 22 % | 0.00 | 9 % | -1.47 | 0.03 | 0 % | No |
| boll_mr | -0.17 | -1.0 % | 22.5 % | 198 | 37 % | 0.23 | 0 % | -0.33 | 0.09 | 0 % | No |

<details><summary>Motivos de rechazo</summary>

- **tsmom**: Sharpe OOS = 0.14 (umbral 0.50); PSR OOS = 0.73 (umbral 0.90); Estabilidad de parámetros = 0.40 (umbral 0.60)
- **donchian**: Sharpe OOS = 0.15 (umbral 0.50); PSR OOS = 0.74 (umbral 0.90); Estabilidad de parámetros = 0.44 (umbral 0.60); Caída máxima OOS = 0.22 (umbral 0.20)
- **ema_cross**: Sharpe OOS = -0.08 (umbral 0.50); PSR OOS = 0.36 (umbral 0.90); Ventanas OOS positivas = 0.29 (umbral 0.55); Estabilidad de parámetros = 0.25 (umbral 0.60); Caída máxima OOS = 0.25 (umbral 0.20); Sharpe OOS con costes ×2 = -0.04 (umbral 0.00)
- **rsi_mr**: Sharpe OOS = -0.85 (umbral 0.50); PSR OOS = 0.00 (umbral 0.90); Ventanas OOS positivas = 0.22 (umbral 0.55); Estabilidad de parámetros = 0.00 (umbral 0.60); Caída máxima OOS = 0.76 (umbral 0.20); Sharpe OOS con costes ×2 = -1.47 (umbral 0.00)
- **boll_mr**: Sharpe OOS = -0.17 (umbral 0.50); PSR OOS = 0.23 (umbral 0.90); Ventanas OOS positivas = 0.37 (umbral 0.55); Estabilidad de parámetros = 0.00 (umbral 0.60); Caída máxima OOS = 0.23 (umbral 0.20); Sharpe OOS con costes ×2 = -0.33 (umbral 0.00)

</details>

## Resultado

**Estrategia aprobada para paper trading:** `donchian:1d:allowShort=1,entry=20,exit=10,stopAtr=2,trail=0` (familia donchian, Sharpe OOS 0.93).

### Prueba de realidad con 200 € (2024-10-20 → 2026-10-20)

Configuración: `donchian:1d:allowShort=1,entry=20,exit=10,stopAtr=2,trail=0`. Capital 224.45 USD (EUR/USD 1.1222).

| Métrica | Valor |
|---|---|
| Resultado neto | 25.85 € |
| Comisiones pagadas | 1.37 € |
| Funding pagado | 4.20 € |
| Operaciones | 20 |
| Órdenes rechazadas por riesgo/tamaño | 0 |
| Nocional medio por operación | 76.40 USD |
| Apalancamiento medio | 0.34x |
| CAGR | 6.3 % |
| Caída máxima | 13.7 % |

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

Ningún contrato de Coinbase Derivatives cabe en el límite de 2x con 200 €: un solo contrato ya supera el apalancamiento permitido. Además, con un riesgo del 2 % (≈ 4.49 USD) y un contrato nano de BTC (0,01 BTC), el stop tendría que estar a ≈ 449 USD del precio (≈ 0.53 %), por debajo del ruido diario de BTC.
