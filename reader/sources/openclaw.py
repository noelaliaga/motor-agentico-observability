"""
OpenClaw · the little there is, told as it is.

Its logs do not store consumption. What can be read is its configuration
(which model and which provider it is set to) and its declared agents.
OpenClaw's spend comes, together with Hermes', out of the OpenRouter total.
"""
from __future__ import annotations

import json
import time

from common import PATHS, record_health, shorten

SOURCE = "openclaw"


def _text(v) -> str | None:
    """Flattens whatever comes into something SQLite can store, or into None."""
    if v is None or isinstance(v, (str, int, float)):
        return str(v) if v is not None else None
    if isinstance(v, dict):
        # `primary` goes first: in OpenClaw the model is {primary, fallback}
        # and what matters is which one it goes to work with.
        return (v.get("primary") or v.get("id") or v.get("model")
                or v.get("name") or json.dumps(v)[:200])
    if isinstance(v, list):
        return ", ".join(_text(x) or "" for x in v)[:200]
    return str(v)[:200]


def read(cx) -> int:
    t0, n = time.time(), 0
    home = PATHS["openclaw"]
    cfg = home / "openclaw.json"
    if not cfg.exists():
        record_health(cx, SOURCE, 0, 0, "openclaw.json does not exist")
        return 0
    try:
        d = json.loads(cfg.read_text())
    except Exception as e:
        record_health(cx, SOURCE, 0, 0, f"openclaw.json unreadable: {e}")
        return 0

    # CAREFUL with the shape of `agents`: it is NOT a dictionary of agents. It
    # is a dictionary with two system keys: `defaults`, the configuration they
    # all inherit, and `list`, the array with the real agents. Reading it as
    # {name: agent} registered two ghost agents called "defaults" and "list",
    # and touching the second one crashed: `list` is a list and has no `.get`.
    # The dashboard showed that AttributeError for days, which is exactly what
    # showing the reader's health is for.
    block = d.get("agents")
    block = block if isinstance(block, dict) else {}
    defaults = block.get("defaults") if isinstance(block.get("defaults"), dict) else {}
    default_model = _text(defaults.get("model"))

    raw = block.get("list")
    if isinstance(raw, list):
        agents = [a for a in raw if isinstance(a, dict)]
    else:
        # In case it ever goes back to the old shape {name: {...}}: take
        # everything that is a dictionary and not a system key.
        agents = [{"id": k, **v} for k, v in block.items()
                  if isinstance(v, dict) and k not in ("defaults", "list")]

    for a in agents:
        name = _text(a.get("id") or a.get("name"))
        if not name:
            continue
        own = _text(a.get("model"))
        cx.execute(
            """INSERT INTO inventory (kind,name,scope,path,description,model)
               VALUES ('agent',?, 'openclaw', ?, ?, ?)
               ON CONFLICT(kind,name,scope) DO UPDATE SET model=excluded.model""",
            # If the agent declares no model, it inherits the one in `defaults`.
            # It is said to be inherited: choosing a model is not the same as
            # not choosing one.
            (name, shorten(cfg), _text(a.get("description")),
             own or (f"{default_model} (inherited)" if default_model else None)),
        )
        n += 1

    record_health(cx, SOURCE, int((time.time() - t0) * 1000), n,
                  note="OpenClaw does not record consumption in its logs; its spend is "
                       "inside the OpenRouter total")
    return n
