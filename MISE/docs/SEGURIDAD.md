# Seguridad y privacidad — puerta de publicación

## Clasificación
- PII: clientes, teléfonos, emails, localizaciones de eventos, preferencias dietéticas; posibles datos de salud (alergias/intolerancias), tratar con cuidado elevado.
- Finanzas: presupuestos y beneficio por evento son confidenciales.
- Documentos: facturas y albaranes pueden incluir datos fiscales identificativos.

## Acceso y sesiones
1. No hay registro abierto. El administrador propietario se autoriza explícitamente por identidad verificada (email o ID de Access).
2. Cloudflare Access debe proteger Worker de forma global (producción, rutas alternativas, previews) o demostrar una cobertura equivalente. Activar la política antes de usar datos reales.
3. Token Access firmado: validar issuer, audiencia, expiración y firma o usar API de identidad autorizada y confiable de plataforma. No confiar únicamente en valor recibido por cabecera si puede falsificarse.
4. Toda API y descarga privada comprueba identidad / autorización. No confiar solo en protección del frontend.
5. Sesión con expiración y revocación controladas por Access. No exponer cookies, tokens, URLs firmadas ni proveedores de IA en logs.

## Datos y cambios
- Validar payloads por servidor con schemas estrictos; longitud, tipos, tamaño, relaciones y permisos.
- SQL parametrizado; no construir expresiones ejecutables ni HTML con entradas sin sanitizar.
- Un usuario jamás podrá seleccionar `owner_id` ajeno para leer datos.
- CSRF: aplicar protección adecuada a cookies/sesión y mutaciones; CORS no permisivo.
- Rendimiento y anti abuso básico: límites de tamaño, tasa e intentos de importación y carga.
- Borrado de eventos/clientes: archivar/anonimizar con verificación de integridad según retención configurada.
- Registro de auditoría para cambio de precios, confirmaciones, exportaciones críticas, imports y restauraciones.

## Documentos
- Autenticar descarga y subida; R2 privado, sin `public bucket`, usar claves internas UUID y validar tipo por contenido y extensión.
- Límite de peso razonable configurable, antivirus o rechazo por extensión/magic para archivos inusuales; normalización de nombres.
- Extracción no ejecuta macros ni comandos de archivos del usuario; PDF se trata como contenido no confiable.
- OCR externo: desactivado por defecto; revisar transferencia transfronteriza y condiciones del proveedor antes de subir datos de clientes.
- Si se llama a una IA, todo texto extraído es dato no confiable y nunca puede disparar acciones financieras o administrativas automáticamente (defensa ante prompt injection).

## RGPD y operación
- Limitar datos personales, justificar finalidad, política de conservación y derecho de acceso/borrado; legalizar flujos con experto si aplica.
- No datos de clientes reales en logs, telemetría o ambientes demo; secretos en gestor de plataforma y `.dev.vars` ignorado por git.
- Exportaciones sensibles requieren autorización y duración de vida de descargas; backups cifrados en repositorios privados si se guardan remotos.
- Backups: verificar periódicamente restauración con una copia de prueba; comprobar RPO/RTO antes de prometer disponibilidad.

## Auditoría de aceptación crítica
- HTTP sin sesión a `/`, `/api/v1/*` y archivos privados -> no entrega datos ni HTML con PII.
- Token ausente, expirado, audiencia incorrecta, falso o de usuario no autorizado -> 401/403.
- Requests de cliente intentan saltar el `owner_id` o acceder a un ID adivinado -> bloqueo.
- Inyección SQL, XSS en notas, CSV formula, JSON excesivo, ZIP/PDF malformado, MIME falsificado -> gestionados y testados.
- Ficheros adjuntos no son accesibles por URL pública; un escaneo de cabeceras no debe exponer datos.
- Antes de producción, comprobar el `workers.dev` asociado y previews con HTTP desde sesión no autenticada, no solo el dominio principal.
