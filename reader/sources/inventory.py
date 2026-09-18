"""
Inventory · what is declared, used or not.

Agents and skills spread across several places. The point is not to list
them: it is to CROSS them with what was really invoked, which comes from
`invocations`. An inventory without usage is a catalogue; with usage, it is a
diagnosis, and in real use the diagnosis was that there were dozens of agents
defined and none ever invoked.

The same name can be declared in three different scopes. That is why the key
is (kind, name, scope) and not just the name.
"""
from __future__ import annotations

import json
import time
from pathlib import Path

from common import MCP_JSON, PATHS, record_health, shorten

SOURCE = "inventory"

# (folder inside MOTOR_CLAUDE, scope): where each thing comes from
AGENTS = [("agents", "global")]
SKILLS = [("skills", "global")]


def _frontmatter(path: Path) -> dict:
    """The YAML block at the top of the .md. No dependencies: only three
    fields are needed and a full parser here would bring in a library for nothing."""
    try:
        txt = path.read_text(errors="ignore")[:4000]
    except OSError:
        return {}
    if not txt.startswith("---"):
        return {}
    end = txt.find("\n---", 3)
    if end < 0:
        return {}
    fields, key = {}, None
    for line in txt[3:end].splitlines():
        if not line.strip() or line.strip().startswith("#"):
            continue
        if line[0] not in " \t-" and ":" in line:
            key, _, v = line.partition(":")
            key = key.strip()
            fields[key] = v.strip().strip("\"'").lstrip(">|").strip()
        elif key and line.strip():
            fields[key] = (fields.get(key, "") + " " + line.strip()).strip()
    return fields


def _home(rel: str) -> Path:
    return Path(PATHS["claude"]) / rel


def read(cx) -> int:
    t0, n = time.time(), 0

    for rel, scope in AGENTS:
        d = _home(rel)
        if not d.is_dir():
            continue
        for f in sorted(d.glob("*.md")):
            fm = _frontmatter(f)
            cx.execute(
                """INSERT INTO inventory (kind,name,scope,path,description,model,modified)
                   VALUES ('agent',?,?,?,?,?,?)
                   ON CONFLICT(kind,name,scope) DO UPDATE SET
                     description=excluded.description, model=excluded.model,
                     modified=excluded.modified""",
                (fm.get("name") or f.stem, scope, shorten(f),
                 (fm.get("description") or "")[:400], fm.get("model"),
                 time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(f.stat().st_mtime))),
            )
            n += 1

    for rel, scope in SKILLS:
        d = _home(rel)
        if not d.is_dir():
            continue
        for sub in sorted(p for p in d.iterdir() if p.is_dir()):
            md = sub / "SKILL.md"
            fm = _frontmatter(md) if md.exists() else {}
            cx.execute(
                """INSERT INTO inventory (kind,name,scope,path,description,modified)
                   VALUES ('skill',?,?,?,?,?)
                   ON CONFLICT(kind,name,scope) DO UPDATE SET
                     description=excluded.description, modified=excluded.modified""",
                (fm.get("name") or sub.name, scope, shorten(sub),
                 (fm.get("description") or "")[:400],
                 time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(sub.stat().st_mtime))),
            )
            n += 1

    # ── MCPs and plugins ─────────────────────────────────────────────────
    for cfg, scope in [(p, "project") for p in MCP_JSON]:
        if not cfg.exists():
            continue
        try:
            for name, v in (json.loads(cfg.read_text()).get("mcpServers") or {}).items():
                cx.execute(
                    """INSERT INTO inventory (kind,name,scope,path,description)
                       VALUES ('mcp',?,?,?,?)
                       ON CONFLICT(kind,name,scope) DO UPDATE SET description=excluded.description""",
                    (name, scope, shorten(cfg), (v.get("command") or v.get("url") or "")[:200]),
                )
                n += 1
        except Exception:
            pass

    pl = PATHS["claude"] / "plugins" / "installed_plugins.json"
    if pl.exists():
        try:
            for name, vs in (json.loads(pl.read_text()).get("plugins") or {}).items():
                v = (vs or [{}])[0]
                cx.execute(
                    """INSERT INTO inventory (kind,name,scope,path,description,modified)
                       VALUES ('plugin',?, 'global', ?, ?, ?)
                       ON CONFLICT(kind,name,scope) DO UPDATE SET description=excluded.description""",
                    (name, shorten(v.get("installPath")), f"v{v.get('version')}", v.get("lastUpdated")),
                )
                n += 1
        except Exception:
            pass

    # ── the cross that turns the catalogue into a diagnosis ──────────────
    cx.execute("""
        UPDATE inventory SET
          uses = COALESCE((SELECT COUNT(*) FROM invocations i
                            WHERE i.kind = inventory.kind AND i.name = inventory.name), 0),
          last_used = COALESCE((SELECT MAX(i.ts) FROM invocations i
                            WHERE i.kind = inventory.kind AND i.name = inventory.name),
                            inventory.last_used)
        WHERE scope <> 'hermes'""")

    record_health(cx, SOURCE, int((time.time() - t0) * 1000), n, None)
    return n
