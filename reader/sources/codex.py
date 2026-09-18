"""
Codex · OpenAI sessions.

MAIN TRAP: every `token_count` event carries TWO figures:
`total_token_usage`, which is CUMULATIVE since the start of the session, and
`last_token_usage`, which is the turn's. Adding up the cumulative one turn by
turn multiplies the spend by hundreds. The last one is always used.
"""
from __future__ import annotations

import json
import time

from common import PATHS, Tail, record_health, shorten

SOURCE = "codex"


def read(cx) -> int:
    t0 = time.time()
    root = PATHS["codex"] / "sessions"
    if not root.is_dir():
        record_health(cx, SOURCE, 0, 0, f"{shorten(root)} does not exist")
        return 0

    tail, n = Tail(cx), 0
    for file in sorted(root.glob("**/*.jsonl")):
        # rollout-2026-07-27T15-09-25-<uuid>.jsonl → the session is the uuid
        ses = file.stem.split("-", 5)[-1] if "-" in file.stem else file.stem
        model, cwd = None, None
        for raw in tail.new_lines(file):
            try:
                d = json.loads(raw)
            except Exception:
                continue
            kind, pl = d.get("type"), (d.get("payload") or {})

            # The model is not in the token event: it has to be carried over
            # from the session header or from the turn context.
            if kind in ("session_meta", "turn_context"):
                model = pl.get("model") or (pl.get("turn_context") or {}).get("model") or model
                cwd = pl.get("cwd") or pl.get("cwd_path") or cwd

            if kind == "event_msg" and pl.get("type") == "token_count":
                u = (pl.get("info") or {}).get("last_token_usage") or {}
                if not u:
                    continue
                ts = d.get("timestamp")
                if not ts:
                    continue
                proj = (cwd or "").rstrip("/").split("/")[-1] or None
                cur = cx.execute(
                    """INSERT OR IGNORE INTO usage
                       (source,session,project,ts,model,speed,
                        t_input,t_output,t_thinking,t_cache_read,t_cache_5m,t_cache_1h,ref)
                       VALUES (?,?,?,?,?, 'standard', ?,?,?,?,0,0,?)""",
                    (SOURCE, ses, proj, ts, model or "gpt-5-codex",
                     u.get("input_tokens") or 0, u.get("output_tokens") or 0,
                     u.get("reasoning_output_tokens") or 0,
                     u.get("cached_input_tokens") or 0,
                     f"{ses}:{ts}:{u.get('total_tokens')}"),
                )
                n += max(cur.rowcount, 0)      # new rows, not lines read

    cx.execute(
        """INSERT INTO sessions (id,source,started,ended,project,model,messages)
           SELECT session, ?, MIN(ts), MAX(ts), MAX(project), MAX(model), COUNT(*)
             FROM usage WHERE source=? AND session IS NOT NULL GROUP BY session
           ON CONFLICT(id) DO UPDATE SET ended=excluded.ended, messages=excluded.messages""",
        (SOURCE, SOURCE),
    )
    record_health(cx, SOURCE, int((time.time() - t0) * 1000), n, None)
    return n
