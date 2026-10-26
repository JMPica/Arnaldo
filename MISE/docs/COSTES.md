# Costes de operación de MISE (previsión, 2026-10-26)

Cuotas consultadas el 2026-10-26 en la documentación oficial de Cloudflare ([D1 pricing](https://developers.cloudflare.com/d1/platform/pricing/), [Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/)). Revísalas antes de cada cambio de plan: pueden variar.

| Servicio | Plan previsto | Cuota relevante | Uso estimado de un chef privado | Coste |
|---|---|---|---|---|
| Cloudflare Workers (API + web) | Free | 100 000 peticiones/día; 10 ms de CPU por petición | < 2 000 peticiones/día | **0 €** |
| Cloudflare D1 (base de datos + adjuntos) | Free | 5 GB; 5 M filas leídas/día; 100 000 filas escritas/día | < 200 MB/año con fotos comprimidas; < 50 000 lecturas/día | **0 €** |
| Static Assets (interfaz, OCR) | Incluido | — | ~20 MB | **0 €** |
| Cloudflare Access (Zero Trust) | Free | hasta 50 usuarios | 1 usuario | **0 €** |
| URL `*.workers.dev` | Incluida | — | — | **0 €** |
| Dominio propio (opcional) | — | — | No necesario | ~10–15 €/año solo si lo decides |
| OCR / lectura de facturas | Local en el navegador | — | — | **0 €** |
| IA externa | **Desactivada** | — | — | **0 €** (requiere tu autorización) |

**Total previsible: 0 €/mes** en el plan Free.

**Riesgo identificado y mitigación:** el límite de **10 ms de CPU** del plan Free. El diseño lo minimiza (PDF y OCR en el navegador, escrituras masivas en una sola sentencia, cifras de eventos cerrados leídas de su snapshot). Si con muchos datos aparecieran errores 1102 (CPU) en informes o importaciones grandes, el plan **Workers Paid (5 $/mes ≈ 4,6 €)** los elimina (CPU hasta minutos) y amplía las cuotas de D1. No se contrata nada sin tu autorización.

**Mantenimiento:** actualizaciones de dependencias (≈ 1 h/trimestre con la batería de pruebas automática), copia JSON semanal manual y revisión anual de cuotas.
