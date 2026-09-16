"""
El estado de tu plan · qué tienes contratado y cuándo te han frenado.

Lo que se puede saber, y lo que no, conviene decirlo de entrada:

  SE SABE   qué plan tienes (`~/.claude.json` lo guarda con nombre y nivel),
            si el uso extra está activado y por qué no entra, y cada vez que
            la API te ha rechazado por tope, con su tipo de ventana y la hora
            exacta a la que se suelta.

  NO SE SABE  cuánto llevas gastado de la ventana actual. El «25 / 900» que
            enseña la app no está en ningún archivo: viaja en la respuesta de
            la API y no se persiste. Sólo aparece en disco el instante en que
            topas, y entonces ya es tarde para avisarte.

Así que este lector NO estima el consumo de la ventana. Cuenta los topes, que
son medidos, y deja el techo en blanco. Un porcentaje sobre una cuota que
nadie publica sería un número inventado con pinta de dato.
"""
from __future__ import annotations

import json
import time

from comun import RUTAS, Cola, anotar_salud

FUENTE = "plan"

# Cómo se llaman por dentro los niveles, y cómo se llaman en tu factura.
NIVELES = {
    "default_claude_max_5x":  ("Claude Max 5×", "cinco veces el Pro"),
    "default_claude_max_20x": ("Claude Max 20×", "veinte veces el Pro"),
    "default_claude_pro":     ("Claude Pro", None),
    "default_claude_free":    ("Claude Free", None),
}

VENTANAS = {
    "five_hour": "ventana de 5 horas",
    "seven_day": "ventana semanal",
    "seven_day_opus": "ventana semanal de Opus",
}


def _cuenta(cx) -> int:
    """El plan, tal y como lo tiene apuntado el propio Claude Code."""
    cfg = RUTAS["claude_json"]
    if cfg is None or not cfg.exists():
        return 0
    d = json.loads(cfg.read_text())
    o = d.get("oauthAccount") or {}
    nivel = o.get("organizationRateLimitTier") or o.get("userRateLimitTier")
    nombre, coletilla = NIVELES.get(nivel or "", (nivel or None, None))

    # Del bloque de la cuenta se toman el plan y las fechas. NO se guardan el
    # correo, los UUID ni nada que identifique: al panel le da igual quién
    # eres, sólo le importa qué tienes contratado.
    datos = {
        "plan": nombre,
        "plan_detalle": coletilla,
        "plan_clave": nivel,
        "tipo_cuenta": o.get("organizationType"),
        "desde": (o.get("subscriptionCreatedAt") or "")[:10] or None,
        "extra_activado": "1" if o.get("hasExtraUsageEnabled") else "0",
        "extra_motivo": d.get("cachedExtraUsageDisabledReason"),
    }
    for clave, valor in datos.items():
        cx.execute("""INSERT INTO plan (clave, valor) VALUES (?,?)
                      ON CONFLICT(clave) DO UPDATE SET valor=excluded.valor""",
                   (clave, valor))
    return sum(1 for v in datos.values() if v)


def _topes(cx) -> int:
    """
    Cada vez que la API dijo que no.

    El registro vive dentro del propio .jsonl de la sesión, en `quotaLimits`,
    y sólo aparece cuando el estado es «rejected». Se lee incremental y con
    marca propia: `claude_code` recorre estos mismos archivos y sin marca los
    dos se pisarían el cursor.
    """
    raiz = RUTAS["claude"] / "projects"
    if not raiz.exists():
        return 0
    cola, n = Cola(cx, marca="plan::"), 0
    # rglob, no glob: las sesiones de los subagentes y de los workflows viven
    # anidadas bajo `subagents/`, y son las que más topan — un barrido plano se
    # dejaba fuera justo las noches en que el sistema se quedó parado.
    for archivo in sorted(raiz.rglob("*.jsonl")):
        for linea in cola.nuevo(archivo):
            if b'"quotaLimits"' not in linea:
                continue
            try:
                d = json.loads(linea)
            except Exception:
                continue
            q = (d.get("message") or {}).get("quotaLimits") or d.get("quotaLimits")
            if not isinstance(q, dict) or q.get("status") != "rejected":
                continue
            reset = q.get("resetsAt")
            cur = cx.execute(
                """INSERT OR IGNORE INTO topes
                   (ts, tipo, ventana, reset_ts, extra_estado, extra_motivo, sesion)
                   VALUES (?,?,?,?,?,?,?)""",
                (d.get("timestamp"), q.get("rateLimitType"),
                 VENTANAS.get(q.get("rateLimitType") or "", q.get("rateLimitType")),
                 time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(reset)) if reset else None,
                 q.get("overageStatus"), q.get("overageDisabledReason"),
                 archivo.stem),
            )
            n += cur.rowcount if cur.rowcount and cur.rowcount > 0 else 0
    return n


def leer(cx) -> int:
    t0 = time.time()
    try:
        n = _cuenta(cx) + _topes(cx)
    except Exception as e:
        anotar_salud(cx, FUENTE, int((time.time() - t0) * 1000), 0,
                     f"{type(e).__name__}: {e}")
        return 0
    anotar_salud(cx, FUENTE, int((time.time() - t0) * 1000), n, None,
                 nota="El consumo de la ventana en curso no se persiste en ninguna parte: "
                      "sólo queda registrado el instante en que la API te frena.")
    return n
