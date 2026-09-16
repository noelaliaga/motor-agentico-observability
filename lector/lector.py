#!/usr/bin/env python3
"""
El lector del motor agéntico.

La ÚNICA pieza de todo el sistema que escribe. Y sólo escribe en su propia
base: cada fuente ajena se abre en modo de solo lectura, sin excepción.

  python3 lector/lector.py            una pasada y sale
  python3 lector/lector.py --bucle    se queda mirando, cada 2 segundos
  python3 lector/lector.py -v         con la traza completa de lo que falle

En primer plano es un proceso que ves y paras con Ctrl-C (`arrancar.sh`).
Para que sobreviva al reinicio hay una plantilla de launchd en `launchd/`.
El lector no envía nada a la red salvo la fuente `openrouter`, y sólo si
tiene clave en el entorno.
"""
from __future__ import annotations

import sys
import time
import traceback
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import tarifas  # noqa: E402
from comun import BASE, RUTAS, abrir, anotar_salud  # noqa: E402

FUENTES = ["claude_code", "codex", "hermes", "openclaw",
           "openrouter", "inventario", "multiverso", "memoria", "cron", "conexiones",
           "plan"]

# La red se consulta despacio: cada 5 minutos, no cada 2 segundos.
LENTAS = {"openrouter": 300, "inventario": 60, "multiverso": 60,
          "memoria": 120, "cron": 120, "conexiones": 120, "plan": 120}
_ultima: dict[str, float] = {}

ESQUEMA = Path(__file__).resolve().parent / "esquema.sql"

# Columnas que se añadieron después de la primera versión. `CREATE TABLE IF
# NOT EXISTS` no toca una tabla que ya existe, así que sin esto el esquema
# nuevo se aplica en una base virgen y en la tuya no — y el fallo aparece
# semanas después, en una consulta que no encuentra la columna.
MIGRACIONES = [
    ("memoria", "tipo", "TEXT"),
    ("salud", "nota", "TEXT"),
    ("sueno", "origen", "TEXT"),
    ("sueno", "gancho", "TEXT"),
]


def migrar(cx):
    for tabla, columna, tipo in MIGRACIONES:
        try:
            hay = {r[1] for r in cx.execute(f"PRAGMA table_info({tabla})")}
        except Exception:
            continue
        if hay and columna not in hay:
            cx.execute(f"ALTER TABLE {tabla} ADD COLUMN {columna} {tipo}")
            print(f"[motor] migración: {tabla}.{columna}", flush=True)


def preparar(cx=None):
    """Abre la base (o usa la que le den), migra, aplica el esquema y siembra tarifas."""
    cx = cx or abrir(escritura=True)
    # Primero las migraciones: el esquema crea índices sobre columnas que una
    # base vieja todavía no tiene.
    migrar(cx)
    cx.executescript(ESQUEMA.read_text())
    migrar(cx)
    tarifas.sembrar(cx)
    tarifas.sembrar_suscripciones(cx)
    cx.commit()
    return cx


def _activa(nombre: str) -> bool:
    # Un adaptador opcional sin configurar no se ejecuta ni se anota: no es un
    # fallo, es una fuente que este usuario no tiene.
    return not (nombre == "multiverso" and RUTAS.get("multiverso") is None)


def pasada(cx, verboso=False, fuentes: list[str] | None = None) -> dict[str, int]:
    hecho = {}
    for nombre in fuentes or FUENTES:
        if not _activa(nombre):
            continue
        cada = LENTAS.get(nombre)
        if cada and time.time() - _ultima.get(nombre, 0) < cada:
            continue
        t0 = time.time()
        try:
            mod = __import__(f"fuentes.{nombre}", fromlist=["leer"])
            hecho[nombre] = mod.leer(cx)
            _ultima[nombre] = time.time()
        except ModuleNotFoundError as e:
            if e.name != f"fuentes.{nombre}":
                raise
            continue                       # una fuente aún sin escribir no es un error
        except Exception as e:
            # Una fuente que revienta NO puede llevarse a las demás por delante.
            # Se anota el motivo y se sigue: la interfaz enseñará esa sección
            # vacía con su explicación, y el resto del motor intacto.
            cx.rollback()
            anotar_salud(cx, nombre, int((time.time() - t0) * 1000), 0,
                         f"{type(e).__name__}: {e}")
            if verboso:
                traceback.print_exc()
        cx.commit()
    return hecho


def main():
    cx = preparar()
    bucle = "--bucle" in sys.argv
    verboso = "-v" in sys.argv
    print(f"[motor] base en {BASE}")
    n = 0
    while True:
        t0 = time.time()
        hecho = pasada(cx, verboso)
        ms = int((time.time() - t0) * 1000)
        if hecho or n == 0:
            print(f"[motor] pasada {n} · {ms} ms · " +
                  " ".join(f"{k}={v}" for k, v in hecho.items() if v), flush=True)
        n += 1
        if not bucle:
            return
        time.sleep(2)


if __name__ == "__main__":
    main()
