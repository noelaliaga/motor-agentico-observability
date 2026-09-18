"""What the reader must never store: secrets' names or values, emails, absolute home paths."""
from __future__ import annotations

import json

import common
from sources import connections, openrouter, plan


def test_mcp_env_variables_are_counted_not_copied(cx, home, monkeypatch):
    (home / ".claude.json").write_text(json.dumps({
        "claudeAiMcpEverConnected": ["claude.ai Notion"],
        "mcpServers": {"github": {"command": "npx", "env": {"SUPER_SECRET_NAME": "value-123"}}},
    }))
    monkeypatch.setattr(connections, "MCP_JSON", [])
    connections.read(cx)
    dump = json.dumps([tuple(r) for r in cx.execute("SELECT * FROM connections")])
    assert "SUPER_SECRET_NAME" not in dump and "value-123" not in dump
    assert "uses 1 environment variable" in dump


def test_plan_does_not_store_account_identity(cx, home):
    (home / ".claude.json").write_text(json.dumps({"oauthAccount": {
        "organizationRateLimitTier": "default_claude_pro", "emailAddress": "someone@example.com",
        "accountUuid": "0000-1111"}}))
    plan.read(cx)
    dump = json.dumps([tuple(r) for r in cx.execute("SELECT * FROM plan")])
    assert "Claude Pro" in dump
    assert "example.com" not in dump and "0000-1111" not in dump


def test_openrouter_without_key_is_a_note_and_makes_no_request(cx, monkeypatch):
    monkeypatch.delenv("OPENROUTER_API_KEY", raising=False)
    monkeypatch.setattr(openrouter, "_request", lambda *a: (_ for _ in ()).throw(AssertionError("network")))
    assert openrouter.read(cx) == 0
    error, note = cx.execute("SELECT error, note FROM health WHERE source='openrouter'").fetchone()
    assert error is None and "OPENROUTER_API_KEY" in note


def test_stored_paths_are_relative_to_home(cx, home, monkeypatch):
    skill = home / ".claude" / "skills" / "demo-skill"
    skill.mkdir(parents=True)
    (skill / "SKILL.md").write_text("---\nname: demo-skill\ndescription: x\n---\n")
    from sources import inventory
    monkeypatch.setattr(inventory, "MCP_JSON", [])
    inventory.read(cx)
    path = cx.execute("SELECT path FROM inventory WHERE name='demo-skill'").fetchone()[0]
    assert path == "~/.claude/skills/demo-skill"
    assert str(common.HOME) not in path


def test_mcp_url_secrets_are_not_stored(cx, home, monkeypatch):
    (home / ".claude.json").write_text(json.dumps({"mcpServers": {
        "remote": {"type": "sse", "url": "https://user:pw@mcp.example.com/sse?api_key=abc123"},
        "path": {"type": "http", "url": "https://mcp.example.com/v1/tok_9f8e7d6c5b4a39281706/mcp#frag"},
    }}))
    monkeypatch.setattr(connections, "MCP_JSON", [])
    connections.read(cx)
    dump = json.dumps([tuple(r) for r in cx.execute("SELECT * FROM connections")], ensure_ascii=False)
    for secret in ("abc123", "api_key", "user:pw", "tok_9f8e7d6c5b4a39281706", "frag"):
        assert secret not in dump, secret
    assert "https://mcp.example.com/sse" in dump
    assert "https://mcp.example.com/v1/…/mcp" in dump


def test_connectors_are_declared_not_connected(cx, home, monkeypatch):
    (home / ".claude.json").write_text(json.dumps({"claudeAiMcpEverConnected": ["claude.ai Notion"]}))
    monkeypatch.setattr(connections, "MCP_JSON", [])
    connections.read(cx)
    status, detail = cx.execute("SELECT status, detail FROM connections WHERE via='connector'").fetchone()
    assert status == "declared" and "at some point" in detail


def test_launchagent_arguments_are_not_stored(cx, home, monkeypatch):
    import plistlib

    from sources import cron
    folder = home / "Library" / "LaunchAgents"
    folder.mkdir(parents=True)
    (folder / "com.example.sync.plist").write_bytes(plistlib.dumps({
        "Label": "com.example.sync", "StartInterval": 600,
        "ProgramArguments": ["/usr/local/bin/sync-tool", "--token", "s3cr3t-value-0001"],
    }))
    monkeypatch.setitem(common.PATHS, "launchagents", folder)
    cron.read(cx)
    dump = json.dumps([tuple(r) for r in cx.execute("SELECT * FROM scheduled")])
    assert "s3cr3t" not in dump and "--token" not in dump
    assert "/usr/local/bin/sync-tool (+2 arguments)" in dump


def test_hermes_session_key_is_not_shown(cx, home, monkeypatch):
    import sqlite3

    from sources import hermes
    h = home / ".hermes"
    h.mkdir()
    db = sqlite3.connect(h / "state.db")
    db.executescript("""
        CREATE TABLE sessions (id TEXT, source TEXT, model TEXT, session_key TEXT, display_name TEXT);
        CREATE TABLE messages (session_id TEXT, timestamp TEXT, token_count INTEGER);
        INSERT INTO sessions VALUES ('s1', 'telegram', 'm', 'agent:main:telegram:dm:555000111', NULL);
        INSERT INTO sessions VALUES ('s2', 'cli', 'm', 'agent:main:cli:x', 'Named session');
        INSERT INTO messages VALUES ('s1', '2026-09-01T10:00:00Z', 0);
    """)
    db.commit()
    db.close()
    monkeypatch.setitem(common.PATHS, "hermes", h)
    hermes.read(cx)
    titles = dict(cx.execute("SELECT id, title FROM sessions WHERE source='hermes'").fetchall())
    assert titles["s2"] == "Named session"
    assert "555000111" not in titles["s1"] and titles["s1"].startswith("session ")


def test_demo_guard_flags_paths_outside_the_demo(tmp_path, monkeypatch):
    import importlib.util

    spec = importlib.util.spec_from_file_location("check_env",
                                                  common.ROOT / "demo" / "check_env.py")
    guard = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(guard)
    demo = tmp_path / "demo"
    home = demo / "home"
    monkeypatch.setattr(common, "HOME", home)
    monkeypatch.setattr(common, "DB", demo / "motor.sqlite")
    monkeypatch.setattr(common, "MCP_JSON", [])
    for k in list(common.PATHS):
        monkeypatch.setitem(common.PATHS, k, home / k)
    assert guard.outside(demo) == []
    monkeypatch.setitem(common.PATHS, "claude", tmp_path / "real-home" / ".claude")
    assert any("PATHS[claude]" in m for m in guard.outside(demo))
