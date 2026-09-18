"""
Memory · what the AI knows about you, and how much of it has gone stale.

It walks the memory systems (a vault of markdown notes (MOTOR_NOTES), Claude
Code's per-project memories and Hermes') and records when each file was last
touched. Freshness is the figure that matters: an old memory is not neutral,
it is wrong context that slips into every new session.

It does not read the CONTENT beyond the title and the links. No need to.
"""
from __future__ import annotations

import re
import time
from pathlib import Path

from common import PATHS, record_health, shorten

SOURCE = "memory"
LINK = re.compile(r"\[\[([^\]|#]+)")
STALE_DAYS = 10


def _systems():
    # `**/*.md` and not `*.md`: a vault has folders and with the flat pattern
    # only the root files were seen. Without MOTOR_NOTES there is no vault.
    if PATHS["notes"] is not None:
        yield "vault", PATHS["notes"], "**/*.md"
    yield "claude-mem", PATHS["claude"] / "projects", "*/memory/*.md"
    yield "hermes", PATHS["hermes"] / "memories", "**/*.md"


def _type(path: Path, system: str, txt: str) -> str:
    """
    What each file is. The types are the graph's, not a taxonomy: what you
    want to see at a glance is what is in the core, what is a decision that
    was taken and what is a loose file.

    The Spanish fragments ("leccion", "lecciones", "registro", "sesion",
    "habilidad") match the author's own note-naming convention. They are
    matched against file names on disk, so they are data, not translated.
    """
    n = path.name.lower()
    if n in ("memory.md", "claude.md", "agents.md", "soul.md") or n.startswith("00"):
        return "core"
    if "decision" in n or "leccion" in n or "lecciones" in n:
        return "decision"
    if "registro" in str(path).lower() or "session" in n or "sesion" in n:
        return "session"
    if "skill" in n or "habilidad" in n or "/skills/" in str(path).lower():
        return "skill"
    if system == "vault" and path.parent.name and path.parent.name != path.parent.parent.name:
        return "file"
    return "file"


def read(cx) -> int:
    t0, n = time.time(), 0
    today = time.time()
    incoming: dict[str, int] = {}
    # title → path, to resolve the [[links]] to real files
    by_title: dict[str, str] = {}
    outgoing: list[tuple[str, str]] = []

    cx.execute("DELETE FROM links")

    for system, root, pattern in _systems():
        if root is None or not root.is_dir():
            continue
        for f in root.glob(pattern):
            if not f.is_file() or "/.obsidian/" in str(f):
                continue
            try:
                st = f.stat()
                txt = f.read_text(errors="ignore")
            except OSError:
                continue
            path = shorten(f)
            out = LINK.findall(txt)
            for e in out:
                incoming[e.strip()] = incoming.get(e.strip(), 0) + 1
                outgoing.append((path, e.strip()))
            by_title.setdefault(f.stem, path)
            cx.execute(
                """INSERT INTO memory
                   (path,system,title,modified,days_untouched,bytes,links_out,type)
                   VALUES (?,?,?,?,?,?,?,?)
                   ON CONFLICT(path) DO UPDATE SET
                     modified=excluded.modified, days_untouched=excluded.days_untouched,
                     bytes=excluded.bytes, links_out=excluded.links_out,
                     type=excluded.type""",
                (path, system, f.stem,
                 time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(st.st_mtime)),
                 int((today - st.st_mtime) / 86400), st.st_size, len(out),
                 _type(f, system, txt)),
            )
            n += 1

    # ── the edges of the graph ───────────────────────────────────────────
    # A [[link]] pointing to a note that does not exist is NOT stored as an
    # edge: it is counted apart as "missing". Drawing a line into nothing
    # would be making up half the graph.
    missing = 0
    for origin, title in outgoing:
        target = by_title.get(title)
        if target:
            cx.execute("INSERT OR IGNORE INTO links VALUES (?,?)", (origin, target))
        else:
            missing += 1

    for name, count in incoming.items():
        cx.execute(
            "UPDATE memory SET links_in=? WHERE title=? AND system='vault'",
            (count, name),
        )
    cx.execute("INSERT OR REPLACE INTO motor_state VALUES ('missing_links', ?)", (str(missing),))
    record_health(cx, SOURCE, int((time.time() - t0) * 1000), n, None,
                  note=f"{missing} links point to notes that do not exist" if missing else None)
    return n
