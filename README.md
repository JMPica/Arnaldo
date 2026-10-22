# APEX — sistema de trading autónomo (paper trading)

APEX vigila Bitcoin cada 5 minutos, decide con una estrategia validada estadísticamente, simula las operaciones con precios reales de Kraken Futures y te lo enseña todo en un panel privado para iPhone. Funciona solo, sin que tengas nada abierto.

**Estado actual:** modo simulación (paper trading). No usa dinero real y no puede hacerlo sin una autorización aparte.

## Qué tienes que hacer

Ver **[docs/INTERVENCIONES.md](docs/INTERVENCIONES.md)**: crear una cuenta gratuita de Cloudflare y añadir tres secretos en GitHub (≈ 15 minutos). Después solo abres APEX, miras el estado y pulsas Encender o Apagar.

## Documentos

| Documento | Contenido |
|---|---|
| [docs/VIABILIDAD.md](docs/VIABILIDAD.md) | Por qué no Coinbase con 400 € y 2x, por qué Kraken, costes (0 €/mes) y qué se puede esperar en euros |
| [docs/INVESTIGACION.md](docs/INVESTIGACION.md) | Resultados de la investigación con datos reales (se regenera automáticamente) |
| [docs/TORI_TRADES.md](docs/TORI_TRADES.md) | Prueba de la estrategia de líneas de tendencia de Tori Trades con datos reales |
| [docs/ARQUITECTURA.md](docs/ARQUITECTURA.md) | Cómo funciona, controles de riesgo, seguridad y pruebas |
| [docs/INTERVENCIONES.md](docs/INTERVENCIONES.md) | Los pasos que requieren tu identidad o tus cuentas |

## Panel

- **Estado:** capital actual, beneficio o pérdida, curva de capital, posición abierta con apalancamiento y riesgo, controles (Encender/Apagar, Pausar entradas, Parada de emergencia) y últimas decisiones con su razonamiento.
- **Operaciones:** cada operación con su motivo de entrada y salida, órdenes, comisiones y funding.
- **Estrategia:** la estrategia activa, sus parámetros, los criterios que superó y los límites de riesgo.
- **Aprendizaje:** el historial de investigaciones semanales y cambios de estrategia.
- **Informes:** el informe mensual automático y el registro de actividad.

## Para desarrolladores

```bash
npm ci
npx tsc --noEmit -p .        # tipos
npx vitest run               # 49 pruebas (núcleo + extremo a extremo)
npx tsx research/run.ts      # investigación completa → docs/INVESTIGACION.md y research/out/champion.json
npx tsx research/learn.ts --dry   # ciclo de aprendizaje sin enviar resultados
```

Aviso: el trading con derivados conlleva un alto riesgo de pérdida. Los resultados históricos y simulados no garantizan resultados futuros. Nada de este repositorio es asesoramiento financiero.
