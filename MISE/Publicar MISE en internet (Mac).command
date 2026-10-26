#!/bin/sh
# MISE · doble clic para publicar (o actualizar) MISE en tu cuenta privada de Cloudflare
cd "$(dirname "$0")" || exit 1
export PATH="$PATH:/usr/local/bin:/opt/homebrew/bin"
if ! command -v node >/dev/null 2>&1; then
  echo "Para usar MISE necesitas instalar Node.js (versión LTS)."
  echo "Se abrirá la página de descarga. Instálalo y vuelve a abrir este archivo."
  open "https://nodejs.org/es/download"
  read -r _
  exit 1
fi
node scripts/publicar.mjs
echo
echo "Puedes cerrar esta ventana."
read -r _
