#!/usr/bin/env python3
"""
The agentic motor's reader.

The ONLY piece of the whole system that writes. And it only writes to its own
database: every other program's source is opened read-only, no exceptions.

  python3 reader/reader.py            one pass and exit
  python3 reader/reader.py --loop     keeps watching, every 2 seconds
  python3 reader/reader.py -v         with the full traceback of whatever fails

In the foreground it is a process you can see and stop with Ctrl-C (`start.sh`).
To survive a reboot there is a launchd template in `launchd/`.
The reader sends nothing to the network except the `openrouter` source, and
only when there is a key in the environment.
"""
from __future__ import annotations

import sys
import time
import traceback
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import pricing  # noqa: E402
from common import DB, PATHS, open_db, record_health  # noqa: E402

SOURCES = ["claude_code", "codex", "hermes", "openclaw",
           "openrouter", "inventory", "multiverso", "memory", "cron", "connections",
           "plan"]

# The network is asked slowly: every 5 minutes, not every 2 seconds.
SLOW = {"openrouter": 300, "inventory": 60, "multiverso": 60,
        "memory": 120, "cron": 120, "connections": 120, "plan": 120}
_last_run: dict[str, float] = {}

SCHEMA = Path(__file__).resolve().parent / "schema.sql"

# Columns added after the first version. `CREATE TABLE IF NOT EXISTS` does not
# touch a table that already exists, so without this the new schema applies to
# a fresh database and not to yours, and the failure shows up weeks later, in
# a query that cannot find the column.
MIGRATIONS = [
    ("memory", "type", "TEXT"),
    ("health", "note", "TEXT"),
    ("review_notes", "origin", "TEXT"),
    ("review_notes", "hook", "TEXT"),
]


def migrate(cx):
    for table, column, kind in MIGRATIONS:
        try:
            present = {r[1] for r in cx.execute(f"PRAGMA table_info({table})")}
        except Exception:
            continue
        if present and column not in present:
            cx.execute(f"ALTER TABLE {table} ADD COLUMN {column} {kind}")
            print(f"[motor] migration: {table}.{column}", flush=True)


def prepare(cx=None):
    """Opens the database (or uses the one given), migrates, applies the schema and seeds prices."""
    cx = cx or open_db(write=True)
    # Migrations first: the schema creates indexes on columns that an old
    # database does not have yet.
    migrate(cx)
    cx.executescript(SCHEMA.read_text())
    migrate(cx)
    pricing.seed(cx)
    pricing.seed_subscriptions(cx)
    cx.commit()
    return cx


def _enabled(name: str) -> bool:
    # An optional adapter that is not configured is neither run nor recorded:
    # it is not a failure, it is a source this user does not have.
    return not (name == "multiverso" and PATHS.get("multiverso") is None)


def run_pass(cx, verbose=False, sources: list[str] | None = None) -> dict[str, int]:
    done = {}
    for name in sources or SOURCES:
        if not _enabled(name):
            continue
        every = SLOW.get(name)
        if every and time.time() - _last_run.get(name, 0) < every:
            continue
        t0 = time.time()
        try:
            mod = __import__(f"sources.{name}", fromlist=["read"])
            done[name] = mod.read(cx)
            _last_run[name] = time.time()
        except ModuleNotFoundError as e:
            if e.name != f"sources.{name}":
                raise
            continue                       # a source not written yet is not an error
        except Exception as e:
            # A source that crashes CANNOT take the others down with it. The
            # reason is recorded and the pass goes on: the interface will show
            # that section empty with its explanation, and the rest intact.
            cx.rollback()
            record_health(cx, name, int((time.time() - t0) * 1000), 0,
                          f"{type(e).__name__}: {e}")
            if verbose:
                traceback.print_exc()
        cx.commit()
    return done


def main():
    cx = prepare()
    loop = "--loop" in sys.argv
    verbose = "-v" in sys.argv
    print(f"[motor] database at {DB}")
    n = 0
    while True:
        t0 = time.time()
        done = run_pass(cx, verbose)
        ms = int((time.time() - t0) * 1000)
        if done or n == 0:
            print(f"[motor] pass {n} · {ms} ms · " +
                  " ".join(f"{k}={v}" for k, v in done.items() if v), flush=True)
        n += 1
        if not loop:
            return
        time.sleep(2)


if __name__ == "__main__":
    main()
