"""The nightly review, with the model call mocked: nothing here reaches a network."""
from __future__ import annotations

import json
import types

import pytest

import sonar


def respuesta(texto: str, coste: float = 0.01):
    salida = json.dumps({"result": texto, "total_cost_usd": coste, "duration_ms": 900})
    return types.SimpleNamespace(returncode=0, stdout=salida, stderr="")


@pytest.fixture(autouse=True)
def sin_red(monkeypatch):
    def prohibido(*a, **k):
        raise AssertionError("the test tried to run a real subprocess")
    monkeypatch.setattr(sonar.subprocess, "run", prohibido)
    monkeypatch.setattr(sonar.lector, "pasada", lambda cx, *a, **k: {})


def test_extract_json_with_fences_and_prose():
    assert sonar.extraer_json('```json\n[{"i": 0}]\n```') == [{"i": 0}]
    assert sonar.extraer_json('Here you go:\n[{"i": 1}]\nThanks') == [{"i": 1}]
    assert sonar.extraer_json('```\n[{"note": "json and more"}]\n```') == [{"note": "json and more"}]


def test_user_name_is_configurable():
    assert "Alex" in sonar.SISTEMA and "Alex" in sonar.LECTOR
    assert "__USUARIO__" not in sonar.SISTEMA + sonar.LECTOR


def test_invented_quote_is_discarded(monkeypatch):
    intercambios = [{"ts": f"2026-09-10T10:0{i}:00Z", "proyecto": "webshop",
                     "tuyo": f"prompt {i}", "suyo": "ok"} for i in range(6)]
    intercambios[2]["tuyo"] = "hazlo más corto, sin adornos"
    monkeypatch.setattr(sonar.conversaciones, "recientes", lambda horas: intercambios)
    notas = [
        {"titulo": "Real", "cuerpo": "c", "cita": "«hazlo más corto, sin adornos»", "prompt": "p"},
        {"titulo": "Invented", "cuerpo": "c", "cita": "nunca escribí esto", "prompt": "p"},
    ]
    monkeypatch.setattr(sonar.subprocess, "run",
                        lambda *a, **k: respuesta("```json\n" + json.dumps(notas) + "\n```"))

    fuera = sonar.leer_conversaciones(cx=None)

    assert [n["titulo"] for n in fuera] == ["Real"]
    assert fuera[0]["origen"] == "leído"


def test_quote_with_real_prefix_and_invented_tail_is_discarded(monkeypatch):
    intercambios = [{"ts": f"2026-09-10T10:0{i}:00Z", "proyecto": "webshop",
                     "tuyo": f"prompt {i}", "suyo": "ok"} for i in range(6)]
    intercambios[2]["tuyo"] = "hazlo  más corto, sin adornos"
    monkeypatch.setattr(sonar.conversaciones, "recientes", lambda horas: intercambios)
    notas = [
        {"titulo": "Tail", "cuerpo": "c", "prompt": "p",
         "cita": "hazlo más corto, sin adornos, y además insulta al cliente de ACME"},
        {"titulo": "Too short", "cuerpo": "c", "prompt": "p", "cita": "hazlo"},
        {"titulo": "Spacing", "cuerpo": "c", "prompt": "p", "cita": "“Hazlo más corto, sin adornos”"},
    ]
    monkeypatch.setattr(sonar, "CUANTAS_LEIDAS", 3)
    monkeypatch.setattr(sonar.subprocess, "run", lambda *a, **k: respuesta(json.dumps(notas)))

    fuera = sonar.leer_conversaciones(cx=None)

    # only the full, normalised quote survives
    assert [n["titulo"] for n in fuera] == ["Spacing"]


def hallazgos(*huellas):
    return [{"categoria": "coste", "asunto": f"asunto {h}", "hechos": [f"hecho {h}"],
             "accion": None, "huella": h} for h in huellas]


def test_reading_conversations_is_off_by_default(cx, monkeypatch):
    monkeypatch.delenv("MOTOR_SUENO_LEE", raising=False)
    monkeypatch.setattr(sonar.detectores, "hallar", lambda c: hallazgos("cache·x·1"))
    monkeypatch.setattr(sonar, "leer_conversaciones",
                        lambda c: (_ for _ in ()).throw(AssertionError("must not read conversations")))
    llamadas = []

    def falso(cmd, **k):
        llamadas.append(cmd)
        return respuesta('[{"i": 0, "titulo": "Título", "cuerpo": "Cuerpo", "prompt": "Haz X"}]')

    monkeypatch.setattr(sonar.subprocess, "run", falso)

    assert sonar.sonar(cx=cx) == 1
    fila = cx.execute("SELECT titulo, accion, gancho, origen, estado FROM sueno").fetchone()
    assert tuple(fila) == ("Título", "Haz X", "Aprovecha la caché", "medido", "nueva")
    # the model runs with no tools, no MCP servers and none of the user's settings
    cmd = llamadas[0]
    i = cmd.index("--tools")
    assert cmd[i + 1] == ""
    assert "--strict-mcp-config" in cmd and "--mcp-config" not in cmd
    j = cmd.index("--setting-sources")
    assert cmd[j + 1] == ""


def test_model_runs_in_an_empty_working_directory(monkeypatch):
    vistos = {}

    def falso(cmd, **k):
        vistos["cwd"] = k.get("cwd")
        from pathlib import Path
        vistos["vacio"] = not any(Path(k["cwd"]).iterdir())
        return respuesta("[]")

    monkeypatch.setattr(sonar.subprocess, "run", falso)
    sonar._llamar("hola")
    assert vistos["cwd"] and vistos["vacio"]


def test_dry_run_with_save_never_calls_the_model(cx, monkeypatch):
    monkeypatch.setattr(sonar.detectores, "hallar", lambda c: hallazgos("memoria·1", "foco·p·7"))
    pedidas = []
    monkeypatch.setattr(sonar.lector, "pasada", lambda cx, *a, **k: pedidas.append(k.get("fuentes")) or {})
    assert sonar.sonar(seco=True, guardar=True, cx=cx) == 2
    # the dry run's pre-pass skips the only network source
    assert pedidas and pedidas[0] is not None and "openrouter" not in pedidas[0]
    assert cx.execute("SELECT COUNT(*) FROM sueno WHERE origen='medido'").fetchone()[0] == 2


def test_note_whose_condition_disappears_is_marked_resuelta(cx, monkeypatch):
    cx.execute("""INSERT INTO sueno (fecha, categoria, titulo, cuerpo, estado, huella)
                  VALUES ('2026-09-01', 'coste', 't', 'c', 'nueva', 'vieja·1')""")
    monkeypatch.setattr(sonar.detectores, "hallar", lambda c: [])
    sonar.sonar(seco=True, cx=cx)
    # "resuelta" = the condition no longer holds. It does NOT mean someone applied it.
    assert cx.execute("SELECT estado FROM sueno WHERE huella='vieja·1'").fetchone()[0] == "resuelta"
