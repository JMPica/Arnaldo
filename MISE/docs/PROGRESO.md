# Registro de progreso (actualizar en cada sesión)

**Estado a 2026-10-26:** aplicación v2 implementada y probada de extremo a extremo en local con el runtime real de Cloudflare (workerd + D1). **Despliegue privado BLOQUEADO por falta de cuenta Cloudflare autorizada.** No se declara completado al 100 %.

| Paso | Estado | Evidencia |
|---|---|---|
| Auditoría v1 + paquete | ✅ Hecho | `verificar_paquete.py` OK; [`AUDITORIA_LEGACY_RESULTADOS.md`](AUDITORIA_LEGACY_RESULTADOS.md) (3 riesgos reproducidos en navegador) |
| Arquitectura de producción | ✅ Hecho | Worker Hono + React/Vite + D1, `migrations/0001_init.sql`, [`DECISIONES.md`](DECISIONES.md) ADR-001..017 |
| Auth privada + D1 | ✅ local · ⛔ real | `security.test.ts` 23/23, smoke 53/53 (modo access) |
| CRUD ingredientes/proveedores/precios | ✅ | integración + E2E-01 |
| Recetas, subrecetas, escandallos | ✅ | fixtures CALC-01..07 (motor de la app), E2E-01 |
| Menús, eventos, costes, presupuestos, snapshots | ✅ | E2E-01, E2E-04, E2E-05, E2E-07 |
| Inventario y listas de compra | ✅ | E2E-02, E2E-03 |
| Importación v1 y backups | ✅ | IMPORT-01..03, BACKUP-01/02, SEC-04 |
| Documentos / IA opcional | ✅ (IA desactivada por diseño) | DOC-01..04, OCR local E2E |
| Seguridad, responsive, accesibilidad | ✅ (Safari real no probado) | E2E iPhone 390 px y 1440 px, E2E-06 |
| Despliegue privado | ⛔ **BLOCKED** | `wrangler whoami` → no autenticado. Ver acciones externas |

Detalle de pruebas y fallos corregidos: [`EVIDENCIAS_PRUEBAS.md`](EVIDENCIAS_PRUEBAS.md). Informe: [`REPORTE_FINAL.md`](REPORTE_FINAL.md).

## Comandos efectivos (desde `MISE/`)
`npm install` · `npm run db:migrate:local` · `npm run dev` · `npm run typecheck` · `npm run test:unit` · `npm run test:integration` · `npm run test:e2e` · `npm run smoke:local-access` · `npm run build` · `npm run deploy:staging|production` · `node scripts/smoke-http.mjs <url>`

## Último trabajo realmente ejecutado (sesión 1)
1. Auditoría v1 con navegador (merma topada al 95 %: 200 €/kg en vez de 1000 €/kg; margen 0 % con ingreso 0; datos corruptos → demo).
2. Dominio de cálculo con Decimal + 31 tests unitarios (todos los fixtures).
3. API completa (35 tests de integración en workerd), UI de 19 pantallas ES/CA, PDFs, OCR local, PWA.
4. 17 E2E Playwright; 7 fallos reales encontrados y corregidos.
5. Smoke de privacidad, CI, scripts de despliegue con comprobaciones, documentación de entrega.

## Acciones externas solicitadas al propietario
1. **Cuenta Cloudflare con MFA y `npx wrangler login`** (👤) — imprescindible para desplegar.
2. **Zero Trust → equipo + política Access con tu email** (👤), copiar AUD a `wrangler.jsonc`.
3. Confirmar con asesoría el **tipo de IVA** de tus servicios (configurable en Ajustes).
Pasos exactos: [`DESPLIEGUE_MISE.md`](DESPLIEGUE_MISE.md).

## Próximo paso al reanudar
Si `npx wrangler whoami` ya muestra sesión: crear D1 (`d1 create`), rellenar `database_id` y `ACCESS_TEAM_DOMAIN` en `wrangler.jsonc`, `wrangler secret put OWNER_EMAILS --env staging`, activar Access en workers.dev, copiar AUD, `npm run deploy:staging`, revisar smoke y acceso real desde iPhone; repetir en producción. Después marcar OPS-02/OPS-03 y actualizar `REPORTE_FINAL.md`.
No repetir auditoría ni reconstruir módulos: todo P0/P1 está implementado y cubierto por pruebas.

## Incidencias y decisiones
- npm 10.9 falla con `edgesOut` sin `legacy-peer-deps` (conflicto de peers del plugin de Vite) → `.npmrc` con `legacy-peer-deps=true`.
- `@cloudflare/vitest-pool-workers` está obsoleto → `@cloudflare/vitest-plugin`.
- `setInputFiles` de Playwright no adjunta ficheros desde rutas con tildes → los tests usan buffers.
- No se usa `wrangler deploy --temporary`: publicaría sin Access.
