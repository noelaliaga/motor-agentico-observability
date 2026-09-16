#!/usr/bin/env python3
"""
El sueño.

Mira lo que hiciste, encuentra lo que se puede mejorar y te lo cuenta. Es la
ÚNICA pieza del motor que usa un modelo — y aun así no decide nada:

  detectores.py  encuentra los hallazgos y calcula las cifras (SQL puro)
  claude -p      los convierte en algo que apetezca leer
  la base        los guarda para que la web los pinte

El modelo recibe los hechos ya calculados y tiene prohibido tocar un número.
No busca patrones, no deduce y no consulta nada: redacta. Si mañana el modelo
desaparece, el sueño sigue funcionando: se quedaría sin prosa, no sin hallazgos.

  python3 lector/sonar.py                    sueña ahora (llama a `claude -p`)
  python3 lector/sonar.py --seco             hallazgos por pantalla, sin modelo
  python3 lector/sonar.py --seco --guardar   y además los guarda sin redactar
  python3 lector/sonar.py --descartar N      entierra una sugerencia para siempre

NO ACTÚA SOBRE NADA. No toca archivos ajenos y sólo escribe en la base del
motor. Lo que sí lanza, y conviene saberlo:
  - la pasada previa del lector, que ejecuta comandos que SÓLO LISTAN
    (`launchctl list`, `hermes cron list`; se apagan con MOTOR_CRON_COMANDOS=0);
  - sin --seco, `claude -p` para redactar.

QUÉ SALE DE LA MÁQUINA (y qué no)
  --seco             nada: sin modelo, y la pasada previa se hace SIN la fuente
                     de OpenRouter (no hay petición de red).
  sin --seco         la pasada previa incluye OpenRouter si hay
                     OPENROUTER_API_KEY, y los HECHOS de cada hallazgo viajan a
                     Anthropic vía `claude -p`. Los hechos pueden incluir el
                     inicio de un prompt tuyo, títulos de notas de memoria y
                     nombres de proyecto. Son texto NO CONFIABLE (sale de tus
                     transcripciones): el modelo corre sin ninguna herramienta
                     y su salida sólo se guarda como texto.
  MOTOR_SUENO_LEE=1  además, fragmentos de tus conversaciones de las últimas
                     24 h (apagado por defecto).
"""
from __future__ import annotations

import json
import os
import shutil
import subprocess
import sys
import tempfile
import time
import unicodedata
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import conversaciones  # noqa: E402
import detectores  # noqa: E402
import lector  # noqa: E402
from comun import USUARIO, abrir  # noqa: E402

# Se resuelve a ruta absoluta a propósito. Cuando el sueño lo dispara launchd
# a las siete de la mañana, el trabajo arranca con un PATH mínimo: un «claude»
# a secas no se encuentra y la tarea falla en silencio todas las noches.
MODELO_CLI = os.environ.get("MOTOR_CLAUDE_CLI") or shutil.which("claude") or "claude"
LIMITE_S = 300
CUANTAS = 4          # cuatro por mañana. Más es una lista de tareas, no un consejo.
CUANTAS_LEIDAS = 2   # y como mucho dos salidas de leerte, que son las que más duelen

SISTEMA = """Eres la voz del Motor Agéntico. Escribes UNA nota corta por hallazgo,
para que __USUARIO__ la lea con el café.

TE DOY LOS HECHOS YA CALCULADOS. Tu trabajo es decirlos bien. Nada más.

REGLAS QUE NO SE ROMPEN
1. Castellano de España. Tuteo. Directo, sin florituras y sin vender nada.
2. PROHIBIDO cambiar, redondear, sumar o inventar un número. Si una cifra no
   está en los HECHOS, no existe.
3. PROHIBIDO recomendar que se ejecute algo automáticamente. Tú sugieres; él decide.
4. Nada de «deberías considerar», «te recomiendo encarecidamente», «es importante
   destacar». Habla como alguien que ha mirado los datos y te lo cuenta.
5. Sin emojis, sin exclamaciones, sin markdown.
6. NO REGAÑES. Esto no es una auditoría de sus fallos: es la ayuda de alguien que
   mira los números por él. Un dato incómodo se dice una vez, sin moraleja y sin
   repetirlo en el cierre. Si el hallazgo no lleva a nada que se pueda hacer
   mañana, no merece nota.

FORMATO DE CADA NOTA
- titulo: una frase con la cifra dentro. Máximo 90 caracteres.
- cuerpo: 3 o 4 frases. Qué pasa, qué le cuesta y qué hacer. El peso va en el
  qué hacer, no en el fallo.
- prompt: EL TEXTO QUE ÉL VA A PEGAR. Léelo bien, porque es donde más se falla:

  Es un prompt, no un consejo. Se copia tal cual y se pega en el chat con su
  asistente. Va escrito COMO SI LO ESCRIBIERA ÉL, dando una orden a la IA.

  MAL (esto es un consejo disfrazado, no sirve):
    «Empieza la sesión pidiendo un plan antes de tocar archivos.»
    «Añade al prompt la regla de cierre.»
  BIEN (esto se pega y funciona):
    «Antes de editar ningún archivo, hazme un plan numerado y espera a que lo
     apruebe. Si el plan pasa de cinco pasos, párate y pregúntame.»
    «Cuando el contador supere 13, avisa y cancela la vigilancia sin esperar
     confirmación.»

  Reglas del prompt: imperativo, dirigido a la IA, en segunda persona. Se
  entiende solo, sin haber leído la nota. Una a tres frases. Nada de explicar
  por qué. Nada de nombrar a __USUARIO__ ni al hallazgo. Si el hallazgo no se arregla
  con un prompt (por ejemplo, borrar archivos viejos), devuelve prompt vacío:
  un prompt de relleno es peor que ninguno.

Devuelves SOLO un array JSON: [{"i":0,"titulo":"…","cuerpo":"…","prompt":"…"}, …]
Un objeto por hallazgo, en el mismo orden que te los doy.
Nada antes ni después del JSON.""".replace("__USUARIO__", USUARIO)


# ── el gancho ────────────────────────────────────────────────────────────
# Dos palabras en imperativo encima del titular: lo que hay que hacer, antes
# de contar por qué. Sale de la huella, no del modelo — un gancho generado
# cambiaría cada noche y dejaría de ser un ancla para el ojo.
GANCHOS = {
    "metodo·sinplan":  "Planifica antes",
    "metodo·maraton":  "Cierra el ciclo",
    "modelo·corto":    "Baja de modelo",
    "modelo":          "Elige mejor el modelo",
    "foco":            "Mira dónde va el tiempo",
    "patron":          "Compón tus skills",
    "sesion":          "Parte la sesión",
    "cache":           "Aprovecha la caché",
    "memoria":         "Limpia la memoria",
    "dormido":         "Despierta o tira",
    "tarifa":          "Revisa la tarifa",
    "leido":           "Lo que dijiste",
}


def gancho_de(huella: str) -> str:
    """El más específico gana: `metodo·sinplan` antes que `metodo`."""
    partes = huella.split("·")
    for largo in (2, 1):
        clave = "·".join(partes[:largo])
        if clave in GANCHOS:
            return GANCHOS[clave]
    return "Vale la pena mirarlo"


def extraer_json(texto: str) -> list:
    """
    El array JSON de la respuesta del modelo, venga como venga.

    Pese a pedirle «sólo JSON», a veces lo envuelve en ```json … ``` o añade
    una frase delante. Se toma lo que hay entre el primer «[» y el último «]».
    """
    texto = (texto or "").strip()
    if texto.startswith("```"):
        texto = texto.split("```")[1]
        if texto.startswith("json"):
            texto = texto[4:]
        texto = texto.strip()
    return json.loads(texto[texto.index("["): texto.rindex("]") + 1])


# Los hechos incluyen texto que sale de tus transcripciones (inicio de prompts,
# títulos de notas): es texto no confiable y puede intentar dar órdenes. Por eso
# el modelo corre sin NINGUNA herramienta y sin nada de tu configuración:
#   --tools ""               ninguna herramienta integrada (ni las futuras)
#   --strict-mcp-config      ningún servidor MCP (no se pasa --mcp-config)
#   --setting-sources ""     ni settings de usuario, ni de proyecto, ni locales
#                            (así tampoco sus hooks ni sus permisos)
#   cwd vacío                ningún CLAUDE.md del directorio de trabajo
# Su salida sólo se guarda como texto; nada la ejecuta.
FLAGS_SIN_HERRAMIENTAS = ["--tools", "", "--strict-mcp-config", "--setting-sources", ""]


def _llamar(prompt: str) -> dict:
    with tempfile.TemporaryDirectory(prefix="motor-sueno-") as vacio:
        r = subprocess.run(
            [MODELO_CLI, "-p", prompt, "--output-format", "json", *FLAGS_SIN_HERRAMIENTAS],
            capture_output=True, text=True, timeout=LIMITE_S, cwd=vacio,
        )
    if r.returncode != 0:
        raise RuntimeError((r.stderr or r.stdout)[-400:])
    return json.loads(r.stdout)


def redactar(hallazgos: list[dict]) -> tuple[list[dict], float | None, int | None]:
    lote = "\n\n".join(
        f"HALLAZGO {i}\nasunto: {h['asunto']}\nhechos:\n" +
        "\n".join(f"  - {f}" for f in h["hechos"])
        for i, h in enumerate(hallazgos)
    )
    d = _llamar(f"{SISTEMA}\n\n───────────\n\n{lote}")
    notas = extraer_json(d.get("result") or "")
    return notas, d.get("total_cost_usd"), d.get("duration_ms")


LECTOR = """Estás mirando cómo trabaja __USUARIO__ con su asistente de IA. Te doy los intercambios
de las últimas 24 horas: lo que él pidió y la primera línea de lo que le contestaron.

Tu trabajo NO es resumir lo que construyó. Es encontrar UNO o DOS patrones en CÓMO trabaja,
de los que sólo se ven leyendo.

QUÉ BUSCAR (ejemplos, no lista cerrada)
- Pide lo mismo dos o tres veces porque la primera respuesta no valía: el encargo inicial
  iba corto de contexto.
- Arranca a construir sin decir a dónde va, y corrige a mitad.
- Corrige siempre en la misma dirección (más corto, más concreto, menos adornos): eso
  debería estar en el encargo desde el principio, no en la corrección.
- Hace a mano algo para lo que ya tiene una herramienta o una skill.
- Interrumpe trabajos largos porque no sabía cuánto iban a tardar.

REGLAS QUE NO SE ROMPEN
1. Cada patrón CITA LITERALMENTE algo que escribió __USUARIO__. Entre comillas y textual. Si no
   puedes citarlo, no lo has visto: no lo escribas.
2. No juzgas ni halagas, y no regañas. Describes lo que pasó, qué le costó y
   cómo se evita la próxima vez. El valor está en lo segundo.
3. Castellano de España, tuteo. Tres o cuatro frases por patrón.
4. Si en 24 horas no hay ningún patrón claro, devuelves un array vacío. Es una respuesta
   perfectamente válida y mejor que inventarse uno.

Devuelves SOLO un array JSON:
[{"titulo":"...", "cuerpo":"...", "cita":"lo que él escribió, textual", "prompt":"el texto que él pega en el chat"}]

El campo `prompt` NO es un consejo. Es el texto que se copia y se pega tal cual en
el chat con su asistente, escrito como si lo escribiera él, en imperativo y
dirigido a la IA. Se tiene que entender sin haber leído la nota.
  MAL:  «Da el criterio de qué dejar fuera antes de encargar el texto.»
  BIEN: «Antes de escribir nada, pregúntame qué no debe aparecer en el texto y
        espera mi respuesta.»
Una a tres frases. Si el patrón no se arregla con un prompt, devuelve prompt vacío.
Nada antes ni después del JSON.""".replace("__USUARIO__", USUARIO)


CITA_MINIMA = 12   # una cita de tres letras aparece en cualquier parte


def _normal(texto: str) -> str:
    """Minúsculas, comillas tipográficas fuera y espacios colapsados."""
    t = unicodedata.normalize("NFKC", texto or "").lower()
    for c in "\"'«»“”‘’":
        t = t.replace(c, "")
    return " ".join(t.split())


def cita_literal(cita: str, textos: list[str]) -> bool:
    """La cita ENTERA tiene que estar en algo que escribió el usuario."""
    c = _normal(cita)
    return len(c) >= CITA_MINIMA and any(c in _normal(t) for t in textos)


def lee_conversaciones() -> bool:
    """Leer conversaciones manda fragmentos de prompts fuera: sólo si se pide."""
    return os.environ.get("MOTOR_SUENO_LEE") == "1"


def leer_conversaciones(cx) -> list[dict]:
    """
    La única parte del motor que LEE en vez de contar.

    Un contador ve que editaste veinte archivos; no ve que pediste tres veces
    lo mismo. Eso sólo está en el texto, y para leerlo hace falta un modelo.

    El seguro contra la invención es la cita: cada patrón tiene que traer entre
    comillas algo que el usuario escribió de verdad. Si no cita, se tira.

    Apagado por defecto: sólo corre con MOTOR_SUENO_LEE=1.
    """
    xs = conversaciones.recientes(24)
    if len(xs) < 6:
        return []
    texto = conversaciones.como_texto(xs)
    try:
        d = _llamar(f"{LECTOR}\n\n───────────\n\n{texto}")
    except Exception as e:
        print(f"[sueño] lectura falló: {str(e)[-200:]}")
        return []
    try:
        notas = extraer_json(d.get("result") or "")
    except Exception:
        return []

    fuera = []
    for n in notas[:CUANTAS_LEIDAS]:
        cita = (n.get("cita") or "").strip().strip('"«»')
        # LA REGLA: si la cita ENTERA no aparece de verdad en lo que escribió,
        # fuera. Un modelo que parafrasea (o que empieza citando y sigue
        # inventando) es exactamente el fallo que este motor existe para no
        # cometer.
        if not cita_literal(cita, [x["tuyo"] for x in xs]):
            print(f"[sueño] descartada por cita inventada: {n.get('titulo','?')[:60]}")
            continue
        fuera.append({
            "categoria": "método",
            "titulo": (n.get("titulo") or "").strip(),
            "cuerpo": (n.get("cuerpo") or "").strip(),
            "hechos": [f"tú escribiste: «{cita}»",
                       f"leído de {len(xs)} intercambios de las últimas 24 horas"],
            "accion": (n.get("prompt") or n.get("consejo") or "").strip() or None,
            "huella": "leido·" + cita[:40].lower(),
            "origen": "leído",
        })
    return fuera


def sonar(seco=False, guardar=False, cx=None) -> int:
    cx = cx or abrir(escritura=True)

    # El sueño se alimenta solo. Antes leía lo que hubiera en la base dando por
    # hecho que el lector seguía vivo. Cuando el lector se paró el 26/08 nadie
    # se enteró: el sueño siguió escribiendo notas de aspecto perfectamente
    # normal sobre datos congelados de cinco días atrás. Una pasada aquí cuesta
    # ~2 s sobre una tarea de minutos y quita esa dependencia silenciosa.
    # En --seco la pasada va sin OpenRouter: «seco» significa que nada sale.
    fuentes = [f for f in lector.FUENTES if f != "openrouter"] if seco else None
    try:
        lector.preparar(cx)
        lector.pasada(cx, fuentes=fuentes)
    except Exception as e:
        # Que falle la ingesta no debe costarte la nota diaria: se avisa en el
        # log —esto antes no avisaba de nada— y se sueña con lo que ya hubiera.
        print(f"[sueño] la pasada previa falló ({type(e).__name__}: {e}); "
              "se sueña con lo que ya hay en la base", flush=True)

    hallazgos = detectores.hallar(cx)

    # Lo que ya está enterrado no vuelve. Lo que ya está en pantalla tampoco
    # se duplica: la huella es la condición, no el texto.
    vistas = {r[0] for r in cx.execute("SELECT huella FROM sueno")}
    nuevos = [h for h in hallazgos if h["huella"] not in vistas][:CUANTAS]

    # Una sugerencia cuya condición ya no se cumple se marca `resuelta` y sale
    # de la portada. OJO con la palabra: significa «ya no se cumple», NO «alguien
    # la aplicó» — el motor no puede saber por qué dejó de cumplirse. La web la
    # enseña así, y no hay botón porque escribiría en la base desde la web.
    vivas = {h["huella"] for h in hallazgos}
    huecos = ",".join("?" * len(vivas)) or "''"
    cx.execute(f"UPDATE sueno SET estado='resuelta' WHERE estado='nueva' AND huella NOT IN ({huecos})",
               tuple(vivas))

    # Lo LEÍDO va aparte de lo MEDIDO y se marca como tal en pantalla: son
    # dos clases de verdad distintas y mezclarlas sería tramposo.
    leidas = [] if seco or not lee_conversaciones() else leer_conversaciones(cx)
    leidas = [x for x in leidas if x["huella"] not in vistas]

    hoy = time.strftime("%Y-%m-%d")
    if seco or (not nuevos and not leidas):
        for h in hallazgos:
            print(f"[{h['categoria']:<8}] {h['asunto']}")
            for f in h["hechos"]:
                print(f"           · {f}")
        guardadas = 0
        if seco and guardar:
            # Sin modelo no hay prosa: el titular es el asunto calculado y el
            # cuerpo lo dice. Las cifras van íntegras en la evidencia.
            for h in nuevos:
                cx.execute(
                    """INSERT OR IGNORE INTO sueno
                       (fecha,categoria,titulo,cuerpo,evidencia,accion,estado,huella,origen,gancho)
                       VALUES (?,?,?,?,?,?,'nueva',?,'medido',?)""",
                    (hoy, h["categoria"], h["asunto"],
                     "Hallazgo calculado con SQL y guardado sin redactar (modo --seco, sin "
                     "modelo de lenguaje). Las cifras exactas están en la evidencia.",
                     json.dumps(h["hechos"], ensure_ascii=False), h.get("accion"),
                     h["huella"], gancho_de(h["huella"])),
                )
                guardadas += 1
        cx.commit()
        print(f"\n{len(nuevos)} nuevos de {len(hallazgos)}"
              + (f" · {guardadas} guardados sin redactar" if guardar else ""))
        return guardadas

    t0 = time.time()
    notas, coste, ms = redactar(nuevos) if nuevos else ([], 0, 0)
    porIndice = {n.get("i", i): n for i, n in enumerate(notas)}
    # La fecha del sueño es un DÍA DE CALENDARIO para quien lo lee, no una
    # marca de tiempo: va en hora local. Con UTC, cualquier pasada entre
    # medianoche y las dos de la mañana se fechaba en el día anterior y el
    # panel enseñaba «anoche» apuntando a antesdeayer. (`hoy` se fija arriba.)
    n = 0
    for i, h in enumerate(nuevos):
        nota = porIndice.get(i)
        if not nota:
            continue
        cx.execute(
            """INSERT OR IGNORE INTO sueno
               (fecha,categoria,titulo,cuerpo,evidencia,accion,estado,huella,gancho)
               VALUES (?,?,?,?,?,?,'nueva',?,?)""",
            (hoy, h["categoria"], nota["titulo"].strip(), nota["cuerpo"].strip(),
             json.dumps(h["hechos"], ensure_ascii=False),
             (nota.get("prompt") or "").strip() or h.get("accion"), h["huella"],
             gancho_de(h["huella"])),
        )
        n += 1
    for x in leidas:
        cx.execute(
            """INSERT OR IGNORE INTO sueno
               (fecha,categoria,titulo,cuerpo,evidencia,accion,estado,huella,origen,gancho)
               VALUES (?,?,?,?,?,?,'nueva',?,'leído',?)""",
            (hoy, x["categoria"], x["titulo"], x["cuerpo"],
             json.dumps(x["hechos"], ensure_ascii=False), x["accion"], x["huella"],
             gancho_de(x["huella"])),
        )
        n += 1
    cx.commit()
    print(f"[sueño] {n} notas ({len(leidas)} de leerte) · {int((time.time()-t0)*1000)} ms · "
          f"coste {f'${coste:.4f}' if coste else 'sin dato'}")
    return n


def descartar(ident: int):
    cx = abrir(escritura=True)
    cx.execute("UPDATE sueno SET estado='descartada' WHERE id=?", (ident,))
    cx.commit()
    print(f"[sueño] {ident} enterrada. No volverá a proponerse.")


if __name__ == "__main__":
    if "--descartar" in sys.argv:
        descartar(int(sys.argv[sys.argv.index("--descartar") + 1]))
    else:
        sonar(seco="--seco" in sys.argv, guardar="--guardar" in sys.argv)
