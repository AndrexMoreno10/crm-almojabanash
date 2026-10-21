@echo off
setlocal
cd /d "%~dp0"
title Almo CRM - Revision local
where node >nul 2>nul
if errorlevel 1 goto missing_node
node -e "if (Number(process.versions.node.split('.')[0]) !== 24) process.exit(1)"
if errorlevel 1 goto missing_node
where npm.cmd >nul 2>nul
if errorlevel 1 goto missing_node
echo Preparando Almo CRM. La primera vez puede tardar unos minutos.
call npm.cmd ci --no-fund --no-audit
if errorlevel 1 goto failed
call npm.cmd run build
if errorlevel 1 goto failed
call npm.cmd run review
if errorlevel 1 goto failed
exit /b 0
:missing_node
echo Instala Node.js 24 desde https://nodejs.org y vuelve a abrir este archivo.
pause
exit /b 1
:failed
echo No se pudo completar el arranque. Conserva el mensaje de error para revisarlo.
pause
exit /b 1
