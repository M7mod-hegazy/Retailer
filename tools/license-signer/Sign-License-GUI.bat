@echo off
REM Double-click this to open the License Signer as a desktop app window.
REM It forces Electron to run in GUI mode (clears ELECTRON_RUN_AS_NODE, which
REM the dev/test scripts set and which would otherwise launch it as plain Node).

cd /d "%~dp0..\.."
set "ELECTRON_RUN_AS_NODE="
"node_modules\.bin\electron.cmd" "tools\license-signer\signer-gui\main.js"

if errorlevel 1 (
  echo.
  echo The signer failed to start. Make sure dependencies are installed ^(npm install^).
  pause
)
