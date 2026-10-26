# Publicar MISE en internet (para usarlo desde el iPhone sin ordenador encendido)

MISE vivirá en **tu cuenta privada de Cloudflare** (plan gratuito, 0 €/mes). Lo abres desde el iPhone, el Mac o el PC, estés donde estés. **Solo entra tu email**: Cloudflare te envía un código la primera vez en cada aparato.

Tiempo total: unos 20 minutos, una sola vez. Necesitas el Mac **o** el PC solo para este paso; después ya no hace falta tenerlo encendido.

---

## Paso 1 · Crear la cuenta de Cloudflare (5 min, en cualquier aparato)
1. Entra en **https://dash.cloudflare.com/sign-up**.
2. Escribe tu email y una contraseña → *Sign up*.
3. Abre el correo de Cloudflare y pulsa el enlace para verificar el email.
4. Si te pregunta qué quieres hacer, pulsa **Skip** u *Omitir*: no hace falta añadir ningún dominio ni elegir ningún plan.
5. Recomendado: activa la verificación en dos pasos: tu nombre (arriba a la derecha) → *Profile* → *Authentication* → *Two-Factor Authentication*.

✅ Listo cuando ves el panel de Cloudflare con tu email arriba a la derecha.

## Paso 2 · Instalar Node.js (5 min, en el Mac o en el PC)
1. Entra en **https://nodejs.org/es/download** y descarga la versión **LTS**.
   - Mac: el archivo `.pkg`. Windows: el archivo `.msi`.
2. Ábrelo y pulsa *Continuar / Siguiente* hasta *Finalizar* (deja todo como viene).

## Paso 3 · Descomprimir MISE
1. Descarga `MISE.zip` y descomprímelo (doble clic) en **Documentos** (no en Descargas).
2. Tendrás una carpeta **Documentos/MISE**.

## Paso 4 · Publicar (doble clic)
1. Dentro de la carpeta MISE, abre:
   - Mac: **`Publicar MISE en internet (Mac).command`**. La primera vez macOS lo bloquea: **clic derecho → Abrir → Abrir**.
   - Windows: **`Publicar MISE en internet (Windows).bat`**. Si sale *Windows protegió su PC*: **Más información → Ejecutar de todas formas**.
2. Se abre una ventana de texto. La primera vez tarda unos minutos instalando cosas: **no la cierres**.
3. Cuando diga *«Pulsa Intro para continuar»*, pulsa **Intro**: se abre el navegador con Cloudflare → pulsa **Allow** (Permitir) → vuelve a la ventana.
4. Te pregunta **tu email**: es el que podrá entrar en MISE. Escríbelo (o pulsa Intro si ya sale el correcto).
5. Puede preguntarte por un **subdominio de workers.dev** (*Would you like to register a workers.dev subdomain?*): responde **Y** (sí) y escribe un nombre corto, por ejemplo `chef-tunombre`. Tu dirección será `https://mise.chef-tunombre.workers.dev`.

## Paso 5 · Activar la protección (1 minuto, en el navegador)
La ventana se para y abre en el navegador la configuración de MISE en Cloudflare:
1. En **Settings** (Configuración), busca **Domains & Routes** → la fila **workers.dev**.
2. Pulsa **Enable Cloudflare Access** (Activar Cloudflare Access).
   - Si Cloudflare te pide crear un «equipo» de Zero Trust, inventa un nombre (p. ej. `chef-tunombre`). Si te pide plan, elige **Free** (gratis). No he podido comprobar desde aquí si te pide una tarjeta para el plan gratuito; si te la pide y prefieres no ponerla, para ahí y avísame.
3. Pulsa **Manage Cloudflare Access** y comprueba que el único email autorizado es **el tuyo**.
4. En esa misma pantalla verás el **Application Audience (AUD) Tag** (64 letras y números). Cópialo.
5. Vuelve a la ventana de MISE, pulsa **Intro** y, cuando te lo pida, **pega el AUD Tag** (si ya aparece entre corchetes, basta con pulsar Intro).

## Paso 6 · Comprobación automática
La ventana vuelve a publicar MISE y **comprueba desde fuera que nadie sin tu email ve nada** (unas 50 pruebas). Al final verás:

```
MISE está publicado y protegido.
Dirección: https://mise.chef-tunombre.workers.dev
```

Si en lugar de eso sale **✗ La comprobación de privacidad NO ha pasado**: no metas datos y mándame una captura de la ventana.

## Paso 7 · iPhone
1. En el iPhone abre **Safari** y escribe la dirección del paso 6.
2. Escribe tu email → te llega un **código** → escríbelo. Ya estás dentro.
3. Pulsa **Compartir** (el cuadrado con la flecha) → **Añadir a pantalla de inicio** → *Añadir*. Desde ahora MISE se abre como una app.
4. Comprueba **Ajustes → Seguridad y actividad**: debe decir *Autenticación: Cloudflare Access*.

En el Mac o el PC, igual: abre la dirección, email y código.

---

### Después
- **Actualizar MISE** cuando te envíe una versión nueva: descomprime la nueva carpeta en el mismo sitio, copia dentro la carpeta `datos-locales` de la antigua (guarda tu configuración) y vuelve a hacer doble clic en *Publicar*. Tus datos no se tocan.
- **Copias de seguridad:** una vez por semana, en MISE: *Ajustes → Copias y exportación → Descargar copia (con documentos)*. Guárdala en iCloud Drive u OneDrive. Cloudflare además puede volver la base de datos a cualquier momento de los últimos 7 días (plan gratuito).
- **Si ya usaste el modo local:** en la versión de internet, *Ajustes → Copias y exportación → Restaurar desde copia* con el último `MISE_copia_….json` de `copias-locales`.
- **Coste:** 0 € con el plan gratuito. Con el uso de una persona no se llega a los límites gratuitos. MISE no activa nada de pago.
- **iPhone perdido:** entra en *dash.cloudflare.com → Zero Trust → Access → Applications → MISE → Revoke existing tokens* (cierra todas las sesiones) y vuelve a entrar en tus otros aparatos con un código nuevo.
