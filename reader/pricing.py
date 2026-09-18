"""
The public API prices, with a date and a provenance.

`usage` does not store dollars: it stores tokens. Money is computed at read
time against this table. That way, on 1 September (when the Sonnet 5 launch
price expires) July is still priced correctly and so is September, without
touching a single data row.

PROVENANCE: Claude Code's `claude-api` skill, "Current Models" table, cached
by Anthropic on 2026-06-24. The cache multipliers come from
`shared/prompt-caching.md`: read 0.1× · 5 min write 1.25× · 1 h 2×.
"""

CHECKED_ON = "2026-08-23"
PROVENANCE = "claude-api skill · Current Models table (cached 2026-06-24)"

# model, valid from, valid to, $input/M, $output/M
PRICES = [
    # ── Anthropic ────────────────────────────────────────────────────────
    ("claude-opus-5",    "2026-01-01", None,          5.0,  25.0),
    ("claude-opus-4-8",  "2026-01-01", None,          5.0,  25.0),
    ("claude-opus-4-7",  "2026-01-01", None,          5.0,  25.0),
    ("claude-opus-4-6",  "2026-01-01", None,          5.0,  25.0),
    ("claude-fable-5",   "2026-01-01", None,         10.0,  50.0),
    ("claude-mythos-5",  "2026-01-01", None,         10.0,  50.0),
    # The Sonnet 5 launch price EXPIRES on 31 August 2026. That is why the
    # table has dates: without them, this figure would poison the whole
    # history on 1 September.
    ("claude-sonnet-5",  "2026-01-01", "2026-08-31",  2.0,  10.0),
    ("claude-sonnet-5",  "2026-09-01", None,          3.0,  15.0),
    ("claude-sonnet-4-6","2026-01-01", None,          3.0,  15.0),
    ("claude-haiku-4-5", "2026-01-01", None,          1.0,   5.0),
    # ── OpenAI, for Codex ────────────────────────────────────────────────
    # No verified provenance yet: they are marked as such and the interface
    # warns about it instead of pretending to be precise.
    ("gpt-5-codex",      "2026-01-01", None,          1.25, 10.0),
    ("gpt-5",            "2026-01-01", None,          1.25, 10.0),
]

# Opus 5 / 4.8 fast mode costs double. It goes apart because it is not a
# different model: it is the same model at another price.
FAST = {"claude-opus-5": (10.0, 50.0), "claude-opus-4-8": (10.0, 50.0)}


def seed(cx):
    for model, valid_from, valid_to, inp, out in PRICES:
        prov = PROVENANCE if model.startswith("claude") else PROVENANCE + " · OpenAI UNVERIFIED"
        cx.execute(
            """INSERT INTO pricing
               (model, valid_from, valid_to, usd_input, usd_output,
                mult_cache_read, mult_cache_5m, mult_cache_1h, provenance, checked_on)
               VALUES (?,?,?,?,?,0.10,1.25,2.00,?,?)
               ON CONFLICT(model, valid_from) DO UPDATE SET
                 valid_to=excluded.valid_to, usd_input=excluded.usd_input,
                 usd_output=excluded.usd_output, provenance=excluded.provenance,
                 checked_on=excluded.checked_on""",
            (model, valid_from, valid_to, inp, out, prov, CHECKED_ON),
        )
    for model, (inp, out) in FAST.items():
        cx.execute(
            """INSERT INTO pricing
               (model, valid_from, valid_to, usd_input, usd_output,
                mult_cache_read, mult_cache_5m, mult_cache_1h, provenance, checked_on)
               VALUES (?,?,?,?,?,0.10,1.25,2.00,?,?)
               ON CONFLICT(model, valid_from) DO UPDATE SET usd_input=excluded.usd_input""",
            (model + "  ⚡", "2026-01-01", None, inp, out,
             PROVENANCE + " · fast mode", CHECKED_ON),
        )


# The subscriptions: the denominator of the ROI. EXAMPLE VALUES: put what you
# pay here. They are seeded into the database so the dashboard does not
# hard-code them.
SUBSCRIPTIONS = [
    ("Plan A",        20.0, "claude_code", "2026-01-01", "example value · put your own fee"),
    ("Plan B",        20.0, "codex",       "2026-01-01", "example value · put your own fee"),
    ("OpenRouter",     0.0, "hermes,openclaw", "2026-01-01",
     "prepaid per use, not a fee: its real spend is read from the API"),
]


def seed_subscriptions(cx):
    for name, usd, covers, since, note in SUBSCRIPTIONS:
        cx.execute(
            """INSERT INTO subscriptions (name, usd_month, covers, since, note)
               VALUES (?,?,?,?,?)
               ON CONFLICT(name) DO UPDATE SET
                 usd_month=excluded.usd_month, covers=excluded.covers, note=excluded.note""",
            (name, usd, covers, since, note),
        )
