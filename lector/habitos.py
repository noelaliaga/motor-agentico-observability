"""
Los detectores de HÁBITOS.

Esto es lo que el sueño mira de verdad: no cuánto gastas, sino CÓMO trabajas.
Lee las sesiones y las herramientas que se usaron en cada una, y busca cosas
como «llevas cinco sesiones editando código sin haber planificado antes» o
«has repetido el mismo arranque catorce veces y eso es una skill».

Igual que los otros: todo se calcula con SQL y reglas escritas. El modelo sólo
lo redacta después. Un LLM al que le pides que «analice cómo trabajas» te
devuelve psicología barata; esto devuelve conteos.

Lo que NO hace: juzgar. Cada hallazgo dice el número y la consecuencia, y deja
la decisión donde tiene que estar.
"""
from __future__ import annotations

# Herramientas que significan «estoy tocando el proyecto de verdad»
ESCRITURA = ("Edit", "Write", "NotebookEdit", "MultiEdit")
# Las que significan «he parado a pensar antes»
PLANIFICAR = ("ExitPlanMode", "EnterPlanMode", "TaskCreate", "TaskUpdate", "TodoWrite")


def _sesiones_con(cx, dias=14):
    """Cada sesión con el recuento de lo que se hizo dentro."""
    return cx.execute(f"""
        SELECT s.id, s.proyecto, s.inicio, s.fin, s.mensajes,
               SUM(CASE WHEN i.nombre IN {ESCRITURA} THEN 1 ELSE 0 END) escribe,
               SUM(CASE WHEN i.nombre IN {PLANIFICAR} THEN 1 ELSE 0 END) planea,
               SUM(CASE WHEN i.clase='skill'  THEN 1 ELSE 0 END) skills,
               SUM(CASE WHEN i.clase='agente' THEN 1 ELSE 0 END) agentes,
               SUM(CASE WHEN i.nombre='Bash'  THEN 1 ELSE 0 END) bash,
               COUNT(i.id) herramientas
          FROM sesiones s LEFT JOIN invocaciones i ON i.sesion = s.id
         WHERE s.fuente='claude_code' AND datetime(s.fin) >= datetime('now', '-{dias} days')
         GROUP BY s.id HAVING s.mensajes > 8""").fetchall()


# ── 1 · construir sin planificar ─────────────────────────────────────────
def sin_plan(cx, hoy):
    ses = _sesiones_con(cx)
    tocan = [s for s in ses if s[5] >= 5]
    if len(tocan) < 3:
        return
    a_pelo = [s for s in tocan if s[6] == 0]
    if len(a_pelo) / len(tocan) < 0.6:
        return
    peor = max(a_pelo, key=lambda s: s[5])
    yield {
        "categoria": "método",
        "asunto": f"{len(a_pelo)} de {len(tocan)} sesiones tocaron archivos sin planificar antes",
        "hechos": [
            f"{len(tocan)} sesiones de las últimas dos semanas editaron cinco archivos o más",
            f"en {len(a_pelo)} de ellas no hubo ni un paso de plan ni una lista de tareas",
            f"la más grande: «{peor[1] or 'sin proyecto'}» con {peor[5]} ediciones y {peor[4]} turnos",
            "planificar antes de editar es lo que evita rehacer a mitad",
        ],
        "accion": "Empieza la sesión con: «antes de tocar nada, hazme un plan y espera a que lo apruebe»",
        "huella": f"metodo·sinplan·{len(a_pelo)//3}",
    }


# ── 2 · sesiones interminables ───────────────────────────────────────────
def sesion_maraton(cx, hoy):
    r = cx.execute("""
        SELECT id, proyecto, mensajes,
               CAST((julianday(fin)-julianday(inicio))*24 AS INTEGER) horas
          FROM sesiones WHERE fuente='claude_code'
           AND datetime(fin) >= datetime('now','-14 days')
         ORDER BY mensajes DESC LIMIT 1""").fetchone()
    if not r or r[2] < 400:
        return
    media = cx.execute("""
        SELECT AVG(mensajes) FROM sesiones WHERE fuente='claude_code'
         AND datetime(fin) >= datetime('now','-28 days') AND mensajes > 5""").fetchone()[0] or 1
    yield {
        "categoria": "método",
        "asunto": f"Una sesión llegó a {r[2]} turnos sin cortarse",
        "hechos": [
            f"sesión de «{r[1] or 'sin proyecto'}»: {r[2]} turnos en {r[3]} horas",
            f"tu sesión media es de {media:.0f} turnos",
            f"es {r[2]/media:.0f} veces la media",
            "cuanto más larga la sesión, más contexto viejo se relee en cada turno",
        ],
        "accion": None,
        "huella": f"metodo·maraton·{r[0]}",
    }


# ── 3 · trabajas a mano lo que ya tienes empaquetado ─────────────────────
def skill_ignorada(cx, hoy):
    """
    Con cientos de skills instaladas, si una sesión hace cuarenta Bash seguidos y no invoca
    ninguna, o falta una skill para eso o hay una y no te acordabas.
    """
    ses = _sesiones_con(cx)
    brutas = [s for s in ses if s[9] >= 25 and s[7] == 0]
    if len(brutas) < 2:
        return
    total_bash = sum(s[9] for s in brutas)
    # Fuera del f-string: una barra invertida dentro de la expresión de un
    # f-string es un SyntaxError antes de Python 3.12.
    n_skills = cx.execute("SELECT COUNT(*) FROM inventario WHERE clase='skill'").fetchone()[0]
    yield {
        "categoria": "método",
        "asunto": f"{len(brutas)} sesiones a base de comandos sueltos, sin usar ni una skill",
        "hechos": [
            f"{total_bash} llamadas a la terminal repartidas en {len(brutas)} sesiones",
            "ninguna de esas sesiones invocó una skill",
            f"tienes {n_skills} skills declaradas",
            "o falta una skill para eso, o existe y no te acordaste",
        ],
        "accion": None,
        "huella": f"metodo·bruta·{len(brutas)//2}",
    }


# ── 4 · el modelo caro para el trabajo barato ────────────────────────────
def modelo_desproporcionado(cx, hoy):
    r = cx.execute("""
        SELECT modelo, COUNT(*) n, AVG(t_salida) media
          FROM uso
         WHERE datetime(ts) >= datetime('now','-14 days')
           AND modelo IN ('claude-opus-5','claude-fable-5','claude-opus-4-8')
           AND t_salida < 350
         GROUP BY modelo HAVING n > 200 ORDER BY n DESC LIMIT 1""").fetchone()
    if not r:
        return
    tot = cx.execute("""SELECT COUNT(*) FROM uso WHERE modelo=?
                          AND datetime(ts) >= datetime('now','-14 days')""", (r[0],)).fetchone()[0]
    yield {
        "categoria": "modelo",
        "asunto": f"{r[1]} turnos de {r[0]} devolvieron menos de 350 tokens",
        "hechos": [
            f"{r[1]} de {tot} turnos con respuestas muy cortas ({r[2]:.0f} tokens de media)",
            f"{r[0]} es de los caros: $25 o $50 por millón de salida",
            "Haiku 4.5 cuesta $5 por millón — cinco a diez veces menos",
            "las respuestas cortas suelen ser lecturas, confirmaciones y comprobaciones",
        ],
        "accion": None,
        "huella": f"modelo·corto·{r[0]}·{r[1]//200}",
    }


# ── 5 · el proyecto que se lleva tu tiempo ───────────────────────────────
def proyecto_dominante(cx, hoy):
    filas = cx.execute("""
        SELECT COALESCE(proyecto,'(sin proyecto)'), COUNT(*) n
          FROM uso WHERE datetime(ts) >= datetime('now','-7 days')
         GROUP BY proyecto ORDER BY n DESC""").fetchall()
    if len(filas) < 2:
        return
    total = sum(f[1] for f in filas)
    top = filas[0]
    if top[1] / total < 0.65:
        return
    yield {
        "categoria": "foco",
        "asunto": f"El {top[1]/total*100:.0f}% de tu semana se fue en «{top[0]}»",
        "hechos": [
            f"{top[1]} de {total} turnos en un solo proyecto",
            f"el segundo, «{filas[1][0]}», se quedó en {filas[1][1]}",
            f"has tocado {len(filas)} proyectos en siete días",
        ],
        "accion": None,
        "huella": f"foco·{top[0]}·{int(top[1]/total*10)}",
    }


HABITOS = [sin_plan, sesion_maraton, skill_ignorada, modelo_desproporcionado, proyecto_dominante]
