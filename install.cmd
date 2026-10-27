@echo off
REM One-step install for SignalCheck (Windows Command Prompt).
setlocal EnableExtensions
cd /d "%~dp0"

echo.
echo === SignalCheck install ===
echo.

REM --- Node / pnpm ---
where node >nul 2>&1
if errorlevel 1 (
  echo [ERROR] Node.js was not found.
  echo Install Node.js 20+ from https://nodejs.org/ then run install.cmd again.
  exit /b 1
)

where pnpm >nul 2>&1
if errorlevel 1 (
  echo pnpm not found — installing with npm...
  call npm install -g pnpm
  if errorlevel 1 (
    echo [ERROR] Could not install pnpm.
    exit /b 1
  )
)

REM --- Python ---
where py >nul 2>&1
if %errorlevel%==0 (
  set "HAS_PY=1"
) else (
  where python >nul 2>&1
  if %errorlevel%==0 (
    set "HAS_PY=1"
  ) else (
    echo [ERROR] Python was not found.
    echo Install Python 3.12+ from https://www.python.org/downloads/
    echo Check "Add python.exe to PATH", then run install.cmd again.
    exit /b 1
  )
)

if not exist ".env" (
  if exist ".env.example" (
    copy /Y ".env.example" ".env" >nul
    echo Created .env from .env.example
  )
)

echo.
echo [1/2] Installing web packages...
call pnpm install
if errorlevel 1 (
  echo [ERROR] pnpm install failed.
  exit /b 1
)

echo.
echo [2/2] Installing API packages...
call scripts\setup-api-pip.cmd
if errorlevel 1 (
  echo [ERROR] API install failed.
  exit /b 1
)

echo.
echo === Install complete ===
echo.
echo Next: double-click start.cmd   or run:  start.cmd
echo Then open http://127.0.0.1:43123
echo.
endlocal
