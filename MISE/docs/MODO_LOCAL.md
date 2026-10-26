# MISE en modo local (Windows · Mac · iPhone)

MISE funciona entero en **un ordenador tuyo** (el «principal»), sin cuentas ni servicios en la nube y con coste 0 €. El iPhone y el otro ordenador se conectan **por la wifi de casa** después de emparejarlos una vez con un código QR.

```
 iPhone ──┐  wifi de casa          ┌─ datos-locales/  (base de datos, secreto)
          ├────────────────►  ORDENADOR PRINCIPAL (MISE en marcha)
 Mac/PC ──┘                        └─ copias-locales/ (copia automática diaria)
```

## 1. Instalar (una vez, en el ordenador principal)
1. Instala **Node.js LTS** desde <https://nodejs.org/es/download> (Windows: instalador `.msi`; Mac: instalador `.pkg`). Siguiente → Siguiente → Finalizar.
2. Descomprime `MISE.zip` en una carpeta fija, por ejemplo `Documentos/MISE` (no la dejes en Descargas ni la muevas después).
3. Abre MISE con doble clic:
   - **Windows:** `Iniciar MISE (Windows).bat`. Si Windows SmartScreen avisa → *Más información* → *Ejecutar de todas formas*. Cuando el **Firewall** pregunte, marca **Redes privadas** y pulsa *Permitir* (sin esto el iPhone no podrá conectarse).
   - **Mac:** `Iniciar MISE (Mac).command`. La primera vez macOS puede bloquearlo: **clic derecho → Abrir → Abrir**. Si pregunta si `workerd` puede aceptar conexiones entrantes → *Permitir*.
4. La primera vez tarda unos minutos (instala componentes; necesita internet solo esta vez). Después arranca en segundos y **funciona sin internet**.
5. Se abre el navegador ya dentro de MISE. Ese ordenador queda emparejado.

> Elige como principal el ordenador que más tiempo esté encendido. Los datos viven **solo** en él.

## 2. Conectar el iPhone (una vez)
1. iPhone y ordenador en **la misma wifi**, con MISE abierto en el ordenador.
2. En el ordenador: **Ajustes → Seguridad y actividad → Dispositivos conectados**, escribe el nombre («iPhone») y pulsa **Conectar un dispositivo**.
3. Escanea el **código QR** con la cámara del iPhone y abre el enlace. Listo.
4. Recomendado: en Safari, *Compartir → Añadir a pantalla de inicio* para tener el icono de MISE.

El código vale **10 minutos y un solo uso**. Para el otro ordenador, haz lo mismo y abre el enlace que aparece bajo el QR.

## 3. Uso diario
- Arranca MISE en el principal con doble clic (deja la ventana abierta; minimízala). Para cerrarlo, cierra esa ventana.
- En el iPhone, abre el icono MISE. Solo funciona **estando en casa** (misma wifi) y con el principal encendido y MISE abierto.
- La dirección del iPhone usa la IP del ordenador (p. ej. `http://192.168.1.20:8787`). Si el router se la cambia, vuelve a emparejar con un QR nuevo. Para evitarlo, reserva una IP fija para el ordenador en el router (opcional).

## 4. Copias de seguridad (automáticas)
- Al arrancar y cada 24 h se guarda `MISE_copia_AAAA-MM-DD_HHMM.json` en `copias-locales/` (se conservan las 30 últimas). Incluyen datos y documentos adjuntos, con suma de verificación.
- **Muy recomendable:** que la copia vaya a una carpeta sincronizada (iCloud Drive u OneDrive) para no perder nada si el ordenador se estropea. Edita `datos-locales/config.json`:
  ```json
  { "carpeta_copias": "C:\\Users\\TU_USUARIO\\OneDrive\\MISE-copias", "copias_a_conservar": 30 }
  ```
  Mac: `"/Users/TU_USUARIO/Library/Mobile Documents/com~apple~CloudDocs/MISE-copias"`.
- **Restaurar:** Ajustes → Copias y exportación → *Restaurar desde copia* (eliges el fichero `.json`) (MISE guarda antes una copia del estado actual).
- **Cambiar de ordenador principal:** instala MISE en el nuevo, restaura la última copia y vuelve a emparejar los dispositivos.

## 5. Seguridad
- Solo entran los dispositivos emparejados (cookie firmada, `HttpOnly`). Un móvil desconocido en tu wifi ve «Este dispositivo no está emparejado» y ningún dato.
- **Revocar** un dispositivo (p. ej. iPhone perdido): Ajustes → Seguridad → *Revocar*. Efecto inmediato.
- La conexión por wifi no va cifrada (http): úsalo **solo en tu wifi de casa**, nunca en wifis públicas. No abras el puerto 8787 en el router.
- `datos-locales/secreto.txt` es la llave de los emparejamientos: no lo compartas. Si lo borras, todos los dispositivos deberán emparejarse de nuevo (los datos no se pierden).
- Copias de seguridad = datos de clientes: guárdalas en tu nube personal, no las envíes por correo.

## 6. Problemas frecuentes
| Síntoma | Solución |
|---|---|
| «Necesitas instalar Node.js» | Instala Node LTS y vuelve a abrir el lanzador. |
| El iPhone no carga | Misma wifi; MISE abierto en el principal; en Windows permite el firewall en *Redes privadas* (Panel de control → Firewall → Permitir una aplicación → `node`/`workerd`). |
| «Este dispositivo no está emparejado» | Genera un QR nuevo (Ajustes → Seguridad). |
| «MISE ya está abierto en otra ventana» | Ya está en marcha; usa esa ventana o ciérrala y vuelve a abrir. |
| La ventana muestra «No se ha detectado red wifi/local» | Conecta el ordenador a la wifi y reinicia MISE. |

Requisitos: Windows 10/11 de 64 bits (Intel/AMD) o macOS 13.5 o posterior (Intel o Apple Silicon); Node.js 20 o superior; ~1 GB de disco tras la instalación.

**Uso desde fuera de casa:** el modo local no lo permite por diseño. Si lo necesitas, la versión en Cloudflare con acceso privado está preparada ([`DESPLIEGUE_MISE.md`](DESPLIEGUE_MISE.md)); se migra restaurando una copia local.
