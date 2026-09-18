#!/usr/bin/env python3
"""
Guard for `make demo`: abort if any path the reader or the web would use
points outside the synthetic data folder.

Imports the reader's own path resolution (reader/common.py), so it checks
exactly what the demo will read, whatever is exported in the shell.

    python3 demo/check_env.py data/demo
"""
from __future__ import annotations

import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "reader"))


def outside(demo: Path) -> list[str]:
    import common

    demo = demo.resolve()
    paths = {"MOTOR_HOME": common.HOME, "MOTOR_DB": common.DB}
    paths.update({f"PATHS[{k}]": v for k, v in common.PATHS.items()})
    paths.update({f"MOTOR_MCP_JSON[{i}]": p for i, p in enumerate(common.MCP_JSON)})
    bad = []
    for name, path in paths.items():
        if path is None:
            continue
        r = Path(path).expanduser().resolve()
        if r != demo and demo not in r.parents:
            bad.append(f"{name} = {r}")
    for var in ("MOTOR_REVIEW_READS", "OPENROUTER_API_KEY", "OPENROUTER_MANAGEMENT_KEY"):
        if os.environ.get(var):
            bad.append(f"{var} is set")
    return bad


def main() -> int:
    if len(sys.argv) != 2:
        print(__doc__)
        return 2
    bad = outside(Path(sys.argv[1]))
    if bad:
        print("demo aborted: these would point outside the synthetic data:", file=sys.stderr)
        for m in bad:
            print(f"  - {m}", file=sys.stderr)
        return 1
    print("demo environment: every path is inside the synthetic data")
    return 0


if __name__ == "__main__":
    sys.exit(main())
