"""
What you said, for the nightly review to read.

Until now the review looked at COUNTERS: how many sessions, how many edits,
how many turns. That finds coarse habits ("you touched files without
planning") but misses what only lives in the text: that you asked for the same
thing three times because the first answer was not good enough, that you start
without saying where you are going, that you always correct in the same
direction.

For that you have to read. And reading is the one thing a counter cannot do.

WHAT IS SENT AND WHAT IS NOT
  · your prompts, trimmed
  · one line of what the assistant answered, to give the exchange context
  · NEVER tool output, files, or anything else from your disk

WARNING THAT IS ALSO SHOWN ON SCREEN: this DOES leave the machine. The review
uses Claude Code, so these excerpts travel to Anthropic's API (the same ones
that already travel every time you use Claude Code, but it is worth saying out
loud). That is why it is OFF by default: it only reads with MOTOR_REVIEW_READS=1.
"""
from __future__ import annotations

import json
import re

from common import PATHS, USER

LABEL = USER.upper()

TRIM_YOURS = 420
TRIM_THEIRS = 260
MAX_EXCHANGES = 46
BUDGET = 26_000        # characters. Above this, the prompt stops paying off.

# What arrives through the user channel but was not written by you.
# "[imagen:" is the marker a Spanish-language Claude Code writes: it is matched
# as data, not translated.
NOISE = (
    "[image:", "[imagen:", "base directory for this skill:", "<command-name>",
    "<local-command", "<system-reminder", "<user-prompt", "caveat:",
    "this session is being continued", "the user sent a new message",
    "[request interrupted", "tool result", "api error", "[usage limit",
)


def _yours(t: str) -> bool:
    b = t.lstrip().lower()
    return len(t) > 3 and not b.startswith("<") and not any(b.startswith(x) for x in NOISE)


def _text(c) -> str:
    if isinstance(c, str):
        return c
    if isinstance(c, list):
        return " ".join(
            b.get("text", "") for b in c
            if isinstance(b, dict) and b.get("type") == "text"
        )
    return ""


def recent(hours: int = 24) -> list[dict]:
    """
    The exchanges of the last `hours`, in order.

    The end of each transcript is read, not the whole file: what happened a
    month ago says nothing about how you work today.
    """
    import datetime as dt
    cutoff = (dt.datetime.now(dt.UTC) - dt.timedelta(hours=hours)).isoformat()
    root = PATHS["claude"] / "projects"
    if not root.is_dir():
        return []

    out: list[dict] = []
    for file in root.glob("*/*.jsonl"):
        if file.stat().st_mtime < (dt.datetime.now() - dt.timedelta(hours=hours + 2)).timestamp():
            continue
        # only the tail of the file: 900 KB is enough for a long day
        size = file.stat().st_size
        with open(file, "rb") as f:
            if size > 900_000:
                f.seek(size - 900_000)
                f.readline()
            raw = f.read().decode("utf-8", "ignore")

        pending = None
        for line in raw.splitlines():
            if '"timestamp"' not in line:
                continue
            try:
                d = json.loads(line)
            except Exception:
                continue
            ts = d.get("timestamp") or ""
            if ts < cutoff:
                continue
            m = d.get("message") or {}
            proj = (d.get("cwd") or "").rstrip("/").split("/")[-1]

            if m.get("role") == "user" and not d.get("isSidechain"):
                t = _text(m.get("content")).strip()
                if _yours(t):
                    pending = {"ts": ts, "project": proj,
                               "yours": re.sub(r"\s+", " ", t)[:TRIM_YOURS], "theirs": ""}
                    out.append(pending)
            elif m.get("role") == "assistant" and pending is not None and not pending["theirs"]:
                t = _text(m.get("content")).strip()
                if t:
                    pending["theirs"] = re.sub(r"\s+", " ", t)[:TRIM_THEIRS]

    out.sort(key=lambda x: x["ts"])
    # If there are too many, the last ones are kept: tonight weighs more than
    # this morning.
    out = out[-MAX_EXCHANGES:]

    total = 0
    trimmed = []
    for x in reversed(out):
        n = len(x["yours"]) + len(x["theirs"])
        if total + n > BUDGET:
            break
        total += n
        trimmed.append(x)
    return list(reversed(trimmed))


def as_text(xs: list[dict]) -> str:
    # This text is the input of the review's Spanish prompt (review.py), so its
    # labels ("sin proyecto", "ASISTENTE") stay in Spanish on purpose.
    return "\n\n".join(
        f"[{x['ts'][11:16]} · {x['project'] or 'sin proyecto'}]\n"
        f"{LABEL}: {x['yours']}\n"
        f"ASISTENTE: {x['theirs'][:TRIM_THEIRS]}" if x["theirs"] else
        f"[{x['ts'][11:16]} · {x['project'] or 'sin proyecto'}]\n{LABEL}: {x['yours']}"
        for x in xs
    )
