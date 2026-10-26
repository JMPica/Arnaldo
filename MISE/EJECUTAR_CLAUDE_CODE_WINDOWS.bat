@echo off
cd /d "%~dp0"
echo MISE - Pega el contenido de 01_MENSAJE_PARA_CLAUDE_CODE.md en Claude Code.
where claude >nul 2>&1
if %errorlevel% neq 0 (
  echo No se encuentra la CLI de Claude Code. Abre esta carpeta en Claude Desktop - Code.
  pause
  exit /b 1
)
claude
