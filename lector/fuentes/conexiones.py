"""
Todo lo que tienes enchufado.

Dos vías, las dos por lectura de archivos de configuración:

  conector   los conectores de claude.ai que la cuenta tiene activados,
             tal y como los apunta `~/.claude.json` (MOTOR_CLAUDE_JSON)
  mcp        los servidores MCP declarados: los de `~/.claude.json` y los de
             cada `.mcp.json` listado en MOTOR_MCP_JSON

REGLA DE SEGURIDAD, SIN EXCEPCIÓN: este lector no abre ningún `.env`. De la
declaración de un servidor MCP guarda el nombre, el ejecutable o la URL SANEADA
(esquema, host y ruta sin query, con los segmentos largos enmascarados: hay
servidores remotos que llevan la clave en la propia URL) y CUÁNTAS variables de
entorno usa — nunca sus nombres ni sus valores. Los argumentos del comando no
se guardan.
"""
from __future__ import annotations

import json
import re
import time
from pathlib import Path
from urllib.parse import urlsplit

from comun import MCP_JSON, RUTAS, anotar_salud, corta

FUENTE = "conexiones"


def _marca(nombre: str) -> str:
    """
    El lector NO decide la marca: guarda el nombre en minúscula y deja que la
    interfaz elija el logotipo. Aquí adivinarlo mal salió caro — Gmail, Drive
    y Calendar acabaron con el icono de OpenAI.
    """
    return nombre.lower()


# Un segmento de ruta con pinta de secreto: largo, o una tira de hex/base64.
_PARECE_SECRETO = re.compile(r"^(?=.*\d)[A-Za-z0-9_\-.=+]{16,}$")


def url_segura(url: str) -> str:
    """
    `esquema://host/ruta`, sin usuario, contraseña, query ni fragmento, y con
    cualquier segmento que parezca un token cambiado por «…».
    """
    try:
        u = urlsplit(url.strip())
    except ValueError:
        return "url no legible"
    if not u.scheme or not u.hostname:
        return "url no legible"
    host = u.hostname + (f":{u.port}" if u.port else "")
    segmentos = ["…" if _PARECE_SECRETO.match(s) else s for s in u.path.split("/")]
    ruta = "/".join(segmentos).rstrip("/")
    return f"{u.scheme}://{host}{ruta}"


def _detalle(donde: str, v: dict) -> str:
    if v.get("command"):
        como = str(v["command"])
        como = corta(como) if como.startswith("/") else como
    elif v.get("url"):
        como = url_segura(str(v["url"]))
    else:
        como = ""
    detalle = f"{donde} · {como}"[:160]
    claves = len(v.get("env") or {})
    if claves:
        detalle += f" · usa {claves} {'variable' if claves == 1 else 'variables'} de entorno"
    return detalle


def leer(cx) -> int:
    t0, n = time.time(), 0
    cx.execute("DELETE FROM conexiones")      # es una foto, no un histórico

    def poner(ident, nombre, via, marca, detalle, estado, origen):
        cx.execute("INSERT OR REPLACE INTO conexiones VALUES (?,?,?,?,?,?,?,0,NULL)",
                   (ident, nombre, via, marca, detalle, estado, origen))

    # ── 1 · ~/.claude.json: conectores de claude.ai y MCP de usuario ─────
    cfg: Path | None = RUTAS["claude_json"]
    if cfg is not None and cfg.exists():
        try:
            d = json.loads(cfg.read_text())
        except Exception as e:
            anotar_salud(cx, FUENTE, int((time.time() - t0) * 1000), 0,
                         f"{corta(cfg)} ilegible: {type(e).__name__}")
            return 0
        for nombre in d.get("claudeAiMcpEverConnected") or []:
            limpio = str(nombre).replace("claude.ai ", "")
            # `claudeAiMcpEverConnected` sólo dice que se conectó ALGUNA VEZ.
            # No prueba que hoy funcione: por eso «declarada», no «conectada».
            poner(f"conector:{limpio}", limpio, "conector", _marca(limpio),
                  "conectado alguna vez desde tu cuenta de Claude", "declarada", corta(cfg))
            n += 1
        for nombre, v in (d.get("mcpServers") or {}).items():
            if isinstance(v, dict):
                poner(f"mcp:{nombre}", nombre, "mcp", _marca(nombre),
                      _detalle("usuario", v), "declarada", corta(cfg))
                n += 1

    # ── 2 · los .mcp.json de tus proyectos ───────────────────────────────
    for ruta in MCP_JSON:
        if not ruta.exists():
            continue
        try:
            servidores = json.loads(ruta.read_text()).get("mcpServers") or {}
        except Exception:
            continue
        for nombre, v in servidores.items():
            if isinstance(v, dict):
                poner(f"mcp:{nombre}", nombre, "mcp", _marca(nombre),
                      _detalle(ruta.parent.name or "proyecto", v), "declarada", corta(ruta))
                n += 1

    # ── 3 · qué se ha usado de verdad ────────────────────────────────────
    cx.execute("""
        UPDATE conexiones SET
          usos = COALESCE((SELECT COUNT(*) FROM invocaciones i
                            WHERE i.clase='mcp'
                              AND (LOWER(i.nombre) = LOWER(conexiones.nombre)
                                OR LOWER(i.nombre) LIKE '%'||LOWER(REPLACE(conexiones.nombre,' ',''))||'%')), 0),
          ultimo_uso = (SELECT MAX(i.ts) FROM invocaciones i
                         WHERE i.clase='mcp'
                           AND (LOWER(i.nombre) = LOWER(conexiones.nombre)
                             OR LOWER(i.nombre) LIKE '%'||LOWER(REPLACE(conexiones.nombre,' ',''))||'%'))""")

    anotar_salud(cx, FUENTE, int((time.time() - t0) * 1000), n, None,
                 nota="Sólo se lee configuración declarada: que un conector o un MCP "
                      "esté aquí no prueba que responda.")
    return n
