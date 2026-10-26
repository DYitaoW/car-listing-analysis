@echo off
setlocal
cd /d "%~dp0.."
echo Installing API dependencies...
node scripts\run-api.mjs setup
if errorlevel 1 exit /b 1
echo.
echo Done. Start the API with:  scripts\run-api.cmd
echo Or both web+API with:      pnpm dev
endlocal
