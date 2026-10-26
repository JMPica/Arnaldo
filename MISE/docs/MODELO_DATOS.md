# Entidades, relaciones y contrato de datos

El archivo `reference/001_esquema.sql` es un **esquema de referencia válido en SQLite** que Claude debe revisar y evolucionar mediante migraciones reales para D1.

## Entidades esenciales
- `users`: identidad verificada por Access, email y estado (sin hashes de contraseña si Access autentica).
- `suppliers`: proveedores, contacto mínimo y metadatos.
- `ingredients`: producto, unidad canónica (`g`, `ml`, `ud`), merma, categoría, alérgenos como advertencia.
- `purchase_formats`: formatos disponibles para ingrediente + proveedor, unidad base, tamaño neto comprado, precio sin IVA; vigencia.
- `price_history`: anotaciones inmutables de compras y cambios, referencia a formato y proveedor, fecha y precio comparables.
- `recipes`, `recipe_lines`: ingredientes o subrecetas; `yield_portions`, notas, instrucciones, tiempo, versión, sin referencias circulares.
- `menus`, `menu_lines`: orden de pase, alternativas y raciones invitado.
- `clients`, `events`, `event_costs`, `event_guests`/dietary: cliente, fechas, localización, menús, cantidad, costes, restricciones.
- `event_snapshots`: JSON financiero con hash y versión para fijar presupuestos y eventos confirmados/cerrados.
- `stock_movements`: libro append-only de movimientos por ingrediente, tipo (receipt, consume, waste, adjust) y trazabilidad de evento/compra.
- `purchases`, `purchase_lines`: documentos, adquisiciones y recepciones; precios reales netos.
- `documents`: metadatos/estado de factura/albarán, hash, objeto R2 privado, revisión.
- `audit_log`: modificaciones sensibles y restauraciones sin volcar PII innecesaria.

## Invariantes
- Cada fila perteneciente al usuario incluye `owner_id` si hay API multiusuaria. Aunque al inicio solo exista uno, nunca confiar en `owner_id` enviado por el cliente.
- Ingredientes enlazados a recetas: archivar/desactivar antes que borrar.
- Menú usado por evento confirmado: versionar y congelar snapshot, no editar retroactivamente.
- Precio: histórico inmutable al editar; última entrada efectiva por fecha; reglas claras para compras futuras y correcciones.
- Cantidades físicas normalizadas a unidad base: por ejemplo 1 kg=1000 g, 0,75 L=750 ml; conversiones volumen<->masa solo mediante densidad configurada explícita.
- Entidades canceladas o archivadas siguen para auditoría, pero no computan en compras activas salvo selección expresa.
- Eventos confirmados pueden tener presupuestos congelados y datos reales distintos.
- Las imágenes de recetas son opcionales; jamás bloquear uso por no adjuntar fotografía.
- Datos personales de comensales: mínimos, sin anotaciones médicas libres si no son necesarias, acceso restringido y limpieza configurable.

## Importación legado v1
Formato visible en `legacy/index.html` y su exportación `MISE_copia_YYYY-MM-DD.json`:
`{version:1,brand,demo,ingredients:[],recipes:[],menus:[],events:[],purchases:[]}`.

Correspondencias:
- `ingredients[].unit` `g|ml|ud` -> unidades base; `packQty`, `packPrice` -> formato compra y primer precio; `waste` -> merma %; `stockQty` -> movimiento inicial de ajuste **una sola vez**.
- `recipes[].portions` -> rendimiento base; `lines[].ingredientId/qty` -> ingredientes por lote.
- `menus[].lines[].recipeId/servings` -> orden de pases inferido por posición, raciones por invitado.
- `events[].client` -> cliente provisional deduplicable por texto (no asumir persona distinta automática); `menuId`,`guests`,`date`,`location`,`status` etc.
- `purchases[].packQty/packPrice` -> historial, manteniendo fecha real, proveedor, referencia.

### Guardarraíles de migración
1. JSON parseable, versión ==1, límites de tamaño/array/string y Zod/schema; JSON malformado bloqueado.
2. Validar IDs y referencias; detectar huérfanos, números inválidos, nombres vacíos, duplicados y unidades desconocidas.
3. Previsualizar mapeo, conflictos y cantidades; elegir agregar a base vacía o estrategia de merge con mapeo manual.
4. Crear backup **antes** de importar; transacción SQL; reconciliar conteos/costes; rollback ante fallo.
5. `demo:true` no debe ingresar a producción como dato comercial sin revisión explícita.
6. Proteger contra CSV injection y fórmula en exportación; no ejecutar HTML ni scripts guardados en datos importados.
