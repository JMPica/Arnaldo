# MISE / instrucciones persistentes para Claude Code

## Objetivo
Construir desde `legacy/` una aplicación privada y operativa para un chef privado. El código antiguo es únicamente material fuente; no es una base de producción segura. Lee al empezar `00_EMPIEZA_AQUI.md` y `01_MENSAJE_PARA_CLAUDE_CODE.md`.

## Orden de autoridad
1. Seguridad y autorizaciones legales / del propietario.
2. Este archivo y los criterios en `docs/PRUEBAS_ACEPTACION.md`.
3. Requisitos de `docs/PRODUCTO.md`, `docs/REGLAS_CALCULO.md`, `docs/ARQUITECTURA.md`.
4. Funciones de la versión `legacy/`, solo cuando sean correctas.

## Reglas fijas
- Idioma primario ES; CAT como segundo idioma (cadenas externalizadas); EUR; zona Europe/Madrid; diseño mobile-first para iPhone.
- Un propietario de entrada, sin registro público, sin anuncios, sin pagos en línea, sin TPV ni reservas públicas.
- Persistencia **real en base de datos**; nunca sustituir con localStorage para información de producción.
- Acceso privado autenticado a **páginas, APIs, ficheros y vistas previa**. Identidad validada en servidor; no confiar en cabeceras falsificables sin comprobar firma.
- Números monetarios con enteros de céntimos o Decimal y política explícita; jamás redondear cada ingrediente antes de sumar.
- Precios de compra y fechas históricos; event snapshots al confirmar/cerrar para no alterar resultados antiguos.
- Alérgenos no se infieren automáticamente; verificación manual obligatoria antes de publicar un menú para cliente.
- Facturas, propuestas y presupuestos: distinguir documentos internos y para cliente. No anunciar emisión de factura fiscal legal si no está implementada.
- Costes sin IVA por defecto para escandallos; indicar claramente tratamiento impositivo en presupuesto y documentar excepciones.
- No almacenar secretos en git; proteger logs y datos personales; migraciones idempotentes o versionadas, backups verificables.
- Mantener interfaces tipadas y validación server-side; pruebas unitarias + integración + E2E; control CI.
- No copiar marca, activos propietarios ni código de Haddock.

## Forma de trabajo
1. Auditar -> decidir -> implementar -> probar -> registrar -> siguiente bloque.
2. Consultar `docs/PROGRESO.md` y actualizarlo siempre con estado/fecha/resultado real/próximo paso.
3. No pedir al propietario decisiones técnicas normales; escalar únicamente accesos, consentimiento, compras y datos no inferibles.
4. No ejecutar despliegue público con datos reales hasta validar Access. Nunca crear usuarios de prueba con credenciales débiles en producción.
5. Evitar añadir dependencia externa de pago cuando existe una solución local fiable; documentar costes reales y límites.
6. Refactorizar libremente para calidad: **no** asumir que el HTML monolítico es reutilizable tal cual.
7. No dar por terminada una tarea sin evidencia (test, captura, consulta SQL, respuesta HTTP o URL comprobada).

## Referencias obligatorias
`docs/PRODUCTO.md`, `docs/ARQUITECTURA.md`, `docs/MODELO_DATOS.md`, `docs/REGLAS_CALCULO.md`, `docs/SEGURIDAD.md`, `docs/UX.md`, `docs/PLAN_EJECUCION.md`, `docs/PRUEBAS_ACEPTACION.md`, `docs/DESPLIEGUE.md`.

## Comandos iniciales
`python3 scripts/verificar_paquete.py` (funciona sin instalar nada). Cuando generes el proyecto moderno, documenta sus comandos efectivos de instalación, tests, build, migraciones y despliegue en `README.md` y `docs/PROGRESO.md`.
