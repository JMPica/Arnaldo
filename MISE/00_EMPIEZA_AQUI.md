# MISE — paquete para Claude Code

Este ZIP es un **handoff ejecutable como proyecto**, no una aplicación online ya terminada. Incluye el prototipo original, un contrato detallado de producto, un diseño de arquitectura, modelo de datos SQL de referencia, cálculos verificables, pruebas de aceptación y las instrucciones permanentes de Claude Code.

## Uso: opción más sencilla (Claude Code Desktop)

1. Descomprime el ZIP completo en una carpeta denominada `MISE` de tu ordenador (no adjuntes solo el Markdown).
2. Abre **Claude Code / pestaña Code** en Claude Desktop, selecciona **Open folder** y escoge esa carpeta. También puedes usar `claude` en el terminal dentro de la carpeta.
3. Abre `01_MENSAJE_PARA_CLAUDE_CODE.md`, copia su contenido y envíalo una sola vez.
4. Da a Claude Code los permisos de desarrollo habituales cuando los solicite, **sin habilitar bypass global de seguridad**. Puedes aprobar operaciones de instalación de dependencias oficiales, ejecutar pruebas y crear archivos dentro de la carpeta.
5. Para desplegar en Cloudflare, autoriza el acceso del servicio desde su flujo oficial cuando Claude te lo pida. No pegues tokens o contraseñas en el chat ni los guardes en el proyecto.

## Qué hará Claude Code

- Auditará `legacy/index.html` y recuperará sus funcionalidades y diseño que merezcan la pena.
- Construirá una nueva aplicación de uso real, privada, con persistencia y disponible desde el móvil.
- Añadirá pruebas para los cálculos, procesos de compras, eventos, controles de seguridad e importación de copias JSON antiguas.
- Automatizará todo lo razonablemente automatizable y explicará **solo las intervenciones de propietario inevitables**.
- Si dispone de cuenta Cloudflare correctamente autorizada, desplegará la aplicación privada y verificará su URL.

## Límites no negociables

- Nadie puede crear una cuenta a tu nombre, introducir un método de pago, superar una MFA o aceptar condiciones legales sin tu intervención/permiso.
- **No** se debe publicar un sitio con datos reales ni en acceso público antes de comprobar el cierre de acceso de Cloudflare Access.
- **No** se usará una API de IA con consumo de pago sin tu autorización expresa.
- La ejecución automática puede requerir varias sesiones; el agente debe mantener `docs/PROGRESO.md` actualizado para continuar sin repetirte preguntas.

## Documentos del paquete

| Archivo | Para qué sirve |
|---|---|
| `01_MENSAJE_PARA_CLAUDE_CODE.md` | Instrucción única lista para pegar |
| `CLAUDE.md` | Instrucciones persistentes que Claude Code carga en cada sesión |
| `docs/PRODUCTO.md` | Funcionalidades y criterios de aceptación |
| `docs/ARQUITECTURA.md` | Tecnologías y decisiones, optimizadas para coste mínimo |
| `docs/REGLAS_CALCULO.md` | Matemáticas exactas, redondeos, formatos y casos límite |
| `docs/MODELO_DATOS.md` | Entidades, relaciones e importación desde v1 |
| `docs/SEGURIDAD.md` | Autenticación, privacidad, protección de archivos |
| `docs/UX.md` | Interfaz y experiencia móvil |
| `docs/PLAN_EJECUCION.md` | Orden de construcción, puertas de calidad, entregables |
| `docs/PRUEBAS_ACEPTACION.md` | Pruebas funcionales que deben ejecutarse de verdad |
| `docs/DESPLIEGUE.md` | Operación, backups y dominio/Access |
| `docs/PUNTOS_MANUALES.md` | Autorizaciones del propietario que ninguna IA puede suplir |
| `docs/AUDITORIA_LEGACY.md` | Estado verificable del HTML original y riesgos |
| `reference/001_esquema.sql` | Diseño SQL base para evolucionar, NO producción final garantizada |
| `fixtures/calculos.json` | Casos de prueba numéricos con resultados esperados |
| `scripts/verificar_paquete.py` | Validación autónoma del contenido inicial |
| `legacy/` | Original íntegro, documentación y capturas |

**No se necesita comprar Haddock ni reutilizar su código.** Inspiración funcional no implica copia de marca o software propietario.
