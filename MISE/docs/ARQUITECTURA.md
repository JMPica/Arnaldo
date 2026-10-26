# Arquitectura objetivo y decisiones de costes

## Stack preferido (modificar solo por motivo técnico demostrado)
- **Frontend:** React + TypeScript + Vite, responsive web/PWA; CSS/Tailwind o estilo propio consistente, paquetes mantenidos.
- **API/backend:** Cloudflare Workers, Hono + TypeScript, endpoints versionados `/api/v1/*` (alternativa arquitectura monolítica TS si despliegue y pruebas mejoran).
- **Persistencia:** Cloudflare D1 (SQLite) con migraciones versionadas, claves foráneas e índices; Drizzle o SQL parametrizado, nunca interpolación.
- **Archivos privados:** Cloudflare R2 bajo permiso/alcance; solo usarlo si documentos adjuntos están activos. Descargas por backend autenticado.
- **Privacidad:** Cloudflare Access sobre **todo el Worker** (incluidos dominios `workers.dev`, previews y rutas API); JWT firmado comprobado en la app o identidad validada del contexto Worker según API vigente. Allowlist del propietario. No crear pantalla de contraseña propia si Access cumple.
- **Pruebas:** Vitest para dominio; tests de HTTP con Worker/D1 local; Playwright para flujos E2E móvil/desktop; análisis TypeScript, linters; CI al construir.
- **PDF/CSV:** librería local elegida tras evaluar compatibilidad runtime y accesibilidad. Nada de servicios SaaS externos por defecto.
- **IVA:** configuración explícita de tipos y criterio de cotización, separados del coste neto; precios siempre con moneda y origen (estimado/real).

## Ruta de migración
1. `legacy/index.html` únicamente como especificación ejecutable y patrón visual.
2. Biblioteca de dominio pura: costes, compras, precios, unidades, márgenes, snapshots. Cubrir con fixtures antes de hacer UI.
3. Migraciones SQL, servicios y API autenticadas, validaciones y control de acceso.
4. UI contra API real. No confiar en datos sembrados de demo ni sincronizaciones ocultas de localStorage.
5. Importación de JSON v1 con prevalidación y transacción; no borrar datos existentes sin consentimiento y backup.
6. PWA básica, documentos, despliegue y pruebas de producción privada.

## Separación de capas
```
web UI (React)
  -> typed API client, forms + validations
  -> /api/v1/* [Worker/Hono]
       -> authentication/authorization middleware
       -> schemas validation + RBAC simple
       -> domain services [pure functions]
       -> repository [D1 SQL]
       -> private object store [R2, optional]
```

## Contrato de acceso
- GET/POST/PATCH/DELETE bajo `/api/v1` con validación de sesión y pertenencia al propietario para **cada** endpoint.
- Worker completo cerrado con Access: visitante sin sesión recibe redirect/401; API responde 401/403 y no filtra información.
- Si la plataforma no permite Access en un dominio aún, desplegar **solo staging sin información personal** y bloquear app/servidor por defecto. No suponer que `workers.dev` es privado: activar Access explícitamente y probarlo.
- Auditoría server-side básica de altas, ediciones críticas, importaciones y borrados.

## Datos y backups
- D1 para transacciones pequeñas; snapshots inmutables por versión para resultados históricos.
- R2 para adjuntos con tamaño máximo, análisis MIME y claves opacas; cifrado/plataforma según proveedor y política de retención.
- Exportación JSON versionada y scripts de importación/restore comprobados; backup previo a importación destructiva.
- Separar demo/staging de producción; nunca poner clientes reales en fixtures.

## Optimización de coste
- La operación normal (CRUD, cálculos, exportación) no utiliza modelos IA externos.
- Enviar a IA únicamente campos mínimos del documento cuando exista aprobación, con coste por petición y presupuesto mensual configurable (inicio: desactivado, 0 €).
- Limitar consultas D1 (índices/paginación) y cargas R2; almacenar precios con historial sin duplicación masiva.
- Revisar cuotas vigentes de Workers, D1, Access y R2 **antes** de dar cifras definitivas. Plan gratis sujeto a cuotas; no prometer coste total 0 en todos los escenarios.

## Decisiones en conflicto
Si Claude Code descubre incompatibilidades, actualiza `docs/DECISIONES.md` con opción elegida, coste, seguridad, rollback, evidencia. No pedir al usuario que decida librería, framework o patrón rutinario.
