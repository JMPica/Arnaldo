# Contrato matemático — NO NEGOCIABLE

**Contexto:** operaciones de referencia en EUR, costes netos de IVA, unidades físicas convertidas a base g/ml/ud, sin redondeos intermedios innecesarios. Implementación decimal exacta o enteros de micro-unidad/centavos documentados. Usar DECIMAL o equivalente en TS para ratios y cantidades; no formatear moneda antes de calcular.

## A. Compra y merma de ingredientes
- Precio envase neto `P`, contenido bruto `Q` unidades base, merma `w` en porcentaje (0 ≤ w < 100).
- Cantidad útil del envase `Qútil = Q × (1 − w/100)`.
- Coste útil por unidad `Cútil = P / Qútil`.
- Coste ingrediente para cantidad útil `q`: `C = q × Cútil`.
- Nunca contar merma por segunda vez al componer recetas o compras.
- Si mermas extremas 100%, unidades nulas o precios negativos: rechazar entrada, no dividir por cero ni utilizar un máximo oculto.

## B. Recetas y subrecetas
- Coste lote = suma de cada línea `(cantidad útil ingrediente × coste unitario útil)` y de subrecetas escaladas por **rendimiento comestible** declarado.
- Coste ración = coste lote / número de raciones útiles, > 0.
- Subreceta con rendimiento 1000 g y línea que consume 150 g: coste línea= coste lote subreceta × 150/1000.
- Subreceta con rendimiento de 8 porciones y línea que consume 3 porciones: coste línea= coste lote × 3/8.
- Incompatibilidad dimensional sin conversión explícita: mostrar error, jamás convertir g a ml de forma automática.
- Prevenir ciclos A->B->A, incluidos ciclos indirectos y autorreferencias.

## C. Menús / eventos
- Coste comida por invitado = suma de `(coste ración de receta × raciones de esa receta por invitado)`; alternativas dietéticas se asignan solo a la población que las toma.
- Coste comida total evento = suma real por grupos de comensales (no multiplicar plato base si se excluye por alternativa).
- Ingreso neto estimado = `(precio neto por invitado × invitados) + ingresos adicionales netos − descuentos netos`.
- Costes operativos = personal, horas del chef imputadas, transporte, alquiler de menaje, dietas, extras, costes fijos imputados y otros; cada partida una sola vez.
- Beneficio estimado = ingresos netos − comida − costes operativos.
- Margen beneficio % = `100 × beneficio / ingreso neto`, si ingreso > 0; si ingreso = 0 mostrar `—` (indefinido), **no 0% como si fuera margen correcto**.
- Food cost % = `100 × comida / ingreso neto`, si ingreso > 0; si no, indefinido.
- Precio sugerido total para margen objetivo `m` (0 ≤ m < 1): `CostesTotales / (1 − m)`; por persona, resta ingresos adicionales netos y divide por nº de invitados, teniendo en cuenta descuentos. Aclarar que se trata de margen sobre ingresos, NO markup sobre costes.
- Comparar estimado (snapshot) y real al cerrar; tener en cuenta ajustes y diferencia de inventario, no reescribir snapshot confirmado.
- IVA en propuestas: extra al subtotal según tipo aplicable configurado y verificado, nunca asumir que cualquier servicio tiene el mismo IVA; cotización siempre etiquetada con impuestos incluidos/excluidos.

## D. Lista de compra
- Para cada ingrediente: demanda útil consolidada `N`.
- Transformar a producto bruto: `B = N / (1−w/100)`.
- Restar stock bruto disponible `S` para obtener necesidad `max(0, B−S)`.
- Con formato paquete `Q`: paquetes enteros = `ceil(necesidad/Q)` si venta solo por paquete completo.
- Mostrar coste esperado `paquetes × P`, cantidad excedente y posible sustituto de proveedor.
- Si se usan reservas de inventario, descontar **stock comprometido** una sola vez y hacer el ledger idempotente.
- No redondear a paquetes al consolidar líneas separadas: sumar demanda antes de ceil.

## E. Precio histórico / snapshot
- Un cambio de precio afecta nuevos presupuestos en modo «precio actual», pero no a snapshots confirmados.
- Guardar fecha efectiva, proveedor, formato, cantidad y precio neto; comparar precio por unidad útil solo para productos comparables.
- Al confirmar un evento, registrar input + costes calculados + fecha/hora + versión de motor de cálculo.
- Registrar al cerrar los costes reales y variación frente al presupuesto, sin pérdida de referencia histórica.

## F. Redondeos
- Usar al menos 6 decimales para coste unitario hasta el subtotal; para UI mostrar 2 decimales en € salvo precio unitario/g importante; importes finales redondeados a 2 decimales con política explícita (recomendado decimal HALF_UP para facturación ilustrativa).
- Importes facturados fiscalmente requieren una política legal propia que NO entra en P0.
- En CSV usar números sin símbolo € y codificación explícita; separar decimales y delimitadores de acuerdo con Excel ES.

## Casos de prueba obligatorios
Lee `fixtures/calculos.json` y crea tests equivalentes dentro de la app. No te limites a comprobar que el archivo JSON exista. Incluir: 0 merma, 25% merma, 2 proveedores, escalado a 10 comensales, consolidación de dos eventos, precio sin ingresos, precio de margen objetivo, cambios históricos, alérgenos, subrecetas, formato cambiado, rollback de importación, duplicados en stock.
