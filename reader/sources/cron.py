"""
What is going to run without you being there.

It gathers in one place the three clocks that today live apart: macOS
LaunchAgents, the Hermes cron and whatever Codex has scheduled. It is the
question "what will run on its own tonight?", which no dashboard answers
right now.

All of it by reading files and running commands that only list. `launchctl
list` enumerates; it does not load, unload or start anything.

Both commands (`launchctl list` and `hermes cron list`) can be switched off
with MOTOR_CRON_COMMANDS=0: the demo does it so as not to mix the real machine
with a synthetic home.
"""
from __future__ import annotations

import os
import plistlib
import re
import subprocess
import time

from common import PATHS, record_health, shorten

SOURCE = "cron"
DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]


def _when(plist: dict) -> str:
    """Turns a LaunchAgent's schedule into something readable."""
    if "StartInterval" in plist:
        s = int(plist["StartInterval"])
        if s % 3600 == 0:
            return f"every {s // 3600} h"
        if s % 60 == 0:
            return f"every {s // 60} min"
        return f"every {s} s"
    cal = plist.get("StartCalendarInterval")
    if not cal:
        return "at load" if plist.get("RunAtLoad") else "—"
    if isinstance(cal, dict):
        cal = [cal]
    parts = []
    for c in cal[:3]:
        h, m = c.get("Hour"), c.get("Minute", 0)
        d = c.get("Weekday")
        when = f"{h:02d}:{m:02d}" if h is not None else f"every hour at minute {m}"
        if d is not None:
            when = f"{DAYS[(int(d) - 1) % 7]} · {when}"
        elif h is not None:
            when = f"daily · {when}"
        parts.append(when)
    return " and ".join(parts)


def _commands() -> bool:
    return os.environ.get("MOTOR_CRON_COMMANDS", "1") != "0"


def _loaded() -> set[str]:
    if not _commands():
        return set()
    try:
        r = subprocess.run(["launchctl", "list"], capture_output=True, text=True, timeout=15)
        return {row.split("\t")[-1].strip() for row in r.stdout.splitlines()[1:] if row.strip()}
    except Exception:
        return set()


def read(cx) -> int:
    t0, n = time.time(), 0
    cx.execute("DELETE FROM scheduled")     # it is a snapshot, not a history
    alive = _loaded()

    # ── the user's LaunchAgents ──────────────────────────────────────────
    folder = PATHS["launchagents"]
    if folder is not None and folder.is_dir():
        for f in sorted(folder.glob("*.plist")):
            try:
                d = plistlib.loads(f.read_bytes())
            except Exception:
                continue
            label = d.get("Label") or f.stem
            # Only what really has a clock: an agent with no schedule and no
            # RunAtLoad is not "going to run", it simply exists.
            if not any(k in d for k in ("StartInterval", "StartCalendarInterval", "RunAtLoad")):
                continue
            # Only the executable and how many arguments it takes: a
            # LaunchAgent's arguments sometimes include tokens or secret flags.
            prog = [str(x) for x in (d.get("ProgramArguments") or [])]
            if prog:
                what = shorten(prog[0]) or ""
                if len(prog) > 1:
                    what += f" (+{len(prog) - 1} {'argument' if len(prog) == 2 else 'arguments'})"
            else:
                what = shorten(str(d.get("Program", ""))) or ""
            cx.execute(
                "INSERT OR REPLACE INTO scheduled VALUES (?,?,?,?,?,?,?)",
                (f"launchd:{label}", "launchd", label, _when(d), None,
                 1 if label in alive else 0, what[:300]),
            )
            n += 1

    # ── the Hermes cron ──────────────────────────────────────────────────
    try:
        if not _commands():
            raise FileNotFoundError
        r = subprocess.run([os.environ.get("MOTOR_HERMES_CLI", "hermes"), "cron", "list", "--all"],
                           capture_output=True, text=True, timeout=25)
        current = None
        for raw in r.stdout.splitlines():
            line = raw.rstrip()
            head = re.match(r"^\s{0,4}([0-9a-f]{8,}|[a-z]+_[a-z0-9]{6,})\s*\[(\w+)\]\s*$", line, re.I)
            if head:
                current = {"id": head[1], "name": head[1], "schedule": None,
                           "next_run": None, "active": bool(re.search(r"active|enabled", head[2], re.I))}
                cx.execute("INSERT OR REPLACE INTO scheduled VALUES (?,?,?,?,?,?,?)",
                           (f"hermes:{current['id']}", "hermes", current["name"],
                            None, None, int(current["active"]), None))
                n += 1
                continue
            field = re.match(r"^\s+([A-Za-z ]+):\s+(.*)$", line)
            if not (field and current):
                continue
            key, value = field[1].strip().lower(), field[2].strip()
            col = {"name": "name", "schedule": "schedule", "next run": "next_run"}.get(key)
            if col:
                cx.execute(f"UPDATE scheduled SET {col}=? WHERE id=?",
                           (value, f"hermes:{current['id']}"))
    except FileNotFoundError:
        pass
    except Exception as e:
        record_health(cx, SOURCE, int((time.time() - t0) * 1000), n, f"hermes cron: {e}")
        return n

    record_health(cx, SOURCE, int((time.time() - t0) * 1000), n, None,
                  note=None if n else "Nothing is scheduled in launchd or in Hermes")
    return n
