@echo off
REM Standalone launcher for the License Signer GUI.
REM Works from a USB stick — no repo root dependency.
REM First run:  npm install
REM Then run:   double-click this file

cd /d "%~dp0"
set "ELECTRON_RUN_AS_NODE="
npx electron .

if errorlevel 1 (
  echo.
  echo The signer failed to start. Make sure you've run "npm install" first.
  pause
)
