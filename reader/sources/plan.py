"""
The state of your plan · what you subscribe to and when you have been stopped.

What can be known, and what cannot, is worth saying up front:

  KNOWN       which plan you have (`~/.claude.json` stores it with a name and a
              tier), whether extra usage is enabled and why it does not kick
              in, and every time the API rejected you for a limit, with its
              window type and the exact time it is released.

  NOT KNOWN   how much of the current window you have used. The "25 / 900"
              the app shows is not in any file: it travels in the API response
              and is not persisted. Only the moment you hit the limit appears
              on disk, and by then it is too late to warn you.

So this reader does NOT estimate the window's consumption. It counts the
rejections, which are measured, and leaves the ceiling blank. A percentage of
a quota nobody publishes would be a made-up number that looks like data.
"""
from __future__ import annotations

import json
import time

from common import PATHS, Tail, record_health

SOURCE = "plan"

# What the tiers are called internally, and what they are called on your bill.
TIERS = {
    "default_claude_max_5x":  ("Claude Max 5×", "five times Pro"),
    "default_claude_max_20x": ("Claude Max 20×", "twenty times Pro"),
    "default_claude_pro":     ("Claude Pro", None),
    "default_claude_free":    ("Claude Free", None),
}

WINDOWS = {
    "five_hour": "5-hour window",
    "seven_day": "weekly window",
    "seven_day_opus": "weekly Opus window",
}


def _account(cx) -> int:
    """The plan, as Claude Code itself has it written down."""
    cfg = PATHS["claude_json"]
    if cfg is None or not cfg.exists():
        return 0
    d = json.loads(cfg.read_text())
    o = d.get("oauthAccount") or {}
    tier = o.get("organizationRateLimitTier") or o.get("userRateLimitTier")
    name, tagline = TIERS.get(tier or "", (tier or None, None))

    # From the account block only the plan and the dates are taken. The email,
    # the UUIDs and anything identifying are NOT stored: the dashboard does not
    # care who you are, only what you subscribe to.
    data = {
        "plan": name,
        "plan_detail": tagline,
        "plan_key": tier,
        "account_type": o.get("organizationType"),
        "since": (o.get("subscriptionCreatedAt") or "")[:10] or None,
        "extra_enabled": "1" if o.get("hasExtraUsageEnabled") else "0",
        "extra_reason": d.get("cachedExtraUsageDisabledReason"),
    }
    for key, value in data.items():
        cx.execute("""INSERT INTO plan (name, value) VALUES (?,?)
                      ON CONFLICT(name) DO UPDATE SET value=excluded.value""",
                   (key, value))
    return sum(1 for v in data.values() if v)


def _rate_limits(cx) -> int:
    """
    Every time the API said no.

    The record lives inside the session's own .jsonl, in `quotaLimits`, and
    only appears when the status is "rejected". It is read incrementally and
    with its own mark: `claude_code` walks these same files and without a mark
    the two would step on each other's cursor.
    """
    root = PATHS["claude"] / "projects"
    if not root.exists():
        return 0
    tail, n = Tail(cx, mark="plan::"), 0
    # rglob, not glob: subagent and workflow sessions live nested under
    # `subagents/`, and they are the ones that hit limits the most: a flat
    # sweep left out exactly the nights the system got stuck.
    for file in sorted(root.rglob("*.jsonl")):
        for line in tail.new_lines(file):
            if b'"quotaLimits"' not in line:
                continue
            try:
                d = json.loads(line)
            except Exception:
                continue
            q = (d.get("message") or {}).get("quotaLimits") or d.get("quotaLimits")
            if not isinstance(q, dict) or q.get("status") != "rejected":
                continue
            reset = q.get("resetsAt")
            cur = cx.execute(
                """INSERT OR IGNORE INTO rate_limits
                   (ts, kind, limit_window, reset_ts, extra_status, extra_reason, session)
                   VALUES (?,?,?,?,?,?,?)""",
                (d.get("timestamp"), q.get("rateLimitType"),
                 WINDOWS.get(q.get("rateLimitType") or "", q.get("rateLimitType")),
                 time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(reset)) if reset else None,
                 q.get("overageStatus"), q.get("overageDisabledReason"),
                 file.stem),
            )
            n += cur.rowcount if cur.rowcount and cur.rowcount > 0 else 0
    return n


def read(cx) -> int:
    t0 = time.time()
    try:
        n = _account(cx) + _rate_limits(cx)
    except Exception as e:
        record_health(cx, SOURCE, int((time.time() - t0) * 1000), 0,
                      f"{type(e).__name__}: {e}")
        return 0
    record_health(cx, SOURCE, int((time.time() - t0) * 1000), n, None,
                  note="The current window's consumption is not persisted anywhere: "
                       "only the moment the API stops you is recorded.")
    return n
