"""
Memoria · qué sabe la IA de ti, y cuánto de eso está rancio.

Recorre los sistemas de memoria —una bóveda de notas markdown (MOTOR_NOTAS),
las memorias por proyecto de Claude Code y las de Hermes— y anota cuándo se tocó cada
archivo por última vez. La frescura es la cifra que importa: una memoria vieja
no es neutral, es contexto equivocado que se cuela en cada sesión nueva.

No lee el CONTENIDO más allá del título y los enlaces. Ni falta que hace.
"""
from __future__ import annotations

import re
import time
from pathlib import Path

from comun import RUTAS, anotar_salud, corta

FUENTE = "memoria"
ENLACE = re.compile(r"\[\[([^\]|#]+)")
RANCIO_DIAS = 10


def _sistemas():
    # `**/*.md` y no `*.md`: una bóveda tiene carpetas y con el patrón plano
    # sólo se veían los archivos de la raíz. Sin MOTOR_NOTAS no hay bóveda.
    if RUTAS["notas"] is not None:
        yield "vault", RUTAS["notas"], "**/*.md"
    yield "claude-mem", RUTAS["claude"] / "projects", "*/memory/*.md"
    yield "hermes", RUTAS["hermes"] / "memories", "**/*.md"


def _tipo(ruta: Path, sistema: str, txt: str) -> str:
    """
    Qué es cada archivo. Los tipos son los del grafo, no una taxonomía:
    lo que se quiere ver de un vistazo es qué está en el núcleo, qué es una
    decisión que se tomó y qué es un archivo suelto.
    """
    n = ruta.name.lower()
    if n in ("memory.md", "claude.md", "agents.md", "soul.md") or n.startswith("00"):
        return "nucleo"
    if "decision" in n or "leccion" in n or "lecciones" in n:
        return "decision"
    if "registro" in str(ruta).lower() or "session" in n or "sesion" in n:
        return "sesion"
    if "skill" in n or "habilidad" in n or "/skills/" in str(ruta).lower():
        return "habilidad"
    if sistema == "vault" and ruta.parent.name and ruta.parent.name != ruta.parent.parent.name:
        return "archivo"
    return "archivo"


def leer(cx) -> int:
    t0, n = time.time(), 0
    hoy = time.time()
    entrantes: dict[str, int] = {}
    # titulo → ruta, para poder resolver los [[enlaces]] a archivos de verdad
    porTitulo: dict[str, str] = {}
    salientes: list[tuple[str, str]] = []

    cx.execute("DELETE FROM enlaces")

    for sistema, raiz, patron in _sistemas():
        if raiz is None or not raiz.is_dir():
            continue
        for f in raiz.glob(patron):
            if not f.is_file() or "/.obsidian/" in str(f):
                continue
            try:
                st = f.stat()
                txt = f.read_text(errors="ignore")
            except OSError:
                continue
            ruta = corta(f)
            salen = ENLACE.findall(txt)
            for e in salen:
                entrantes[e.strip()] = entrantes.get(e.strip(), 0) + 1
                salientes.append((ruta, e.strip()))
            porTitulo.setdefault(f.stem, ruta)
            cx.execute(
                """INSERT INTO memoria
                   (ruta,sistema,titulo,modificado,dias_sin_tocar,bytes,enlaces_salen,tipo)
                   VALUES (?,?,?,?,?,?,?,?)
                   ON CONFLICT(ruta) DO UPDATE SET
                     modificado=excluded.modificado, dias_sin_tocar=excluded.dias_sin_tocar,
                     bytes=excluded.bytes, enlaces_salen=excluded.enlaces_salen,
                     tipo=excluded.tipo""",
                (ruta, sistema, f.stem,
                 time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(st.st_mtime)),
                 int((hoy - st.st_mtime) / 86400), st.st_size, len(salen),
                 _tipo(f, sistema, txt)),
            )
            n += 1

    # ── las aristas del grafo ────────────────────────────────────────────
    # Un [[enlace]] que apunta a una nota que no existe NO se guarda como
    # arista: se cuenta aparte como «faltante». Dibujar una línea hacia la nada
    # sería inventarse la mitad del grafo.
    faltan = 0
    for origen, titulo in salientes:
        destino = porTitulo.get(titulo)
        if destino:
            cx.execute("INSERT OR IGNORE INTO enlaces VALUES (?,?)", (origen, destino))
        else:
            faltan += 1

    for nombre, cuantos in entrantes.items():
        cx.execute(
            "UPDATE memoria SET enlaces_entran=? WHERE titulo=? AND sistema='vault'",
            (cuantos, nombre),
        )
    cx.execute("INSERT OR REPLACE INTO state_motor VALUES ('enlaces_faltantes', ?)", (str(faltan),))
    anotar_salud(cx, FUENTE, int((time.time() - t0) * 1000), n, None,
                 nota=f"{faltan} enlaces apuntan a notas que no existen" if faltan else None)
    return n
