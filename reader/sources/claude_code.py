"""
Claude Code · the rich source.

From each assistant turn it takes the model, the SIX token counters
separately, the speed, the effort, the project and the git branch. From each
of your turns, the prompt. And from each `tool_use` block, which tool and
which skill were really invoked, which is what turns an inventory of 241
skills into "ten used and 231 dormant".
"""
from __future__ import annotations

import json
import time

from common import PATHS, Tail, record_health, shorten

SOURCE = "claude_code"

# What arrives through the user channel but was not written by you.
# "[imagen:" is the marker a Spanish-language Claude Code writes: it is matched
# as data, not translated.
NOISE = (
    "[image:", "[imagen:", "base directory for this skill:",
    "<command-name>", "<local-command", "<system-reminder", "<user-prompt",
    "caveat: the messages below", "this session is being continued",
    "the user sent a new message while you were working",
    "[request interrupted", "arguments:", "tool result", "api error",
    "[usage limit", "[note:", "please continue", "system:",
)


def _is_yours(t: str) -> bool:
    b = t.lstrip().lower()
    if len(t) < 3 or b.startswith("<"):
        return False
    return not any(b.startswith(x) for x in NOISE)


def _project(cwd: str | None, folder: str) -> str:
    if cwd:
        return cwd.rstrip("/").split("/")[-1] or cwd
    # Claude Code's folder name is the path with dashes:
    # "-home-demo-projects-webshop" → "webshop"
    return folder.strip("-").split("-")[-1]


def read(cx) -> int:
    t0 = time.time()
    root = PATHS["claude"] / "projects"
    if not root.is_dir():
        record_health(cx, SOURCE, 0, 0, f"{shorten(root)} does not exist")
        return 0

    tail, n = Tail(cx), 0
    # rglob, not glob. Subagent and workflow sessions live nested under
    # `subagents/`, and they are 140 files and 234 MB: more than a quarter of
    # everything written. With a flat sweep, delegated work cost nothing
    # according to the dashboard: the day you spend the most is the day you
    # delegate the most.
    for file in sorted(root.rglob("*.jsonl")):
        # The project folder is the first one under `projects/`, not the
        # file's: otherwise a subagent would end up attributed to "wf_7c12f677".
        parts = file.relative_to(root).parts
        folder = parts[0] if parts else file.parent.name
        for raw in tail.new_lines(file):
            try:
                d = json.loads(raw)
            except Exception:
                continue                      # a broken line does not bring the file down
            m = d.get("message") or {}
            ts = d.get("timestamp")
            ses = d.get("sessionId") or d.get("session_id")
            proj = _project(d.get("cwd"), folder)
            branch = d.get("gitBranch")
            uid = d.get("uuid")

            # ── the assistant turn: this is where the money is ────────────
            u = m.get("usage") or {}
            model = m.get("model")
            # `<synthetic>` is not a model: those are messages Claude Code
            # makes up itself. Counting them inflates the turns and costs nothing.
            if u and model and model != "<synthetic>" and ts:
                cc = u.get("cache_creation") or {}
                w1h = cc.get("ephemeral_1h_input_tokens") or 0
                w5m = cc.get("ephemeral_5m_input_tokens") or 0
                if not (w1h or w5m):
                    w5m = u.get("cache_creation_input_tokens") or 0
                det = u.get("output_tokens_details") or {}
                cur = cx.execute(
                    """INSERT OR IGNORE INTO usage
                       (source,session,project,ts,model,speed,effort,
                        t_input,t_output,t_thinking,t_cache_read,t_cache_5m,t_cache_1h,branch,ref)
                       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
                    (SOURCE, ses, proj, ts, model,
                     u.get("speed") or "standard", d.get("effort"),
                     u.get("input_tokens") or 0, u.get("output_tokens") or 0,
                     det.get("thinking_tokens") or 0,
                     u.get("cache_read_input_tokens") or 0, w5m, w1h,
                     branch, m.get("id") or uid),
                )
                # NEW rows, not processed lines: `total_changes` is cumulative
                # for the connection and counted every line with `usage` even
                # when INSERT OR IGNORE discarded it as a repeat.
                n += max(cur.rowcount, 0)

            # ── what you asked for ───────────────────────────────────────
            if m.get("role") == "user" and ts and not d.get("isSidechain"):
                c = m.get("content")
                text = c if isinstance(c, str) else " ".join(
                    b.get("text", "") for b in c if isinstance(b, dict) and b.get("type") == "text"
                ) if isinstance(c, list) else ""
                text = text.strip()
                # The "user" channel does not only carry your prompts: also
                # tool results, attached-image markers, headers a skill injects
                # when it loads, and system notices. Without this filter, the
                # pattern detector concluded that "[image: original 2796x1290…]"
                # was a habit of yours that deserved to become a skill.
                if text and _is_yours(text):
                    cx.execute(
                        "INSERT OR IGNORE INTO prompts (session,source,ts,text,ref) VALUES (?,?,?,?,?)",
                        (ses, SOURCE, ts, text[:4000], uid),
                    )

            # ── what was invoked ─────────────────────────────────────────
            for b in (m.get("content") or []) if isinstance(m.get("content"), list) else []:
                if not (isinstance(b, dict) and b.get("type") == "tool_use"):
                    continue
                name, inp = b.get("name"), (b.get("input") or {})
                if name == "Skill" and inp.get("skill"):
                    kind, nm = "skill", inp["skill"]
                elif name in ("Task", "Agent") and inp.get("subagent_type"):
                    kind, nm = "agent", inp["subagent_type"]
                elif name and name.startswith("mcp__"):
                    kind, nm = "mcp", name.split("__")[1]
                else:
                    kind, nm = "tool", name
                if nm and ts:
                    cx.execute(
                        "INSERT OR IGNORE INTO invocations (ts,session,source,kind,name,ref) VALUES (?,?,?,?,?,?)",
                        (ts, ses, SOURCE, kind, nm, b.get("id")),
                    )

    # ── sessions are derived from what was loaded, not read separately ───
    cx.execute(
        """INSERT INTO sessions (id,source,started,ended,project,branch,messages)
           SELECT session, ?, MIN(ts), MAX(ts), MAX(project), MAX(branch), COUNT(*)
             FROM usage WHERE source=? AND session IS NOT NULL GROUP BY session
           ON CONFLICT(id) DO UPDATE SET
             ended=excluded.ended, messages=excluded.messages, project=excluded.project""",
        (SOURCE, SOURCE),
    )
    cx.execute(
        """UPDATE sessions SET title = (
             SELECT substr(p.text,1,160) FROM prompts p
              WHERE p.session = sessions.id ORDER BY p.ts LIMIT 1)
           WHERE source=? AND title IS NULL""",
        (SOURCE,),
    )
    record_health(cx, SOURCE, int((time.time() - t0) * 1000), n, None)
    return n
