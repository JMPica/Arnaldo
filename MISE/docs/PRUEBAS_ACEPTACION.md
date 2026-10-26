# Pruebas de aceptación obligatorias

Todos estos casos deben **ejecutarse en código**; no basta describirlos. Para cada uno, enlazar el test y anotar el resultado PASS/FAIL en `docs/PROGRESO.md`.

## Acceso / privacidad (P0, bloqueantes)
- **SEC-01:** visitante anónimo no accede a app, `/api/v1/events`, `/api/v1/clients`, `/api/v1/documents`, ni a vistas previas/URLs alternativas.
- **SEC-02:** usuario ajeno y JWT no válido no obtienen datos. Validación en backend, incluido IDOR.
- **SEC-03:** campos de cliente y texto de receta con HTML/SQL malicioso no provocan inyección/XSS.
- **SEC-04:** al crear backup no aparecen tokens, sesiones, secretos ni passwords; descarga solo autenticada.
- **SEC-05:** secretos ausentes -> error seguro, no fallback público.

## Cálculos y datos
- **CALC-01:** `fixtures/calculos.json`: los importes coinciden exactamente o con tolerancia decimal indicada.
- **CALC-02:** merma aplicada una sola vez en compra y escandallo.
- **CALC-03:** menús de 10 vs 4 invitados escalan linealmente según porciones sin alteración maestra.
- **CALC-04:** subrecetas con rendimiento medido; detección de ciclos, incompatible g/ml.
- **CALC-05:** beneficio y margen con descuentos, costes reales, horas chef; cero ingresos -> margen indefinido.
- **CALC-06:** el precio actual cambia al registrar compras; un presupuesto confirmado histórico no cambia.
- **CALC-07:** cifra final 2 decimales y sin acumulación de redondeo por línea.

## Funcionalidad principal
- **E2E-01:** crear ingrediente+proveedor+formato -> receta+subreceta -> menú 8 pases -> cliente -> evento 10 invitados -> propuesta PDF -> confirmar -> compras -> recepción -> ejecución -> cierre -> margen real.
- **E2E-02:** dos eventos comparten ingrediente, su lista consolidada descuenta stock una sola vez y redondea paquetes una sola vez.
- **E2E-03:** stock físico no puede ser negativo silenciosamente; editar compra mantiene histórico y evita duplicación en reintento.
- **E2E-04:** edición de menú posterior a confirmación no reescribe presupuesto anterior; re-presupuestar crea versión.
- **E2E-05:** PDF cliente no muestra recetas secretas, escandallos, costes, beneficio o márgenes; ficha interna sí.
- **E2E-06:** idiomas ES/CAT, móvil 390px y desktop 1440px, teclado y formularios con errores.
- **E2E-07:** alérgeno detectado/etiquetado y pendiente de verificación bloquea marcado de menú como 'revisado'.

## Migración / backup
- **IMPORT-01:** backup v1 real (o fixture compatibilidad realista) se convierte manteniendo recuentos, relaciones, costes y stock sin duplicar.
- **IMPORT-02:** datos inválidos / referencias huérfanas / formato v2 desconocido producen preview de error y **no** cambios parciales.
- **IMPORT-03:** importar dos veces no duplica movimientos ni entidades, o requiere confirmación explícita de merge.
- **BACKUP-01:** exportación->borrado en entorno de prueba->restauración recupera todos los registros y snapshots; adjuntos se restauran o se indican como ausentes.
- **BACKUP-02:** restaurar no borra existentes sin backup y confirmación explícita.

## Documentos P1
- **DOC-01:** subir PDF o imagen permitida y acceder solamente con identidad autorizada.
- **DOC-02:** PDF texto produce propuesta de líneas, **no** modifica precios antes de aprobar.
- **DOC-03:** recibo repetido se detecta antes de añadir stock por duplicado.
- **DOC-04:** IA desactivada por defecto, no existe llamada facturable silenciosa.

## Operación / despliegue
- **OPS-01:** check TypeScript + tests + build ejecutados (comandos y salidas reales).
- **OPS-02:** migraciones aplicadas a D1 de prueba y rollback/forward definido.
- **OPS-03:** prueba de URL producción sin sesión y con sesión válida, y pruebas básicas del flujo real desde iPhone o viewport equivalente.
- **OPS-04:** procedimiento de restore ensayado y documentado; tiempo estimado anotado como medición, no promesa.

## Reglas de PASS
Si un test no se ejecutó = **NOT RUN**, nunca PASS. Si falta Access/Cloudflare real = **BLOCKED** y no declarar despliegue listo para producción. No inventar capturas, resultados HTTP ni URLs.
