#!/bin/sh
cd "$(dirname "$0")" || exit 1
printf '%s
' 'MISE — consulta 01_MENSAJE_PARA_CLAUDE_CODE.md y pega su contenido al iniciar.'
if command -v claude >/dev/null 2>&1; then
  exec claude
else
  printf '%s
' 'No se encuentra la CLI de Claude Code. Abre esta carpeta en Claude Desktop > Code.'
fi
