"""
Los detectores del sueño.

Aquí NO hay modelo de lenguaje. Cada hallazgo se calcula con SQL y reglas
escritas, y viaja con las cifras exactas que lo sostienen. El modelo sólo lo
redacta después — no busca, no deduce y no calcula.

Es la regla de todo el motor, y tiene un motivo: un LLM al que le pides que
«encuentre patrones» en una tabla te devuelve hallazgos
plausibles y distintos cada vez. Estos son siempre los mismos ante los mismos
datos, y se pueden discutir porque están escritos.

Cada hallazgo lleva una HUELLA: si mañana la condición ya no se cumple, la
sugerencia desaparece sola. No hace falta marcarla como hecha — arreglarlo ES
marcarla como hecha.
"""
from __future__ import annotations

import datetime as dt

COSTE = """(u.t_entrada*t.usd_entrada + u.t_salida*t.usd_salida
          + u.t_cache_lee*t.usd_entrada*t.mult_cache_lee
          + u.t_cache_5m*t.usd_entrada*t.mult_cache_5m
          + u.t_cache_1h*t.usd_entrada*t.mult_cache_1h)/1e6"""
JOIN = """LEFT JOIN tarifas t
            ON t.modelo = (CASE WHEN u.velocidad='fast' THEN u.modelo||'  ⚡' ELSE u.modelo END)
           AND date(u.ts) >= date(t.desde)
           AND (t.hasta IS NULL OR date(u.ts) <= date(t.hasta))"""


def _h(*partes) -> str:
    return "·".join(str(p) for p in partes)


# ── 1 · una tarifa que caduca ────────────────────────────────────────────
def tarifa_que_caduca(cx, hoy: dt.date):
    """
    El aviso más accionable de todos y el que nadie mira: un precio con fecha
    de caducidad que ya estás usando. Cuando expire, el mismo trabajo costará
    más sin que cambie nada en tu lado.
    """
    for r in cx.execute(f"""
        SELECT t.modelo, t.hasta, t.usd_entrada, t.usd_salida,
               (SELECT usd_entrada FROM tarifas x WHERE x.modelo=t.modelo AND x.desde>t.hasta
                 ORDER BY x.desde LIMIT 1) e2,
               (SELECT usd_salida  FROM tarifas x WHERE x.modelo=t.modelo AND x.desde>t.hasta
                 ORDER BY x.desde LIMIT 1) s2,
               (SELECT COUNT(*) FROM uso u WHERE u.modelo=t.modelo AND date(u.ts) >= date('now','-14 days')) turnos,
               (SELECT COALESCE(SUM({COSTE}),0) FROM uso u {JOIN}
                 WHERE u.modelo=t.modelo AND date(u.ts) >= date('now','-28 days')) usd
          FROM tarifas t
         WHERE t.hasta IS NOT NULL AND date(t.hasta) >= date('now')
           AND date(t.hasta) <= date('now','+45 days')"""):
        modelo, hasta, e1, s1, e2, s2, turnos, usd = r
        if not turnos or not e2:
            continue
        dias = (dt.date.fromisoformat(hasta) - hoy).days
        subida = (s2 / s1 - 1) * 100 if s1 else 0
        yield {
            "categoria": "coste",
            "asunto": f"El precio de {modelo} sube el {hasta}",
            "hechos": [
                f"{modelo} está en precio de lanzamiento: ${e1}/${s1} por millón",
                f"a partir del {hasta} pasa a ${e2}/${s2} — un {subida:.0f}% más de salida",
                f"faltan {dias} días",
                f"lo has usado {turnos} veces en las últimas dos semanas",
                f"te ha costado ${usd:,.2f} equivalentes en 28 días",
            ],
            "accion": None,
            "huella": _h("tarifa", modelo, hasta),
        }


# ── 2 · memoria rancia ───────────────────────────────────────────────────
def memoria_rancia(cx, hoy):
    tot, viejos = cx.execute(
        "SELECT COUNT(*), SUM(CASE WHEN dias_sin_tocar>10 THEN 1 ELSE 0 END)"
        " FROM memoria WHERE dias_sin_tocar IS NOT NULL").fetchone()
    if not tot or not viejos or viejos / tot < 0.3:
        return
    peores = cx.execute(
        "SELECT titulo, sistema, dias_sin_tocar FROM memoria"
        " WHERE dias_sin_tocar > 10 ORDER BY dias_sin_tocar DESC LIMIT 5").fetchall()
    frescura = round((tot - viejos) / tot * 100)
    yield {
        "categoria": "memoria",
        "asunto": f"{viejos} de tus {tot} archivos de memoria llevan más de 10 días sin tocarse",
        "hechos": [
            f"frescura de la memoria: {frescura}%",
            f"{viejos} rancios de {tot} archivos",
            *[f"«{t}» ({s}) lleva {d} días congelado" for t, s, d in peores],
        ],
        "accion": None,
        "huella": _h("memoria", viejos // 10),
    }


# ── 3 · lo que tienes montado y no usas ──────────────────────────────────
def inventario_dormido(cx, hoy):
    for clase, umbral in (("skill", 0.8), ("agente", 0.7)):
        tot, usados = cx.execute(
            "SELECT COUNT(*), SUM(CASE WHEN usos>0 THEN 1 ELSE 0 END)"
            " FROM inventario WHERE clase=?", (clase,)).fetchone()
        if not tot:
            continue
        dormidos = tot - (usados or 0)
        if dormidos / tot < umbral:
            continue
        vivos = cx.execute(
            "SELECT nombre, usos FROM inventario WHERE clase=? AND usos>0"
            " ORDER BY usos DESC LIMIT 4", (clase,)).fetchall()
        yield {
            "categoria": "higiene",
            "asunto": f"Tienes {tot} {clase}s declarados y usas {usados or 0}",
            "hechos": [
                f"{dormidos} {clase}s sin estrenar nunca",
                *[f"«{n}» es de los pocos vivos: {u} invocaciones" for n, u in vivos],
                "el uso sale de contar invocaciones reales, no de lo que hay escrito",
            ],
            "accion": None,
            "huella": _h("dormido", clase, dormidos // 20),
        }


# ── 4 · una sesión que se disparó de precio ──────────────────────────────
def sesion_cara(cx, hoy):
    r = cx.execute(f"""
        SELECT u.sesion, MAX(u.proyecto), MIN(u.ts), MAX(u.ts), COUNT(*),
               COALESCE(SUM({COSTE}),0) usd, GROUP_CONCAT(DISTINCT u.modelo),
               (SELECT substr(p.texto,1,140) FROM prompts p WHERE p.sesion=u.sesion ORDER BY p.ts LIMIT 1)
          FROM uso u {JOIN}
         WHERE datetime(u.ts) >= datetime('now','-7 days') AND u.sesion IS NOT NULL
         GROUP BY u.sesion ORDER BY usd DESC LIMIT 1""").fetchone()
    if not r or (r[5] or 0) < 40:
        return
    ses, proy, ini, fin, turnos, usd, modelos, titulo = r
    media = cx.execute(f"""
        SELECT COALESCE(AVG(x),0) FROM (
          SELECT COALESCE(SUM({COSTE}),0) x FROM uso u {JOIN}
           WHERE datetime(u.ts) >= datetime('now','-28 days') AND u.sesion IS NOT NULL
           GROUP BY u.sesion)""").fetchone()[0]
    yield {
        "categoria": "coste",
        "asunto": f"Una sola sesión te costó ${usd:,.2f} esta semana",
        "hechos": [
            f"sesión {ses[:8]} · proyecto {proy or 'sin proyecto'}",
            f"{turnos} turnos con {modelos}",
            f"la sesión media de los últimos 28 días cuesta ${media:,.2f}",
            f"es {usd/media:.0f} veces la media" if media else "",
            f"empezó con: «{(titulo or '').strip()}»" if titulo else "",
        ],
        "accion": None,
        "huella": _h("sesion", ses),
    }


# ── 5 · un patrón que pide ser una skill ─────────────────────────────────
def patron_repetido(cx, hoy):
    """
    Si repites el mismo arranque muchas
    veces, eso es una skill esperando a existir. Se agrupa por las tres
    primeras palabras, que es donde vive la intención de un prompt.
    """
    filas = cx.execute("""
        SELECT LOWER(TRIM(SUBSTR(texto,1,40))) frag, COUNT(*) n, MAX(ts)
          FROM prompts WHERE datetime(ts) >= datetime('now','-14 days')
           AND LENGTH(texto) > 12
         GROUP BY LOWER(SUBSTR(texto,1,18))
        HAVING n >= 4 ORDER BY n DESC LIMIT 3""").fetchall()
    for frag, n, ultimo in filas:
        yield {
            "categoria": "skill",
            "asunto": f"Has empezado {n} prompts igual en dos semanas",
            "hechos": [
                f"{n} veces empezando por «{frag.strip()}…»",
                f"la última, {ultimo[:10]}",
                "un arranque que se repite es una skill que todavía no existe",
            ],
            "accion": None,
            "huella": _h("patron", frag[:18], n // 3),
        }


# ── 6 · caché desaprovechada ─────────────────────────────────────────────
def cache_floja(cx, hoy):
    r = cx.execute("""
        SELECT proyecto,
               COALESCE(SUM(t_cache_lee),0) lee,
               COALESCE(SUM(t_entrada + t_cache_5m + t_cache_1h),0) resto,
               COUNT(*) n
          FROM uso WHERE datetime(ts) >= datetime('now','-14 days')
           AND fuente='claude_code' AND proyecto IS NOT NULL
         GROUP BY proyecto HAVING n > 60 ORDER BY (lee*1.0/(lee+resto+1)) ASC LIMIT 1""").fetchone()
    if not r:
        return
    proy, lee, resto, n = r
    ratio = lee / (lee + resto + 1)
    if ratio > 0.75:
        return
    mejor = cx.execute("""
        SELECT proyecto, COALESCE(SUM(t_cache_lee),0)*1.0 /
               (COALESCE(SUM(t_cache_lee),0)+COALESCE(SUM(t_entrada+t_cache_5m+t_cache_1h),0)+1) r
          FROM uso WHERE datetime(ts) >= datetime('now','-14 days') AND fuente='claude_code'
         GROUP BY proyecto ORDER BY r DESC LIMIT 1""").fetchone()
    yield {
        "categoria": "coste",
        "asunto": f"En «{proy}» la caché apenas te está sirviendo",
        "hechos": [
            f"sólo el {ratio*100:.0f}% de los tokens de entrada vienen de caché",
            f"en «{mejor[0]}» ese número es del {mejor[1]*100:.0f}%",
            "la caché leída cuesta la décima parte que la entrada normal",
            f"{n} turnos medidos en dos semanas",
        ],
        "accion": None,
        "huella": _h("cache", proy, int(ratio * 10)),
    }


import habitos  # noqa: E402

# El orden importa: el sueño se queda con los primeros, y lo que más ayuda al
# usuario no es saber cuánto gastó — es saber cómo podría trabajar mejor.
DETECTORES = [
    *habitos.HABITOS,
    patron_repetido, tarifa_que_caduca, sesion_cara,
    cache_floja, memoria_rancia, inventario_dormido,
]


def hallar(cx) -> list[dict]:
    hoy = dt.date.today()
    out: list[dict] = []
    for d in DETECTORES:
        try:
            for h in d(cx, hoy):
                h["hechos"] = [x for x in h["hechos"] if x]
                out.append(h)
        except Exception as e:                      # un detector roto no calla a los demás
            print(f"[sueño] detector {d.__name__}: {type(e).__name__}: {e}")
    return out
