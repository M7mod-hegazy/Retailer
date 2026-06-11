@echo off
title ElHegazi License Signer — USB Edition
cd /d "%~dp0"

REM ======== QUICK CHECK: are we in a browser temp folder? ========
echo %~dp0 | findstr /i "INetCache Temp Temporary" >nul
if not errorlevel 1 goto :EXTRACT_WARN

echo  ElHegazi License Signer — USB Edition
echo  ======================================
echo.

REM ======== 1. Create data directory first ========
set "LS_DATA_DIR=%~dp0_license-data"
mkdir "%LS_DATA_DIR%" 2>nul
set "LOG=%LS_DATA_DIR%\launcher.log"
echo.>>"%LOG%" 2>nul
echo ===== %DATE% %TIME% =====>>"%LOG%" 2>nul

REM ======== 2. Find Node.js (prefer bundled win-node.exe) ========
set "NODE="

if exist "%~dp0win-node.exe" (
  set "NODE=%~dp0win-node.exe"
  echo  [OK] Found bundled win-node.exe
) else (
  where node >nul 2>nul
  if not errorlevel 1 (
    set "NODE=node"
    echo  [OK] Found system Node.js
  )
)

if "%NODE%"=="" (
  echo  [..] Node.js not found. Downloading portable Node.js (one-time)...
  echo.
  powershell -ExecutionPolicy Bypass -File "%~dp0download-node.ps1"
  if exist "%~dp0win-node.exe" (
    set "NODE=%~dp0win-node.exe"
    echo  [OK] Downloaded win-node.exe
    echo.
  ) else (
    echo.
    echo  [!!] DOWNLOAD FAILED.
    echo       Make sure you have internet access and try again.
    echo       Or download node.exe from https://nodejs.org/
    echo       and place it as win-node.exe next to this file.
    echo.
    pause
    exit /b 1
  )
)

echo [NODE] %NODE%>>"%LOG%"
echo  [OK] Using: %NODE%

REM ======== 3. Verify Node.js actually works ========
"%NODE%" --version >nul 2>&1
if errorlevel 1 (
  echo  [!!] Node.js binary is broken or not executable:
  echo       %NODE%
  echo       Download a fresh copy of Node.js.
  pause
  exit /b 1
)
for /f "tokens=*" %%v in ('"%NODE%" --version') do set "NV=%%v"
echo  [OK] Node.js version: %NV%
echo [NODE-VER] %NV%>>"%LOG%"
echo.

REM ======== 4. Verify required files ========
set "MISSING="
if not exist "%~dp0server.js"    set "MISSING=%~dp0server.js"
if not exist "%~dp0gui.html"     set "MISSING=%MISSING% + %~dp0gui.html"
if not exist "%~dp0signEngine.js" set "MISSING=%MISSING% + %~dp0signEngine.js"
if not exist "%~dp0shared\signLicense.js" set "MISSING=%MISSING% + %~dp0shared\signLicense.js"
if not exist "%~dp0shared\tokenCodec.js"  set "MISSING=%MISSING% + %~dp0shared\tokenCodec.js"

if not "%MISSING%"=="" (
  echo  [!!] MISSING FILES: %MISSING%
  echo       Copy the ENTIRE usb/ folder to your Desktop or flash drive,
  echo       then run USB-LAUNCH.bat from there.
  echo.
  echo       (You ran it from: %~dp0)
  echo [MISSING] %MISSING%>>"%LOG%"
  pause
  exit /b 1
)
echo  [OK] All files present
echo.

REM ======== 5. Start server ========
echo  Starting server...
echo  (The browser will open automatically once the server is ready.)
echo  Press Ctrl+C in this window to stop the server.
echo.

echo [START] Launching server.js>>"%LOG%"
"%NODE%" "%~dp0server.js"
set "EXIT_CODE=%ERRORLEVEL%"
echo [EXIT] Server exited with code %EXIT_CODE%>>"%LOG%"

echo.
echo  [..] Server stopped (exit code %EXIT_CODE%).
echo  [..] Check the log at: %LOG%
echo  [..] Close the browser tab if it is still open.
echo.
pause
goto :EOF

:EXTRACT_WARN
cls
echo.
echo  =====================================================
echo    WRONG LOCATION
echo  =====================================================
echo.
echo  You ran this file from a browser temp folder:
echo    %~dp0
echo.
echo  This folder only contains the batch file, not the rest
echo  of the application.
echo.
echo  To fix this:
echo.
echo    1. Copy the ENTIRE "usb" folder to your Desktop
echo       or flash drive.
echo.
echo    2. Open the copied folder and double-click
echo       USB-LAUNCH.bat from there.
echo.
echo  The "usb" folder contains:
echo    - win-node.exe  (Node.js runtime)
echo    - server.js     (the app)
echo    - gui.html      (the interface)
echo    - signEngine.js + shared/  (libraries)
echo.
echo  =====================================================
echo.
pause
