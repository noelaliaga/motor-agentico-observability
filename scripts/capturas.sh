#!/usr/bin/env bash
# Screenshots of the dashboard, taken ONLY from the synthetic demo.
#
#   make demo            # in one terminal: synthetic data + web on 127.0.0.1:8797
#   make capturas        # in another: writes docs/capturas/*.png
#
# Uses a headless Chrome (CHROME=/path/to/chrome to override) with a throwaway
# profile inside the repo, so it never touches your browser profile.
#
# Three flags matter (learnt the hard way while recording the original video):
#   --enable-unsafe-swiftshader and --run-all-compositor-stages-before-draw:
#       without them the <canvas> pieces (memory chain, helix) render black
#       while the rest of the page looks fine, so nobody notices.
#   --virtual-time-budget: virtual time runs faster than real time, so a large
#       budget lets animations settle without waiting that long.
set -euo pipefail

cd "$(dirname "$0")/.."
URL="${URL:-http://127.0.0.1:${MOTOR_PUERTO:-8797}}"
OUT="docs/capturas"
PERFIL="$(pwd)/.chrome-capturas"

if [[ -z "${CHROME:-}" ]]; then
  for c in "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
           "$(command -v google-chrome || true)" "$(command -v chromium || true)"; do
    [[ -n "$c" && -x "$c" ]] && CHROME="$c" && break
  done
fi
[[ -n "${CHROME:-}" ]] || { echo "No Chrome found. Set CHROME=/path/to/chrome." >&2; exit 1; }

# Refuse to photograph anything that is not the demo database.
curl -fsS "$URL/" -o /dev/null || { echo "The dashboard is not running on $URL (make demo)." >&2; exit 1; }
# The synthetic data has invented projects; an instance on real data does not.
curl -fsS "$URL/actividad" | grep -q "acme-webshop" \
  || { echo "No synthetic project on $URL/actividad: refusing to screenshot a non-demo base." >&2; exit 1; }

mkdir -p "$OUT"
FLAGS=(--headless=new --hide-scrollbars --force-device-scale-factor=1
       --enable-unsafe-swiftshader --run-all-compositor-stages-before-draw
       --disable-new-content-rendering-timeout --no-first-run --no-default-browser-check
       --window-size=1440,1800 --virtual-time-budget=5000)

# Headless Chrome sometimes never returns on pages with endless animations:
# each capture gets a hard deadline and a fresh profile.
captura() {
  local destino="$1" url="$2" perfil="$PERFIL-$RANDOM"
  "$CHROME" "${FLAGS[@]}" "--user-data-dir=$perfil" "--screenshot=$destino" "$url" >/dev/null 2>&1 &
  local pid=$!
  for _ in $(seq 1 "${LIMITE_S:-45}"); do
    if [[ -s "$destino" ]] || ! kill -0 "$pid" 2>/dev/null; then break; fi
    sleep 1
  done
  sleep 1
  pkill -f -- "--user-data-dir=$perfil" 2>/dev/null || true
  # Chrome's helper processes keep writing to the profile for a moment after
  # the kill; wait for them before removing it, or `rm` races with them.
  for _ in 1 2 3 4 5 6 7 8 9 10; do
    pgrep -f -- "--user-data-dir=$perfil" >/dev/null 2>&1 || break
    sleep 0.5
  done
  rm -rf "$perfil" 2>/dev/null || { sleep 1; rm -rf "$perfil" 2>/dev/null || true; }
  [[ -s "$destino" ]] && echo "· $destino" || echo "✗ no capture for $url" >&2
}

for par in inicio: dinero:dinero herramientas:herramientas conexiones:conexiones skills:skills \
           actividad:actividad inventario:inventario memoria:memoria sueno:sueno \
           hermes:maquinas/hermes openclaw:maquinas/openclaw; do
  nombre="${par%%:*}"; ruta="${par#*:}"
  rm -f "$OUT/$nombre.png"
  captura "$OUT/$nombre.png" "$URL/$ruta"
done
