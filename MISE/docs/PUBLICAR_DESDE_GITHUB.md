# Publicar MISE sin instalar nada (desde el navegador)

Tú solo creas la cuenta y dos «llaves» en el navegador (vale el del iPhone o el del PC del trabajo). **GitHub publica MISE en tu cuenta de Cloudflare** cada vez que se aprueban las pruebas, y comprueba que nadie más puede entrar. Coste: 0 €.

Tiempo: unos 15 minutos. Ninguna llave se escribe en el chat.

---

## Paso 1 · Cuenta de Cloudflare
1. Entra en **https://dash.cloudflare.com/sign-up** → email y contraseña → *Sign up*.
2. Pulsa el enlace de verificación que te llega por email.
3. Si te ofrece añadir un dominio o elegir plan → **Skip** (omitir).

## Paso 2 · Activar Zero Trust (la «puerta» con tu email)
1. En el panel de Cloudflare, menú de la izquierda → **Zero Trust**.
2. Te pide un **nombre de equipo**: escribe algo corto, p. ej. `chef-tunombre` → *Next*.
3. Plan: **Free** (0 $, hasta 50 usuarios) → continúa hasta el final.
   - Si te pide una **tarjeta** y no quieres ponerla, sáltate este paso y avísame: el sistema intentará activarlo solo y, si no puede, te lo dirá sin publicar nada abierto.

## Paso 3 · Crear la llave de Cloudflare (API Token)
1. Arriba a la derecha, el icono de tu perfil → **My Profile** (Mi perfil) → **API Tokens** → **Create Token**.
2. Abajo del todo: **Create Custom Token → Get started**.
3. **Token name:** `MISE`
4. **Permissions** — añade estas 5 filas (columna 1 siempre *Account*; pulsa *+ Add more* para cada fila nueva):

   | Account | Permiso | Nivel |
   |---|---|---|
   | Account | **Workers Scripts** | Edit |
   | Account | **D1** | Edit |
   | Account | **Access: Apps and Policies** | Edit |
   | Account | **Access: Organizations, Identity Providers, and Groups** | Edit |
   | Account | **Account Settings** | Read |

5. **Account Resources:** *Include* → tu cuenta.
6. **Continue to summary** → **Create Token**.
7. Pulsa **Copy** para copiar la llave. Solo se muestra una vez: no la cierres hasta el paso 4.

## Paso 4 · Guardar las llaves en GitHub (cifradas)
1. Abre **https://github.com/JMPica/Arnaldo/settings/secrets/actions** (entra con tu cuenta de GitHub).
2. **New repository secret**:
   - Name: `CLOUDFLARE_API_TOKEN` · Secret: *pega la llave del paso 3* → **Add secret**.
3. **New repository secret** otra vez:
   - Name: `MISE_OWNER_EMAIL` · Secret: *tu email* (el único que podrá entrar en MISE) → **Add secret**.

GitHub guarda los secretos cifrados. No aparecen en ningún registro, ni siquiera para Claude, y nadie más puede verlos aunque el código sea público.

## Paso 5 · Avisar a Claude
Escribe «listo» en el chat. Claude lanza la publicación y te pasa la dirección cuando la comprobación de privacidad haya pasado. A partir de ahí, cada mejora que haga Claude se publica sola, después de pasar todas las pruebas.

## Paso 6 · iPhone
1. Abre la dirección en **Safari** (algo como `https://mise.chef-xxxxxx.workers.dev`).
2. Escribe tu email → te llega un **código** → escríbelo.
3. **Compartir → Añadir a pantalla de inicio.**
4. Comprueba **Ajustes → Seguridad y actividad**: *Autenticación: Cloudflare Access*.

---

### Seguridad
- El código de MISE es visible en GitHub, como ya lo era. **Tus datos no**: viven solo en tu Cloudflare, detrás de tu email.
- La llave solo sirve para publicar MISE en tu cuenta (Workers, D1 y Access). Si quieres cortar todo: *My Profile → API Tokens → MISE → Delete*. MISE seguirá funcionando; solo dejarán de publicarse las actualizaciones.
- Para quitar el acceso a un aparato perdido: *Zero Trust → Access → Applications → MISE → Revoke existing tokens*.
