"""
The nightly review's detectors.

There is NO language model here. Every finding is computed with SQL and
written rules, and travels with the exact figures behind it. The model only
phrases it afterwards: it does not search, deduce or compute.

It is the rule of the whole motor, and it has a reason: an LLM you ask to
"find patterns" in a table gives you plausible findings that differ every
time. These are always the same for the same data, and they can be argued
with because they are written down.

Every finding carries a FINGERPRINT: if tomorrow the condition no longer
holds, the suggestion goes away on its own. There is no need to mark it as
done: fixing it IS marking it as done.
"""
from __future__ import annotations

import datetime as dt

COST = """(u.t_input*t.usd_input + u.t_output*t.usd_output
          + u.t_cache_read*t.usd_input*t.mult_cache_read
          + u.t_cache_5m*t.usd_input*t.mult_cache_5m
          + u.t_cache_1h*t.usd_input*t.mult_cache_1h)/1e6"""
JOIN = """LEFT JOIN pricing t
            ON t.model = (CASE WHEN u.speed='fast' THEN u.model||'  ⚡' ELSE u.model END)
           AND date(u.ts) >= date(t.valid_from)
           AND (t.valid_to IS NULL OR date(u.ts) <= date(t.valid_to))"""


def _fp(*parts) -> str:
    return "·".join(str(p) for p in parts)


# ── 1 · a price that expires ─────────────────────────────────────────────
def expiring_price(cx, today: dt.date):
    """
    The most actionable warning of all and the one nobody looks at: a price
    with an expiry date that you are already using. When it expires, the same
    work will cost more without anything changing on your side.
    """
    for r in cx.execute(f"""
        SELECT t.model, t.valid_to, t.usd_input, t.usd_output,
               (SELECT usd_input FROM pricing x WHERE x.model=t.model AND x.valid_from>t.valid_to
                 ORDER BY x.valid_from LIMIT 1) i2,
               (SELECT usd_output FROM pricing x WHERE x.model=t.model AND x.valid_from>t.valid_to
                 ORDER BY x.valid_from LIMIT 1) o2,
               (SELECT COUNT(*) FROM usage u WHERE u.model=t.model AND date(u.ts) >= date('now','-14 days')) turns,
               (SELECT COALESCE(SUM({COST}),0) FROM usage u {JOIN}
                 WHERE u.model=t.model AND date(u.ts) >= date('now','-28 days')) usd
          FROM pricing t
         WHERE t.valid_to IS NOT NULL AND date(t.valid_to) >= date('now')
           AND date(t.valid_to) <= date('now','+45 days')"""):
        model, valid_to, i1, o1, i2, o2, turns, usd = r
        if not turns or not i2:
            continue
        days = (dt.date.fromisoformat(valid_to) - today).days
        rise = (o2 / o1 - 1) * 100 if o1 else 0
        yield {
            "category": "cost",
            "subject": f"The price of {model} goes up after {valid_to}",
            "facts": [
                f"{model} is at its launch price: ${i1}/${o1} per million",
                f"after {valid_to} it goes to ${i2}/${o2}: {rise:.0f}% more for output",
                f"{days} days to go",
                f"you have used it {turns} times in the last two weeks",
                f"it has cost you ${usd:,.2f} equivalent in 28 days",
            ],
            "action": None,
            "fingerprint": _fp("price", model, valid_to),
        }


# ── 2 · stale memory ─────────────────────────────────────────────────────
def stale_memory(cx, today):
    tot, old = cx.execute(
        "SELECT COUNT(*), SUM(CASE WHEN days_untouched>10 THEN 1 ELSE 0 END)"
        " FROM memory WHERE days_untouched IS NOT NULL").fetchone()
    if not tot or not old or old / tot < 0.3:
        return
    worst = cx.execute(
        "SELECT title, system, days_untouched FROM memory"
        " WHERE days_untouched > 10 ORDER BY days_untouched DESC LIMIT 5").fetchall()
    freshness = round((tot - old) / tot * 100)
    yield {
        "category": "memory",
        "subject": f"{old} of your {tot} memory files have not been touched in over 10 days",
        "facts": [
            f"memory freshness: {freshness}%",
            f"{old} stale out of {tot} files",
            *[f"“{t}” ({s}) has been frozen for {d} days" for t, s, d in worst],
        ],
        "action": None,
        "fingerprint": _fp("memory", old // 10),
    }


# ── 3 · what you have set up and do not use ──────────────────────────────
def dormant_inventory(cx, today):
    for kind, threshold in (("skill", 0.8), ("agent", 0.7)):
        tot, used = cx.execute(
            "SELECT COUNT(*), SUM(CASE WHEN uses>0 THEN 1 ELSE 0 END)"
            " FROM inventory WHERE kind=?", (kind,)).fetchone()
        if not tot:
            continue
        dormant = tot - (used or 0)
        if dormant / tot < threshold:
            continue
        alive = cx.execute(
            "SELECT name, uses FROM inventory WHERE kind=? AND uses>0"
            " ORDER BY uses DESC LIMIT 4", (kind,)).fetchall()
        yield {
            "category": "hygiene",
            "subject": f"You have {tot} {kind}s declared and use {used or 0}",
            "facts": [
                f"{dormant} {kind}s never used even once",
                *[f"“{n}” is one of the few alive: {u} invocations" for n, u in alive],
                "usage comes from counting real invocations, not from what is written down",
            ],
            "action": None,
            "fingerprint": _fp("dormant", kind, dormant // 20),
        }


# ── 4 · a session whose price shot up ────────────────────────────────────
def expensive_session(cx, today):
    r = cx.execute(f"""
        SELECT u.session, MAX(u.project), MIN(u.ts), MAX(u.ts), COUNT(*),
               COALESCE(SUM({COST}),0) usd, GROUP_CONCAT(DISTINCT u.model),
               (SELECT substr(p.text,1,140) FROM prompts p WHERE p.session=u.session ORDER BY p.ts LIMIT 1)
          FROM usage u {JOIN}
         WHERE datetime(u.ts) >= datetime('now','-7 days') AND u.session IS NOT NULL
         GROUP BY u.session ORDER BY usd DESC LIMIT 1""").fetchone()
    if not r or (r[5] or 0) < 40:
        return
    ses, proj, start, end, turns, usd, models, title = r
    mean = cx.execute(f"""
        SELECT COALESCE(AVG(x),0) FROM (
          SELECT COALESCE(SUM({COST}),0) x FROM usage u {JOIN}
           WHERE datetime(u.ts) >= datetime('now','-28 days') AND u.session IS NOT NULL
           GROUP BY u.session)""").fetchone()[0]
    yield {
        "category": "cost",
        "subject": f"A single session cost you ${usd:,.2f} this week",
        "facts": [
            f"session {ses[:8]} · project {proj or 'no project'}",
            f"{turns} turns with {models}",
            f"the average session of the last 28 days costs ${mean:,.2f}",
            f"it is {usd/mean:.0f} times the average" if mean else "",
            f"it started with: “{(title or '').strip()}”" if title else "",
        ],
        "action": None,
        "fingerprint": _fp("session", ses),
    }


# ── 5 · a pattern that asks to be a skill ────────────────────────────────
def repeated_pattern(cx, today):
    """
    If you repeat the same opening many times, that is a skill waiting to
    exist. It groups by the first three words, which is where the intent of a
    prompt lives.
    """
    rows = cx.execute("""
        SELECT LOWER(TRIM(SUBSTR(text,1,40))) frag, COUNT(*) n, MAX(ts)
          FROM prompts WHERE datetime(ts) >= datetime('now','-14 days')
           AND LENGTH(text) > 12
         GROUP BY LOWER(SUBSTR(text,1,18))
        HAVING n >= 4 ORDER BY n DESC LIMIT 3""").fetchall()
    for frag, n, last in rows:
        yield {
            "category": "skill",
            "subject": f"You started {n} prompts the same way in two weeks",
            "facts": [
                f"{n} times starting with “{frag.strip()}…”",
                f"the last one, {last[:10]}",
                "an opening that repeats is a skill that does not exist yet",
            ],
            "action": None,
            "fingerprint": _fp("pattern", frag[:18], n // 3),
        }


# ── 6 · wasted cache ─────────────────────────────────────────────────────
def weak_cache(cx, today):
    r = cx.execute("""
        SELECT project,
               COALESCE(SUM(t_cache_read),0) hit,
               COALESCE(SUM(t_input + t_cache_5m + t_cache_1h),0) rest,
               COUNT(*) n
          FROM usage WHERE datetime(ts) >= datetime('now','-14 days')
           AND source='claude_code' AND project IS NOT NULL
         GROUP BY project HAVING n > 60 ORDER BY (hit*1.0/(hit+rest+1)) ASC LIMIT 1""").fetchone()
    if not r:
        return
    proj, hit, rest, n = r
    ratio = hit / (hit + rest + 1)
    if ratio > 0.75:
        return
    best = cx.execute("""
        SELECT project, COALESCE(SUM(t_cache_read),0)*1.0 /
               (COALESCE(SUM(t_cache_read),0)+COALESCE(SUM(t_input+t_cache_5m+t_cache_1h),0)+1) r
          FROM usage WHERE datetime(ts) >= datetime('now','-14 days') AND source='claude_code'
         GROUP BY project ORDER BY r DESC LIMIT 1""").fetchone()
    yield {
        "category": "cost",
        "subject": f"In “{proj}” the cache is barely helping you",
        "facts": [
            f"only {ratio*100:.0f}% of the input tokens come from the cache",
            f"in “{best[0]}” that number is {best[1]*100:.0f}%",
            "a cache read costs a tenth of normal input",
            f"{n} turns measured in two weeks",
        ],
        "action": None,
        "fingerprint": _fp("cache", proj, int(ratio * 10)),
    }


import habits  # noqa: E402

# Order matters: the review keeps the first ones, and what helps the user most
# is not knowing how much they spent: it is knowing how they could work better.
DETECTORS = [
    *habits.HABITS,
    repeated_pattern, expiring_price, expensive_session,
    weak_cache, stale_memory, dormant_inventory,
]


def find(cx) -> list[dict]:
    today = dt.date.today()
    out: list[dict] = []
    for d in DETECTORS:
        try:
            for h in d(cx, today):
                h["facts"] = [x for x in h["facts"] if x]
                out.append(h)
        except Exception as e:                      # a broken detector does not silence the others
            print(f"[review] detector {d.__name__}: {type(e).__name__}: {e}")
    return out
