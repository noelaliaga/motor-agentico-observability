"""The nightly review, with the model call mocked: nothing here reaches a network."""
from __future__ import annotations

import json
import types

import pytest

import review


def answer(text: str, cost: float = 0.01):
    out = json.dumps({"result": text, "total_cost_usd": cost, "duration_ms": 900})
    return types.SimpleNamespace(returncode=0, stdout=out, stderr="")


@pytest.fixture(autouse=True)
def no_network(monkeypatch):
    def forbidden(*a, **k):
        raise AssertionError("the test tried to run a real subprocess")
    monkeypatch.setattr(review.subprocess, "run", forbidden)
    monkeypatch.setattr(review.reader, "run_pass", lambda cx, *a, **k: {})


def test_extract_json_with_fences_and_prose():
    assert review.extract_json('```json\n[{"i": 0}]\n```') == [{"i": 0}]
    assert review.extract_json('Here you go:\n[{"i": 1}]\nThanks') == [{"i": 1}]
    assert review.extract_json('```\n[{"note": "json and more"}]\n```') == [{"note": "json and more"}]


def test_user_name_is_configurable():
    assert "Alex" in review.SYSTEM_PROMPT and "Alex" in review.READER_PROMPT
    assert "__USER__" not in review.SYSTEM_PROMPT + review.READER_PROMPT


# The model's answers below use the JSON keys the (Spanish) prompts ask for:
# "titulo", "cuerpo", "cita", "prompt".
def test_invented_quote_is_discarded(monkeypatch):
    exchanges = [{"ts": f"2026-09-10T10:0{i}:00Z", "project": "webshop",
                  "yours": f"prompt {i}", "theirs": "ok"} for i in range(6)]
    exchanges[2]["yours"] = "make it shorter, no frills"
    monkeypatch.setattr(review.conversations, "recent", lambda hours: exchanges)
    notes = [
        {"titulo": "Real", "cuerpo": "c", "cita": "«make it shorter, no frills»", "prompt": "p"},
        {"titulo": "Invented", "cuerpo": "c", "cita": "I never wrote this", "prompt": "p"},
    ]
    monkeypatch.setattr(review.subprocess, "run",
                        lambda *a, **k: answer("```json\n" + json.dumps(notes) + "\n```"))

    out = review.read_conversations(cx=None)

    assert [n["title"] for n in out] == ["Real"]
    assert out[0]["origin"] == "read"


def test_quote_with_real_prefix_and_invented_tail_is_discarded(monkeypatch):
    exchanges = [{"ts": f"2026-09-10T10:0{i}:00Z", "project": "webshop",
                  "yours": f"prompt {i}", "theirs": "ok"} for i in range(6)]
    exchanges[2]["yours"] = "make it  shorter, no frills"
    monkeypatch.setattr(review.conversations, "recent", lambda hours: exchanges)
    notes = [
        {"titulo": "Tail", "cuerpo": "c", "prompt": "p",
         "cita": "make it shorter, no frills, and also insult the ACME customer"},
        {"titulo": "Too short", "cuerpo": "c", "prompt": "p", "cita": "make"},
        {"titulo": "Spacing", "cuerpo": "c", "prompt": "p", "cita": "“Make it shorter, no frills”"},
    ]
    monkeypatch.setattr(review, "MAX_READ_NOTES", 3)
    monkeypatch.setattr(review.subprocess, "run", lambda *a, **k: answer(json.dumps(notes)))

    out = review.read_conversations(cx=None)

    # only the full, normalised quote survives
    assert [n["title"] for n in out] == ["Spacing"]


def findings(*fingerprints):
    return [{"category": "cost", "subject": f"subject {h}", "facts": [f"fact {h}"],
             "action": None, "fingerprint": h} for h in fingerprints]


def test_reading_conversations_is_off_by_default(cx, monkeypatch):
    monkeypatch.delenv("MOTOR_REVIEW_READS", raising=False)
    monkeypatch.setattr(review.detectors, "find", lambda c: findings("cache·x·1"))
    monkeypatch.setattr(review, "read_conversations",
                        lambda c: (_ for _ in ()).throw(AssertionError("must not read conversations")))
    calls = []

    def fake(cmd, **k):
        calls.append(cmd)
        return answer('[{"i": 0, "titulo": "Title", "cuerpo": "Body", "prompt": "Do X"}]')

    monkeypatch.setattr(review.subprocess, "run", fake)

    assert review.review(cx=cx) == 1
    row = cx.execute("SELECT title, action, hook, origin, status FROM review_notes").fetchone()
    assert tuple(row) == ("Title", "Do X", "Make the cache work", "measured", "new")
    # the model runs with no tools, no MCP servers and none of the user's settings
    cmd = calls[0]
    i = cmd.index("--tools")
    assert cmd[i + 1] == ""
    assert "--strict-mcp-config" in cmd and "--mcp-config" not in cmd
    j = cmd.index("--setting-sources")
    assert cmd[j + 1] == ""


def test_model_runs_in_an_empty_working_directory(monkeypatch):
    seen = {}

    def fake(cmd, **k):
        seen["cwd"] = k.get("cwd")
        from pathlib import Path
        seen["empty"] = not any(Path(k["cwd"]).iterdir())
        return answer("[]")

    monkeypatch.setattr(review.subprocess, "run", fake)
    review._call("hello")
    assert seen["cwd"] and seen["empty"]


def test_dry_run_with_save_never_calls_the_model(cx, monkeypatch):
    monkeypatch.setattr(review.detectors, "find", lambda c: findings("memory·1", "focus·p·7"))
    asked = []
    monkeypatch.setattr(review.reader, "run_pass", lambda cx, *a, **k: asked.append(k.get("sources")) or {})
    assert review.review(dry_run=True, save=True, cx=cx) == 2
    # the dry run's pre-pass skips the only network source
    assert asked and asked[0] is not None and "openrouter" not in asked[0]
    assert cx.execute("SELECT COUNT(*) FROM review_notes WHERE origin='measured'").fetchone()[0] == 2


def test_note_whose_condition_disappears_is_marked_resolved(cx, monkeypatch):
    cx.execute("""INSERT INTO review_notes (day, category, title, body, status, fingerprint)
                  VALUES ('2026-09-01', 'cost', 't', 'c', 'new', 'old·1')""")
    monkeypatch.setattr(review.detectors, "find", lambda c: [])
    review.review(dry_run=True, cx=cx)
    # "resolved" = the condition no longer holds. It does NOT mean someone applied it.
    assert cx.execute("SELECT status FROM review_notes WHERE fingerprint='old·1'").fetchone()[0] == "resolved"
