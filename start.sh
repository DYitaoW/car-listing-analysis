#!/usr/bin/env bash
# One-step run for SignalCheck (macOS / Linux / Git Bash).
set -euo pipefail
cd "$(dirname "$0")"

if [[ ! -d node_modules ]]; then
  echo "Dependencies missing — running ./install.sh first..."
  ./install.sh
fi

if [[ ! -d apps/api/.venv ]] && ! command -v uv >/dev/null 2>&1; then
  echo "API venv missing — running ./install.sh first..."
  ./install.sh
fi

cleanup() {
  if [[ -n "${API_PID:-}" ]]; then kill "$API_PID" 2>/dev/null || true; fi
  if [[ -n "${WEB_PID:-}" ]]; then kill "$WEB_PID" 2>/dev/null || true; fi
}
trap cleanup EXIT INT TERM

echo
echo "Starting SignalCheck..."
echo "  API  -> http://127.0.0.1:43124"
echo "  Web  -> http://127.0.0.1:43123"
echo
echo "Press Ctrl+C to stop."
echo

node scripts/run-api.mjs &
API_PID=$!
pnpm dev:web &
WEB_PID=$!

sleep 2
if command -v open >/dev/null 2>&1; then
  open "http://127.0.0.1:43123" || true
elif command -v xdg-open >/dev/null 2>&1; then
  xdg-open "http://127.0.0.1:43123" >/dev/null 2>&1 || true
fi

wait
