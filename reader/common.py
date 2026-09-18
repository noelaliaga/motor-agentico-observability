"""What every reader shares. No business logic here."""
from __future__ import annotations

import os
import sqlite3
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def _path(var: str, default: Path | None) -> Path | None:
    value = os.environ.get(var)
    if value:
        return Path(value).expanduser()
    return default


def _path_list(var: str) -> list[Path]:
    """A variable holding several paths separated by `os.pathsep` (':' on Unix)."""
    return [Path(p).expanduser() for p in os.environ.get(var, "").split(os.pathsep) if p]


# The home: the root every source is looked up from. Defaults to your $HOME.
# For the demo it points at a synthetic home and the motor sees nothing real.
HOME = _path("MOTOR_HOME", Path.home())
DB = _path("MOTOR_DB", ROOT / "data" / "motor.sqlite")

# The name the nightly review uses for the user in its prompts. The default is
# Spanish on purpose: it is only ever inserted into the review's prompts, which
# stay in Spanish (see review.py).
USER = os.environ.get("MOTOR_USER", "").strip() or "el usuario"

# Where each source lives. ALL of it configurable through the environment: not
# a single hard-coded path from a particular machine. A `None` path means
# "source switched off".
PATHS: dict[str, Path | None] = {
    "claude":       _path("MOTOR_CLAUDE",       HOME / ".claude"),
    "claude_json":  _path("MOTOR_CLAUDE_JSON",  HOME / ".claude.json"),
    "codex":        _path("MOTOR_CODEX",        HOME / ".codex"),
    "hermes":       _path("MOTOR_HERMES",       HOME / ".hermes"),
    "openclaw":     _path("MOTOR_OPENCLAW",     HOME / ".openclaw"),
    "launchagents": _path("MOTOR_LAUNCHAGENTS", HOME / "Library" / "LaunchAgents"),
    # Optional: without the variable, the source is not read.
    "notes":        _path("MOTOR_NOTES",        None),   # a vault of markdown notes
    "multiverso":   _path("MOTOR_MULTIVERSO",   None),   # a multiverso-context-engine index
}

# Extra .mcp.json files (from your projects) that the inventory and the
# connections must look at, on top of the servers in ~/.claude.json.
MCP_JSON: list[Path] = _path_list("MOTOR_MCP_JSON")


def shorten(path: Path | str | None) -> str | None:
    """
    A path as it is stored in the database: relative to the home, with "~".

    The dashboard shows paths on screen. Storing them absolute would put the
    machine's user name in every screenshot; relative to the home they say the
    same and give nobody away.
    """
    if path is None:
        return None
    text = str(path)
    home = str(HOME)
    if home and text == home:
        return "~"
    if home and text.startswith(home.rstrip("/") + "/"):
        return "~/" + text[len(home.rstrip("/")) + 1:]
    return text


def open_db(write: bool = False, db: Path | str | None = None) -> sqlite3.Connection:
    """
    The motor's database. `write=False` opens it truly read-only: SQLite
    rejects any INSERT at connection level. The web ALWAYS reads read-only.
    """
    path = Path(db) if db is not None else DB
    if write:
        path.parent.mkdir(parents=True, exist_ok=True)
        cx = sqlite3.connect(path, timeout=30)
        cx.execute("PRAGMA journal_mode=WAL")
        cx.execute("PRAGMA synchronous=NORMAL")
    else:
        cx = sqlite3.connect(f"file:{path}?mode=ro", uri=True, timeout=10)
    cx.row_factory = sqlite3.Row
    return cx


def read_only(path: Path) -> sqlite3.Connection:
    """
    Open ANOTHER program's database. Always read-only, no exceptions: the motor
    cannot corrupt Hermes' database, neither by accident nor through a bug.
    """
    return sqlite3.connect(f"file:{path}?mode=ro", uri=True, timeout=10)


class Tail:
    """
    Incremental reading of a file that only grows.

    It stores how many bytes were already read and seek()s there on the next
    pass. Claude Code and Codex .jsonl files are never rewritten: they are only
    appended to. That is why the first pass is expensive and the rest almost free.

    The `inode` is not decoration: if a file rotates or is recreated, the path
    stays the same but the content is different. Without comparing the inode,
    the motor would seek() into the middle of a new file and read garbage
    SILENTLY.
    """

    def __init__(self, cx: sqlite3.Connection, mark: str = ""):
        self.cx = cx
        # Two different sources may want to walk the SAME files. Without a mark
        # they would share a cursor: the first one to pass advances the counter
        # and the second one sees nothing, silently and forever.
        self.mark = mark

    def new_lines(self, path: Path):
        try:
            st = path.stat()
        except OSError:
            return
        row = self.cx.execute(
            "SELECT inode, bytes_read FROM read_cursors WHERE path=?", (self.mark + str(path),)
        ).fetchone()
        start = 0
        if row and row[0] == st.st_ino and row[1] <= st.st_size:
            start = row[1]
        if start == st.st_size:
            return
        with open(path, "rb") as f:
            f.seek(start)
            raw = f.read()
        # If the last chunk arrived half-written, it is left for the next pass.
        cut = raw.rfind(b"\n")
        if cut == -1:
            return
        for line in raw[: cut + 1].splitlines():
            if line.strip():
                yield line
        self.cx.execute(
            """INSERT INTO read_cursors (path, inode, bytes_read, mtime, last_read)
               VALUES (?,?,?,?,datetime('now'))
               ON CONFLICT(path) DO UPDATE SET
                 inode=excluded.inode, bytes_read=excluded.bytes_read,
                 mtime=excluded.mtime, last_read=excluded.last_read""",
            (self.mark + str(path), st.st_ino, start + cut + 1, st.st_mtime),
        )


def record_health(cx, source: str, ms: int, rows: int,
                  error: str | None = None, note: str | None = None):
    """
    Records every pass, including the ones that fail.

    `last_ok` only advances when there was NO error: that way the interface can
    say "this source has not been updated for 40 minutes and this is why"
    instead of showing an old number as if it were current.

    ERROR and NOTE are not the same thing, and mixing them up was costly:
    "Hermes does not record tokens" is a NOTE (Hermes works perfectly and loaded
    its rows), but stored as an error it made the sidebar paint Hermes, OpenClaw
    and OpenRouter grey, as if they were down. A dashboard that calls dead what
    is alive lies as much as one that makes things up.
    """
    ok = None if error else now()
    cx.execute(
        """INSERT INTO health (source, last_ok, last_attempt, ms, row_count, error, note)
           VALUES (?,?,?,?,?,?,?)
           ON CONFLICT(source) DO UPDATE SET
             last_ok      = COALESCE(excluded.last_ok, health.last_ok),
             last_attempt = excluded.last_attempt,
             ms = excluded.ms, row_count = excluded.row_count,
             error = excluded.error, note = excluded.note""",
        (source, ok, now(), ms, rows, error, note),
    )


def now() -> str:
    return time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
