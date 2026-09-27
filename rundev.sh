#!/bin/bash
set -euo pipefail

PROJECT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
cd "$PROJECT_DIR"

# Prefer the project's supported Node version without changing the global default.
if command -v brew >/dev/null 2>&1; then
  NODE24_BIN="$(brew --prefix)/opt/node@24/bin"
  if [ -x "$NODE24_BIN/node" ]; then
    export PATH="$NODE24_BIN:$PATH"
  fi
fi

if [ ! -f .env.local ]; then
  echo "Firebase設定がありません。READMEのローカル開発手順に従って.env.localを復元してください。" >&2
  exit 1
fi
if [ ! -d node_modules ]; then
  npm ci
fi

echo "http://localhost:${PORT:-5173}/hush-pointer/ (停止: Ctrl+C)"
exec npm run dev -- --host 127.0.0.1 --port "${PORT:-5173}" --strictPort
