"""
Lo que dijiste, para que el sueño lo lea.

Hasta ahora el sueño miraba CONTADORES: cuántas sesiones, cuántas ediciones,
cuántos turnos. Eso encuentra hábitos gruesos —«tocaste archivos sin
planificar»— pero no ve lo que sólo está en el texto: que pediste tres veces lo
mismo porque la primera respuesta no valía, que arrancas sin decir a dónde vas,
que corriges siempre en la misma dirección.

Para eso hay que leer. Y leer es lo único que un contador no puede hacer.

QUÉ SE MANDA Y QUÉ NO
  · tus prompts, recortados
  · una línea de lo que contestó el asistente, para dar contexto al intercambio
  · NUNCA salidas de herramientas, ni archivos, ni contenido de tu disco

AVISO QUE VA TAMBIÉN EN PANTALLA: esto SÍ sale de la máquina. El sueño usa
Claude Code, así que estos fragmentos viajan a la API de Anthropic — los mismos
que ya viajan cada vez que usas Claude Code, pero conviene decirlo en voz alta.
Por eso está APAGADO por defecto: sólo se lee con MOTOR_SUENO_LEE=1.
"""
from __future__ import annotations

import json
import re

from comun import RUTAS, USUARIO

ETIQUETA = USUARIO.upper()

RECORTE_TUYO = 420
RECORTE_SUYO = 260
MAX_INTERCAMBIOS = 46
PRESUPUESTO = 26_000        # caracteres. Por encima, el prompt deja de rendir.

# Lo que llega por el canal de usuario pero no lo escribiste tú.
RUIDO = (
    "[image:", "[imagen:", "base directory for this skill:", "<command-name>",
    "<local-command", "<system-reminder", "<user-prompt", "caveat:",
    "this session is being continued", "the user sent a new message",
    "[request interrupted", "tool result", "api error", "[usage limit",
)


def _tuyo(t: str) -> bool:
    b = t.lstrip().lower()
    return len(t) > 3 and not b.startswith("<") and not any(b.startswith(x) for x in RUIDO)


def _texto(c) -> str:
    if isinstance(c, str):
        return c
    if isinstance(c, list):
        return " ".join(
            b.get("text", "") for b in c
            if isinstance(b, dict) and b.get("type") == "text"
        )
    return ""


def recientes(horas: int = 24) -> list[dict]:
    """
    Los intercambios de las últimas `horas`, en orden.

    Se lee el final de cada transcripción, no el archivo entero: lo de hace un
    mes no dice nada de cómo trabajas hoy.
    """
    import datetime as dt
    corte = (dt.datetime.now(dt.UTC) - dt.timedelta(hours=horas)).isoformat()
    raiz = RUTAS["claude"] / "projects"
    if not raiz.is_dir():
        return []

    fuera: list[dict] = []
    for archivo in raiz.glob("*/*.jsonl"):
        if archivo.stat().st_mtime < (dt.datetime.now() - dt.timedelta(hours=horas + 2)).timestamp():
            continue
        # sólo la cola del archivo: 900 KB bastan para un día largo
        tam = archivo.stat().st_size
        with open(archivo, "rb") as f:
            if tam > 900_000:
                f.seek(tam - 900_000)
                f.readline()
            crudo = f.read().decode("utf-8", "ignore")

        pendiente = None
        for linea in crudo.splitlines():
            if '"timestamp"' not in linea:
                continue
            try:
                d = json.loads(linea)
            except Exception:
                continue
            ts = d.get("timestamp") or ""
            if ts < corte:
                continue
            m = d.get("message") or {}
            proy = (d.get("cwd") or "").rstrip("/").split("/")[-1]

            if m.get("role") == "user" and not d.get("isSidechain"):
                t = _texto(m.get("content")).strip()
                if _tuyo(t):
                    pendiente = {"ts": ts, "proyecto": proy,
                                 "tuyo": re.sub(r"\s+", " ", t)[:RECORTE_TUYO], "suyo": ""}
                    fuera.append(pendiente)
            elif m.get("role") == "assistant" and pendiente is not None and not pendiente["suyo"]:
                t = _texto(m.get("content")).strip()
                if t:
                    pendiente["suyo"] = re.sub(r"\s+", " ", t)[:RECORTE_SUYO]

    fuera.sort(key=lambda x: x["ts"])
    # Si hay más de la cuenta se cogen los últimos: lo de esta noche pesa más
    # que lo de esta mañana.
    fuera = fuera[-MAX_INTERCAMBIOS:]

    total = 0
    recortado = []
    for x in reversed(fuera):
        n = len(x["tuyo"]) + len(x["suyo"])
        if total + n > PRESUPUESTO:
            break
        total += n
        recortado.append(x)
    return list(reversed(recortado))


def como_texto(xs: list[dict]) -> str:
    return "\n\n".join(
        f"[{x['ts'][11:16]} · {x['proyecto'] or 'sin proyecto'}]\n"
        f"{ETIQUETA}: {x['tuyo']}\n"
        f"ASISTENTE: {x['suyo'][:RECORTE_SUYO]}" if x["suyo"] else
        f"[{x['ts'][11:16]} · {x['proyecto'] or 'sin proyecto'}]\n{ETIQUETA}: {x['tuyo']}"
        for x in xs
    )
