#!/usr/bin/env bash
# Arma el sitio de GitHub Pages desde fuente/: cada fragmento (el mismo que se publica como artefacto) se envuelve en un documento HTML completo.
# Uso: ./build.sh   (en Git Bash)
set -e
cd "$(dirname "$0")"
wrap(){ # wrap <fragmento> <salida>
  {
    printf '%s\n' '<!doctype html>' '<html lang="es">' '<head>' '<meta charset="utf-8">' \
      '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">' \
      '<meta name="robots" content="noindex, nofollow">' \
      '<meta name="theme-color" content="#070d15">' \
      '<style>*,*::before,*::after{box-sizing:border-box}html,body{margin:0}</style>'
    cat "fuente/$1"
    printf '\n%s\n' '</body>' '</html>'
  } > "$2"
  echo "OK: $2 ($(wc -c < "$2") bytes)"
}
wrap sysmicon-home-prototipo.html index.html
[ -f fuente/portafolio.html ] && wrap portafolio.html portafolio.html
cp fuente/escena.js escena.js
