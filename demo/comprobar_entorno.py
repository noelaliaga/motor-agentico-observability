#!/usr/bin/env python3
"""
Guard for `make demo`: abort if any path the reader or the web would use
points outside the synthetic data folder.

Imports the reader's own path resolution (lector/comun.py), so it checks
exactly what the demo will read, whatever is exported in the shell.

    python3 demo/comprobar_entorno.py data/demo
"""
from __future__ import annotations

import os
import sys
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(RAIZ / "lector"))


def fuera(demo: Path) -> list[str]:
    import comun

    demo = demo.resolve()
    rutas = {"MOTOR_CASA": comun.CASA, "MOTOR_BASE": comun.BASE}
    rutas.update({f"RUTAS[{k}]": v for k, v in comun.RUTAS.items()})
    rutas.update({f"MOTOR_MCP_JSON[{i}]": p for i, p in enumerate(comun.MCP_JSON)})
    malas = []
    for nombre, ruta in rutas.items():
        if ruta is None:
            continue
        r = Path(ruta).expanduser().resolve()
        if r != demo and demo not in r.parents:
            malas.append(f"{nombre} = {r}")
    for var in ("MOTOR_SUENO_LEE", "OPENROUTER_API_KEY", "OPENROUTER_MANAGEMENT_KEY"):
        if os.environ.get(var):
            malas.append(f"{var} is set")
    return malas


def main() -> int:
    if len(sys.argv) != 2:
        print(__doc__)
        return 2
    malas = fuera(Path(sys.argv[1]))
    if malas:
        print("demo aborted: these would point outside the synthetic data:", file=sys.stderr)
        for m in malas:
            print(f"  - {m}", file=sys.stderr)
        return 1
    print("demo environment: every path is inside the synthetic data")
    return 0


if __name__ == "__main__":
    sys.exit(main())
