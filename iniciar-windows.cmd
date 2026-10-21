@echo off
setlocal
cd /d "%~dp0"
title Almojabanas Huilenses - Desarrollo automatico
where node >nul 2>nul
if errorlevel 1 goto missing_node
where npm.cmd >nul 2>nul
if errorlevel 1 goto missing_node
echo Iniciando el CRM con actualizacion automatica.
echo El navegador se actualiza al guardar y los cambios de GitHub se revisan cada 20 segundos.
echo Si tienes cambios locales, la sincronizacion de GitHub se pausa para conservarlos.
call npm.cmd run dev:sync
if errorlevel 1 goto failed
exit /b 0
:missing_node
echo No se encontro Node.js o npm en esta terminal. Comprueba node --version y npm.cmd --version.
echo El proyecto requiere Node.js 24. Cierra y vuelve a abrir la terminal despues de instalarlo.
pause
exit /b 1
:failed
echo No se pudo completar el arranque. Conserva el mensaje de error para revisarlo.
pause
exit /b 1
