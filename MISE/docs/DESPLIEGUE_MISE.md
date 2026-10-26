# Despliegue privado de MISE en Cloudflare — pasos exactos

> Estado a 2026-10-26: **todo preparado y probado en local; despliegue BLOQUEADO** porque el entorno de desarrollo no tiene cuenta de Cloudflare autorizada (`wrangler whoami` → *You are not authenticated*). No se usó `wrangler deploy --temporary` porque publicaría la app **sin Cloudflare Access**.

Solo tú puedes hacer los pasos marcados 👤 (cuenta, MFA, autorización OAuth, email autorizado). El resto lo ejecuta Claude Code o el script.

## 1. Cuenta y autorización (👤, ~10 min, 0 €)
1. 👤 Crea o abre tu cuenta en `dash.cloudflare.com` con MFA activada. No hace falta tarjeta para el plan Free.
2. 👤 En la carpeta `MISE`, ejecuta `npx wrangler login` y aprueba en el navegador (OAuth oficial; nunca pegues tokens en el chat).
3. 👤 En **Zero Trust** (menú lateral) elige un nombre de equipo, p. ej. `mise-chef` → tu dominio de equipo será `https://mise-chef.cloudflareaccess.com`. Plan **Free** (hasta 50 usuarios).

## 2. Bases de datos D1 (Claude o tú)
```bash
npx wrangler d1 create mise-db-staging
npx wrangler d1 create mise-db
```
Copia cada `database_id` en `wrangler.jsonc` (`env.staging` y `env.production`, sustituyendo `REPLACE_…_DATABASE_ID`).

## 3. Primer despliegue protegido de staging (datos ficticios)
1. Pon en `wrangler.jsonc → env.staging.vars.ACCESS_TEAM_DOMAIN` tu dominio de equipo.
2. `npx wrangler secret put OWNER_EMAILS --env staging` → escribe tu email (si añades más separados por comas, los siguientes serán colaboradores).
3. 👤 Activa Access en el Worker: **Workers & Pages → mise-staging → Settings → Domains & Routes → workers.dev → «Enable Cloudflare Access»** (protege también las *preview URLs*, que además están desactivadas en la configuración). Edita la política creada para permitir **solo tu email**.
4. 👤 En **Zero Trust → Access → Applications → mise-staging** copia el **Application Audience (AUD) Tag** y pégalo en `env.staging.vars.ACCESS_AUD`.
5. `npm run deploy:staging` — el script comprueba login, placeholders y secreto; pasa typecheck + unit + integración + build; aplica migraciones remotas; despliega y ejecuta `scripts/smoke-http.mjs` contra la URL `workers.dev` **sin sesión** (debe salir `PASS` en todo: redirección al login de Access o 401).
6. 👤 Abre la URL en el iPhone, inicia sesión con tu email (código por correo) y comprueba **Ajustes → Seguridad** (Autenticación: Cloudflare Access). Opcional: «Añadir a pantalla de inicio».

## 4. Producción
Repite el paso 3 con `env.production` (`mise`), su AUD, su secreto `OWNER_EMAILS` y `npm run deploy:production`. **Solo después** de que el smoke salga en verde, importa tus datos reales (Ajustes → Importar MISE v1, o crea el catálogo).

## 5. Copias y recuperación
- Semanal: **Ajustes → Copias → Descargar copia (con documentos)** y guárdala cifrada fuera de la app.
- D1 *Time Travel* permite volver a un punto de los últimos días (`npx wrangler d1 time-travel restore mise-db --env production --timestamp=…`). No sustituye a la copia JSON.
- Restauración ensayada: tests `BACKUP-01/02` (API y UI). Tiempo medido en local: 58 ms la transacción de restauración del test de integración, ~1,5 s el flujo UI completo (medición, no promesa).

## 6. Rollback
`npx wrangler rollback --env production` vuelve a la versión anterior del Worker. Las migraciones son solo aditivas en la v2.0; ante una migración futura se hará copia JSON antes.

## Puntos manuales pendientes (no programables)
| Acción | Quién | Estado |
|---|---|---|
| Cuenta Cloudflare + MFA + `wrangler login` | 👤 | **Pendiente** |
| Equipo Zero Trust + política Access con tu email | 👤 | **Pendiente** |
| Copiar AUD y `database_id` (o dejar que Claude lo haga con la sesión ya autorizada) | 👤/Claude | Pendiente |
| Verificar tipo de IVA aplicable a tus servicios | 👤 + asesoría | Pendiente (configurable, por defecto 10 % marcado «a verificar») |
| Autorizar IA externa de pago | 👤 | **No solicitado** (desactivada por diseño) |
