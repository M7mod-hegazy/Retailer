@echo off
title Build Retailer Activator
cd /d "%~dp0"

echo Building standalone activator.exe using Node.js SEA...
echo (Requires Node.js 20+)
echo.

REM Step 1: Copy Node.js executable as base
node -e "require('fs').copyFileSync(process.execPath, 'activator.exe')"
if errorlevel 1 goto :err
echo [1/4] Base executable copied

REM Step 2: Create SEA config
node -e "require('fs').writeFileSync('sea-config.json', JSON.stringify({main:'activator.js',output:'sea-prep.blob',disableExperimentalSEAWarning:true}))"
if errorlevel 1 goto :err
echo [2/4] SEA config written

REM Step 3: Generate SEA blob
node --experimental-sea-config sea-config.json
if errorlevel 1 goto :err
echo [3/4] SEA blob generated

REM Step 4: Inject blob into executable
npx postject activator.exe NODE_SEA_BLOB sea-prep.blob --sentinel-fuse NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2
if errorlevel 1 goto :err
echo [4/4] Blob injected

REM Clean up temp files
del sea-config.json sea-prep.blob 2>nul

echo.
echo Done! activator.exe ready.
echo Copy activator.exe + license-private.pem to your USB.
echo.
dir /b activator.exe
echo.
pause
exit /b 0

:err
echo.
echo Build failed.
pause
exit /b 1
