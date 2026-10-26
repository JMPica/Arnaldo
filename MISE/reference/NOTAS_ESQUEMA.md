# Condiciones del esquema SQL de referencia

Este esquema crea las tablas y relaciones básicas y se valida con SQLite en `scripts/verificar_paquete.py`. **No es una migración de producción aprobada automáticamente**.

Claude Code debe:
1. Separar `reference/001_esquema.sql` en migraciones D1 versionadas y ejecutarlas también contra Wrangler local.
2. Asegurar validación de `quantity_base` como Decimal positivo/negativo con autorización específica; SQLite no garantiza tipado decimal por sí solo.
3. Evaluar si dividir importes monetarios en céntimos es suficiente para precios por miligramo, mililitro, unidad y los cálculos de despiece; preservar precisión hasta total monetario.
4. Modelar variantes dietéticas y grupos de comensales con conteos coherentes; prohibir doble cómputo de alternativas.
5. Introducir triggers o invariantes transaccionales para consistencia de `owner_id` entre entidades enlazadas; claves foráneas por sí solas no lo garantizan.
6. Versionar recetas/menús y snapshots inmutables de presupuesto con detalle suficiente para auditoría posterior.
7. Añadir migraciones y tests contra un D1 real de prueba antes del despliegue.
8. No inventar independencia de proveedor; schema SQL de referencia puede evolucionar si justificado.
