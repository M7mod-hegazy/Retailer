@echo off
REM Build standalone portable .exe for USB / MTP deployment.
REM
REM Prerequisites:
REM   1. Node.js installed
REM   2. npm install   (one-time)
REM   3. Double-click this file
REM
REM Outputs:
REM   dist\ElHegazi License Signer-1.0.0-portable.exe  (single file, ~68MB)
REM   dist\win-unpacked\   (full extracted app, ~253MB — fallback)

cd /d "%~dp0"
if not exist "node_modules" (
  echo Installing dependencies...
  call npm install
  if errorlevel 1 (
    echo npm install failed. Make sure Node.js is installed.
    pause & exit /b 1
  )
)

echo Building portable .exe (first download of Electron is slow)...
npx electron-builder --win portable
if errorlevel 1 ( echo Build failed. & pause & exit /b 1 )

echo.
echo Done! dist\ElHegazi License Signer-1.0.0-portable.exe ready.
echo Copy it to your phone / USB stick.
pause
