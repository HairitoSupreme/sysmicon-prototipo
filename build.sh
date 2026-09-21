#!/usr/bin/env bash
# Arma index.html para GitHub Pages a partir del fragmento del prototipo (el mismo que se publica como artefacto).
# Uso: ./build.sh /ruta/a/sysmicon-home-prototipo.html
set -e
SRC="$1"; [ -f "$SRC" ] || { echo "Falta el fragmento HTML"; exit 1; }
cd "$(dirname "$0")"
{
  printf '%s\n' '<!doctype html>' '<html lang="es">' '<head>' '<meta charset="utf-8">' \
    '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">' \
    '<meta name="robots" content="noindex, nofollow">' \
    '<meta name="theme-color" content="#070d15">' \
    '<style>*,*::before,*::after{box-sizing:border-box}html,body{margin:0}</style>'
  cat "$SRC"
  printf '\n%s\n' '</body>' '</html>'
} > index.html
cp "$(dirname "$SRC")/legado-data.js" legado-data.js
echo "OK: index.html ($(wc -c < index.html) bytes)"
