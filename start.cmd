@echo off
REM One-step run for SignalCheck (Windows Command Prompt).
setlocal EnableExtensions
cd /d "%~dp0"

if not exist "apps\api\.venv\Scripts\python.exe" (
  echo API is not installed yet. Running install.cmd first...
  call "%~dp0install.cmd"
  if errorlevel 1 exit /b 1
)

where pnpm >nul 2>&1
if errorlevel 1 (
  echo [ERROR] pnpm was not found. Run install.cmd first.
  exit /b 1
)

if not exist "node_modules" (
  echo Web packages missing. Running install.cmd first...
  call "%~dp0install.cmd"
  if errorlevel 1 exit /b 1
)

echo.
echo Starting SignalCheck...
echo   API  -^> http://127.0.0.1:43124
echo   Web  -^> http://127.0.0.1:43123
echo.
echo Two windows will open. Close them to stop the app.
echo.

start "SignalCheck API" /D "%~dp0" cmd /k scripts\run-api-pip.cmd
timeout /t 2 /nobreak >nul
start "SignalCheck Web" /D "%~dp0" cmd /k pnpm dev:web
timeout /t 3 /nobreak >nul
start "" "http://127.0.0.1:43123"

echo Browser should open to the landing page.
echo Keep the API and Web windows open while you use the app.
endlocal
