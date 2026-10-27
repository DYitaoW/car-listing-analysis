@echo off
setlocal
cd /d "%~dp0.."
where pnpm >nul 2>&1
if errorlevel 1 (
  echo pnpm was not found. Install Node.js 20+, then:
  echo   npm install -g pnpm
  exit /b 1
)
pnpm install
if errorlevel 1 exit /b 1
echo.
echo Done. Start the web app with:  pnpm dev:web
echo Start web + API with:         pnpm dev
endlocal
