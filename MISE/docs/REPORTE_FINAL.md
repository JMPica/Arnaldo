# Informe de entrega (2026-10-26)

- **Rama / commits:** `claude/mise-private-chef-os-c8s53u` (ver `git log -- MISE`).
- **Forma de uso elegida por el propietario: modo local** (ordenador principal Windows/Mac + iPhone por wifi, dispositivos emparejados por QR, copias automáticas): implementado y verificado en Linux — [`MODO_LOCAL.md`](MODO_LOCAL.md). Pendiente solo la primera instalación en tu hardware.
- **URL privada en Cloudflare (opcional):** BLOCKED — sin cuenta autorizada. Pasos: [`DESPLIEGUE_MISE.md`](DESPLIEGUE_MISE.md).
- **Acceso no autorizado:** PASS (local, modo producción) — `npm run smoke:local-access` 53/53 + `security.test.ts` 23/23. En URL real: NOT RUN (BLOCKED).
- **Acceso autorizado:** PASS (integración con JWT RS256 firmado y JWKS simulado; dev loopback en E2E). Con Access real: NOT RUN (BLOCKED).
- **DB D1 y migraciones:** PASS en D1 local (wrangler 58 comandos; Miniflare en tests). D1 remota: NOT RUN (BLOCKED).
- **CRUD ingredientes, proveedores y precios:** PASS · **Recetas y subrecetas:** PASS · **Menús y eventos:** PASS · **Compras e inventario:** PASS · **Importación v1 y restauración:** PASS
- **Documentos (P1):** PASS (PDF texto + OCR local + revisión humana + duplicados) · **IA externa:** DISABLED BY DESIGN
- **Tests:** unitarios 31 · integración 40 · E2E 17 (+1 omitido por diseño) · smoke de privacidad 53 · smoke modo local 11 — todos en verde; CI de GitHub en verde.
- **Responsive iPhone:** PASS en emulación Chromium 390 px (sin scroll horizontal; E2E-01 completo). Safari real: NOT RUN.
- **Coste mensual:** 0 € previsto (plan Free); riesgo CPU 10 ms → Workers Paid 5 $/mes si fuera necesario. [`COSTES.md`](COSTES.md)
- **Intervenciones del propietario pendientes:** instalar en tu ordenador según `MODO_LOCAL.md` y emparejar el iPhone; elegir carpeta de copias sincronizada; confirmar IVA con asesoría. (Cloudflare solo si quieres acceso fuera de casa.)
- **Manual de uso:** [`GUIA_USO.md`](GUIA_USO.md)

**Conclusión honesta:** la aplicación está implementada y verificada de extremo a extremo, y el modo local privado que elegiste funciona (acceso, seguridad y recuperación de datos probados). **No se declara «100 % completado»** hasta que la instales en tu Windows/Mac y conectes tu iPhone real: es lo único que no puedo probar desde aquí.

## Matriz de cumplimiento (requisito → implementación → prueba → estado)

| Requisito | Implementación | Prueba | Estado |
|---|---|---|---|
| P0.1 Acceso privado, API/ficheros protegidos | `src/worker/auth.ts`, `index.ts` (Access JWT + allowlist, `run_worker_first`, CSRF, CSP) | SEC-01..05, smoke | PASS local · BLOCKED real |
| P0.1 Dashboard, búsqueda, ES/CA, ajustes | `insights.ts`, `Dashboard.tsx`, `Layout.tsx`, `ca.ts` | E2E-06, i18n.test | PASS |
| P0.2 Ingredientes, proveedores, formatos, historial inmutable, alertas, CSV | `catalog.ts`, triggers `price_history` | CALC-06, alertas, CSV | PASS |
| P0.3 Recetas, subrecetas, ciclos, escandallo, escalado, alérgenos humanos | `costing.ts`, `recipes.ts`, `RecipeEditor.tsx` | CALC-01..04, E2E-01, E2E-07 | PASS |
| P0.4 Menús degustación, variantes sin doble cómputo, vista cliente | `planPortions`, `MenuEditor.tsx` | variantes (unit/int), E2E-01 | PASS |
| P0.5 Clientes, eventos, costes previstos/reales, snapshots, propuesta cliente, cierre | `events.ts` (servicio y rutas), `EventDetail.tsx`, `proposalDto` | E2E-01, E2E-04, E2E-05, CALC-05 | PASS |
| P0.6 Lista consolidada, envases, stock en libro, recepciones parciales, sin negativos, idempotencia | `shopping.ts`, `purchasing.ts` | E2E-02, E2E-03 | PASS |
| P0.7 Backup JSON/CSV, restore con backup previo, import v1 dry-run, PDFs cliente/internos | `backup.ts`, `data.ts`, `legacy.ts`, `pdf/docs.ts` | IMPORT-01..03, BACKUP-01/02, SEC-04 | PASS |
| P1.1 Documentos: subida, previsualización, extracción local, correspondencias, confirmación, trazabilidad | `documents.ts`, `invoice.ts`, `extract.ts`, `DocumentReview.tsx` | DOC-01..04, OCR E2E | PASS |
| P1.2 Plan de producción, calendario iCal | `/events/:id/production`, `/calendar.ics` | E2E-01 (producción) | PASS · notificaciones in-app: avisos en Resumen |
| OPS-01 typecheck + tests + build | scripts npm, CI `.github/workflows/mise-ci.yml` | ejecutado | PASS |
| OPS-02/03 D1 remota, URL real | `scripts/deploy.sh` | — | **BLOCKED** |
| Modo local: acceso por dispositivo emparejado, copias automáticas | `local-auth.ts`, `routes/devices.ts`, `scripts/local.mjs`, lanzadores | `local-mode.test.ts`, `smoke-local-mode.mjs`, Playwright iPhone | PASS (Linux) · tu hardware: pendiente |
| OPS-04 restore ensayado | `BACKUP-01`, `BACKUP-03` (otra instalación) | 58 ms (medición local) | PASS |

P2 (asistente IA, colaboradores con roles, plantillas de marca): no implementado deliberadamente; el modelo de datos (`owner_id`, `role`, `ai_provider`) está preparado.
