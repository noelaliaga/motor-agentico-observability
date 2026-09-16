"""
Shared fixtures.

Before anything imports `comun`, the environment is pointed at a home that
does not exist. The reader resolves every source from MOTOR_* variables at
import time, so without this a test run on a developer machine would read the
real ~/.claude transcripts into a temporary database.
"""
from __future__ import annotations

import os
import sys
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
_CASA_VACIA = Path(__file__).resolve().parent / "_casa_inexistente"

for var in list(os.environ):
    if var.startswith("MOTOR_") or var.startswith("OPENROUTER_"):
        del os.environ[var]
os.environ["MOTOR_CASA"] = str(_CASA_VACIA)
os.environ["MOTOR_CRON_COMANDOS"] = "0"
os.environ["MOTOR_USUARIO"] = "Alex"

sys.path.insert(0, str(RAIZ / "lector"))

import pytest  # noqa: E402

import comun  # noqa: E402
import lector  # noqa: E402


@pytest.fixture
def cx(tmp_path):
    """A fresh motor database with the full schema and pricing seeded."""
    con = comun.abrir(escritura=True, base=tmp_path / "motor.sqlite")
    lector.preparar(con)
    lector._ultima.clear()
    yield con
    con.close()


@pytest.fixture
def casa(tmp_path, monkeypatch):
    """A throwaway home; RUTAS entries point inside it for the test only."""
    home = tmp_path / "home"
    home.mkdir()
    monkeypatch.setattr(comun, "CASA", home)
    monkeypatch.setitem(comun.RUTAS, "claude", home / ".claude")
    monkeypatch.setitem(comun.RUTAS, "claude_json", home / ".claude.json")
    monkeypatch.setitem(comun.RUTAS, "codex", home / ".codex")
    return home
