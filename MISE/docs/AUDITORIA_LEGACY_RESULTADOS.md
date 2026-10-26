# Auditoría v1 ejecutada (2026-10-26)

Evidencia ejecutada en esta sesión (no supuesta):

| Comprobación | Resultado | Evidencia |
|---|---|---|
| `python3 scripts/verificar_paquete.py` | **OK** (26 comprobaciones) | Salida: "VALIDACIÓN DEL PAQUETE: OK" |
| SHA-256 `legacy/index.html` | `327818fa…9bce1` = manifest | `sha256sum` |
| SHA-256 `legacy/MISE_original_v1.zip` | `31d071f4…7d96c9` = manifest | `sha256sum` |
| ZIP original | 2 ficheros (`index.html` 62 761 B, `LEEME.txt` 2 186 B) | `unzip -l` |
| Carga del HTML en Chromium (390 px) | Sin errores JS; 8 secciones de navegación | Playwright (script de auditoría en scratchpad) |

## Inventario funcional de v1
Resumen · Ingredientes · Recetario · Menús · Eventos · Lista de compra · Precios/compras · Configuración. Entidades JSON: `ingredients, recipes, menus, events, purchases` en `localStorage` (`mise-private-chef-v1`). Exporta JSON y CSV de eventos; imprime presupuesto **interno**.

## Riesgos confirmados con prueba de comportamiento
1. **Merma con tope silencioso del 95 %** (`useablePrice`): ingrediente 1000 g a 10 € con merma 99 % muestra **200 €/kg**; el valor correcto es 1 000 €/kg. → La v2 rechaza `merma ≥ 100` y calcula exacto.
2. **Margen 0 % con ingreso 0**: evento con ingreso 0 y coste 50 € muestra "-50,00 € (0%)". → v2 muestra "—" (indefinido).
3. **Fallback a demo ante datos corruptos**: con `localStorage` corrupto la app carga la demo; el siguiente guardado sobrescribe los datos reales. → v2 usa base de datos y errores explícitos.
4. `Number` binario y redondeos de UI; sin Decimal.
5. Sin autenticación, sin servidor, sin sincronización entre dispositivos.
6. `stockQty` es un campo editable (no libro de movimientos); compras sobrescriben el precio del ingrediente (sin histórico robusto); los eventos se recalculan siempre con el precio actual (sin snapshot).
7. Sin subrecetas, sin alternativas dietéticas, sin clientes normalizados, sin PDF real, sin catalán, sin OCR.
8. Positivo: escapado HTML `esc()` y mitigación básica de fórmulas CSV; fórmulas de escandallo/compra correctas salvo el tope de merma.

Conclusión: v1 se usa solo como especificación funcional y referencia visual (paleta bosque/marfil/salvia, tipografía editorial). No se reutiliza código.
