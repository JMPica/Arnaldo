# APEX — Estudio de viabilidad (octubre de 2026)

Resumen para el propietario. Las cifras de estrategia salen de `docs/INVESTIGACION.md`, que se genera automáticamente con datos reales.

## 1. ¿Se pueden operar futuros de Bitcoin de Coinbase con 200 € y 2x?

**No, con las reglas que fijaste.**

- Coinbase empezó a ofrecer futuros a usuarios de Coinbase Advanced en 26 países europeos en marzo de 2026, a través de su entidad regulada MiFID (Chipre), con verificación de experiencia y KYC. Tus capturas confirman que los ves en la app (lugar: Coinbase Derivatives Exchange, contrato de 1/100 BTC, fondos en USD/USDC). No hay documentación pública que confirme que la API de Coinbase permita operar esos contratos desde la UE; lo de la API internacional (INTX) no aplica a residentes en la UE.
- El problema decisivo es el tamaño del contrato. Según la API pública de Coinbase, el contrato más pequeño de BTC es de **0,01 BTC ≈ 844 US$** de nocional. Con 200 € (≈ 232 US$) eso exige **3,6x** de apalancamiento con un solo contrato. Tu límite es 2x.
- Además, con un riesgo del 1 % por operación (≈ 2,3 US$), un solo contrato obligaría a poner el stop a ≈ 230 US$ del precio (≈ 0,28 %). BTC se mueve más que eso en una hora normal: el stop saltaría casi siempre por ruido.

### Las materias primas de tus capturas (Coinbase Derivatives)

Tamaños verificados en la API pública de Coinbase y precios de tus capturas:

| Activo | Contrato | Nocional de 1 contrato | Apalancamiento necesario con 200 € |
|---|---|---|---|
| Bitcoin | 0,01 BTC | ≈ 844 US$ | 3,6x |
| Oro | 1 onza | ≈ 4.142 US$ | 17,9x |
| Plata | 50 onzas | ≈ 2.883 US$ | 12,4x |
| Cobre | 2.000 libras | ≈ 13.100 US$ | 56x |
| Platino | 10 onzas | ≈ 16.279 US$ | 70x |
| Petróleo | 10 barriles | ≈ 979 US$ | 4,2x |
| Gas natural | 1.000 MMBtu | ≈ 2.778 US$ | 12x |

Ninguno cabe en 2x con 200 €. Por eso no se pueden usar en APEX con tus reglas a través de Coinbase, aunque el análisis estadístico de estos activos está en el informe de investigación.

**Alternativa para materias primas:** la lista pública de instrumentos de Kraken Futures incluye perpetuos de oro (`PF_XAUUSD`, mínimo 0,001 onzas ≈ 4 US$), plata (`PF_XAGUSD`, mínimo 0,1 onzas ≈ 6 US$) y petróleo WTI y Brent (`PF_WTIOILUSD`, `PF_BRENTOILUSD`, mínimo 0,1 barriles ≈ 10 US$). Esos tamaños sí caben en 2x con 200 €. Falta confirmar que estén disponibles para clientes del EEE (la lista se descargó desde un servidor de EE. UU.). Ver el informe de investigación para saber si alguna estrategia supera los criterios en estos activos antes de plantear añadirlos.

## 2. Alternativa elegida: Kraken Futures (perpetuo PF_XBTUSD)

| Criterio | Kraken Futures (UE) | Coinbase Futures (UE) |
|---|---|---|
| Regulación | MiFID II, Payward Europe Digital Solutions (CY) Ltd; disponible en España | MiFID II, Coinbase (Chipre) |
| Tamaño mínimo | **0,0001 BTC ≈ 8 US$** (verificado en la API de Kraken) | 0,01 BTC ≈ 844 US$ |
| ¿Cabe en 2x y 1 % de riesgo con 200 €? | **Sí**, con margen | No |
| API para operar | Sí, documentada, con entorno de pruebas (demo-futures.kraken.com) | No confirmada para la UE |
| Comisiones (nivel inicial) | 0,02 % maker / 0,05 % taker | desde 0,02 % por contrato |
| Diferencial observado | 1 US$ sobre 84.110 (≈ 0,1 pb) | — |
| Coste de mantener la posición | funding horario (medio histórico ≈ 10 % anual pagado por los largos) | funding/roll |
| Retiradas desde la API | se pueden desactivar en los permisos de la clave | — |

**Decisión:** APEX usa los precios en vivo de Kraken Futures (PF_XBTUSD) para el paper trading y, si algún día lo autorizas, operaría allí. No se ha contratado nada ni se ha movido dinero.

## 3. Resultados de la investigación (resumen)

Con datos horarios reales de 2017 a octubre de 2026, costes reales y prueba fuera de muestra (walk-forward):

- **Superan todos los criterios:** ruptura de Donchian (Sharpe fuera de muestra 0,94) y cruce de medias (0,82). Son estrategias de seguimiento de tendencia, la familia con más evidencia académica.
- **No los superan:** momentum puro (0,48, se queda justo por debajo) y las dos de reversión a la media (pierden dinero tras costes).
- **Comparación pasiva:** comprar y mantener BTC dio más rentabilidad (36,9 % anual en el mismo periodo) pero con una caída máxima del 76,6 %. La estrategia elegida tuvo una caída máxima fuera de muestra del 11,6 %.

- **Materias primas** (datos horarios de OANDA desde 2003-2006): en **oro** superan los criterios el momentum (Sharpe 0,66) y Donchian (0,53), con rentabilidades pequeñas; en plata, cobre, platino, petróleo y gas natural **ninguna estrategia los supera**.

**Estrategia que usará APEX:** ruptura de Donchian diaria (entrada al superar el máximo de 20 días, salida al perder el mínimo de 10, stop a 2 ATR, largos y cortos), elegida con la misma regla walk-forward sobre los dos últimos años.

**Lo que esto significa en euros.** Con 1 % de riesgo por operación y stops anchos, la posición media es pequeña (≈ 0,16x del capital). En la prueba con 200 € de los dos últimos años (20/10/2024 → 20/10/2026) la estrategia habría ganado **≈ 13,3 €** (≈ 3,3 % anual) en 20 operaciones, con una caída máxima del 6,9 %, pagando ≈ 0,63 € en comisiones y ≈ 2,1 € en funding. Los resultados pasados no garantizan nada: es una referencia de orden de magnitud, no una previsión.

## 4. Costes de infraestructura

| Componente | Servicio | Coste |
|---|---|---|
| Panel web privado + API | Cloudflare Workers (plan gratuito: 100.000 peticiones/día) | 0 € |
| Motor autónomo (cada 5 min) | Cloudflare Cron Triggers (incluido) | 0 € |
| Base de datos persistente | Cloudflare D1 (gratis hasta 5 GB) | 0 € |
| Investigación semanal, pruebas, despliegue, vigilante | GitHub Actions (repositorio público: minutos ilimitados) | 0 € |
| Llamadas a IA | Ninguna: el motor es determinista | 0 € |
| Avisos al móvil (opcional) | Telegram | 0 € |
| **Total fijo** | | **0 €/mes** |

Uso estimado: 288 ciclos al día del motor más las visitas al panel, muy por debajo de los límites gratuitos.

**¿Comprometen los costes la viabilidad?** Cualquier coste fijo la rompería. Un servidor de 4 €/mes son 48 € al año, el 24 % del capital, frente a una ganancia histórica de ≈ 6-7 €/año. Por eso todo el sistema está diseñado para el plan gratuito. Con 200 € el proyecto es viable como **fase de validación** (comprobar que el sistema funciona y que los resultados en simulación se parecen a los del backtest), no como fuente de ingresos.

## 5. Riesgos y limitaciones conocidas

- La investigación usa velas de Binance como aproximación al perpetuo de Kraken (Kraken solo tiene historia desde 2022). El motor en vivo usa datos de Kraken. El control de deriva semanal compara ambos.
- El funding de Kraken es horario y puede cambiar de signo. El paper trading usa la tasa real de cada hora.
- El plan gratuito de Cloudflare limita el tiempo de CPU por ejecución. El motor está optimizado para ello, pero un pico podría hacer fallar un ciclo aislado; el siguiente ciclo lo recupera (las velas no procesadas se procesan después) y el panel muestra el error.
- El repositorio es público (no fue posible crear uno privado con los permisos actuales). No contiene secretos; el código de la estrategia sí es visible. Puedes hacerlo privado en GitHub en cualquier momento (ver INTERVENCIONES.md).
- Fiscalidad: las ganancias con derivados se declaran en el IRPF (base del ahorro). Consulta con un asesor; esto no es asesoramiento fiscal ni financiero.

## Fuentes

- Coinbase lanza futuros en 26 países europeos (marzo de 2026): https://www.theblock.co/post/392797/coinbase-opens-crypto-futures-trading-europe , https://www.coinbase.com/blog/futures-contracts-europe
- Contratos nano de Coinbase Derivatives: https://www.cftc.gov/filings/ptc/ptc06262524818.pdf , https://www.coinbase.com/derivatives
- Kraken derivados regulados en Europa: https://www.coindesk.com/business/2025/05/20/kraken-rolls-out-regulated-crypto-derivatives-in-europe , https://pro.kraken.com/es/perps/crypto-perpetuals
- Entorno demo de Kraken Futures: https://docs.kraken.com/api/docs/guides/futures-introduction
- Especificaciones verificadas por API: `research/data/coinbase_futures_products.json`, `research/data/kraken_instruments_xbt.json`, `research/data/kraken_ticker_pf_xbtusd.json` (descargadas el 22/10/2026).
