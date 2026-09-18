"""
OpenRouter · the only REAL money in the whole motor.

Everything else is an equivalent: tokens valued at API price that a flat
subscription actually pays for. Not this. These are dollars that left the
account.

It is also the only reader that touches the network, which is why it runs
every 5 minutes and not every 2 seconds: a provider's API is not hammered just
to paint a number.

The per-model breakdown lives in /activity and requires a *management key*.
With the normal key it returns 403. If OPENROUTER_MANAGEMENT_KEY is in the
environment, it is requested; otherwise the total is shown and the reason
there is no more is given.
"""
from __future__ import annotations

import json
import os
import time
import urllib.request

from common import now, record_health

SOURCE = "openrouter"


def _request(url: str, key: str):
    req = urllib.request.Request(url, headers={"Authorization": f"Bearer {key}"})
    with urllib.request.urlopen(req, timeout=20) as r:
        return json.loads(r.read())


def _key() -> str | None:
    # ONLY from the process environment. The motor never opens another app's
    # .env looking for a key: it is used for one request and not stored.
    return os.environ.get("OPENROUTER_API_KEY") or None


def read(cx) -> int:
    t0 = time.time()
    key = _key()
    if not key:
        # No key is not a failure: it is an unconfigured source. It goes as a
        # note so as not to paint red something that was never asked for.
        record_health(cx, SOURCE, 0, 0,
                      note="Not configured: no OPENROUTER_API_KEY in the environment")
        return 0
    try:
        d = _request("https://openrouter.ai/api/v1/credits", key).get("data") or {}
        spent = float(d.get("total_usage") or 0)
        credit = float(d.get("total_credits") or 0)
        cx.execute(
            """INSERT INTO real_spend (provider, ts, usd, detail)
               VALUES ('openrouter', ?, ?, ?)
               ON CONFLICT(provider, ts) DO UPDATE SET usd=excluded.usd""",
            (now()[:10], spent,
             json.dumps({"credit": credit, "remaining": credit - spent})),
        )
    except Exception as e:
        record_health(cx, SOURCE, int((time.time() - t0) * 1000), 0, f"{type(e).__name__}: {e}")
        return 0

    note = None
    mk = os.environ.get("OPENROUTER_MANAGEMENT_KEY")
    if mk:
        try:
            act = _request("https://openrouter.ai/api/v1/activity", mk).get("data") or []
            for row in act:
                cx.execute(
                    """INSERT INTO real_spend (provider, ts, usd, detail)
                       VALUES (?,?,?,?)
                       ON CONFLICT(provider, ts) DO UPDATE SET usd=excluded.usd""",
                    (f"openrouter:{row.get('model','?')}", row.get("date"),
                     float(row.get("usage") or 0), json.dumps(row)),
                )
        except Exception as e:
            note = f"the management key did not work: {e}"
    else:
        note = ("Total only: the per-model breakdown requires an OpenRouter "
                "management key in OPENROUTER_MANAGEMENT_KEY")

    record_health(cx, SOURCE, int((time.time() - t0) * 1000), 1, note=note)
    return 1
