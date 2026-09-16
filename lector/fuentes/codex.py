"""
Codex · sesiones de OpenAI.

TRAMPA PRINCIPAL: cada evento `token_count` trae DOS cifras —
`total_token_usage`, que es ACUMULADA desde el principio de la sesión, y
`last_token_usage`, que es la del turno. Sumar la acumulada turno a turno
multiplica el gasto por cientos. Se usa siempre la última.
"""
from __future__ import annotations

import json
import time

from comun import RUTAS, Cola, anotar_salud, corta

FUENTE = "codex"


def leer(cx) -> int:
    t0 = time.time()
    raiz = RUTAS["codex"] / "sessions"
    if not raiz.is_dir():
        anotar_salud(cx, FUENTE, 0, 0, f"No existe {corta(raiz)}")
        return 0

    cola, n = Cola(cx), 0
    for archivo in sorted(raiz.glob("**/*.jsonl")):
        # rollout-2026-07-27T15-09-25-<uuid>.jsonl → la sesión es el uuid
        ses = archivo.stem.split("-", 5)[-1] if "-" in archivo.stem else archivo.stem
        modelo, cwd = None, None
        for cruda in cola.nuevo(archivo):
            try:
                d = json.loads(cruda)
            except Exception:
                continue
            tipo, pl = d.get("type"), (d.get("payload") or {})

            # El modelo no viene en el evento de tokens: hay que arrastrarlo
            # desde la cabecera de la sesión o del contexto del turno.
            if tipo in ("session_meta", "turn_context"):
                modelo = pl.get("model") or (pl.get("turn_context") or {}).get("model") or modelo
                cwd = pl.get("cwd") or pl.get("cwd_path") or cwd

            if tipo == "event_msg" and pl.get("type") == "token_count":
                u = (pl.get("info") or {}).get("last_token_usage") or {}
                if not u:
                    continue
                ts = d.get("timestamp")
                if not ts:
                    continue
                proy = (cwd or "").rstrip("/").split("/")[-1] or None
                cur = cx.execute(
                    """INSERT OR IGNORE INTO uso
                       (fuente,sesion,proyecto,ts,modelo,velocidad,
                        t_entrada,t_salida,t_pensamiento,t_cache_lee,t_cache_5m,t_cache_1h,ref)
                       VALUES (?,?,?,?,?, 'standard', ?,?,?,?,0,0,?)""",
                    (FUENTE, ses, proy, ts, modelo or "gpt-5-codex",
                     u.get("input_tokens") or 0, u.get("output_tokens") or 0,
                     u.get("reasoning_output_tokens") or 0,
                     u.get("cached_input_tokens") or 0,
                     f"{ses}:{ts}:{u.get('total_tokens')}"),
                )
                n += max(cur.rowcount, 0)      # filas nuevas, no líneas leídas

    cx.execute(
        """INSERT INTO sesiones (id,fuente,inicio,fin,proyecto,modelo,mensajes)
           SELECT sesion, ?, MIN(ts), MAX(ts), MAX(proyecto), MAX(modelo), COUNT(*)
             FROM uso WHERE fuente=? AND sesion IS NOT NULL GROUP BY sesion
           ON CONFLICT(id) DO UPDATE SET fin=excluded.fin, mensajes=excluded.mensajes""",
        (FUENTE, FUENTE),
    )
    anotar_salud(cx, FUENTE, int((time.time() - t0) * 1000), n, None)
    return n
