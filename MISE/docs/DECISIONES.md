# Registro de decisiones técnicas

| ID | Decisión provisional | Motivo | Cuándo revisarla |
|---|---|---|---|
| ADR-001 | App privada, un propietario; preparada para roles | Evitar complejidad innecesaria | Incorporación colaboradores |
| ADR-002 | TypeScript + React + Vite para UI y Hono para API Cloudflare Workers | Stack portable, pequeño, mismo despliegue viable | Restricción real de bundler/plataforma |
| ADR-003 | Cloudflare D1 para persistencia; R2 cuando haya adjuntos | Coste contenido y base SQL | Si límites o RGPD aconsejan otra opción |
| ADR-004 | Cloudflare Access para proteger Worker entero | Login sin desarrollar gestión de contraseñas propia | Si falta autorización/capacidad Access |
| ADR-005 | OCR/IA detrás de proveedor intercambiable y opt-in | Evitar coste, filtrado accidental de datos | Al autorizarlo |
| ADR-006 | Importación segura desde JSON v1, no usar localStorage de producción | Mantener portabilidad | Al probar importación |

Claude: confirma cada decisión tras comprobar documentación y herramientas reales. Registra cambios con razones y consecuencias. No repitas análisis desde cero en cada sesión.
