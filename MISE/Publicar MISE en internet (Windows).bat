@echo off
REM MISE - doble clic para publicar (o actualizar) MISE en tu cuenta privada de Cloudflare
chcp 65001 >nul
cd /d "%~dp0"
where node >nul 2>&1
if errorlevel 1 (
  echo Para usar MISE necesitas instalar Node.js ^(version LTS^).
  echo Se abrira la pagina de descarga. Instalalo y vuelve a abrir este archivo.
  start "" "https://nodejs.org/es/download"
  pause
  exit /b 1
)
node scripts\publicar.mjs
pause
