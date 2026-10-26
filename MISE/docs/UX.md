# Diseño UX/UI — private chef premium

## Filosofía
Una herramienta profesional que **ahorre tiempo en cocina**, no un backoffice burocrático. Diseño editorial sobrio, referencias a Mise en Place: legibilidad excelente, microinteracciones rápidas, sin dashboards recargados. Tomar la marca MISE como nombre y la estética general del prototipo (verde profundo, blanco cálido) como referencia visual, no como código que deba copiarse.

## Navegación
Desktop: menú lateral colapsable + área principal; iPhone: navegación inferior accesible o menú sencillo y navegación por pestañas. CTA principal visible y contextual.

Páginas mínimas:
1. Resumen
2. Ingredientes / Proveedores
3. Recetas / Fichas técnicas
4. Menús degustación
5. Eventos / Clientes
6. Compras / Inventario
7. Documentos
8. Rentabilidad / Informes
9. Ajustes / Datos

## Flujos prioritarios
**Evento nuevo (≤ 3 min con catálogo):** nuevo cliente o elegir existente -> invitados + fecha -> escoger menú -> costes -> precio y margen -> guardar presupuesto -> exportar PDF cliente. Debería poder hacerse desde iPhone.

**Escandallo:** abrir receta -> ingredientes y subrecetas -> coste y ración se recalculan -> revisión de alérgenos -> ficha PDF.

**Compras:** seleccionar evento(s) -> necesidades netas -> descuentos de stock y reservas -> proveedor y envases -> exportar / marcar recepción.

**Factura PDF:** cargar -> mostrar documento junto a extracción -> marcar ambigüedad -> confirmar cambios; nunca cambiar precios sin aceptación.

**Cierre:** evento realizado -> introducir costes reales -> ver desviación vs presupuesto congelado -> cerrar y archivar.

## UI / accesibilidad
- Español y catalán completos para P0; no cadenas mezcladas. Datepicker 24 h y formato día/mes/año; guardado ISO en backend.
- Importes con etiqueta `sin IVA`/`con IVA`, `previsto`/`real`, `€/comensal`, `% food cost`, `% margen`.
- Tablas desktop, tarjetas móviles para datos clave; skeletons/estados vacíos y guardado explícito.
- Inputs numéricos en móvil con teclado adecuado; táctiles ≥44px; contraste WCAG AA como objetivo; navegación teclado, errores explicativos.
- Las operaciones destructivas incluyen confirmación y, cuando sea viable, posibilidad de deshacer.
- Etiquetas de alérgenos importantes; aviso visible: 'Revisión manual obligatoria'.
- PWA instalable en pantalla de inicio si no compromete autenticación: caché exclusivamente de assets públicos, NUNCA de datos personales en cache abierta.

## Marca
`MISE` en tipografía editorial de alto contraste; paleta orientativa: bosque #142824, marfil #F7F9F6, salvia #31674F, tinta #172621. No es necesario copiar píxel por píxel el HTML original.
