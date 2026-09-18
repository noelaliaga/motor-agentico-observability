"""
The HABIT detectors.

This is what the nightly review really looks at: not how much you spend, but
HOW you work. It reads the sessions and the tools used in each one, and looks
for things like "five sessions editing code without planning first" or "you
repeated the same opening fourteen times and that is a skill".

Same as the others: everything is computed with SQL and written rules. The
model only phrases it afterwards. An LLM you ask to "analyse how you work"
gives you cheap psychology; this gives you counts.

What it does NOT do: judge. Each finding states the number and the
consequence, and leaves the decision where it belongs.
"""
from __future__ import annotations

# Tools that mean "I am really touching the project"
WRITING = ("Edit", "Write", "NotebookEdit", "MultiEdit")
# The ones that mean "I stopped to think first"
PLANNING = ("ExitPlanMode", "EnterPlanMode", "TaskCreate", "TaskUpdate", "TodoWrite")


def _sessions_with(cx, days=14):
    """Every session with the count of what was done inside it."""
    return cx.execute(f"""
        SELECT s.id, s.project, s.started, s.ended, s.messages,
               SUM(CASE WHEN i.name IN {WRITING} THEN 1 ELSE 0 END) writes,
               SUM(CASE WHEN i.name IN {PLANNING} THEN 1 ELSE 0 END) plans,
               SUM(CASE WHEN i.kind='skill'  THEN 1 ELSE 0 END) skills,
               SUM(CASE WHEN i.kind='agent' THEN 1 ELSE 0 END) agents,
               SUM(CASE WHEN i.name='Bash'  THEN 1 ELSE 0 END) bash,
               COUNT(i.id) tools
          FROM sessions s LEFT JOIN invocations i ON i.session = s.id
         WHERE s.source='claude_code' AND datetime(s.ended) >= datetime('now', '-{days} days')
         GROUP BY s.id HAVING s.messages > 8""").fetchall()


# ── 1 · building without a plan ──────────────────────────────────────────
def no_plan(cx, today):
    ses = _sessions_with(cx)
    touching = [s for s in ses if s[5] >= 5]
    if len(touching) < 3:
        return
    unplanned = [s for s in touching if s[6] == 0]
    if len(unplanned) / len(touching) < 0.6:
        return
    worst = max(unplanned, key=lambda s: s[5])
    yield {
        "category": "method",
        "subject": f"{len(unplanned)} of {len(touching)} sessions touched files without planning first",
        "facts": [
            f"{len(touching)} sessions in the last two weeks edited five files or more",
            f"in {len(unplanned)} of them there was not a single plan step or task list",
            f"the biggest: “{worst[1] or 'no project'}” with {worst[5]} edits and {worst[4]} turns",
            "planning before editing is what avoids redoing things halfway",
        ],
        "action": "Start the session with: “before touching anything, make me a plan and wait for me to approve it”",
        "fingerprint": f"method·noplan·{len(unplanned)//3}",
    }


# ── 2 · endless sessions ─────────────────────────────────────────────────
def marathon_session(cx, today):
    r = cx.execute("""
        SELECT id, project, messages,
               CAST((julianday(ended)-julianday(started))*24 AS INTEGER) hours
          FROM sessions WHERE source='claude_code'
           AND datetime(ended) >= datetime('now','-14 days')
         ORDER BY messages DESC LIMIT 1""").fetchone()
    if not r or r[2] < 400:
        return
    mean = cx.execute("""
        SELECT AVG(messages) FROM sessions WHERE source='claude_code'
         AND datetime(ended) >= datetime('now','-28 days') AND messages > 5""").fetchone()[0] or 1
    yield {
        "category": "method",
        "subject": f"One session reached {r[2]} turns without a break",
        "facts": [
            f"session in “{r[1] or 'no project'}”: {r[2]} turns in {r[3]} hours",
            f"your average session is {mean:.0f} turns",
            f"it is {r[2]/mean:.0f} times the average",
            "the longer the session, the more old context is re-read on every turn",
        ],
        "action": None,
        "fingerprint": f"method·marathon·{r[0]}",
    }


# ── 3 · doing by hand what you already have packaged ─────────────────────
def ignored_skill(cx, today):
    """
    With hundreds of skills installed, if a session runs forty Bash calls in a
    row and invokes none, either a skill for that is missing or there is one
    and you forgot it.
    """
    ses = _sessions_with(cx)
    raw = [s for s in ses if s[9] >= 25 and s[7] == 0]
    if len(raw) < 2:
        return
    total_bash = sum(s[9] for s in raw)
    # Outside the f-string: a backslash inside an f-string expression is a
    # SyntaxError before Python 3.12.
    n_skills = cx.execute("SELECT COUNT(*) FROM inventory WHERE kind='skill'").fetchone()[0]
    yield {
        "category": "method",
        "subject": f"{len(raw)} sessions made of loose commands, without using a single skill",
        "facts": [
            f"{total_bash} terminal calls spread over {len(raw)} sessions",
            "none of those sessions invoked a skill",
            f"you have {n_skills} skills declared",
            "either a skill for that is missing, or it exists and you did not remember it",
        ],
        "action": None,
        "fingerprint": f"method·rawbash·{len(raw)//2}",
    }


# ── 4 · the expensive model for the cheap work ───────────────────────────
def oversized_model(cx, today):
    r = cx.execute("""
        SELECT model, COUNT(*) n, AVG(t_output) mean
          FROM usage
         WHERE datetime(ts) >= datetime('now','-14 days')
           AND model IN ('claude-opus-5','claude-fable-5','claude-opus-4-8')
           AND t_output < 350
         GROUP BY model HAVING n > 200 ORDER BY n DESC LIMIT 1""").fetchone()
    if not r:
        return
    tot = cx.execute("""SELECT COUNT(*) FROM usage WHERE model=?
                          AND datetime(ts) >= datetime('now','-14 days')""", (r[0],)).fetchone()[0]
    yield {
        "category": "model",
        "subject": f"{r[1]} turns of {r[0]} returned fewer than 350 tokens",
        "facts": [
            f"{r[1]} of {tot} turns with very short answers ({r[2]:.0f} tokens on average)",
            f"{r[0]} is one of the expensive ones: $25 or $50 per million output",
            "Haiku 4.5 costs $5 per million: five to ten times less",
            "short answers are usually reads, confirmations and checks",
        ],
        "action": None,
        "fingerprint": f"model·short·{r[0]}·{r[1]//200}",
    }


# ── 5 · the project that takes your time ─────────────────────────────────
def dominant_project(cx, today):
    rows = cx.execute("""
        SELECT COALESCE(project,'(no project)'), COUNT(*) n
          FROM usage WHERE datetime(ts) >= datetime('now','-7 days')
         GROUP BY project ORDER BY n DESC""").fetchall()
    if len(rows) < 2:
        return
    total = sum(f[1] for f in rows)
    top = rows[0]
    if top[1] / total < 0.65:
        return
    yield {
        "category": "focus",
        "subject": f"{top[1]/total*100:.0f}% of your week went into “{top[0]}”",
        "facts": [
            f"{top[1]} of {total} turns in a single project",
            f"the second, “{rows[1][0]}”, stayed at {rows[1][1]}",
            f"you touched {len(rows)} projects in seven days",
        ],
        "action": None,
        "fingerprint": f"focus·{top[0]}·{int(top[1]/total*10)}",
    }


HABITS = [no_plan, marathon_session, ignored_skill, oversized_model, dominant_project]
