# Registro de progreso (actualizar en cada sesión)

**Estado a 2026-10-26 (sesión 2):** el propietario eligió **modo local** (Windows, Mac, iPhone por wifi). Implementado y verificado: lanzadores de doble clic, emparejamiento por QR, revocación, copias automáticas, restauración en instalación nueva. CI de GitHub en verde (runs 3 y 4). El despliegue en Cloudflare sigue preparado pero ya **no es necesario** para usar MISE; queda pendiente solo la verificación en el hardware real del propietario (Windows/Mac/Safari iPhone).

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
| Modo local privado (elegido) | ✅ en contenedor Linux · ⏳ en tu Windows/Mac/iPhone | `smoke-local-mode.mjs` 11/11, `local-mode.test.ts` 5/5, Playwright iPhone 390 px emparejado por IP de red. [`MODO_LOCAL.md`](MODO_LOCAL.md) |
| Despliegue Cloudflare (opcional) | ⛔ BLOCKED (no necesario en modo local) | `wrangler whoami` → no autenticado |
| CI GitHub | ✅ | runs 40379738550 y 40380600672 en verde |

Detalle de pruebas y fallos corregidos: [`EVIDENCIAS_PRUEBAS.md`](EVIDENCIAS_PRUEBAS.md). Informe: [`REPORTE_FINAL.md`](REPORTE_FINAL.md).

## Comandos efectivos (desde `MISE/`)
`npm install` · `npm run db:migrate:local` · `npm run dev` · `npm run typecheck` · `npm run test:unit` · `npm run test:integration` · `npm run test:e2e` · `npm run smoke:local-access` · `npm run smoke:local-mode` · `npm run local` · `npm run build` · `npm run deploy:staging|production` · `node scripts/smoke-http.mjs <url>`

## Último trabajo realmente ejecutado (sesión 1)
1. Auditoría v1 con navegador (merma topada al 95 %: 200 €/kg en vez de 1000 €/kg; margen 0 % con ingreso 0; datos corruptos → demo).
2. Dominio de cálculo con Decimal + 31 tests unitarios (todos los fixtures).
3. API completa (35 tests de integración en workerd), UI de 19 pantallas ES/CA, PDFs, OCR local, PWA.
4. 17 E2E Playwright; 7 fallos reales encontrados y corregidos.
5. Smoke de privacidad, CI, scripts de despliegue con comprobaciones, documentación de entrega.

## Sesión 2 (cont.) — el propietario quiere el iPhone como dispositivo principal
El iPhone no puede ser servidor → elegida la **publicación en Cloudflare** (respuesta del propietario: «En internet»). Este entorno no llega a `api.cloudflare.com` (proxy 403) y no debe recibir tokens → `scripts/publicar.mjs` + lanzadores «Publicar MISE en internet» que ejecuta el propietario: login OAuth, D1, migraciones, despliegue, secreto, Access (1 clic en el panel + pegar AUD), smoke de privacidad obligatorio. Probado aquí: sintaxis, configuración generada (`wrangler deploy --dry-run` con bindings correctos), ejecución hasta el login OAuth. **Pendiente: ejecución real por el propietario** (guía [`PUBLICAR_INTERNET.md`](PUBLICAR_INTERNET.md)).

## Sesión 2 (modo local)
1. `AUTH_MODE=local`: emparejamiento por token HMAC de 10 min y un solo uso → cookie firmada `HttpOnly` por dispositivo (tabla `paired_devices`, migración 0002), revocación inmediata, Ajustes → Seguridad con QR (`qrcode`).
2. `scripts/local.mjs` + `Iniciar MISE (Windows).bat` / `Iniciar MISE (Mac).command`: instala, compila si hace falta, migra, arranca en la wifi, copia al arrancar y cada 24 h (30 últimas), abre el navegador ya emparejado. Detecta instancia duplicada, cierra limpio al cerrar la ventana (SIGHUP), rutas con espacios en Windows, sin consultas a internet tras instalar.
3. **Fallo real encontrado y corregido:** una copia no se podía restaurar en *otra* instalación (otro ordenador o local ↔ Cloudflare): `audit_log.actor_user_id` apuntaba a un usuario inexistente → FK → restauración revertida. Ahora el autor desconocido pasa a null. Test BACKUP-03 (falla sin la corrección) y prueba real: borrar `datos-locales` → restaurar copia automática → datos de vuelta.

## Acciones externas solicitadas al propietario
1. **Modo local:** instalar Node LTS, descomprimir, doble clic en el lanzador, permitir el firewall en redes privadas, emparejar el iPhone por QR y elegir carpeta de copias en iCloud/OneDrive (`datos-locales/config.json`). Avisar si algo falla en tu Windows/Mac.
2. *(Solo si quieres usarlo fuera de casa)* cuenta Cloudflare + `npx wrangler login` + política Access ([`DESPLIEGUE_MISE.md`](DESPLIEGUE_MISE.md)).
3. Confirmar con asesoría el **tipo de IVA** de tus servicios (configurable en Ajustes).
Pasos exactos: [`DESPLIEGUE_MISE.md`](DESPLIEGUE_MISE.md).

## Próximo paso al reanudar
Si el propietario ya ejecutó «Publicar»: pedirle la URL y el resultado del smoke (o captura del error), corregir y marcar OPS-02/OPS-03. Si falló en el paso de Access, revisar el texto real del panel y ajustar `publicar.mjs`/la guía.
Modo local: recoger el resultado de la primera instalación del propietario en Windows/Mac y Safari iPhone; corregir lo que aparezca. Cloudflare solo si el propietario lo pide:
Si `npx wrangler whoami` ya muestra sesión: crear D1 (`d1 create`), rellenar `database_id` y `ACCESS_TEAM_DOMAIN` en `wrangler.jsonc`, `wrangler secret put OWNER_EMAILS --env staging`, activar Access en workers.dev, copiar AUD, `npm run deploy:staging`, revisar smoke y acceso real desde iPhone; repetir en producción. Después marcar OPS-02/OPS-03 y actualizar `REPORTE_FINAL.md`.
No repetir auditoría ni reconstruir módulos: todo P0/P1 está implementado y cubierto por pruebas.

## Incidencias y decisiones
- npm 10.9 falla con `edgesOut` sin `legacy-peer-deps` (conflicto de peers del plugin de Vite) → `.npmrc` con `legacy-peer-deps=true`.
- `@cloudflare/vitest-pool-workers` está obsoleto → `@cloudflare/vitest-plugin`.
- `setInputFiles` de Playwright no adjunta ficheros desde rutas con tildes → los tests usan buffers.
- No se usa `wrangler deploy --temporary`: publicaría sin Access.
