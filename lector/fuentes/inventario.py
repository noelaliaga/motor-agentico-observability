"""
Inventario · lo que existe declarado, se use o no.

Agentes y skills repartidos por varios sitios. La gracia no es listarlos:
es CRUZARLOS con lo que de verdad se invocó, que sale de `invocaciones`. Un
inventario sin uso es un catálogo; con uso, es un diagnóstico — y en el uso
real el diagnóstico fue que había decenas de agentes definidos y ninguno
invocado nunca.

Un mismo nombre puede estar declarado en tres ámbitos distintos. Por eso la
clave es (clase, nombre, ámbito) y no sólo el nombre.
"""
from __future__ import annotations

import json
import time
from pathlib import Path

from comun import MCP_JSON, RUTAS, anotar_salud, corta

FUENTE = "inventario"

# (carpeta dentro de MOTOR_CLAUDE, ámbito) — de dónde sale cada cosa
AGENTES = [("agents", "global")]
SKILLS = [("skills", "global")]


def _frontmatter(ruta: Path) -> dict:
    """El bloque YAML de arriba del .md. Sin dependencias: sólo hacen falta
    tres campos y un parser completo aquí sería traer una librería para nada."""
    try:
        txt = ruta.read_text(errors="ignore")[:4000]
    except OSError:
        return {}
    if not txt.startswith("---"):
        return {}
    fin = txt.find("\n---", 3)
    if fin < 0:
        return {}
    campos, clave = {}, None
    for linea in txt[3:fin].splitlines():
        if not linea.strip() or linea.strip().startswith("#"):
            continue
        if linea[0] not in " \t-" and ":" in linea:
            clave, _, v = linea.partition(":")
            clave = clave.strip()
            campos[clave] = v.strip().strip("\"'").lstrip(">|").strip()
        elif clave and linea.strip():
            campos[clave] = (campos.get(clave, "") + " " + linea.strip()).strip()
    return campos


def _casa(rel: str) -> Path:
    return Path(RUTAS["claude"]) / rel


def leer(cx) -> int:
    t0, n = time.time(), 0

    for rel, ambito in AGENTES:
        d = _casa(rel)
        if not d.is_dir():
            continue
        for f in sorted(d.glob("*.md")):
            fm = _frontmatter(f)
            cx.execute(
                """INSERT INTO inventario (clase,nombre,ambito,ruta,descripcion,modelo,modificado)
                   VALUES ('agente',?,?,?,?,?,?)
                   ON CONFLICT(clase,nombre,ambito) DO UPDATE SET
                     descripcion=excluded.descripcion, modelo=excluded.modelo,
                     modificado=excluded.modificado""",
                (fm.get("name") or f.stem, ambito, corta(f),
                 (fm.get("description") or "")[:400], fm.get("model"),
                 time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(f.stat().st_mtime))),
            )
            n += 1

    for rel, ambito in SKILLS:
        d = _casa(rel)
        if not d.is_dir():
            continue
        for sub in sorted(p for p in d.iterdir() if p.is_dir()):
            md = sub / "SKILL.md"
            fm = _frontmatter(md) if md.exists() else {}
            cx.execute(
                """INSERT INTO inventario (clase,nombre,ambito,ruta,descripcion,modificado)
                   VALUES ('skill',?,?,?,?,?)
                   ON CONFLICT(clase,nombre,ambito) DO UPDATE SET
                     descripcion=excluded.descripcion, modificado=excluded.modificado""",
                (fm.get("name") or sub.name, ambito, corta(sub),
                 (fm.get("description") or "")[:400],
                 time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(sub.stat().st_mtime))),
            )
            n += 1

    # ── MCPs y plugins ───────────────────────────────────────────────────
    for cfg, ambito in [(p, "proyecto") for p in MCP_JSON]:
        if not cfg.exists():
            continue
        try:
            for nombre, v in (json.loads(cfg.read_text()).get("mcpServers") or {}).items():
                cx.execute(
                    """INSERT INTO inventario (clase,nombre,ambito,ruta,descripcion)
                       VALUES ('mcp',?,?,?,?)
                       ON CONFLICT(clase,nombre,ambito) DO UPDATE SET descripcion=excluded.descripcion""",
                    (nombre, ambito, corta(cfg), (v.get("command") or v.get("url") or "")[:200]),
                )
                n += 1
        except Exception:
            pass

    pl = RUTAS["claude"] / "plugins" / "installed_plugins.json"
    if pl.exists():
        try:
            for nombre, vs in (json.loads(pl.read_text()).get("plugins") or {}).items():
                v = (vs or [{}])[0]
                cx.execute(
                    """INSERT INTO inventario (clase,nombre,ambito,ruta,descripcion,modificado)
                       VALUES ('plugin',?, 'global', ?, ?, ?)
                       ON CONFLICT(clase,nombre,ambito) DO UPDATE SET descripcion=excluded.descripcion""",
                    (nombre, corta(v.get("installPath")), f"v{v.get('version')}", v.get("lastUpdated")),
                )
                n += 1
        except Exception:
            pass

    # ── el cruce que convierte el catálogo en diagnóstico ────────────────
    cx.execute("""
        UPDATE inventario SET
          usos = COALESCE((SELECT COUNT(*) FROM invocaciones i
                            WHERE i.clase = inventario.clase AND i.nombre = inventario.nombre), 0),
          ultimo_uso = COALESCE((SELECT MAX(i.ts) FROM invocaciones i
                            WHERE i.clase = inventario.clase AND i.nombre = inventario.nombre),
                            inventario.ultimo_uso)
        WHERE ambito <> 'hermes'""")

    anotar_salud(cx, FUENTE, int((time.time() - t0) * 1000), n, None)
    return n
