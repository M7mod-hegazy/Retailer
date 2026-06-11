@echo off
REM Run the pre-built portable .exe from a USB stick.
REM
REM Place ElHegazi License Signer-1.0.0-portable.exe next to this file,
REM then double-click this batch file (or run the .exe directly).
REM
REM The .exe stores keys in %USERPROFILE%\.retailer-keys\ and
REM outputs in out\ relative to the .exe location.

cd /d "%~dp0"

if exist "ElHegazi License Signer-1.0.0-portable.exe" (
  start "" "ElHegazi License Signer-1.0.0-portable.exe"
) else (
  echo Portable .exe not found.
  echo.
  echo Option 1 — Build it yourself:
  echo   1. Have Node.js installed on any PC
  echo   2. Run BUILD_PORTABLE.bat
  echo   3. Copy the .exe from dist\ to your USB
  echo.
  echo Option 2 — Run from source (slower, needs Node.js):
  echo   1. Run npm install  (one time)
  echo   2. Run Sign-License-GUI.bat
  pause
)
