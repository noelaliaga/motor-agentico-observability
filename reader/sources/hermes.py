"""
Hermes · activity yes, spend no.

Hermes (Nous Research, MIT) stores sessions with their model and channel, and
their messages. But the `token_count` column is ZERO in every row: it does not
record consumption. Nothing is estimated here: estimating tokens from the text
length would be making things up, and this motor's rule is that a figure that
does not exist is shown as "no data", never as zero.

What it does contribute, and it is valuable: which skills you really use.
`.usage.json` carries `use_count` and `last_used_at` for every installed skill.

Its database is ALWAYS opened read-only: the motor cannot corrupt Hermes'
board, not even through a bug of its own.
"""
from __future__ import annotations

import hashlib
import json
import time

from common import PATHS, read_only, record_health, shorten

SOURCE = "hermes"


def _opaque_title(key: str | None) -> str | None:
    """
    Hermes' `session_key` usually carries the channel's identifier (a
    messaging chat, for example). It is not shown: without a `display_name`, the
    session is titled with a short hash of the key, stable across passes.
    """
    if not key:
        return None
    return "session " + hashlib.sha256(str(key).encode()).hexdigest()[:8]


def read(cx) -> int:
    t0, n = time.time(), 0
    home = PATHS["hermes"]
    warning = None

    db = home / "state.db"
    if db.exists():
        try:
            h = read_only(db)
            for r in h.execute(
                "SELECT id, source, model, session_key, display_name FROM sessions"
            ):
                sid, channel, model, key, name = r
                row = h.execute(
                    "SELECT MIN(timestamp), MAX(timestamp), COUNT(*), COALESCE(SUM(token_count),0)"
                    " FROM messages WHERE session_id=?", (sid,)).fetchone()
                start, end, msgs, tokens = row
                cx.execute(
                    """INSERT INTO sessions (id,source,started,ended,channel,model,title,messages)
                       VALUES (?,?,?,?,?,?,?,?)
                       ON CONFLICT(id) DO UPDATE SET
                         ended=excluded.ended, messages=excluded.messages, model=excluded.model""",
                    (sid, SOURCE, start, end, channel, model, name or _opaque_title(key), msgs or 0),
                )
                n += 1
                # If Hermes ever starts filling token_count, this picks it up
                # on its own. While it is zero, no `usage` row is written,
                # which is the same as saying "I don't know".
                if tokens:
                    cx.execute(
                        """INSERT OR IGNORE INTO usage
                           (source,session,ts,model,t_input,t_output,ref)
                           VALUES (?,?,?,?,0,?,?)""",
                        (SOURCE, sid, end, model or "?", tokens, f"hermes:{sid}"),
                    )
            h.close()
        except Exception as e:
            warning = f"state.db: {e}"
    else:
        warning = "state.db does not exist"

    # ── the skills Hermes does know you used ─────────────────────────────
    usage = home / "skills" / ".usage.json"
    if usage.exists():
        try:
            d = json.loads(usage.read_text())
            for name, v in d.items():
                cx.execute(
                    """INSERT INTO inventory (kind,name,scope,path,modified,uses,last_used)
                       VALUES ('skill',?, 'hermes', ?, ?, ?, ?)
                       ON CONFLICT(kind,name,scope) DO UPDATE SET
                         uses=excluded.uses, last_used=excluded.last_used""",
                    (name, shorten(home / "skills" / name), v.get("created_at"),
                     v.get("use_count") or 0, v.get("last_used_at")),
                )
                n += 1
        except Exception as e:
            warning = (warning or "") + f" · .usage.json: {e}"

    # The warning is NOT an error that breaks anything: it is what the
    # interface will show as the reason Hermes' spend box is empty.
    record_health(cx, SOURCE, int((time.time() - t0) * 1000), n,
                  error=warning,
                  note="Hermes does not record tokens: the column exists and is zero, "
                       "so its spend is shown empty, not estimated")
    return n
