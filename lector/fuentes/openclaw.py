"""
OpenClaw · lo poco que hay, dicho como es.

Sus logs no guardan consumo. Lo que sí se puede leer es su configuración —
qué modelo y qué proveedor tiene puestos — y sus agentes declarados. El gasto
de OpenClaw sale, junto con el de Hermes, del total de OpenRouter.
"""
from __future__ import annotations

import json
import time

from comun import RUTAS, anotar_salud, corta

FUENTE = "openclaw"


def _texto(v) -> str | None:
    """Aplana lo que venga a algo que SQLite pueda guardar, o a None."""
    if v is None or isinstance(v, (str, int, float)):
        return str(v) if v is not None else None
    if isinstance(v, dict):
        # `primary` va primero: en OpenClaw el modelo es {primary, fallback} y
        # lo que importa es con cuál sale a trabajar.
        return (v.get("primary") or v.get("id") or v.get("model")
                or v.get("name") or json.dumps(v)[:200])
    if isinstance(v, list):
        return ", ".join(_texto(x) or "" for x in v)[:200]
    return str(v)[:200]


def leer(cx) -> int:
    t0, n = time.time(), 0
    casa = RUTAS["openclaw"]
    cfg = casa / "openclaw.json"
    if not cfg.exists():
        anotar_salud(cx, FUENTE, 0, 0, "No existe openclaw.json")
        return 0
    try:
        d = json.loads(cfg.read_text())
    except Exception as e:
        anotar_salud(cx, FUENTE, 0, 0, f"openclaw.json ilegible: {e}")
        return 0

    # OJO con la forma de `agents`: NO es un diccionario de agentes. Es un
    # diccionario con dos claves de sistema — `defaults`, la configuración que
    # heredan todos, y `list`, el array con los agentes de verdad. Leerlo como
    # {nombre: agente} daba de alta dos agentes fantasma llamados «defaults» y
    # «list», y al tocar el segundo reventaba: `list` es una lista y no tiene
    # `.get`. El panel llevaba días enseñando ese AttributeError, que es
    # exactamente para lo que sirve enseñar la salud del lector.
    bloque = d.get("agents")
    bloque = bloque if isinstance(bloque, dict) else {}
    porDefecto = bloque.get("defaults") if isinstance(bloque.get("defaults"), dict) else {}
    modeloDefecto = _texto(porDefecto.get("model"))

    crudos = bloque.get("list")
    if isinstance(crudos, list):
        agentes = [a for a in crudos if isinstance(a, dict)]
    else:
        # Por si algún día vuelve a la forma antigua {nombre: {...}}: se toma
        # todo lo que sea un diccionario y no sea una clave de sistema.
        agentes = [{"id": k, **v} for k, v in bloque.items()
                   if isinstance(v, dict) and k not in ("defaults", "list")]

    for a in agentes:
        nombre = _texto(a.get("id") or a.get("name"))
        if not nombre:
            continue
        propio = _texto(a.get("model"))
        cx.execute(
            """INSERT INTO inventario (clase,nombre,ambito,ruta,descripcion,modelo)
               VALUES ('agente',?, 'openclaw', ?, ?, ?)
               ON CONFLICT(clase,nombre,ambito) DO UPDATE SET modelo=excluded.modelo""",
            # Si el agente no declara modelo, hereda el de `defaults`. Se dice
            # que es heredado: no es lo mismo elegir un modelo que no elegirlo.
            (nombre, corta(cfg), _texto(a.get("description")),
             propio or (f"{modeloDefecto} (heredado)" if modeloDefecto else None)),
        )
        n += 1

    anotar_salud(cx, FUENTE, int((time.time() - t0) * 1000), n,
                 nota="OpenClaw no registra consumo en sus logs; su gasto va dentro "
                      "del total de OpenRouter")
    return n
