# Autorizaciones externas inevitables (NO son programación)

Claude Code hará el trabajo técnico siempre que las herramientas y permisos estén disponibles. Hay acciones que ninguna IA debe ni puede fingir completar:

| Acción | Quién | Qué debe hacer Claude |
|---|---|---|
| Crear/iniciar sesión cuenta de Claude y ejecutar Claude Code | Propietario | Continuar al abrir la carpeta |
| Crear/iniciar sesión cuenta Cloudflare con MFA | Propietario | Guiar paso a paso solo cuando sea necesario |
| Autorizar Wrangler/OAuth para desplegar | Propietario | Solicitar autorización oficial, nunca contraseña en chat |
| Configurar/confirmar identidad autorizada en Access | Propietario | Guiar validación y rechazar publicación privada no verificada |
| Aprobar plan facturable, compra de dominio o uso de API externa de IA | Propietario | Calcular costes y pedir permiso explícito antes de gastar |
| Definir datos fiscales reales, tratamiento legal de IVA y condiciones comerciales finales | Propietario/asesoría | Ofrecer campos configurables sin inventar tratamiento legal |
| Incorporar facturas y datos de clientes verdaderos | Propietario | Importarlos **después** de la auditoría de seguridad |

Si falta Cloudflare: desarrollar y ejecutar TODO localmente + staging de datos sintéticos. Entregar lista corta y precisa de botones/acciones externas pendientes y reanudar al estar autorizadas.

**Prohibido:** pedir contraseñas por chat, introducir datos de tarjeta, evadir MFA o declarar 'listo' con esas acciones pendientes.
