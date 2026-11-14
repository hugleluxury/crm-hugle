#!/usr/bin/env sh
# CRM HUGLE · abre el CRM en http://localhost:4800 (macOS / Linux)
cd "$(dirname "$0")" || exit 1
if ! command -v node >/dev/null 2>&1; then
  echo "No encuentro Node.js. Usa la versión web: https://hugleluxury.github.io/crm-hugle/"
  echo "o instala Node.js desde https://nodejs.org"
  exit 1
fi
exec node servidor.mjs "$@"
