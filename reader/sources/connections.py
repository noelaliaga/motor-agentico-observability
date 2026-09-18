"""
Everything you have plugged in.

Two routes, both by reading configuration files:

  connector  the claude.ai connectors the account has enabled, as
             `~/.claude.json` records them (MOTOR_CLAUDE_JSON)
  mcp        the declared MCP servers: those in `~/.claude.json` and those in
             every `.mcp.json` listed in MOTOR_MCP_JSON

SECURITY RULE, NO EXCEPTIONS: this reader opens no `.env`. From an MCP
server's declaration it stores the name, the executable or the SANITISED URL
(scheme, host and path without the query, with long segments masked: some
remote servers carry the key in the URL itself) and HOW MANY environment
variables it uses, never their names or values. The command's arguments are
not stored.
"""
from __future__ import annotations

import json
import re
import time
from pathlib import Path
from urllib.parse import urlsplit

from common import MCP_JSON, PATHS, record_health, shorten

SOURCE = "connections"


def _brand(name: str) -> str:
    """
    The reader does NOT decide the brand: it stores the lower-case name and
    lets the interface pick the logo. Guessing it wrong here was costly:
    Gmail, Drive and Calendar ended up with the OpenAI icon.
    """
    return name.lower()


# A path segment that looks like a secret: long, or a run of hex/base64.
_LOOKS_SECRET = re.compile(r"^(?=.*\d)[A-Za-z0-9_\-.=+]{16,}$")


def safe_url(url: str) -> str:
    """
    `scheme://host/path`, without user, password, query or fragment, and with
    any segment that looks like a token replaced by "…".
    """
    try:
        u = urlsplit(url.strip())
    except ValueError:
        return "unreadable url"
    if not u.scheme or not u.hostname:
        return "unreadable url"
    host = u.hostname + (f":{u.port}" if u.port else "")
    segments = ["…" if _LOOKS_SECRET.match(s) else s for s in u.path.split("/")]
    path = "/".join(segments).rstrip("/")
    return f"{u.scheme}://{host}{path}"


def _detail(where: str, v: dict) -> str:
    if v.get("command"):
        how = str(v["command"])
        how = shorten(how) if how.startswith("/") else how
    elif v.get("url"):
        how = safe_url(str(v["url"]))
    else:
        how = ""
    detail = f"{where} · {how}"[:160]
    keys = len(v.get("env") or {})
    if keys:
        detail += f" · uses {keys} environment {'variable' if keys == 1 else 'variables'}"
    return detail


def read(cx) -> int:
    t0, n = time.time(), 0
    cx.execute("DELETE FROM connections")      # it is a snapshot, not a history

    def put(ident, name, via, brand, detail, status, origin):
        cx.execute("INSERT OR REPLACE INTO connections VALUES (?,?,?,?,?,?,?,0,NULL)",
                   (ident, name, via, brand, detail, status, origin))

    # ── 1 · ~/.claude.json: claude.ai connectors and user MCP servers ────
    cfg: Path | None = PATHS["claude_json"]
    if cfg is not None and cfg.exists():
        try:
            d = json.loads(cfg.read_text())
        except Exception as e:
            record_health(cx, SOURCE, int((time.time() - t0) * 1000), 0,
                          f"{shorten(cfg)} unreadable: {type(e).__name__}")
            return 0
        for name in d.get("claudeAiMcpEverConnected") or []:
            clean = str(name).replace("claude.ai ", "")
            # `claudeAiMcpEverConnected` only says it was connected AT SOME
            # POINT. It does not prove it works today: hence "declared", not
            # "connected".
            put(f"connector:{clean}", clean, "connector", _brand(clean),
                "connected at some point from your Claude account", "declared", shorten(cfg))
            n += 1
        for name, v in (d.get("mcpServers") or {}).items():
            if isinstance(v, dict):
                put(f"mcp:{name}", name, "mcp", _brand(name),
                    _detail("user", v), "declared", shorten(cfg))
                n += 1

    # ── 2 · your projects' .mcp.json files ───────────────────────────────
    for path in MCP_JSON:
        if not path.exists():
            continue
        try:
            servers = json.loads(path.read_text()).get("mcpServers") or {}
        except Exception:
            continue
        for name, v in servers.items():
            if isinstance(v, dict):
                put(f"mcp:{name}", name, "mcp", _brand(name),
                    _detail(path.parent.name or "project", v), "declared", shorten(path))
                n += 1

    # ── 3 · what has really been used ────────────────────────────────────
    cx.execute("""
        UPDATE connections SET
          uses = COALESCE((SELECT COUNT(*) FROM invocations i
                            WHERE i.kind='mcp'
                              AND (LOWER(i.name) = LOWER(connections.name)
                                OR LOWER(i.name) LIKE '%'||LOWER(REPLACE(connections.name,' ',''))||'%')), 0),
          last_used = (SELECT MAX(i.ts) FROM invocations i
                         WHERE i.kind='mcp'
                           AND (LOWER(i.name) = LOWER(connections.name)
                             OR LOWER(i.name) LIKE '%'||LOWER(REPLACE(connections.name,' ',''))||'%'))""")

    record_health(cx, SOURCE, int((time.time() - t0) * 1000), n, None,
                  note="Only declared configuration is read: a connector or an MCP server "
                       "being here does not prove it answers.")
    return n
