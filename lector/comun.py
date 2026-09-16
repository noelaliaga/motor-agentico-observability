"""Lo que comparten todos los lectores. Nada de lógica de negocio aquí."""
from __future__ import annotations

import os
import sqlite3
import time
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent


def _ruta(var: str, defecto: Path | None) -> Path | None:
    valor = os.environ.get(var)
    if valor:
        return Path(valor).expanduser()
    return defecto


def _lista(var: str) -> list[Path]:
    """Una variable con varias rutas separadas por `os.pathsep` (':' en Unix)."""
    return [Path(p).expanduser() for p in os.environ.get(var, "").split(os.pathsep) if p]


# La casa: la raíz desde la que se buscan las fuentes. Por defecto, tu $HOME.
# Para la demo apunta a una home sintética y el motor no ve nada real.
CASA = _ruta("MOTOR_CASA", Path.home())
BASE = _ruta("MOTOR_BASE", RAIZ / "data" / "motor.sqlite")

# El nombre con el que el sueño se dirige al usuario en sus prompts.
USUARIO = os.environ.get("MOTOR_USUARIO", "").strip() or "el usuario"

# Dónde vive cada fuente. TODO configurable por entorno: ni una ruta de una
# máquina concreta escrita a fuego. Una ruta `None` significa «fuente apagada».
RUTAS: dict[str, Path | None] = {
    "claude":       _ruta("MOTOR_CLAUDE",       CASA / ".claude"),
    "claude_json":  _ruta("MOTOR_CLAUDE_JSON",  CASA / ".claude.json"),
    "codex":        _ruta("MOTOR_CODEX",        CASA / ".codex"),
    "hermes":       _ruta("MOTOR_HERMES",       CASA / ".hermes"),
    "openclaw":     _ruta("MOTOR_OPENCLAW",     CASA / ".openclaw"),
    "launchagents": _ruta("MOTOR_LAUNCHAGENTS", CASA / "Library" / "LaunchAgents"),
    # Opcionales: sin variable, la fuente no se lee.
    "notas":        _ruta("MOTOR_NOTAS",        None),   # una bóveda de notas markdown
    "multiverso":   _ruta("MOTOR_MULTIVERSO",   None),   # un índice multiverso-context-engine
}

# Ficheros .mcp.json adicionales (de tus proyectos) que el inventario y las
# conexiones deben mirar, además de los servidores de ~/.claude.json.
MCP_JSON: list[Path] = _lista("MOTOR_MCP_JSON")


def corta(ruta: Path | str | None) -> str | None:
    """
    Una ruta tal y como se guarda en la base: relativa a la casa, con «~».

    El panel enseña rutas en pantalla. Guardarlas absolutas metería el nombre
    de usuario de la máquina en cada captura; relativas a la casa dicen lo
    mismo y no delatan a nadie.
    """
    if ruta is None:
        return None
    texto = str(ruta)
    casa = str(CASA)
    if casa and texto == casa:
        return "~"
    if casa and texto.startswith(casa.rstrip("/") + "/"):
        return "~/" + texto[len(casa.rstrip("/")) + 1:]
    return texto


def abrir(escritura: bool = False, base: Path | str | None = None) -> sqlite3.Connection:
    """
    La base del motor. `escritura=False` abre en modo ro de verdad: SQLite
    rechaza cualquier INSERT a nivel de conexión. La web SIEMPRE lee en ro.
    """
    ruta = Path(base) if base is not None else BASE
    if escritura:
        ruta.parent.mkdir(parents=True, exist_ok=True)
        cx = sqlite3.connect(ruta, timeout=30)
        cx.execute("PRAGMA journal_mode=WAL")
        cx.execute("PRAGMA synchronous=NORMAL")
    else:
        cx = sqlite3.connect(f"file:{ruta}?mode=ro", uri=True, timeout=10)
    cx.row_factory = sqlite3.Row
    return cx


def solo_lectura(ruta: Path) -> sqlite3.Connection:
    """
    Abrir la base de OTRO programa. Siempre en ro, sin excepción: el motor no
    puede corromper la base de Hermes ni por accidente ni por un bug.
    """
    return sqlite3.connect(f"file:{ruta}?mode=ro", uri=True, timeout=10)


class Cola:
    """
    Lectura incremental de un archivo que sólo crece.

    Guarda cuántos bytes se leyeron ya y en la siguiente pasada hace seek().
    Los .jsonl de Claude Code y Codex nunca se reescriben: sólo se les añade
    por el final. Por eso la primera pasada cuesta y las demás, casi nada.

    El `inode` no es un adorno: si un archivo rota o se recrea, la ruta sigue
    siendo la misma pero el contenido es otro. Sin comparar inode, el motor
    haría seek() a mitad de un archivo nuevo y leería basura EN SILENCIO.
    """

    def __init__(self, cx: sqlite3.Connection, marca: str = ""):
        self.cx = cx
        # Dos fuentes distintas pueden querer recorrer los MISMOS archivos.
        # Sin una marca compartirían cursor: la primera que pasa avanza el
        # contador y la segunda no ve nada, en silencio y para siempre.
        self.marca = marca

    def nuevo(self, ruta: Path):
        try:
            st = ruta.stat()
        except OSError:
            return
        fila = self.cx.execute(
            "SELECT inode, bytes_leidos FROM lectura WHERE ruta=?", (self.marca + str(ruta),)
        ).fetchone()
        desde = 0
        if fila and fila[0] == st.st_ino and fila[1] <= st.st_size:
            desde = fila[1]
        if desde == st.st_size:
            return
        with open(ruta, "rb") as f:
            f.seek(desde)
            crudo = f.read()
        # Si el último trozo llegó a medias, se deja para la próxima pasada.
        corte = crudo.rfind(b"\n")
        if corte == -1:
            return
        for linea in crudo[: corte + 1].splitlines():
            if linea.strip():
                yield linea
        self.cx.execute(
            """INSERT INTO lectura (ruta, inode, bytes_leidos, mtime, ultima)
               VALUES (?,?,?,?,datetime('now'))
               ON CONFLICT(ruta) DO UPDATE SET
                 inode=excluded.inode, bytes_leidos=excluded.bytes_leidos,
                 mtime=excluded.mtime, ultima=excluded.ultima""",
            (self.marca + str(ruta), st.st_ino, desde + corte + 1, st.st_mtime),
        )


def anotar_salud(cx, fuente: str, ms: int, filas: int,
                 error: str | None = None, nota: str | None = None):
    """
    Deja constancia de cada pasada, también de las que fallan.

    `ultima_ok` sólo avanza si NO hubo error: así la interfaz puede decir «esta
    fuente lleva 40 minutos sin actualizarse y este es el motivo» en vez de
    enseñar un número viejo como si fuera de ahora.

    ERROR y NOTA no son lo mismo, y confundirlos costó caro: «Hermes no
    registra tokens» es una NOTA —Hermes funciona perfectamente y cargó sus
    filas— pero al guardarla como error, la barra lateral pintaba Hermes,
    OpenClaw y OpenRouter en gris, como si estuvieran caídos. Un panel que
    llama muerto a lo que está vivo es tan mentiroso como uno que inventa.
    """
    ok = None if error else ahora()
    cx.execute(
        """INSERT INTO salud (fuente, ultima_ok, ultima_intento, ms, filas, error, nota)
           VALUES (?,?,?,?,?,?,?)
           ON CONFLICT(fuente) DO UPDATE SET
             ultima_ok      = COALESCE(excluded.ultima_ok, salud.ultima_ok),
             ultima_intento = excluded.ultima_intento,
             ms = excluded.ms, filas = excluded.filas,
             error = excluded.error, nota = excluded.nota""",
        (fuente, ok, ahora(), ms, filas, error, nota),
    )


def ahora() -> str:
    return time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
