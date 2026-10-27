@echo off
REM Start the API using the pip-created .venv (no uv / Node required).
setlocal
cd /d "%~dp0..\apps\api"

if not exist ".venv\Scripts\python.exe" (
  echo No .venv found. Run scripts\setup-api-pip.cmd first.
  exit /b 1
)

".venv\Scripts\python.exe" -m uvicorn listing_validator_api.main:app --reload --host 127.0.0.1 --port 43124
endlocal
