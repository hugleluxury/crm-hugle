@echo off
chcp 65001 >nul
title CRM HUGLE
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo  No encuentro Node.js en este ordenador.
  echo  Puedes usar CRM HUGLE directamente en el navegador:
  echo  https://hugleluxury.github.io/crm-hugle/
  echo.
  echo  O instala Node.js desde https://nodejs.org y vuelve a abrir este archivo.
  start "" "https://hugleluxury.github.io/crm-hugle/"
  pause
  exit /b
)
node servidor.mjs
pause
