# MISE · guía de uso en una página

**Entrar (modo local):** arranca MISE en el ordenador principal con doble clic; en el iPhone abre el icono MISE estando en la misma wifi (emparejado una vez por QR, ver [`MODO_LOCAL.md`](MODO_LOCAL.md)). **(Cloudflare):** abre tu URL privada → email → código. Nadie más puede entrar. En iPhone usa la barra inferior (Resumen · Eventos · Recetas · Compras · Más). Idioma ES/CA en **Ajustes**. Todos los importes son **sin IVA** salvo donde dice «con IVA».

**1. Catálogo (una vez, luego mantenimiento)**
- **Proveedores:** nombre y, si quieres, NIF (ayuda a reconocer sus facturas).
- **Ingredientes:** unidad base (g, ml, ud), **merma %** (lo que se pierde al limpiar) y alérgenos (los marcas tú). Añade un **formato de compra** (p. ej. «Bolsa 2 kg» a 4,80 €). Cada precio nuevo se **añade al historial**, nunca lo borra.
- **Recetas:** cantidades **netas** para el lote y nº de raciones. Puedes usar otra receta como **subreceta** (por raciones o por peso si indicas su rendimiento). El coste por ración se recalcula al instante. Al terminar, pulsa **Marcar alérgenos como revisados**.
- **Menús:** pases en orden, raciones por comensal y **alternativas** (vegetariano, sin gluten…). Revisa el menú para poder enviarlo.

**2. Evento (≤ 3 minutos desde el móvil)**
**Eventos → Nuevo evento:** cliente (o nuevo), fecha, comensales, menú, tus horas y gastos, precio por comensal. MISE te muestra beneficio, margen y **precio recomendado** para tu margen objetivo. Guarda.
En la ficha del evento:
- **Propuesta PDF (ES/CA):** documento para el cliente con menú, alérgenos y precio con IVA. **Nunca** muestra costes ni márgenes. *Informe interno PDF* sí (no lo envíes).
- **Confirmar evento:** congela el presupuesto (versión inmutable). Si luego suben precios o cambias el menú, verás un aviso y podrás **Re-presupuestar** (nueva versión; las anteriores se conservan).
- **Datos y comensales:** grupos dietéticos (p. ej. 2 veganos) que toman la alternativa del menú sin contar doble.

**3. Compras y producción**
- **Compras → Lista de compra:** elige uno o varios eventos; MISE suma la demanda, añade la merma, resta tu stock y redondea a envases enteros, agrupado por proveedor. **Crear pedido**, exportar CSV o **PDF para el mercado**.
- Al recibir: **Registrar recepción** (también parcial). El stock sube solo; nunca lo editas a mano (usa *Ajustar stock* si cuentas inventario).
- **Facturas y albaranes (Documentos):** *Hacer foto* o subir PDF → *Extraer datos* (lectura local en tu dispositivo, gratis) → revisa proveedor, fecha, nº y cada línea emparejada con tu catálogo → **Confirmar**. Solo entonces se actualizan precios y stock. Detecta documentos repetidos.
- En el evento, pestaña **Compras y producción:** plan de mise en place (raciones y lotes por receta), reservar stock y **registrar consumo** el día de producción.

**4. Cierre y rentabilidad**
Tras el servicio: **Costes → Costes reales** (comida —puedes usar el total de compras vinculadas—, tus horas reales, personal, transporte…). Pestaña **Cierre:** previsto vs real por partida → **Cerrar y archivar resultado**. **Rentabilidad** y **Resumen** muestran previsión, resultado real y desviaciones; exportables a CSV.

**5. Tus datos**
**Ajustes → Copias:** descarga la copia JSON (con documentos) cada semana y guárdala fuera. *Restaurar* exige escribir RESTAURAR y antes guarda una copia automática. *Importar MISE v1* trae tu antigua copia `MISE_copia_….json` con vista previa y sin duplicar. Ajustes también define marca, IVA por defecto (verifícalo con tu asesoría), margen objetivo, tarifa de tus horas y condiciones de la propuesta.

> MISE no emite facturas fiscales ni sustituye a la contabilidad. La IA externa está desactivada: nada sale de tu cuenta sin tu autorización expresa.
