@echo off
REM Install API deps with pip only (no uv, no Node required).
setlocal
cd /d "%~dp0..\apps\api"

where py >nul 2>&1
if %errorlevel%==0 (
  set "PY=py -3.12"
) else (
  where python >nul 2>&1
  if errorlevel 1 (
    echo Python was not found. Install Python 3.12+ from https://www.python.org/downloads/
    echo During setup, enable "Add python.exe to PATH".
    exit /b 1
  )
  set "PY=python"
)

if not exist ".venv\Scripts\python.exe" (
  echo Creating apps\api\.venv ...
  %PY% -m venv .venv
  if errorlevel 1 exit /b 1
)

echo Installing requirements.txt ...
".venv\Scripts\python.exe" -m pip install -U pip
if errorlevel 1 exit /b 1
".venv\Scripts\python.exe" -m pip install -r requirements.txt
if errorlevel 1 exit /b 1
".venv\Scripts\python.exe" -m pip install -e .
if errorlevel 1 exit /b 1

echo.
echo API deps ready. Start with:  scripts\run-api-pip.cmd
endlocal
