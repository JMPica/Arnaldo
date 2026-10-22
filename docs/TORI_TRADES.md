# Estrategia de líneas de tendencia de Tori Trades: prueba con datos reales

Fecha: 22/10/2026. Riesgo por operación: 2 %. Apalancamiento máximo: 2x. Mismos costes y criterios que el resto de estrategias (ver `INVESTIGACION.md`).

## Qué se ha copiado

Se han tomado las reglas que Tori Trades (Victoria Duke) publica de forma abierta: su checklist en PDF, sus publicaciones en X y resúmenes de terceros. No se ha usado el contenido de sus cursos de pago. El código está en `src/core/strategies/trendline.ts`.

| Regla publicada | Cómo la aplica APEX |
|---|---|
| Velas de 4 horas, sin indicadores | Velas de 4 h; el ATR solo se usa como tolerancia para medir si un toque "toca" la línea |
| Línea de acción con 2-3 o más toques (mechas) | Líneas entre máximos o mínimos de giro con 2 o 3 toques como mínimo (se prueban las dos variantes) |
| Toques separados por 6 o más velas | Mínimo de 6 velas entre toques |
| Línea trazada durante 3 semanas o más | Al menos 126 velas de 4 h desde el primer toque |
| Ruptura: entrar cuando una vela cierra al otro lado | Entrada en la apertura de la vela siguiente; variante con confirmación de una segunda vela |
| Rebote: la misma línea es de acción y de seguridad | Variante "rupturas + rebotes" |
| Stop donde la 4ª vela tras la ruptura tocaría la línea de seguridad | Igual |
| Salir si una vela cierra al otro lado de la línea de seguridad; arrastrar el stop con ella | Igual |
| Objetivo en el primer soporte/resistencia que dé 2R o más, o dejar correr | Las dos variantes |
| Riesgo de 1-2 % por operación | 2 % |

Lo que no se puede copiar: su criterio visual al trazar las líneas, el contexto que mira en gráficos mayores, las noticias y su elección de qué operaciones tomar. Ella hace unas pocas operaciones al año muy seleccionadas; la versión automática toma todas las que cumplen las reglas.

## Resultados fuera de muestra (walk-forward, 2005/2017 → 2026)

| Activo | Variante | Rentabilidad anual | Caída máxima | Sharpe | Operaciones | ¿Supera los criterios? |
|---|---|---|---|---|---|---|
| **Platino** | Solo rupturas | **3,3 %** | 15,7 % | 0,50 | 185 | **Casi**: falla por un punto (54 % de semestres positivos; se exige 55 %) |
| Platino | Rupturas + rebotes | −1,4 % | 37,1 % | −0,11 | 359 | No |
| Petróleo | Solo rupturas | 0,1 % | 26,3 % | 0,05 | 284 | No |
| Petróleo | Rupturas + rebotes | −2,5 % | 56,0 % | −0,21 | 395 | No |
| BTC | Solo rupturas | 5,1 % | 17,9 % | 0,47 | 141 | No |
| BTC | Rupturas + rebotes | −4,3 % | 38,0 % | −0,22 | 189 | No |
| Oro | Solo rupturas | −0,7 % | 22,1 % | −0,07 | 237 | No |
| Oro | Rupturas + rebotes | −0,7 % | 28,4 % | −0,04 | 404 | No |
| Plata | Solo rupturas | −1,4 % | 39,0 % | −0,13 | 230 | No |
| Plata | Rupturas + rebotes | −3,6 % | 62,4 % | −0,24 | 419 | No |

Para comparar: la estrategia activa de APEX (ruptura de Donchian diaria en BTC) da un 13,2 % anual fuera de muestra con una caída máxima del 18 % y supera todos los criterios.

## Conclusiones

1. **En platino su idea tiene algo.** Es la única estrategia de las probadas que gana dinero fuera de muestra en platino (las otras cinco familias pierden). Pero la ventaja es pequeña (3,3 % anual) y no llega a superar los criterios.
2. **En petróleo, oro, plata y BTC no supera los criterios.** En BTC gana algo (5,1 %), menos que la estrategia actual.
3. **Los rebotes empeoran siempre los resultados.** Las rupturas aportan algo; los rebotes, automatizados, pierden dinero en todos los activos.
4. **Tampoco se podría operar en platino con tu capital:** el contrato de Coinbase son 10 onzas (≈ 16.000 US$) y Kraken no tiene perpetuo de platino.
5. Sus resultados personales, si son reales, dependen de su criterio y de su capital, no de las reglas que publica. Esas reglas, aplicadas de forma automática, no explican ganancias como las que anuncia.

## Qué cambia en APEX

- La estrategia queda incorporada como una familia más (`trendline`). El aprendizaje semanal la reevaluará con los datos nuevos y la propondrá solo si algún día supera los criterios y mejora a la vigente.
- La estrategia activa sigue siendo la ruptura de Donchian diaria en BTC.

## Fuentes

- Checklist de Tori Trades: https://cdn.prod.website-files.com/668852f921e36c3365b91d03/6851a0c6c14969d9b98520a2_Tori%20Trades%20Trendlines.pdf
- Publicaciones en X: https://x.com/toritrades/status/1912976565819809846 , https://x.com/toritrades/status/1814362243435295092 , https://x.com/toritrades/status/1944913436699468197
- Resúmenes de terceros: https://www.tradezella.com/strategies/trendline-strategy , https://fxreplay.com/strategies/tori-trades-trendlines-strategy , https://www.chartfanatics.com/strategies/trendline-strategy , https://www.forex.in.rs/trendline-swing-discipline/
- Reseña con extractos del bróker: https://coinspot.io/en/reviews/tori-trades/
