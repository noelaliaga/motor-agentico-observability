"""Money is computed at read time against dated pricing. Unknown price → NULL, never 0."""
from __future__ import annotations

import pytest

from detectores import COSTE, JOIN


def turno(cx, ref, modelo, ts, salida=1_000_000, velocidad="standard"):
    cx.execute(
        """INSERT INTO uso (fuente, ts, modelo, velocidad, t_salida, ref)
           VALUES ('claude_code', ?, ?, ?, ?, ?)""", (ts, modelo, velocidad, salida, ref))


def coste(cx, ref):
    return cx.execute(f"SELECT {COSTE} FROM uso u {JOIN} WHERE u.ref=?", (ref,)).fetchone()[0]


def test_price_in_force_on_the_day_of_the_turn(cx):
    # claude-sonnet-5: launch price $10/M output until 2026-08-31, then $15/M.
    turno(cx, "antes", "claude-sonnet-5", "2026-08-20T12:00:00Z")
    turno(cx, "despues", "claude-sonnet-5", "2026-09-05T12:00:00Z")
    assert coste(cx, "antes") == pytest.approx(10.0)
    assert coste(cx, "despues") == pytest.approx(15.0)


def test_expired_price_does_not_rewrite_history(cx):
    turno(cx, "ultimo-dia", "claude-sonnet-5", "2026-08-31T23:00:00Z")
    assert coste(cx, "ultimo-dia") == pytest.approx(10.0)


def test_model_without_price_is_null_not_zero(cx):
    turno(cx, "desconocido", "some-unpriced-model", "2026-09-05T12:00:00Z")
    assert coste(cx, "desconocido") is None
    total, sin_tarifa = cx.execute(
        f"""SELECT COALESCE(SUM({COSTE}), 0), SUM(CASE WHEN t.usd_entrada IS NULL THEN 1 ELSE 0 END)
              FROM uso u {JOIN}""").fetchone()
    assert total == 0 and sin_tarifa == 1          # the UI can say "no price", not "$0"


def test_fast_mode_uses_its_own_price(cx):
    turno(cx, "rapido", "claude-opus-5", "2026-09-05T12:00:00Z", velocidad="fast")
    turno(cx, "normal", "claude-opus-5", "2026-09-05T12:00:00Z")
    assert coste(cx, "rapido") == pytest.approx(2 * coste(cx, "normal"))


def test_cache_counters_are_priced_separately(cx):
    cx.execute("""INSERT INTO uso (fuente, ts, modelo, t_cache_lee, t_cache_5m, t_cache_1h, ref)
                  VALUES ('claude_code', '2026-09-05T12:00:00Z', 'claude-opus-5',
                          1000000, 1000000, 1000000, 'cache')""")
    # $5/M input: read 0.1x + 5 min write 1.25x + 1 h write 2x
    assert coste(cx, "cache") == pytest.approx(5 * (0.10 + 1.25 + 2.00))
