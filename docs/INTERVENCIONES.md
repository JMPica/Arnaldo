# APEX — Lo que tienes que hacer tú

Todo lo técnico está hecho y probado. Solo quedan pasos que requieren tu identidad o tus cuentas. Están agrupados para hacerlos de una vez: unos 15 minutos, sin tarjeta y sin coste.

## Paso 1 · Cuenta gratuita de Cloudflare (10 min)

Cloudflare aloja el panel, el motor y la base de datos en su plan gratuito.

1. Crea la cuenta en https://dash.cloudflare.com/sign-up y confirma el correo.
2. En el menú de la izquierda abre **Workers y Pages** una vez. Si te pide elegir un subdominio `*.workers.dev`, elige uno que no revele tu nombre (por ejemplo, una palabra al azar).
3. Copia el **ID de cuenta** (Account ID): aparece en la columna derecha de *Workers y Pages* → *Información general*.
4. Crea un token de API: icono de perfil → **Mi perfil** → **Tokens de API** → **Crear token** → plantilla **Editar Cloudflare Workers** → **Usar plantilla**. En *Permisos* pulsa **Añadir más** y añade **Cuenta · D1 · Editar**. Continúa y pulsa **Crear token**. Copia el token (solo se muestra una vez).

## Paso 2 · Tres secretos en GitHub (3 min)

En https://github.com/JMPica/Arnaldo → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**, crea:

| Nombre | Valor |
|---|---|
| `CLOUDFLARE_API_TOKEN` | el token del paso 1.4 |
| `CLOUDFLARE_ACCOUNT_ID` | el ID de cuenta del paso 1.3 |
| `APEX_PASSWORD` | la contraseña con la que entrarás en APEX (mínimo 12 caracteres; usa una frase larga que no uses en otro sitio) |

Opcionales:

| Nombre | Para qué |
|---|---|
| `APEX_TOTP_SECRET` | segundo factor con una app como Google Authenticator. Valor: una clave base32 de 32 caracteres (A-Z y 2-7) que también introduces en la app como "clave de configuración". |
| `TELEGRAM_BOT_TOKEN` y `TELEGRAM_CHAT_ID` | avisos gratuitos al móvil en cada operación y si se suspende la operativa |

Los secretos nunca aparecen en el código ni en los registros.

## Paso 3 · Avísame

Escribe "listo" en esta conversación. Lanzaré el despliegue, comprobaré que el motor late y verificaré el panel. Si prefieres hacerlo tú: en GitHub → **Actions** → **apex-scheduler** → **Run workflow** → tarea `deploy`.

## Paso 4 · Abrir APEX en el iPhone

1. La dirección privada está en Cloudflare → **Workers y Pages** → **apex** → enlace *Visitar* (`https://apex.<tu-subdominio>.workers.dev`). No se publica en ningún registro.
2. Ábrela en Safari, entra con tu contraseña y pulsa **Compartir → Añadir a pantalla de inicio**. Se abrirá como una app.
3. Pulsa **Encender**. Desde ese momento el motor opera en simulación (paper trading) cada 5 minutos aunque tengas el móvil apagado.

## Opcional · Hacer privado el repositorio

El repositorio `JMPica/Arnaldo` es público y la integración no tiene permiso para crear uno privado. No contiene secretos, pero el código es visible. Si quieres ocultarlo: **Settings → General → Danger Zone → Change visibility → Private**. En privado, GitHub Actions da 2.000 minutos gratis al mes; APEX usa unos 200.

## Más adelante, solo si decides usar dinero real (autorización aparte)

No hagas nada de esto ahora. El sistema no puede operar con dinero real: el panel no tiene forma de activarlo y el motor lo bloquea salvo que exista un secreto de despliegue específico.

Cuando lo decidas, hablaremos de:

1. Abrir cuenta en Kraken, verificar identidad y superar el test de idoneidad de derivados (requisito MiFID).
2. Probar primero en el entorno demo de Kraken Futures (gratis, sin dinero).
3. Crear una clave de API **solo con permiso de trading**, sin permiso de retirada.
4. Transferir tú mismo, como máximo, 200 €. APEX nunca mueve fondos entre cuentas.
5. Darme tu autorización expresa por escrito.
