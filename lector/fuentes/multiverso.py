"""
MULTIVERSO · adaptador OPCIONAL.

Lee un índice de «universos» ya generado (el formato que produce el repo
público `multiverso-context-engine`: `data/manifest.json` más un JSON por
universo con sus nodos). Aquí no se recalcula nada — se lee el manifiesto y
se guardan los nodos como memoria, que alimenta la sección de Memoria.

Sólo corre si `MOTOR_MULTIVERSO` apunta a la raíz de ese índice. Sin la
variable, el lector ni lo intenta: no tenerlo no es un fallo.
"""
from __future__ import annotations

import json
import time

from comun import RUTAS, anotar_salud, corta

FUENTE = "multiverso"


def leer(cx) -> int:
    t0, n = time.time(), 0
    if RUTAS["multiverso"] is None:
        return 0
    datos = RUTAS["multiverso"] / "data"
    man = datos / "manifest.json"
    if not man.exists():
        anotar_salud(cx, FUENTE, 0, 0, f"No existe {corta(man)}")
        return 0

    d = json.loads(man.read_text())
    for u in d.get("universes", []):
        st = u.get("stats") or {}
        cx.execute(
            """INSERT INTO inventario (clase,nombre,ambito,ruta,descripcion,modificado,usos)
               VALUES ('universo',?, 'multiverso', ?, ?, ?, ?)
               ON CONFLICT(clase,nombre,ambito) DO UPDATE SET
                 descripcion=excluded.descripcion, usos=excluded.usos,
                 modificado=excluded.modificado""",
            (u.get("name") or u.get("id"), corta(datos / f"{u.get('id')}.json"),
             (u.get("sub") or u.get("tagline") or "")[:400],
             d.get("generated"), st.get("nodes") or 0),
        )
        n += 1

        # Los nodos del universo, como archivos de memoria con sus enlaces.
        f = datos / f"{u.get('id')}.json"
        if not f.exists():
            continue
        try:
            uni = json.loads(f.read_text())
        except Exception:
            continue
        nodos = uni.get("nodes") or uni.get("nodos") or []
        if isinstance(nodos, dict):
            nodos = list(nodos.values())
        for nd in nodos[:4000]:
            if not isinstance(nd, dict):
                continue
            ruta = nd.get("path") or nd.get("ruta") or nd.get("id")
            if not ruta:
                continue
            cx.execute(
                """INSERT INTO memoria (ruta,sistema,titulo,modificado,bytes,enlaces_salen)
                   VALUES (?, 'multiverso', ?, ?, ?, ?)
                   ON CONFLICT(ruta) DO UPDATE SET
                     titulo=excluded.titulo, modificado=excluded.modificado""",
                (str(ruta), (nd.get("label") or nd.get("name") or "")[:200],
                 nd.get("mtime") or nd.get("modified"), nd.get("size") or 0,
                 len(nd.get("links") or nd.get("children") or [])),
            )
            n += 1
    anotar_salud(cx, FUENTE, int((time.time() - t0) * 1000), n, None)
    return n
