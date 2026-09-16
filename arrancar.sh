#!/usr/bin/env bash
# Run the motor in the foreground on YOUR data: the reader in a loop and the web.
# Ctrl-C stops both. For something that survives a reboot, use the templates in
# launchd/ instead. For a demo with synthetic data, use `make demo`.
#
# The dashboard has no authentication by design: it binds to 127.0.0.1 and
# answers 403 to any non-loopback Host. Do not deploy it.
set -euo pipefail
cd "$(dirname "$0")"

export MOTOR_BASE="${MOTOR_BASE:-$PWD/data/motor.sqlite}"

echo "· reader  → watches the disk every 2 s, writes to $MOTOR_BASE"
python3 lector/lector.py --bucle & LECTOR=$!

echo "· web     → http://127.0.0.1:${MOTOR_PUERTO:-8796}  (dev server)"
(cd web && npm run dev) & WEB=$!

trap 'kill $LECTOR $WEB 2>/dev/null' INT TERM
wait
