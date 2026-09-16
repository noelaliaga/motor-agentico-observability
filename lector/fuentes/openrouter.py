"""
OpenRouter · el único dinero REAL de todo el motor.

Todo lo demás son equivalentes: tokens valorados a tarifa de API que en
realidad paga una suscripción plana. Esto no. Esto son dólares que salieron
de la cuenta.

Es también el único lector que toca la red, por eso corre cada 5 minutos y no
cada 2 segundos: no se martillea la API de un proveedor por pintar un número.

El desglose por modelo vive en /activity y exige una *management key*. Con la
clave normal devuelve 403. Si aparece OPENROUTER_MANAGEMENT_KEY en el
entorno, se pide; si no, se enseña el total y se dice por qué no hay más.
"""
from __future__ import annotations

import json
import os
import time
import urllib.request

from comun import ahora, anotar_salud

FUENTE = "openrouter"


def _pedir(url: str, clave: str):
    req = urllib.request.Request(url, headers={"Authorization": f"Bearer {clave}"})
    with urllib.request.urlopen(req, timeout=20) as r:
        return json.loads(r.read())


def _clave() -> str | None:
    # SÓLO del entorno del proceso. El motor nunca abre el .env de otra app
    # para buscar una clave: se usa para una petición y no se guarda.
    return os.environ.get("OPENROUTER_API_KEY") or None


def leer(cx) -> int:
    t0 = time.time()
    clave = _clave()
    if not clave:
        # Sin clave no hay fallo: hay una fuente sin configurar. Va como nota
        # para no pintar de rojo algo que nunca se pidió.
        anotar_salud(cx, FUENTE, 0, 0,
                     nota="Sin configurar: no hay OPENROUTER_API_KEY en el entorno")
        return 0
    try:
        d = _pedir("https://openrouter.ai/api/v1/credits", clave).get("data") or {}
        gastado = float(d.get("total_usage") or 0)
        credito = float(d.get("total_credits") or 0)
        cx.execute(
            """INSERT INTO gasto_real (proveedor, ts, usd, detalle)
               VALUES ('openrouter', ?, ?, ?)
               ON CONFLICT(proveedor, ts) DO UPDATE SET usd=excluded.usd""",
            (ahora()[:10], gastado,
             json.dumps({"credito": credito, "restante": credito - gastado})),
        )
    except Exception as e:
        anotar_salud(cx, FUENTE, int((time.time() - t0) * 1000), 0, f"{type(e).__name__}: {e}")
        return 0

    nota = None
    mk = os.environ.get("OPENROUTER_MANAGEMENT_KEY")
    if mk:
        try:
            act = _pedir("https://openrouter.ai/api/v1/activity", mk).get("data") or []
            for fila in act:
                cx.execute(
                    """INSERT INTO gasto_real (proveedor, ts, usd, detalle)
                       VALUES (?,?,?,?)
                       ON CONFLICT(proveedor, ts) DO UPDATE SET usd=excluded.usd""",
                    (f"openrouter:{fila.get('model','?')}", fila.get("date"),
                     float(fila.get("usage") or 0), json.dumps(fila)),
                )
        except Exception as e:
            nota = f"la management key no sirvió: {e}"
    else:
        nota = ("Sólo el total: el desglose por modelo exige una management key "
                "de OpenRouter en OPENROUTER_MANAGEMENT_KEY")

    anotar_salud(cx, FUENTE, int((time.time() - t0) * 1000), 1, nota=nota)
    return 1
