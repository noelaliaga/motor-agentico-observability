"""What the reader must never store: secrets' names or values, emails, absolute home paths."""
from __future__ import annotations

import json

import comun
from fuentes import conexiones, openrouter, plan


def test_mcp_env_variables_are_counted_not_copied(cx, casa, monkeypatch):
    (casa / ".claude.json").write_text(json.dumps({
        "claudeAiMcpEverConnected": ["claude.ai Notion"],
        "mcpServers": {"github": {"command": "npx", "env": {"SUPER_SECRET_NAME": "value-123"}}},
    }))
    monkeypatch.setattr(conexiones, "MCP_JSON", [])
    conexiones.leer(cx)
    volcado = json.dumps([tuple(r) for r in cx.execute("SELECT * FROM conexiones")])
    assert "SUPER_SECRET_NAME" not in volcado and "value-123" not in volcado
    assert "usa 1 variable" in volcado


def test_plan_does_not_store_account_identity(cx, casa):
    (casa / ".claude.json").write_text(json.dumps({"oauthAccount": {
        "organizationRateLimitTier": "default_claude_pro", "emailAddress": "someone@example.com",
        "accountUuid": "0000-1111"}}))
    plan.leer(cx)
    volcado = json.dumps([tuple(r) for r in cx.execute("SELECT * FROM plan")])
    assert "Claude Pro" in volcado
    assert "example.com" not in volcado and "0000-1111" not in volcado


def test_openrouter_without_key_is_a_note_and_makes_no_request(cx, monkeypatch):
    monkeypatch.delenv("OPENROUTER_API_KEY", raising=False)
    monkeypatch.setattr(openrouter, "_pedir", lambda *a: (_ for _ in ()).throw(AssertionError("network")))
    assert openrouter.leer(cx) == 0
    error, nota = cx.execute("SELECT error, nota FROM salud WHERE fuente='openrouter'").fetchone()
    assert error is None and "OPENROUTER_API_KEY" in nota


def test_stored_paths_are_relative_to_home(cx, casa, monkeypatch):
    skill = casa / ".claude" / "skills" / "demo-skill"
    skill.mkdir(parents=True)
    (skill / "SKILL.md").write_text("---\nname: demo-skill\ndescription: x\n---\n")
    from fuentes import inventario
    monkeypatch.setattr(inventario, "MCP_JSON", [])
    inventario.leer(cx)
    ruta = cx.execute("SELECT ruta FROM inventario WHERE nombre='demo-skill'").fetchone()[0]
    assert ruta == "~/.claude/skills/demo-skill"
    assert str(comun.CASA) not in ruta


def test_mcp_url_secrets_are_not_stored(cx, casa, monkeypatch):
    (casa / ".claude.json").write_text(json.dumps({"mcpServers": {
        "remoto": {"type": "sse", "url": "https://user:pw@mcp.example.com/sse?api_key=abc123"},
        "ruta": {"type": "http", "url": "https://mcp.example.com/v1/tok_9f8e7d6c5b4a39281706/mcp#frag"},
    }}))
    monkeypatch.setattr(conexiones, "MCP_JSON", [])
    conexiones.leer(cx)
    volcado = json.dumps([tuple(r) for r in cx.execute("SELECT * FROM conexiones")], ensure_ascii=False)
    for secreto in ("abc123", "api_key", "user:pw", "tok_9f8e7d6c5b4a39281706", "frag"):
        assert secreto not in volcado, secreto
    assert "https://mcp.example.com/sse" in volcado
    assert "https://mcp.example.com/v1/…/mcp" in volcado


def test_connectors_are_declared_not_connected(cx, casa, monkeypatch):
    (casa / ".claude.json").write_text(json.dumps({"claudeAiMcpEverConnected": ["claude.ai Notion"]}))
    monkeypatch.setattr(conexiones, "MCP_JSON", [])
    conexiones.leer(cx)
    estado, detalle = cx.execute("SELECT estado, detalle FROM conexiones WHERE via='conector'").fetchone()
    assert estado == "declarada" and "alguna vez" in detalle


def test_launchagent_arguments_are_not_stored(cx, casa, monkeypatch):
    import plistlib

    from fuentes import cron
    carpeta = casa / "Library" / "LaunchAgents"
    carpeta.mkdir(parents=True)
    (carpeta / "com.example.sync.plist").write_bytes(plistlib.dumps({
        "Label": "com.example.sync", "StartInterval": 600,
        "ProgramArguments": ["/usr/local/bin/sync-tool", "--token", "s3cr3t-value-0001"],
    }))
    monkeypatch.setitem(comun.RUTAS, "launchagents", carpeta)
    cron.leer(cx)
    volcado = json.dumps([tuple(r) for r in cx.execute("SELECT * FROM programado")])
    assert "s3cr3t" not in volcado and "--token" not in volcado
    assert "/usr/local/bin/sync-tool (+2 argumentos)" in volcado


def test_hermes_session_key_is_not_shown(cx, casa, monkeypatch):
    import sqlite3

    from fuentes import hermes
    h = casa / ".hermes"
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
    monkeypatch.setitem(comun.RUTAS, "hermes", h)
    hermes.leer(cx)
    titulos = dict(cx.execute("SELECT id, titulo FROM sesiones WHERE fuente='hermes'").fetchall())
    assert titulos["s2"] == "Named session"
    assert "555000111" not in titulos["s1"] and titulos["s1"].startswith("sesión ")


def test_demo_guard_flags_paths_outside_the_demo(tmp_path, monkeypatch):
    import importlib.util

    spec = importlib.util.spec_from_file_location("comprobar_entorno",
                                                  comun.RAIZ / "demo" / "comprobar_entorno.py")
    guarda = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(guarda)
    demo = tmp_path / "demo"
    home = demo / "home"
    monkeypatch.setattr(comun, "CASA", home)
    monkeypatch.setattr(comun, "BASE", demo / "motor.sqlite")
    monkeypatch.setattr(comun, "MCP_JSON", [])
    for k in list(comun.RUTAS):
        monkeypatch.setitem(comun.RUTAS, k, home / k)
    assert guarda.fuera(demo) == []
    monkeypatch.setitem(comun.RUTAS, "claude", tmp_path / "real-home" / ".claude")
    assert any("RUTAS[claude]" in m for m in guarda.fuera(demo))
