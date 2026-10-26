# Plan para que Claude Code ejecute el proyecto completo

## Política de trabajo
Continuar de forma proactiva mientras existan tareas técnicas ejecutables. Comprobar documentación vigente si API/biblioteca varían. Nunca transformar una dificultad en una pregunta al usuario salvo permisos imprescindibles. Actualizar `docs/PROGRESO.md` antes de cerrar cada sesión.

### Sprint 0 — auditoría y habilitación
- Validar este handoff; ejecutar `python3 scripts/verificar_paquete.py`.
- Inspeccionar legacy íntegro y capturas; inventariar pantallas, estructuras y brechas sin asumir que la demo es segura.
- Fijar estructura repo, entorno reproducible, formato/configuración, scripts `dev`, `test`, `typecheck`, `build`, `db:migrate`, `deploy`.
- Iniciar control Git y CI (si existe acceso), commits incrementales; nunca publicar repositorio público con datos de cliente.
- Evidencia: arranque local documentado, CI o comandos de pruebas y base schema migrada.

### Sprint 1 — datos y motor de cálculo
- Diseñar migraciones D1 y servicios de base de datos, modelo y relaciones, validación con schemas.
- Implementar unidades, merma, precios históricos, recetas con subrecetas, costes, márgenes y compras; usar `fixtures/calculos.json` como tests automatizados.
- Probar esquema local, CRUD autenticado, historial y transacciones.
- Evidencia: tests matemáticos, integridad y APIs.

### Sprint 2 — interfaz y operaciones de chef
- Implementar layout responsive bilingüe y estados.
- Recetario, proveedores, menús, eventos/clientes, costes presupuestados/reales, dashboard, compras, inventario, estado confirmación y snapshots.
- PDF de propuestas cliente sin costes y PDF interno con márgenes, CSV+JSON.
- Evidencia: E2E crear desde cero un evento completo, editar ingrediente y verificar que snapshot anterior no cambia.

### Sprint 3 — migración y seguridad
- Importar formato JSON v1 con dry-run; logs y rollback; exportación y restauración verificables.
- Integrar Access y verificar en entorno de prueba: app, APIs, ficheros, previews y url alternativa cerrados.
- Regresar al modelo y arreglar edge cases detectados.
- Evidencia: tests auth/broken access control/restore/rollback.

### Sprint 4 — documentos y producción
- Adjuntos privados PDF/foto; revisión manual de datos de factura, duplicados y extracción sin IA de pago (o IA opcional solo si autorizado).
- App instalable PWA con cache segura, experiencia iPhone, pruebas visuales, accesibilidad y corrección de fallos.
- Desplegar cuando haya cuenta Cloudflare y autorización; no dejar público. Comprobar URL y login real.
- Evidencia: URLs probadas, healthchecks, plan de backups, informe claro de límites.

### Sprint 5 — cierre y entrega
- Toda tarea P0 pasa pruebas. Registrar P1 completado / pendiente con evidencia.
- Manual de usuario no técnico y FAQ; reporte costes/consumo, seguridad y mantenimiento.
- Matriz de cumplimiento: cada requisito -> ruta de implementación -> test -> estado.

## Puertas de calidad
G0: v1 auditada; G1: modelo+cálculos probados; G2: evento end-to-end; G3: acceso cerrado+backup probado; G4: UX móvil+PDF+import; G5: despliegue privado inspeccionado.

## Reanudación
Si el chat/capacidad se interrumpe, registrar commit actual, tests que pasan/fallan y bloqueos en `docs/PROGRESO.md`. La siguiente sesión de Claude Code debe leerlo y continuar desde la última tarea incompleta, no volver a redactar un plan.

## Reglas de comunicación al propietario
Solo pedir: login Cloudflare, aprobación de despliegue/pagos, email de acceso, nombre comercial si es indispensable. Cualquier otra preferencia usar valores configurables sensatos. Explicar con instrucciones breves y capturas si se exige acción humana.
