"""Money is computed at read time against dated pricing. Unknown price → NULL, never 0."""
from __future__ import annotations

import pytest

from detectors import COST, JOIN


def turn(cx, ref, model, ts, output=1_000_000, speed="standard"):
    cx.execute(
        """INSERT INTO usage (source, ts, model, speed, t_output, ref)
           VALUES ('claude_code', ?, ?, ?, ?, ?)""", (ts, model, speed, output, ref))


def cost(cx, ref):
    return cx.execute(f"SELECT {COST} FROM usage u {JOIN} WHERE u.ref=?", (ref,)).fetchone()[0]


def test_price_in_force_on_the_day_of_the_turn(cx):
    # claude-sonnet-5: launch price $10/M output until 2026-08-31, then $15/M.
    turn(cx, "before", "claude-sonnet-5", "2026-08-20T12:00:00Z")
    turn(cx, "after", "claude-sonnet-5", "2026-09-05T12:00:00Z")
    assert cost(cx, "before") == pytest.approx(10.0)
    assert cost(cx, "after") == pytest.approx(15.0)


def test_expired_price_does_not_rewrite_history(cx):
    turn(cx, "last-day", "claude-sonnet-5", "2026-08-31T23:00:00Z")
    assert cost(cx, "last-day") == pytest.approx(10.0)


def test_model_without_price_is_null_not_zero(cx):
    turn(cx, "unknown", "some-unpriced-model", "2026-09-05T12:00:00Z")
    assert cost(cx, "unknown") is None
    total, unpriced = cx.execute(
        f"""SELECT COALESCE(SUM({COST}), 0), SUM(CASE WHEN t.usd_input IS NULL THEN 1 ELSE 0 END)
              FROM usage u {JOIN}""").fetchone()
    assert total == 0 and unpriced == 1          # the UI can say "no price", not "$0"


def test_fast_mode_uses_its_own_price(cx):
    turn(cx, "fast", "claude-opus-5", "2026-09-05T12:00:00Z", speed="fast")
    turn(cx, "normal", "claude-opus-5", "2026-09-05T12:00:00Z")
    assert cost(cx, "fast") == pytest.approx(2 * cost(cx, "normal"))


def test_cache_counters_are_priced_separately(cx):
    cx.execute("""INSERT INTO usage (source, ts, model, t_cache_read, t_cache_5m, t_cache_1h, ref)
                  VALUES ('claude_code', '2026-09-05T12:00:00Z', 'claude-opus-5',
                          1000000, 1000000, 1000000, 'cache')""")
    # $5/M input: read 0.1x + 5 min write 1.25x + 1 h write 2x
    assert cost(cx, "cache") == pytest.approx(5 * (0.10 + 1.25 + 2.00))
