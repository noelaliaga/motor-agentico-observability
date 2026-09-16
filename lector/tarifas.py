"""
Las tarifas públicas de la API, con fecha y procedencia.

No se guardan dólares en `uso`: se guardan tokens. El dinero se calcula al
leer contra esta tabla. Así, el 1 de septiembre —cuando caduque el precio de
lanzamiento de Sonnet 5— julio sigue estando bien calculado y septiembre
también, sin tocar una fila de datos.

PROCEDENCIA: skill `claude-api` de Claude Code, tabla «Current Models»,
cacheada por Anthropic el 2026-06-24. Los multiplicadores de caché salen de
`shared/prompt-caching.md`: lectura 0,1× · escritura 5 min 1,25× · 1 h 2×.
"""

CONSULTADO = "2026-08-23"
FUENTE = "skill claude-api · tabla Current Models (caché 2026-06-24)"

# modelo, desde, hasta, $entrada/M, $salida/M
TARIFAS = [
    # ── Anthropic ────────────────────────────────────────────────────────
    ("claude-opus-5",    "2026-01-01", None,          5.0,  25.0),
    ("claude-opus-4-8",  "2026-01-01", None,          5.0,  25.0),
    ("claude-opus-4-7",  "2026-01-01", None,          5.0,  25.0),
    ("claude-opus-4-6",  "2026-01-01", None,          5.0,  25.0),
    ("claude-fable-5",   "2026-01-01", None,         10.0,  50.0),
    ("claude-mythos-5",  "2026-01-01", None,         10.0,  50.0),
    # El precio de lanzamiento de Sonnet 5 CADUCA el 31 de agosto de 2026.
    # Por eso la tabla tiene fechas: sin ellas, este dato envenenaría el
    # histórico entero el día 1 de septiembre.
    ("claude-sonnet-5",  "2026-01-01", "2026-08-31",  2.0,  10.0),
    ("claude-sonnet-5",  "2026-09-01", None,          3.0,  15.0),
    ("claude-sonnet-4-6","2026-01-01", None,          3.0,  15.0),
    ("claude-haiku-4-5", "2026-01-01", None,          1.0,   5.0),
    # ── OpenAI, para Codex ───────────────────────────────────────────────
    # Sin procedencia verificada todavía: se marcan como tales y la interfaz
    # lo advierte en vez de fingir precisión.
    ("gpt-5-codex",      "2026-01-01", None,          1.25, 10.0),
    ("gpt-5",            "2026-01-01", None,          1.25, 10.0),
]

# El modo rápido de Opus 5 / 4.8 cuesta el doble. Va aparte porque no es un
# modelo distinto: es el mismo modelo con otra tarifa.
RAPIDO = {"claude-opus-5": (10.0, 50.0), "claude-opus-4-8": (10.0, 50.0)}


def sembrar(cx):
    for modelo, desde, hasta, ent, sal in TARIFAS:
        proc = FUENTE if modelo.startswith("claude") else FUENTE + " · OpenAI SIN VERIFICAR"
        cx.execute(
            """INSERT INTO tarifas
               (modelo, desde, hasta, usd_entrada, usd_salida,
                mult_cache_lee, mult_cache_5m, mult_cache_1h, procedencia, consultado_en)
               VALUES (?,?,?,?,?,0.10,1.25,2.00,?,?)
               ON CONFLICT(modelo, desde) DO UPDATE SET
                 hasta=excluded.hasta, usd_entrada=excluded.usd_entrada,
                 usd_salida=excluded.usd_salida, procedencia=excluded.procedencia,
                 consultado_en=excluded.consultado_en""",
            (modelo, desde, hasta, ent, sal, proc, CONSULTADO),
        )
    for modelo, (ent, sal) in RAPIDO.items():
        cx.execute(
            """INSERT INTO tarifas
               (modelo, desde, hasta, usd_entrada, usd_salida,
                mult_cache_lee, mult_cache_5m, mult_cache_1h, procedencia, consultado_en)
               VALUES (?,?,?,?,?,0.10,1.25,2.00,?,?)
               ON CONFLICT(modelo, desde) DO UPDATE SET usd_entrada=excluded.usd_entrada""",
            (modelo + "  ⚡", "2026-01-01", None, ent, sal,
             FUENTE + " · modo rápido", CONSULTADO),
        )


# Las suscripciones: el denominador del ROI. VALORES DE EJEMPLO — pon aquí lo
# que pagas tú. Se siembran en la base para que el panel no los lleve a fuego.
SUSCRIPCIONES = [
    ("Plan A",        20.0, "claude_code", "2026-01-01", "valor de ejemplo · pon tu cuota"),
    ("Plan B",        20.0, "codex",       "2026-01-01", "valor de ejemplo · pon tu cuota"),
    ("OpenRouter",     0.0, "hermes,openclaw", "2026-01-01",
     "prepago por uso, no cuota: su gasto real se lee de la API"),
]


def sembrar_suscripciones(cx):
    for n, usd, cubre, desde, nota in SUSCRIPCIONES:
        cx.execute(
            """INSERT INTO suscripciones (nombre, usd_mes, cubre, desde, nota)
               VALUES (?,?,?,?,?)
               ON CONFLICT(nombre) DO UPDATE SET
                 usd_mes=excluded.usd_mes, cubre=excluded.cubre, nota=excluded.nota""",
            (n, usd, cubre, desde, nota),
        )
