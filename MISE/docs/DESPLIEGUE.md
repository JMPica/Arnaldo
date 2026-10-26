# Runbook de despliegue y operación

## Aprovisionamiento
1. Propietario autoriza cuenta Cloudflare; MFA requerida y acceso a Workers/D1/Zero Trust. No colocar token en prompt.
2. Claude confirma cuotas y derechos vigentes. Elegir Workers/D1; base de datos separada staging/production.
3. Preparar migraciones, revisar datos demo y cargar solo ficticios a staging.
4. Activar **Cloudflare Access sobre todo el Worker** y una política allowlist de propietario; proteger producción y previews. Puede funcionar sobre workers.dev sin comprar dominio adicional si está habilitado según cuenta.
5. Publicar frontend + API una vez, con D1 vinculada y R2 si se utiliza.
6. Probar endpoints desde una sesión **no autenticada** y otra autorizada, con especial atención a la URL workers.dev y a las vistas previas; jamás confiar solo en “hay un login visible”.
7. Importar datos reales exclusivamente después de completar prueba de privacidad y backups.

## Entornos
- `local`: desarrollo, cuentas y datos falsos; usuario simulado solo si está estrictamente limitado a desarrollo/loopback.
- `staging`: desplegado protegido con Access, datos sintéticos.
- `production`: acceso restringido, cuentas autorizadas y backups.

## Pipeline
Install -> lint/typecheck -> unit -> integration -> build -> migrate staging -> E2E staging -> Access audit -> (aprobación propietario para operaciones remotas destructivas) -> migrate production -> deploy -> smoke private.

## Backup y restore
- D1 permite recuperación de punto en tiempo según plan/cuotas vigentes, pero eso no sustituye una exportación portable periódica.
- Configurar export JSON y proceso programado si hay autorización e infraestructura; adjuntos R2 requieren estrategia separada.
- Guardar copia cifrada fuera de aplicación con acceso limitado; mantener al menos una restauración de ensayo reproducible.
- Restauración de producción siempre exige backup pre-restore, verificación de checksum y aprobación explícita.

## Operación
- Monitorizar errores 401/403 inesperados, eventos API, límites D1/Workers y cuota R2/OCR.
- Actualizaciones de paquetes con regresión de cálculos; snapshot de eventos no cambiar con nuevas versiones.
- Mantenimiento y corrección de vulnerabilidades; posibilidad de revocar identidad y exportar datos.

## Pendientes de propietario inevitables
Ver `docs/PUNTOS_MANUALES.md`. Registrar paso a paso lo efectivamente completado, DNS (si aplica), URL y pruebas. Nunca exponer datos personales de un cliente de ejemplo real.
