# ENCARGO ÚNICO A CLAUDE CODE — MISE PRIVATE CHEF OS

Actúa como un equipo senior autónomo de Product Manager, chef ejecutivo, ingeniero full-stack, arquitecto de datos, especialista en seguridad, diseñador UX, QA y DevOps. **Tu misión es entregar una aplicación privada REAL y OPERATIVA para un chef privado.** No entregues solo un informe, un prototipo visual o recomendaciones.

Tienes a tu disposición este proyecto. Lee `CLAUDE.md` y `00_EMPIEZA_AQUI.md`; examina **toda** la carpeta `docs/`, la SQL de `reference/`, los fixtures, el HTML de `legacy/` y sus imágenes de referencia. Sigue las instrucciones y restricciones de este repositorio.

## Orden de ejecución obligatorio

1. Haz inventario y auditoría del prototipo v1; ejecuta `python3 scripts/verificar_paquete.py` y comprueba qué existe realmente. Registra hallazgos en `docs/PROGRESO.md`.
2. Establece el proyecto de producción (frontend, backend, esquema, migraciones, autenticación, pruebas, scripts y entornos). Sigue `docs/ARQUITECTURA.md`, ajustándolo por restricciones reales documentadas. No repliques los puntos débiles de `legacy/`.
3. Implementa y prueba de extremo a extremo: usuarios autorizados; ingredientes/proveedores y versiones de precios; recetas y subrecetas; menús; clientes y eventos; costes de personal/logística; compras e inventario; estimaciones y cierres; dashboard; copias JSON/CSV; exportación cliente/interna; importación segura de backup v1.
4. Implementa la captura documental (PDF/foto) con previsualización, almacenamiento seguro, extracción de texto local o bibliotecas permitidas, validación humana y trazabilidad. OCR/IA externos **opcionales y deshabilitados por defecto** hasta autorizar costes y tratamiento de datos.
5. Ejecuta tests unitarios, integración, seguridad, E2E con Playwright, responsive iPhone y recuperación ante errores. Registra los comandos y sus resultados, incluyendo fallos reales. Arregla todos los bloqueantes.
6. Prepara Cloudflare Workers + D1 + Cloudflare Access. Si existen credenciales autorizadas, despliega de forma privada, prueba la URL real y restringe al usuario autorizado. Si falta acceso o una acción humana, continúa construyendo y probando todo lo demás: deja la tarea humana exacta en `docs/PROGRESO.md` y reanuda en cuanto sea posible.
7. Entrega al usuario: URL comprobada si existe, resumen de módulos implementados, pruebas ejecutadas, costes previsibles, pendientes verificables y guía de uso de 1 página.

## Normas de autonomía y ejecución

- Toma decisiones técnicas razonables sin trasladarme cuestiones de ingeniería. El producto es **para mi uso privado**, inicialmente **una sola cuenta**; modela bien los datos para facilitar futuras ampliaciones.
- Debes crear, editar y probar código real. No describas tareas como si estuvieran hechas.
- Mantén `docs/PROGRESO.md` y `docs/DECISIONES.md` al día por etapa. Divide trabajo complejo en tareas y continúa hasta entregar lo máximo viable en tu entorno.
- Puedes usar herramientas de desarrollo y pruebas autorizadas, pero no desactives protecciones de seguridad ni ejecutes comandos destructivos contra cuentas remotas.
- No compartas claves ni datos reales. No contrates nada, no actives IA de pago, no registres dominios ni abras el acceso público sin consentimiento explícito.
- No afirmes «100% completado» hasta satisfacer **todos** los criterios P0/P1 y comprobar el despliegue privado, recuperación desde backup, seguridad, importación y pruebas.
- Si el desarrollo se interrumpe por límites de sesión, al reanudar lee `docs/PROGRESO.md` y continúa directamente sin replantear todo el proyecto.

**Prioridad final:** un MISE seguro, estable y útil de verdad para presupuestar, cocinar, planificar y cerrar eventos, no una lista de funcionalidades sin implementar.
