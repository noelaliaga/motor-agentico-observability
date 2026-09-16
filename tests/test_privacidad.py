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
