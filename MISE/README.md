# MISE — Private Chef OS (v2)

Aplicación privada para chef privado: **cliente → menú → recetas → escandallos → presupuesto → compras → producción → evento → rentabilidad final**, usable desde iPhone y ordenador.

- **Estado y continuidad:** [`docs/PROGRESO.md`](docs/PROGRESO.md) · decisiones: [`docs/DECISIONES.md`](docs/DECISIONES.md)
- **Publicar en internet (iPhone sin ordenador encendido, privado y gratis):** [`docs/PUBLICAR_INTERNET.md`](docs/PUBLICAR_INTERNET.md) — doble clic en `Publicar MISE en internet (Mac).command` / `(Windows).bat`
- **Modo local (Windows · Mac · iPhone por wifi, sin nube):** [`docs/MODO_LOCAL.md`](docs/MODO_LOCAL.md) — doble clic en `Iniciar MISE (Windows).bat` o `Iniciar MISE (Mac).command`
- **Guía de uso (1 página):** [`docs/GUIA_USO.md`](docs/GUIA_USO.md)
- **Despliegue privado paso a paso:** [`docs/DESPLIEGUE_MISE.md`](docs/DESPLIEGUE_MISE.md) · costes: [`docs/COSTES.md`](docs/COSTES.md)
- **Informe de entrega y evidencias:** [`docs/REPORTE_FINAL.md`](docs/REPORTE_FINAL.md) · [`docs/EVIDENCIAS_PRUEBAS.md`](docs/EVIDENCIAS_PRUEBAS.md)
- Paquete original (especificación, v1 intacta en `legacy/`): [`00_EMPIEZA_AQUI.md`](00_EMPIEZA_AQUI.md)

## Arquitectura

Un único **Cloudflare Worker** (Hono + TypeScript) sirve la API `/api/v1/*` y la SPA React (Vite) como *static assets* con `run_worker_first`, de modo que **todo** (HTML, JS, API, ficheros) pasa por la verificación del JWT de **Cloudflare Access**. Persistencia en **D1** (SQLite) con migraciones versionadas. Cálculos exactos con `decimal.js` en `src/shared` (mismo código en servidor y navegador). PDF y OCR se generan en el navegador (pdf-lib, pdf.js, Tesseract.js auto-alojado): sin servicios de pago ni envío de datos a terceros.

```
src/shared   dominio puro: costes, subrecetas, menús, eventos, compras, stock, CSV, importación v1, facturas
src/worker   API Hono: auth Access, CSRF, rutas, servicios (snapshots, backup, documentos)
src/web      React: páginas, i18n ES/CA, PDFs, extracción local
migrations   esquema D1 versionado
tests        unit (Node) + integration (workerd + D1 local)   e2e/  Playwright (iPhone 390 px y escritorio 1440 px)
```

## Dos formas de funcionar

| | Modo local | Cloudflare (elegido por el propietario) |
|---|---|---|
| Dónde están los datos | Tu ordenador principal (`datos-locales/`) | D1 en tu cuenta Cloudflare |
| Acceso | Dispositivos emparejados por QR en tu wifi (`AUTH_MODE=local`) | Cloudflare Access con tu email (`AUTH_MODE=access`) |
| Desde fuera de casa | No | Sí |
| Coste | 0 € | 0 € (plan Free) |

Mismo código, misma base de datos SQLite y mismas migraciones; se pasa de uno a otro con una copia JSON.

## Comandos

```bash
npm install                      # Node ≥ 20 (.npmrc incluye legacy-peer-deps)
cp .dev.vars.example .dev.vars   # identidad simulada SOLO en localhost
npm run db:migrate:local         # migraciones en D1 local
npm run dev                      # build + wrangler dev → http://127.0.0.1:8787
npm run local                    # modo local real (lo que hacen los lanzadores de doble clic)
npm run typecheck
npm run test:unit                # 31 tests de dominio, fixtures, i18n
npm run test:integration         # 39 tests HTTP contra el Worker real con D1 local
npm run test:e2e                 # 17 E2E Playwright (levanta su propio servidor con D1 limpia)
npm run smoke:local-access       # 53 comprobaciones de privacidad en modo producción (Access)
npm run build
npm run publicar                 # publicación guiada en Cloudflare (lo que hace el lanzador «Publicar»)
npm run deploy:staging           # requiere `npx wrangler login` del propietario (ver DESPLIEGUE_MISE.md)
npm run deploy:production
node scripts/smoke-http.mjs https://<tu-url>   # privacidad de la URL real sin sesión
python3 scripts/verificar_paquete.py           # verificador del paquete original
```
