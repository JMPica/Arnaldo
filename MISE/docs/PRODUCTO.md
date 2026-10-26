# Especificación funcional — MISE Private Chef OS

## Visión y persona
App privada para un chef que diseña experiencias gastronómicas y gestiona eventos (domicilio, menú degustación, celebraciones, corporativos). Debe permitir contestar: **¿qué cocinaré, qué debo comprar, cuánto me cuesta y cuánto voy a ganar?** Usuario único al inicio; acceso desde iPhone y ordenador. No asumir un restaurante con TPV.

## Alcance de primera entrega de producción (P0)

### P0.1 Acceso y navegación
- App 100% privada: sin registro público; sesión segura y ruta/API/adjuntos protegidos desde servidor.
- Dashboard: próximos eventos, eventos confirmados, facturación prevista, coste previsto, beneficio estimado, margen estimado, avisos de costes/precios, compras pendientes.
- Navegación clara y búsqueda por entidades; castellano y catalán con traducciones completas de los flujos P0; EUR y formatos europeos.
- Configuración: nombre comercial editable, moneda EUR, preferencias, exportación y restauración, zona horaria Madrid.

### P0.2 Ingredientes y proveedores
- Ingrediente: nombre, categoría, unidad base (`g`, `ml`, `ud`), merma de limpieza o rendimiento comestible, alérgenos validados, notas, estado activo, proveedor preferido.
- Proveedor: contacto, web, email, teléfono (todos opcionales), código/referencia del producto, observaciones.
- Formatos de compra por proveedor (p.ej., bolsa 2 kg, caja 12 uds, botella 750 ml) con su precio **sin IVA**, fecha efectiva y precio por unidad utilizable.
- Historial cronológico de precios: una actualización jamás sobrescribe el precio histórico; fecha de compra y fecha de registro separadas.
- Alertas configurables para incremento de precios entre dos compras comparables; advertir si la unidad o envase cambió.
- Importación/exportación CSV con validación y vista previa.

### P0.3 Recetas y subrecetas
- Ficha: nombre, categoría, descripciones ES/CAT, instrucciones, técnicas, tiempos, rendimiento real, porciones, imagen opcional, observaciones, alérgenos revisados.
- Líneas con ingrediente **o** subreceta; cantidades y unidades; prohibir ciclos; múltiples preparaciones/lotes si procede.
- Coste total por lote, coste por ración útil y desglose por ingrediente; simulación con precios actuales; versiones congeladas de eventos confirmados.
- Ajustar automáticamente cantidades para cualquier número de comensales sin alterar la receta maestra; usar `Decimal`/céntimos en las operaciones según reglas.
- Merma por ingrediente y rendimiento final de receta no deben aplicarse dos veces.
- Copiar, editar, archivar; no borrado físico de ingredientes enlazados. Alérgenos manuales y derivados visibles, pero el visto bueno debe ser humano.

### P0.4 Menús
- Menús degustación y menús por pases; selección de recetas, gramajes/raciones por invitado y alternativas dietéticas.
- Coste por invitado, food cost estimado, coste total; versión de menú para cliente **sin mostrar costes internos**.
- Duplicación de menús, versiones y redacción ES/CAT.
- Manejar alternativas para comensales específicos sin contarlas dos veces.

### P0.5 Clientes y eventos
- Cliente y sus datos mínimos, preferencias dietéticas y consentimiento/justificación de tratamiento según política.
- Evento: fecha/hora, dirección en campo privado, estado borrador/presupuestado/confirmado/realizado/cancelado, comensales, menú elegido, participantes dietéticos, instrucciones, restricciones, fechas de compras/producción.
- Presupuesto: precio por comensal, cargos adicionales, descuentos, costes de personal (incluyendo las propias horas), alquiler de equipos, desplazamiento, compras, consumo, otros gastos, costes generales asignados opcionalmente.
- Diferenciar datos previstos y costes reales; congelar foto financiera al confirmar y mantener histórico tras subir precios.
- Propuesta comercial para cliente (con su branding y partidas acordadas; sin beneficio/costes secretos); ficha interna y cierre comparativo.
- Permitir cerrar y archivar evento sin perder trazabilidad; campos requeridos para estado confirmado.

### P0.6 Compras e inventario
- Lista consolidada por evento o múltiples eventos próximos, agrupada por ingrediente y proveedor; necesidades netas, bruto a comprar, stock disponible, envases enteros y coste previsto.
- Gestión de stock en unidades base con registro de movimientos (entrada, consumo reservado/real, merma, ajuste) y fecha; jamás inferir existencias únicamente de un campo editable.
- Compra: proveedor, producto, formato, cantidad, precio, documento opcional y ajuste de stock; recepciones parciales.
- No descontar inventario de dos eventos antes de producir/confirmar consumos; evitar dobles reservas y negativos silenciosos.
- Exportar listas PDF/CSV e imprimir para mercado.

### P0.7 Exportación, importación, documentación
- Exportar **todos** los datos propios en formato estructurado/versionado (JSON) + CSV de entidades clave.
- Importar copia `legacy` v1 mediante dry-run con resumen de registros, anomalías, validación, copia previa y confirmación explícita.
- Presupuestos PDF para cliente, ficha técnica PDF, lista de compra PDF e informe interno PDF; sin datos internos en el documento público.
- Backup automático programable o backup seguro descargable y probado con restore; instrucciones de recuperación.

## Alcance de segunda etapa (P1, tras P0 estable)

### P1.1 Documentos
- Adjuntar PDF/JPG/PNG/HEIC si el navegador lo permite; validar firma/MIME/tamaño en servidor; no aceptar ejecutables; almacenar privado.
- Extractor primero intenta texto embebido en PDF; para escaneos propone OCR local o IA externa **opt-in**, nunca coste/transferencia ocultos.
- Campos propuestos: proveedor, fecha, nº documento, líneas, unidades, impuestos, descuentos, precios, total.
- Vincular líneas a catálogo con puntuación de confianza, resaltar ambigüedad y **solicitar confirmación humana** antes de actualizar precios/stock.
- Archivar original, extracción, revisor, fecha y trazabilidad; prevenir doble entrada por hash + proveedor + referencia.

### P1.2 Producción y planificación
- Plan de mise en place por tiempos, técnicas, subrecetas y fechas; checklists imprimibles, tareas, conservación, transporte, temperaturas como notas manuales.
- Calendario de eventos y tareas local a la app con exportación iCal; integrar Google Calendar solo si autorización expresa.
- Notificaciones in-app sobre hitos de compras y preparación.

## Opcionales (P2, no bloquear despliegue)
- Asistente gastronómico que sugiera recetas o optimizaciones sin alterar datos sin revisión.
- Lectura de facturas por IA externa y sugerencias de correspondencias; coste por documento visible.
- Colaboradores/roles, plantillas comerciales, plantillas de marca, integraciones adicionales.

## Fuera de alcance deliberadamente
- TPV restaurante, pagos con tarjeta, motor público de reservas, contabilidad oficial, emisión de facturas fiscales, control APPCC automatizado, certificados de alérgenos, recomendación sanitaria automática, scraping de precios en vivo sin permiso.
- Copia de UI, código, materiales o marca de Haddock.

## Definición de terminado (DoD)
Cada función P0: datos que persisten entre dispositivos, validación server-side, usuario no autenticado bloqueado, estados vacíos y errores tratados, tests unitarios o integración relevantes, E2E feliz + caso adverso, ES/CAT, móvil realista. P1 puede diferirse **únicamente si se documenta**; en ningún caso declarar «100% terminado» con P0 incompleto.
