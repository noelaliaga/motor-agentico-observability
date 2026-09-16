"""
Hermes · actividad sí, gasto no.

Hermes (Nous Research, MIT) guarda sesiones con el modelo y el canal, y sus
mensajes. Pero la columna `token_count` está a CERO en todas las filas: no registra
consumo. Aquí no se estima nada — estimar tokens por la longitud del texto
sería inventar, y la regla de este motor es que un dato que no existe se
enseña como «sin dato», nunca como cero.

Lo que sí aporta, y es valioso: qué skills usas de verdad. `.usage.json`
lleva `use_count` y `last_used_at` de cada skill instalada.

Su base se abre SIEMPRE en solo lectura: el motor no puede corromper el
tablero de Hermes ni por un fallo propio.
"""
from __future__ import annotations

import hashlib
import json
import time

from comun import RUTAS, anotar_salud, corta, solo_lectura

FUENTE = "hermes"


def _titulo_opaco(clave: str | None) -> str | None:
    """
    La `session_key` de Hermes suele llevar el identificador del canal (un chat
    de mensajería, por ejemplo). No se enseña: sin `display_name`, la sesión se
    titula con un hash corto de la clave, estable entre pasadas.
    """
    if not clave:
        return None
    return "sesión " + hashlib.sha256(str(clave).encode()).hexdigest()[:8]


def leer(cx) -> int:
    t0, n = time.time(), 0
    casa = RUTAS["hermes"]
    aviso = None

    base = casa / "state.db"
    if base.exists():
        try:
            h = solo_lectura(base)
            for r in h.execute(
                "SELECT id, source, model, session_key, display_name FROM sessions"
            ):
                sid, canal, modelo, clave, nombre = r
                fila = h.execute(
                    "SELECT MIN(timestamp), MAX(timestamp), COUNT(*), COALESCE(SUM(token_count),0)"
                    " FROM messages WHERE session_id=?", (sid,)).fetchone()
                ini, fin, msgs, tokens = fila
                cx.execute(
                    """INSERT INTO sesiones (id,fuente,inicio,fin,canal,modelo,titulo,mensajes)
                       VALUES (?,?,?,?,?,?,?,?)
                       ON CONFLICT(id) DO UPDATE SET
                         fin=excluded.fin, mensajes=excluded.mensajes, modelo=excluded.modelo""",
                    (sid, FUENTE, ini, fin, canal, modelo, nombre or _titulo_opaco(clave), msgs or 0),
                )
                n += 1
                # Si algún día Hermes empieza a rellenar token_count, esto lo
                # recoge solo. Mientras esté a cero, no se escribe una fila de
                # `uso` — que es lo mismo que decir «no lo sé».
                if tokens:
                    cx.execute(
                        """INSERT OR IGNORE INTO uso
                           (fuente,sesion,ts,modelo,t_entrada,t_salida,ref)
                           VALUES (?,?,?,?,0,?,?)""",
                        (FUENTE, sid, fin, modelo or "?", tokens, f"hermes:{sid}"),
                    )
            h.close()
        except Exception as e:
            aviso = f"state.db: {e}"
    else:
        aviso = "no existe state.db"

    # ── las skills que Hermes sí sabe si usaste ──────────────────────────
    uso = casa / "skills" / ".usage.json"
    if uso.exists():
        try:
            d = json.loads(uso.read_text())
            for nombre, v in d.items():
                cx.execute(
                    """INSERT INTO inventario (clase,nombre,ambito,ruta,modificado,usos,ultimo_uso)
                       VALUES ('skill',?, 'hermes', ?, ?, ?, ?)
                       ON CONFLICT(clase,nombre,ambito) DO UPDATE SET
                         usos=excluded.usos, ultimo_uso=excluded.ultimo_uso""",
                    (nombre, corta(casa / "skills" / nombre), v.get("created_at"),
                     v.get("use_count") or 0, v.get("last_used_at")),
                )
                n += 1
        except Exception as e:
            aviso = (aviso or "") + f" · .usage.json: {e}"

    # El aviso NO es un error que rompa: es lo que la interfaz enseñará como
    # motivo de que la casilla de gasto de Hermes esté vacía.
    anotar_salud(cx, FUENTE, int((time.time() - t0) * 1000), n,
                 error=aviso,
                 nota="Hermes no registra tokens: la columna existe y está a cero, "
                      "así que su gasto se enseña vacío y no estimado")
    return n
