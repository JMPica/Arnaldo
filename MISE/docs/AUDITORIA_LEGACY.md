# Auditoría preliminar verificable del prototipo v1

**Archivos originales preservados:** `legacy/index.html` y `legacy/LEEME_ORIGINAL.txt`; ZIP original preservado por trazabilidad. El original tiene 2 ficheros de código/documentación y no contiene backend.

## Lo que efectivamente hay
- HTML/CSS/JavaScript monolítico; se puede abrir localmente.
- `localStorage` para guardar DB de usuario y JSON import/export.
- Entidades: `ingredients`, `recipes`, `menus`, `events`, `purchases`.
- Navegación: dashboard, ingredientes, recetas, menús, eventos, compras, precios/compras y ajustes.
- Cálculos de coste por envase/merma, ración, menú, beneficio previsto, listas de compra, comparación de precios; CSV y impresión de presupuesto interno.
- Escapado de HTML y mitigación básica de CSV formula en exportación; UI demo ficticia.

## Lo que **NO** hay en v1
- Cuenta/autenticación/sesiones/autorización, API o servidor; datos no se sincronizan entre navegadores.
- Base de datos SQL ni copias automáticas; migraciones ni versionado robusto.
- Subrecetas anidadas, fichas técnicas detalladas, históricos/versiones de precios robustos ni snapshots inmutables de eventos.
- Inventario como libro de movimientos; `stockQty` es un campo simple.
- Gestión normalizada de clientes ni alternativas dietéticas por invitado.
- PDFs generados profesionalmente o documentos públicos separados de internos; impresión HTML únicamente.
- Extracción documental/OCR, adjuntos, almacenamiento privado, API IA, pruebas automatizadas y CI.
- Bilingüismo completo; la interfaz actual está en español.

## Riesgos concretos a corregir
- El legado contiene `useablePrice` con un tope silencioso de merma del 95%; no repetirlo y rechazar `w >= 100`.
- Cálculos con `Number` binario y redondeo de UI; migrar dominio a Decimal/centavos y cubrir fixtures.
- El origen de `localStorage` no es una zona segura para datos personales; evitar producción.
- `eventStats` devuelve `0` cuando ingreso es 0; en nueva app el margen deberá ser indefinido, no '0%' engañoso.
- `printEvent` es solo presupuesto **interno**; no reutilizarlo como PDF cliente sin separar información sensible.
- Si un ingrediente se borra/edita, deben preservarse versiones de presupuestos confirmados; el legado recalcula desde precio actual.
- `load()` hace fallback a demo ante JSON inválido; nueva app informa error y evita confusión/pérdida de datos.

Claude Code debe verificar y ampliar la auditoría tras leer entero el HTML y probarlo; este documento no pretende certificar pruebas que todavía no se han ejecutado.
