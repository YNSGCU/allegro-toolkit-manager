@echo off
setlocal

cd /d "%~dp0"

if not exist "dist-electron\electron\main.js" (
  echo [ATM] Electron build not found. Running build:electron...
  call npm run build:electron
  if errorlevel 1 goto error
)

if not exist "dist\index.html" (
  echo [ATM] Renderer build not found. Running build:renderer...
  call npm run build:renderer
  if errorlevel 1 goto error
)

echo [ATM] Launching Allegro Toolkit Manager...
start "" npx.cmd electron dist-electron/electron/main.js
exit /b 0

:error
echo [ATM] Launch failed. Check the messages above.
pause
exit /b 1
