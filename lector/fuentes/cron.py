"""
Lo que va a correr sin que tú estés delante.

Junta en un solo sitio los tres relojes que hoy viven separados: los
LaunchAgents de macOS, el cron de Hermes y lo que tenga programado Codex. Es
la pregunta «¿qué se va a ejecutar solo esta noche?», que ahora mismo no tiene
respuesta en ningún panel.

Todo por lectura de archivos y de comandos que sólo listan. `launchctl list`
enumera; no carga, no descarga y no arranca nada.

Los dos comandos (`launchctl list` y `hermes cron list`) se pueden apagar con
MOTOR_CRON_COMANDOS=0: la demo lo hace para no mezclar la máquina real con
una home sintética.
"""
from __future__ import annotations

import os
import plistlib
import re
import subprocess
import time

from comun import RUTAS, anotar_salud, corta

FUENTE = "cron"
DIAS = ["lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"]


def _cuando(plist: dict) -> str:
    """Traduce el horario de un LaunchAgent a algo que se lea."""
    if "StartInterval" in plist:
        s = int(plist["StartInterval"])
        if s % 3600 == 0:
            return f"cada {s // 3600} h"
        if s % 60 == 0:
            return f"cada {s // 60} min"
        return f"cada {s} s"
    cal = plist.get("StartCalendarInterval")
    if not cal:
        return "al arrancar" if plist.get("RunAtLoad") else "—"
    if isinstance(cal, dict):
        cal = [cal]
    partes = []
    for c in cal[:3]:
        h, m = c.get("Hour"), c.get("Minute", 0)
        d = c.get("Weekday")
        cuando = f"{h:02d}:{m:02d}" if h is not None else f"cada hora en el minuto {m}"
        if d is not None:
            cuando = f"{DIAS[(int(d) - 1) % 7]} · {cuando}"
        elif h is not None:
            cuando = f"diario · {cuando}"
        partes.append(cuando)
    return " y ".join(partes)


def _comandos() -> bool:
    return os.environ.get("MOTOR_CRON_COMANDOS", "1") != "0"


def _cargados() -> set[str]:
    if not _comandos():
        return set()
    try:
        r = subprocess.run(["launchctl", "list"], capture_output=True, text=True, timeout=15)
        return {fila.split("\t")[-1].strip() for fila in r.stdout.splitlines()[1:] if fila.strip()}
    except Exception:
        return set()


def leer(cx) -> int:
    t0, n = time.time(), 0
    cx.execute("DELETE FROM programado")     # es una foto, no un histórico
    vivos = _cargados()

    # ── LaunchAgents del usuario ─────────────────────────────────────────
    carpeta = RUTAS["launchagents"]
    if carpeta is not None and carpeta.is_dir():
        for f in sorted(carpeta.glob("*.plist")):
            try:
                d = plistlib.loads(f.read_bytes())
            except Exception:
                continue
            etiqueta = d.get("Label") or f.stem
            # Sólo lo que de verdad tiene reloj: un agente sin horario ni
            # RunAtLoad no «va a correr», simplemente existe.
            if not any(k in d for k in ("StartInterval", "StartCalendarInterval", "RunAtLoad")):
                continue
            prog = d.get("ProgramArguments") or []
            cx.execute(
                "INSERT OR REPLACE INTO programado VALUES (?,?,?,?,?,?,?)",
                (f"launchd:{etiqueta}", "launchd", etiqueta, _cuando(d), None,
                 1 if etiqueta in vivos else 0,
                 " ".join(corta(str(x)) or "" for x in prog)[:300] if prog
                 else (corta(str(d.get("Program", ""))) or "")[:300]),
            )
            n += 1

    # ── el cron de Hermes ────────────────────────────────────────────────
    try:
        if not _comandos():
            raise FileNotFoundError
        r = subprocess.run([os.environ.get("MOTOR_HERMES_CLI", "hermes"), "cron", "list", "--all"],
                           capture_output=True, text=True, timeout=25)
        actual = None
        for cruda in r.stdout.splitlines():
            linea = cruda.rstrip()
            cab = re.match(r"^\s{0,4}([0-9a-f]{8,}|[a-z]+_[a-z0-9]{6,})\s*\[(\w+)\]\s*$", linea, re.I)
            if cab:
                actual = {"id": cab[1], "nombre": cab[1], "cuando": None,
                          "siguiente": None, "activo": bool(re.search(r"active|enabled", cab[2], re.I))}
                cx.execute("INSERT OR REPLACE INTO programado VALUES (?,?,?,?,?,?,?)",
                           (f"hermes:{actual['id']}", "hermes", actual["nombre"],
                            None, None, int(actual["activo"]), None))
                n += 1
                continue
            campo = re.match(r"^\s+([A-Za-z ]+):\s+(.*)$", linea)
            if not (campo and actual):
                continue
            clave, valor = campo[1].strip().lower(), campo[2].strip()
            col = {"name": "nombre", "schedule": "cuando", "next run": "siguiente"}.get(clave)
            if col:
                cx.execute(f"UPDATE programado SET {col}=? WHERE id=?",
                           (valor, f"hermes:{actual['id']}"))
    except FileNotFoundError:
        pass
    except Exception as e:
        anotar_salud(cx, FUENTE, int((time.time() - t0) * 1000), n, f"hermes cron: {e}")
        return n

    anotar_salud(cx, FUENTE, int((time.time() - t0) * 1000), n, None,
                 nota=None if n else "No hay nada programado en launchd ni en Hermes")
    return n
