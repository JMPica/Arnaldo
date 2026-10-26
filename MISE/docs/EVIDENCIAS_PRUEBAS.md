# Evidencias de pruebas (ejecución real, 2026-10-26)

Entorno: contenedor Linux, Node 22.22, wrangler 4.153 (workerd local), Chromium 1243 (Playwright 1.63). Comandos ejecutados desde `MISE/`.

| Comando | Resultado real |
|---|---|
| `python3 scripts/verificar_paquete.py` | `VALIDACIÓN DEL PAQUETE: OK` (26 comprobaciones) |
| `npm run typecheck` | sin errores |
| `npm run test:unit` | **31 passed** (3 ficheros) |
| `npm run test:integration` | **35 passed** (3 ficheros) — Worker real en workerd + D1 local con migraciones |
| `npm run build` | OK (SPA en `dist/client`, OCR auto-alojado en `/ocr`) |
| `npm run test:e2e` | **17 passed, 1 skipped** (OCR de foto solo en el proyecto escritorio, por coste de tiempo) |
| `npm run smoke:local-access` | **53/53 PASS** — modo producción `AUTH_MODE=access` |
| `npx wrangler whoami` | *You are not authenticated* → despliegue **BLOCKED** |

## Unitarias (`tests/unit`)
- `costing.test.ts` (19): **todos los casos de `fixtures/calculos.json` calculados con el motor de la app** (no con la fórmula del fixture), pruebas negativas (merma 100 %, cantidades negativas, g↔ml, ciclos directos/indirectos/autorreferencia), merma una sola vez (CALC-02), escalado 4 vs 10 (CALC-03), variantes dietéticas sin doble cómputo, beneficio con descuento/horas/costes (CALC-05), precio por fecha (CALC-06), redondeo sin acumulación (CALC-07), reservas de stock, alertas de precio y formato cambiado.
- `legacy-csv-invoice.test.ts` (9): importación v1 (IMPORT-01/02/03 a nivel de plan), CSV con protección de fórmulas, extractor de facturas (fecha, nº, proveedor por NIF, líneas con verificación aritmética, totales), correspondencia con catálogo.
- `i18n.test.ts` (3): **824 cadenas de la interfaz con traducción catalana**, marcadores conservados, redondeo HALF_UP de presentación.

## Integración HTTP (`tests/integration`, Worker real + D1)
- `security.test.ts` (23): SEC-01 (9 rutas sin token → 401 sin datos), SEC-02 (firma falsa, audiencia, issuer, caducado, basura, email fuera de allowlist, cabecera falsificada, **IDOR** con otro propietario y `owner_id` inyectado ignorado), colaborador preparado, SEC-03 (SQL/XSS como dato literal, CSP, nosniff), CSRF/Origin, sin CORS, JSON malformado, 415, 413, 422.
- `flows.test.ts` (9): E2E-01 por API (subreceta 1,17 €, ciclo y g→ml rechazados, menú de 8 pases, propuesta sin fugas, snapshots, compras, recepción parcial idempotente, sobre-recepción rechazada, reservas, consumo, cierre 870 € / 72,5 %), CALC-06/E2E-04 (snapshot 11,28 € inmutable; triggers impiden `UPDATE` de snapshots e historial), E2E-02 (750→1000→900→2 envases→6 €), E2E-03, variantes, SEC-05 (configuración ausente → 500, modo dev fuera de loopback → 403), IMPORT-01/02/03, SEC-04 + BACKUP-01/02 (export sin secretos, borrado, restauración completa con documentos, checksum manipulado rechazado, copia previa en servidor; `restore_ms=58`).
- `documents.test.ts` (3): DOC-01 (tipos por firma, ejecutable renombrado, HTML como JPG, extensión no coincidente, 413, nombre saneado), DOC-02/03 (extracción sin efectos, confirmación crea compra + precios `document` + formato nuevo + stock; reconfirmación y misma factura escaneada → bloqueadas), DOC-04 (IA desactivada, cero llamadas externas).

## E2E Playwright (`e2e/`, Chromium con viewport y UA de iPhone 13 — 390 px — y escritorio 1440 px)
- **E2E-01** completo desde la interfaz en ambos: proveedor, 2 ingredientes, subreceta medida, 2 recetas, revisión de alérgenos, menú de **8 pases**, evento de **10 comensales** con cliente nuevo, **propuesta PDF verificada extrayendo su texto con pdf.js** (contiene menú, alérgenos y 1320,00 €; no contiene «Coste», «Beneficio», «Margen», «Escandallo», «Food cost»), informe interno con márgenes, confirmación, subida de precio posterior sin alterar el presupuesto congelado, lista de compra, pedido, recepción, consumo, costes reales, cierre: **beneficio real 910,00 € · margen 75,8 %**. Sin scroll horizontal.
- E2E-02, E2E-03, **E2E-06** (CA completo sin cadenas en castellano, Escape cierra diálogos, foco con Tab, errores de formulario visibles), **E2E-07**, DOC-01/02/03 (PDF generado → extracción → emparejado → precios), **OCR de foto real con Tesseract auto-alojado** bajo la CSP de producción, BACKUP-01/02 por UI, IMPORT-01 por UI.

## Fallos reales encontrados por las pruebas y corregidos
1. iPhone: tablas anchas ensanchaban la rejilla → scroll horizontal (CSS `min-width: 0`).
2. Pantalla en blanco tras guardar una receta/menú nuevo (datos aún no cargados) → guardas + `ErrorBoundary`.
3. Estado de formulario arrastrado entre entidades al navegar → pantallas de detalle remontadas por `:id`.
4. Extractor: nº de factura confundido con «TOTAL FACTURA 14,08» → regex con dígito obligatorio y exclusión de totales.
5. D1 rechaza `SELECT` compuestos de 6 términos (búsqueda) → dos consultas en un batch.
6. Columnas con dígitos (`sha256`) rechazadas por la lista blanca de inserción masiva → regex corregida.
7. Versión del snapshot no mostrada en el cierre → corregido y cubierto por test.

## NOT RUN / BLOCKED (honesto)
- **OPS-02/OPS-03 en Cloudflare real:** BLOCKED (sin cuenta autorizada). Migraciones probadas solo en D1 local (`wrangler d1 migrations apply --local`: 58 comandos OK).
- **Safari/WebKit real en iPhone:** NOT RUN (solo emulación Chromium con viewport, UA y táctil de iPhone 13; WebKit no está instalado en el entorno).
