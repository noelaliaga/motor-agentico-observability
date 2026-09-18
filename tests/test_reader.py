"""Health bookkeeping, fault isolation between sources, schema and migrations."""
from __future__ import annotations

import sqlite3
import sys
import types

import common
import reader


def health_row(cx, source):
    return cx.execute("SELECT last_ok, error, note FROM health WHERE source=?", (source,)).fetchone()


def test_error_does_not_advance_last_ok(cx, monkeypatch):
    monkeypatch.setattr(common, "now", lambda: "2026-09-10T10:00:00Z")
    common.record_health(cx, "x", 5, 3)
    assert tuple(health_row(cx, "x")) == ("2026-09-10T10:00:00Z", None, None)

    monkeypatch.setattr(common, "now", lambda: "2026-09-10T11:00:00Z")
    common.record_health(cx, "x", 5, 0, error="boom")
    last_ok, error, _ = health_row(cx, "x")
    assert last_ok == "2026-09-10T10:00:00Z"      # still the last GOOD pass
    assert error == "boom"


def test_note_is_not_an_error(cx, monkeypatch):
    monkeypatch.setattr(common, "now", lambda: "2026-09-10T12:00:00Z")
    common.record_health(cx, "hermes", 5, 42, note="does not record tokens")
    assert tuple(health_row(cx, "hermes")) == ("2026-09-10T12:00:00Z", None, "does not record tokens")


def test_a_failing_source_does_not_take_down_the_others(cx, monkeypatch):
    def broken(con):
        con.execute("INSERT INTO motor_state VALUES ('half_done', '1')")   # must be rolled back
        raise RuntimeError("boom")

    def healthy(con):
        common.record_health(con, "healthy", 1, 7)
        return 7

    monkeypatch.setitem(sys.modules, "sources.broken", types.SimpleNamespace(read=broken))
    monkeypatch.setitem(sys.modules, "sources.healthy", types.SimpleNamespace(read=healthy))

    done = reader.run_pass(cx, sources=["broken", "healthy"])

    assert done == {"healthy": 7}
    assert health_row(cx, "broken")["error"] == "RuntimeError: boom"
    assert health_row(cx, "healthy")["error"] is None
    assert cx.execute("SELECT COUNT(*) FROM motor_state WHERE name='half_done'").fetchone()[0] == 0


def test_unconfigured_optional_adapter_is_skipped(cx, monkeypatch):
    monkeypatch.setitem(common.PATHS, "multiverso", None)
    reader.run_pass(cx, sources=["multiverso"])
    assert health_row(cx, "multiverso") is None


def test_schema_is_one_file_with_18_tables(cx):
    tables = {r[0] for r in cx.execute("SELECT name FROM sqlite_master WHERE type='table'")}
    assert len(tables) == 18
    assert {"scheduled", "connections", "plan", "rate_limits"} <= tables


def test_migrate_an_old_database(tmp_path):
    path = tmp_path / "old.sqlite"
    old = sqlite3.connect(path)
    # The first version: no memory.type, health.note, review_notes.origin or review_notes.hook.
    old.executescript("""
        CREATE TABLE memory (path TEXT PRIMARY KEY, system TEXT NOT NULL, title TEXT,
                             modified TEXT, days_untouched INTEGER, bytes INTEGER,
                             links_out INTEGER DEFAULT 0, links_in INTEGER DEFAULT 0);
        CREATE TABLE health (source TEXT PRIMARY KEY, last_ok TEXT, last_attempt TEXT,
                             ms INTEGER, row_count INTEGER, error TEXT);
        CREATE TABLE review_notes (id INTEGER PRIMARY KEY, day TEXT NOT NULL, category TEXT NOT NULL,
                                   title TEXT NOT NULL, body TEXT NOT NULL, evidence TEXT, action TEXT,
                                   status TEXT NOT NULL DEFAULT 'new', fingerprint TEXT UNIQUE);
        INSERT INTO review_notes (day, category, title, body, fingerprint) VALUES ('2026-08-01','cost','t','c','h');
    """)
    old.commit()
    old.close()

    cx = common.open_db(write=True, db=path)
    reader.prepare(cx)

    def columns(t):
        return {r[1] for r in cx.execute(f"PRAGMA table_info({t})")}

    assert "type" in columns("memory")
    assert "note" in columns("health")
    assert {"origin", "hook"} <= columns("review_notes")
    assert cx.execute("SELECT COUNT(*) FROM review_notes").fetchone()[0] == 1   # data survives
    common.record_health(cx, "x", 1, 1, note="works after migration")
    cx.close()


def test_short_paths_hide_the_home_directory(monkeypatch, tmp_path):
    monkeypatch.setattr(common, "HOME", tmp_path)
    assert common.shorten(tmp_path / ".claude" / "skills") == "~/.claude/skills"
    assert common.shorten("/opt/other") == "/opt/other"
