#!/usr/bin/env bash
# One-step install for SignalCheck (macOS / Linux / Git Bash).
set -euo pipefail
cd "$(dirname "$0")"

echo
echo "=== SignalCheck install ==="
echo

if ! command -v node >/dev/null 2>&1; then
  echo "[ERROR] Node.js was not found. Install Node.js 20+ from https://nodejs.org/"
  exit 1
fi

if ! command -v pnpm >/dev/null 2>&1; then
  echo "pnpm not found — installing with npm..."
  npm install -g pnpm
fi

if ! command -v python3 >/dev/null 2>&1 && ! command -v python >/dev/null 2>&1; then
  echo "[ERROR] Python 3.12+ was not found."
  exit 1
fi

if [[ ! -f .env && -f .env.example ]]; then
  cp .env.example .env
  echo "Created .env from .env.example"
fi

echo
echo "[1/2] Installing web packages..."
pnpm install

echo
echo "[2/2] Installing API packages..."
node scripts/run-api.mjs setup

echo
echo "=== Install complete ==="
echo
echo "Next: ./start.sh"
echo "Then open http://127.0.0.1:43123"
echo
