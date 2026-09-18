"""
Shared fixtures.

Before anything imports `common`, the environment is pointed at a home that
does not exist. The reader resolves every source from MOTOR_* variables at
import time, so without this a test run on a developer machine would read the
real ~/.claude transcripts into a temporary database.
"""
from __future__ import annotations

import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
_EMPTY_HOME = Path(__file__).resolve().parent / "_missing_home"

for var in list(os.environ):
    if var.startswith("MOTOR_") or var.startswith("OPENROUTER_"):
        del os.environ[var]
os.environ["MOTOR_HOME"] = str(_EMPTY_HOME)
os.environ["MOTOR_CRON_COMMANDS"] = "0"
os.environ["MOTOR_USER"] = "Alex"

sys.path.insert(0, str(ROOT / "reader"))

import pytest  # noqa: E402

import common  # noqa: E402
import reader  # noqa: E402


@pytest.fixture
def cx(tmp_path):
    """A fresh motor database with the full schema and pricing seeded."""
    con = common.open_db(write=True, db=tmp_path / "motor.sqlite")
    reader.prepare(con)
    reader._last_run.clear()
    yield con
    con.close()


@pytest.fixture
def home(tmp_path, monkeypatch):
    """A throwaway home; PATHS entries point inside it for the test only."""
    home = tmp_path / "home"
    home.mkdir()
    monkeypatch.setattr(common, "HOME", home)
    monkeypatch.setitem(common.PATHS, "claude", home / ".claude")
    monkeypatch.setitem(common.PATHS, "claude_json", home / ".claude.json")
    monkeypatch.setitem(common.PATHS, "codex", home / ".codex")
    return home
