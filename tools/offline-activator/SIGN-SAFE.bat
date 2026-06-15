@echo off
title ElHegazi - Dash-Safe License Signer
cd /d "%~dp0"

set "NODE="
if exist "%~dp0win-node.exe" set "NODE=%~dp0win-node.exe"
if "%NODE%"=="" (
  where node >nul 2>nul
  if not errorlevel 1 set "NODE=node"
)
if "%NODE%"=="" (
  echo.
  echo  Node.js not found. Either:
  echo    - install Node.js from https://nodejs.org, or
  echo    - copy win-node.exe next to this file.
  echo.
  pause
  exit /b 1
)

"%NODE%" "%~dp0sign-safe.js" %*
