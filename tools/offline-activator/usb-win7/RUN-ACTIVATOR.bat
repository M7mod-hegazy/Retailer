@echo off
title ElHegazi Retailer - License Activator (Windows 7)
cd /d "%~dp0"

if not exist "%~dp0win7-node.exe" (
  echo.
  echo  [ERROR] win7-node.exe is missing from this folder.
  echo  Copy the WHOLE folder to the USB / PC, then run again.
  echo.
  pause
  exit /b 1
)
if not exist "%~dp0license-private.pem" (
  echo.
  echo  [ERROR] license-private.pem is missing from this folder.
  echo  This is your signing key - it must sit next to this file.
  echo.
  pause
  exit /b 1
)

"%~dp0win7-node.exe" "%~dp0activator.js"

echo.
pause
