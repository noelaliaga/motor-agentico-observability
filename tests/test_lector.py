"""Health bookkeeping, fault isolation between sources, schema and migrations."""
from __future__ import annotations

import sqlite3
import sys
import types

import comun
import lector


def fila_salud(cx, fuente):
    return cx.execute("SELECT ultima_ok, error, nota FROM salud WHERE fuente=?", (fuente,)).fetchone()


def test_error_does_not_advance_last_ok(cx, monkeypatch):
    monkeypatch.setattr(comun, "ahora", lambda: "2026-09-10T10:00:00Z")
    comun.anotar_salud(cx, "x", 5, 3)
    assert tuple(fila_salud(cx, "x")) == ("2026-09-10T10:00:00Z", None, None)

    monkeypatch.setattr(comun, "ahora", lambda: "2026-09-10T11:00:00Z")
    comun.anotar_salud(cx, "x", 5, 0, error="boom")
    ultima_ok, error, _ = fila_salud(cx, "x")
    assert ultima_ok == "2026-09-10T10:00:00Z"      # still the last GOOD pass
    assert error == "boom"


def test_note_is_not_an_error(cx, monkeypatch):
    monkeypatch.setattr(comun, "ahora", lambda: "2026-09-10T12:00:00Z")
    comun.anotar_salud(cx, "hermes", 5, 42, nota="does not record tokens")
    assert tuple(fila_salud(cx, "hermes")) == ("2026-09-10T12:00:00Z", None, "does not record tokens")


def test_a_failing_source_does_not_take_down_the_others(cx, monkeypatch):
    def rota(con):
        con.execute("INSERT INTO state_motor VALUES ('a_medias', '1')")   # must be rolled back
        raise RuntimeError("boom")

    def sana(con):
        comun.anotar_salud(con, "sana", 1, 7)
        return 7

    monkeypatch.setitem(sys.modules, "fuentes.rota", types.SimpleNamespace(leer=rota))
    monkeypatch.setitem(sys.modules, "fuentes.sana", types.SimpleNamespace(leer=sana))

    hecho = lector.pasada(cx, fuentes=["rota", "sana"])

    assert hecho == {"sana": 7}
    assert fila_salud(cx, "rota")["error"] == "RuntimeError: boom"
    assert fila_salud(cx, "sana")["error"] is None
    assert cx.execute("SELECT COUNT(*) FROM state_motor WHERE clave='a_medias'").fetchone()[0] == 0


def test_unconfigured_optional_adapter_is_skipped(cx, monkeypatch):
    monkeypatch.setitem(comun.RUTAS, "multiverso", None)
    lector.pasada(cx, fuentes=["multiverso"])
    assert fila_salud(cx, "multiverso") is None


def test_schema_is_one_file_with_18_tables(cx):
    tablas = {r[0] for r in cx.execute("SELECT name FROM sqlite_master WHERE type='table'")}
    assert len(tablas) == 18
    assert {"programado", "conexiones", "plan", "topes"} <= tablas


def test_migrate_an_old_database(tmp_path):
    ruta = tmp_path / "vieja.sqlite"
    vieja = sqlite3.connect(ruta)
    # The first version: no memoria.tipo, salud.nota, sueno.origen or sueno.gancho.
    vieja.executescript("""
        CREATE TABLE memoria (ruta TEXT PRIMARY KEY, sistema TEXT NOT NULL, titulo TEXT,
                              modificado TEXT, dias_sin_tocar INTEGER, bytes INTEGER,
                              enlaces_salen INTEGER DEFAULT 0, enlaces_entran INTEGER DEFAULT 0);
        CREATE TABLE salud (fuente TEXT PRIMARY KEY, ultima_ok TEXT, ultima_intento TEXT,
                            ms INTEGER, filas INTEGER, error TEXT);
        CREATE TABLE sueno (id INTEGER PRIMARY KEY, fecha TEXT NOT NULL, categoria TEXT NOT NULL,
                            titulo TEXT NOT NULL, cuerpo TEXT NOT NULL, evidencia TEXT, accion TEXT,
                            estado TEXT NOT NULL DEFAULT 'nueva', huella TEXT UNIQUE);
        INSERT INTO sueno (fecha, categoria, titulo, cuerpo, huella) VALUES ('2026-08-01','coste','t','c','h');
    """)
    vieja.commit()
    vieja.close()

    cx = comun.abrir(escritura=True, base=ruta)
    lector.preparar(cx)

    def columnas(t):
        return {r[1] for r in cx.execute(f"PRAGMA table_info({t})")}

    assert "tipo" in columnas("memoria")
    assert "nota" in columnas("salud")
    assert {"origen", "gancho"} <= columnas("sueno")
    assert cx.execute("SELECT COUNT(*) FROM sueno").fetchone()[0] == 1   # data survives
    comun.anotar_salud(cx, "x", 1, 1, nota="works after migration")
    cx.close()


def test_short_paths_hide_the_home_directory(monkeypatch, tmp_path):
    monkeypatch.setattr(comun, "CASA", tmp_path)
    assert comun.corta(tmp_path / ".claude" / "skills") == "~/.claude/skills"
    assert comun.corta("/opt/other") == "/opt/other"
