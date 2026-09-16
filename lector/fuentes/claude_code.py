"""
Claude Code · la fuente rica.

De cada turno del asistente saca el modelo, los SEIS contadores de tokens por
separado, la velocidad, el esfuerzo, el proyecto y la rama de git. De cada
turno tuyo, el prompt. Y de cada bloque `tool_use`, qué herramienta y qué
skill se invocaron de verdad — que es lo que convierte un inventario de 241
skills en «diez usadas y 231 dormidas».
"""
from __future__ import annotations

import json
import time

from comun import RUTAS, Cola, anotar_salud, corta

FUENTE = "claude_code"

# Lo que llega por el canal de usuario pero no lo has escrito tú.
RUIDO = (
    "[image:", "[imagen:", "base directory for this skill:",
    "<command-name>", "<local-command", "<system-reminder", "<user-prompt",
    "caveat: the messages below", "this session is being continued",
    "the user sent a new message while you were working",
    "[request interrupted", "arguments:", "tool result", "api error",
    "[usage limit", "[note:", "please continue", "system:",
)


def _es_tuyo(t: str) -> bool:
    b = t.lstrip().lower()
    if len(t) < 3 or b.startswith("<"):
        return False
    return not any(b.startswith(x) for x in RUIDO)


def _proyecto(cwd: str | None, carpeta: str) -> str:
    if cwd:
        return cwd.rstrip("/").split("/")[-1] or cwd
    # El nombre de carpeta de Claude Code es la ruta con guiones:
    # «-home-demo-projects-webshop» → «webshop»
    return carpeta.strip("-").split("-")[-1]


def leer(cx) -> int:
    t0 = time.time()
    raiz = RUTAS["claude"] / "projects"
    if not raiz.is_dir():
        anotar_salud(cx, FUENTE, 0, 0, f"No existe {corta(raiz)}")
        return 0

    cola, n = Cola(cx), 0
    # rglob, no glob. Las sesiones de subagentes y de workflows viven anidadas
    # bajo `subagents/`, y son 140 archivos y 234 MB — más de un cuarto de todo
    # lo que se escribe. Con un barrido plano, el trabajo delegado no costaba
    # nada según el panel: el día que más gastas es el día que más delegas.
    for archivo in sorted(raiz.rglob("*.jsonl")):
        # La carpeta del proyecto es la primera bajo `projects/`, no la del
        # archivo: si no, un subagente acabaría atribuido a «wf_7c12f677».
        partes = archivo.relative_to(raiz).parts
        carpeta = partes[0] if partes else archivo.parent.name
        for cruda in cola.nuevo(archivo):
            try:
                d = json.loads(cruda)
            except Exception:
                continue                      # una línea rota no tumba el archivo
            m = d.get("message") or {}
            ts = d.get("timestamp")
            ses = d.get("sessionId") or d.get("session_id")
            proy = _proyecto(d.get("cwd"), carpeta)
            rama = d.get("gitBranch")
            uid = d.get("uuid")

            # ── el turno del asistente: aquí está el dinero ───────────────
            u = m.get("usage") or {}
            modelo = m.get("model")
            # `<synthetic>` no es un modelo: son mensajes que fabrica el propio
            # Claude Code. Contarlos infla los turnos y no cuesta un céntimo.
            if u and modelo and modelo != "<synthetic>" and ts:
                cc = u.get("cache_creation") or {}
                w1h = cc.get("ephemeral_1h_input_tokens") or 0
                w5m = cc.get("ephemeral_5m_input_tokens") or 0
                if not (w1h or w5m):
                    w5m = u.get("cache_creation_input_tokens") or 0
                det = u.get("output_tokens_details") or {}
                cur = cx.execute(
                    """INSERT OR IGNORE INTO uso
                       (fuente,sesion,proyecto,ts,modelo,velocidad,esfuerzo,
                        t_entrada,t_salida,t_pensamiento,t_cache_lee,t_cache_5m,t_cache_1h,rama,ref)
                       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
                    (FUENTE, ses, proy, ts, modelo,
                     u.get("speed") or "standard", d.get("effort"),
                     u.get("input_tokens") or 0, u.get("output_tokens") or 0,
                     det.get("thinking_tokens") or 0,
                     u.get("cache_read_input_tokens") or 0, w5m, w1h,
                     rama, m.get("id") or uid),
                )
                # Filas NUEVAS, no líneas procesadas: `total_changes` es acumulado
                # de la conexión y contaba cada línea con `usage` aunque el
                # INSERT OR IGNORE la descartara por repetida.
                n += max(cur.rowcount, 0)

            # ── lo que le pediste ────────────────────────────────────────
            if m.get("role") == "user" and ts and not d.get("isSidechain"):
                c = m.get("content")
                texto = c if isinstance(c, str) else " ".join(
                    b.get("text", "") for b in c if isinstance(b, dict) and b.get("type") == "text"
                ) if isinstance(c, list) else ""
                texto = texto.strip()
                # Por el canal «user» no sólo llegan tus prompts: también
                # resultados de herramienta, marcadores de imagen adjunta,
                # cabeceras que inyecta una skill al cargarse y avisos del
                # sistema. Sin este filtro, el detector de patrones concluía
                # que «[image: original 2796x1290…]» era un hábito tuyo que
                # merecía convertirse en skill.
                if texto and _es_tuyo(texto):
                    cx.execute(
                        "INSERT OR IGNORE INTO prompts (sesion,fuente,ts,texto,ref) VALUES (?,?,?,?,?)",
                        (ses, FUENTE, ts, texto[:4000], uid),
                    )

            # ── qué se invocó ────────────────────────────────────────────
            for b in (m.get("content") or []) if isinstance(m.get("content"), list) else []:
                if not (isinstance(b, dict) and b.get("type") == "tool_use"):
                    continue
                nombre, inp = b.get("name"), (b.get("input") or {})
                if nombre == "Skill" and inp.get("skill"):
                    clase, nom = "skill", inp["skill"]
                elif nombre in ("Task", "Agent") and inp.get("subagent_type"):
                    clase, nom = "agente", inp["subagent_type"]
                elif nombre and nombre.startswith("mcp__"):
                    clase, nom = "mcp", nombre.split("__")[1]
                else:
                    clase, nom = "herramienta", nombre
                if nom and ts:
                    cx.execute(
                        "INSERT OR IGNORE INTO invocaciones (ts,sesion,fuente,clase,nombre,ref) VALUES (?,?,?,?,?,?)",
                        (ts, ses, FUENTE, clase, nom, b.get("id")),
                    )

    # ── las sesiones se derivan de lo cargado, no se leen aparte ─────────
    cx.execute(
        """INSERT INTO sesiones (id,fuente,inicio,fin,proyecto,rama,mensajes)
           SELECT sesion, ?, MIN(ts), MAX(ts), MAX(proyecto), MAX(rama), COUNT(*)
             FROM uso WHERE fuente=? AND sesion IS NOT NULL GROUP BY sesion
           ON CONFLICT(id) DO UPDATE SET
             fin=excluded.fin, mensajes=excluded.mensajes, proyecto=excluded.proyecto""",
        (FUENTE, FUENTE),
    )
    cx.execute(
        """UPDATE sesiones SET titulo = (
             SELECT substr(p.texto,1,160) FROM prompts p
              WHERE p.sesion = sesiones.id ORDER BY p.ts LIMIT 1)
           WHERE fuente=? AND titulo IS NULL""",
        (FUENTE,),
    )
    anotar_salud(cx, FUENTE, int((time.time() - t0) * 1000), n, None)
    return n
