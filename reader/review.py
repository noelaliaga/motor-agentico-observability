#!/usr/bin/env python3
"""
The nightly review.

It looks at what you did, finds what can be improved and tells you. It is the
ONLY piece of the motor that uses a model, and even so it decides nothing:

  detectors.py   finds the findings and computes the figures (pure SQL)
  claude -p      turns them into something worth reading
  the database   stores them for the web to paint

The model receives the facts already computed and is forbidden to touch a
number. It does not look for patterns, deduce or query anything: it phrases.
If the model disappeared tomorrow, the review would keep working: it would
lose its prose, not its findings.

  python3 reader/review.py                     runs the review now (calls `claude -p`)
  python3 reader/review.py --dry-run           findings on screen, no model
  python3 reader/review.py --dry-run --save    and also stores them unphrased
  python3 reader/review.py --dismiss N         buries a suggestion for good

IT ACTS ON NOTHING. It touches no one else's files and only writes to the
motor's database. What it does launch, and it is worth knowing:
  - the reader's pre-pass, which runs commands that ONLY LIST
    (`launchctl list`, `hermes cron list`; switched off with MOTOR_CRON_COMMANDS=0);
  - without --dry-run, `claude -p` to phrase the notes.

WHAT LEAVES THE MACHINE (and what does not)
  --dry-run             nothing: no model, and the pre-pass runs WITHOUT the
                        OpenRouter source (no network request).
  without --dry-run     the pre-pass includes OpenRouter if there is an
                        OPENROUTER_API_KEY, and the FACTS of each finding travel
                        to Anthropic via `claude -p`. The facts can include the
                        start of one of your prompts, memory note titles and
                        project names. They are UNTRUSTED text (it comes from your
                        transcripts): the model runs without any tool and its
                        output is only stored as text.
  MOTOR_REVIEW_READS=1  also, excerpts of your conversations from the last
                        24 h (off by default).
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
import conversations  # noqa: E402
import detectors  # noqa: E402
import reader  # noqa: E402
from common import USER, open_db  # noqa: E402

# Resolved to an absolute path on purpose. When launchd fires the review at
# seven in the morning, the job starts with a minimal PATH: a bare "claude"
# is not found and the task fails silently every night.
CLAUDE_CLI = os.environ.get("MOTOR_CLAUDE_CLI") or shutil.which("claude") or "claude"
TIMEOUT_S = 300
MAX_NOTES = 4        # four per morning. More is a to-do list, not advice.
MAX_READ_NOTES = 2   # and at most two coming from reading you, which are the ones that sting most

# The two prompts below (SYSTEM_PROMPT and READER_PROMPT) stay in Spanish on
# purpose: the notes are written for a Spanish-speaking user, and switching the
# prompts to English would change the language of the notes the model writes.
# That is a product decision, not a translation, so it was left out of the
# move to English. The JSON keys they ask for ("titulo", "cuerpo", "prompt",
# "cita") are read below exactly as the prompts name them.
SYSTEM_PROMPT = """Eres la voz del Motor Agéntico. Escribes UNA nota corta por hallazgo,
para que __USER__ la lea con el café.

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
  por qué. Nada de nombrar a __USER__ ni al hallazgo. Si el hallazgo no se arregla
  con un prompt (por ejemplo, borrar archivos viejos), devuelve prompt vacío:
  un prompt de relleno es peor que ninguno.

Devuelves SOLO un array JSON: [{"i":0,"titulo":"…","cuerpo":"…","prompt":"…"}, …]
Un objeto por hallazgo, en el mismo orden que te los doy.
Nada antes ni después del JSON.""".replace("__USER__", USER)


# ── the hook ─────────────────────────────────────────────────────────────
# Two imperative words above the headline: what to do, before saying why. It
# comes from the fingerprint, not from the model: a generated hook would change
# every night and stop being an anchor for the eye.
HOOKS = {
    "method·noplan":   "Plan first",
    "method·marathon": "Close the loop",
    "model·short":     "Step down a model",
    "model":           "Pick the model better",
    "focus":           "See where the time goes",
    "pattern":         "Compose your skills",
    "session":         "Split the session",
    "cache":           "Make the cache work",
    "memory":          "Clean up the memory",
    "dormant":         "Wake it or drop it",
    "price":           "Check the price",
    "read":            "What you said",
}


def hook_for(fingerprint: str) -> str:
    """The most specific one wins: `method·noplan` before `method`."""
    parts = fingerprint.split("·")
    for length in (2, 1):
        key = "·".join(parts[:length])
        if key in HOOKS:
            return HOOKS[key]
    return "Worth a look"


def extract_json(text: str) -> list:
    """
    The JSON array in the model's answer, however it comes.

    Despite asking for "only JSON", it sometimes wraps it in ```json … ``` or
    adds a sentence in front. What lies between the first "[" and the last "]"
    is taken.
    """
    text = (text or "").strip()
    if text.startswith("```"):
        text = text.split("```")[1]
        if text.startswith("json"):
            text = text[4:]
        text = text.strip()
    return json.loads(text[text.index("["): text.rindex("]") + 1])


# The facts include text that comes from your transcripts (start of prompts,
# note titles): it is untrusted text and may try to give orders. That is why
# the model runs without ANY tool and without any of your configuration:
#   --tools ""               no built-in tools (not even future ones)
#   --strict-mcp-config      no MCP servers (no --mcp-config is passed)
#   --setting-sources ""     no user, project or local settings
#                            (so none of their hooks or permissions either)
#   empty cwd                no CLAUDE.md from the working directory
# Its output is only stored as text; nothing executes it.
NO_TOOLS_FLAGS = ["--tools", "", "--strict-mcp-config", "--setting-sources", ""]


def _call(prompt: str) -> dict:
    with tempfile.TemporaryDirectory(prefix="motor-review-") as empty:
        r = subprocess.run(
            [CLAUDE_CLI, "-p", prompt, "--output-format", "json", *NO_TOOLS_FLAGS],
            capture_output=True, text=True, timeout=TIMEOUT_S, cwd=empty,
        )
    if r.returncode != 0:
        raise RuntimeError((r.stderr or r.stdout)[-400:])
    return json.loads(r.stdout)


def write_notes(findings: list[dict]) -> tuple[list[dict], float | None, int | None]:
    # The batch framing ("HALLAZGO", "asunto", "hechos") is part of the Spanish
    # prompt above, so it stays in Spanish too.
    batch = "\n\n".join(
        f"HALLAZGO {i}\nasunto: {h['subject']}\nhechos:\n" +
        "\n".join(f"  - {f}" for f in h["facts"])
        for i, h in enumerate(findings)
    )
    d = _call(f"{SYSTEM_PROMPT}\n\n───────────\n\n{batch}")
    notes = extract_json(d.get("result") or "")
    return notes, d.get("total_cost_usd"), d.get("duration_ms")


READER_PROMPT = """Estás mirando cómo trabaja __USER__ con su asistente de IA. Te doy los intercambios
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
1. Cada patrón CITA LITERALMENTE algo que escribió __USER__. Entre comillas y textual. Si no
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
Nada antes ni después del JSON.""".replace("__USER__", USER)


MIN_QUOTE = 12   # a three-letter quote shows up anywhere


def _normal(text: str) -> str:
    """Lower case, typographic quotes out and spaces collapsed."""
    t = unicodedata.normalize("NFKC", text or "").lower()
    for c in "\"'«»“”‘’":
        t = t.replace(c, "")
    return " ".join(t.split())


def quote_is_literal(quote: str, texts: list[str]) -> bool:
    """The WHOLE quote has to be in something the user wrote."""
    c = _normal(quote)
    return len(c) >= MIN_QUOTE and any(c in _normal(t) for t in texts)


def reads_conversations() -> bool:
    """Reading conversations sends prompt excerpts out: only when asked for."""
    return os.environ.get("MOTOR_REVIEW_READS") == "1"


def read_conversations(cx) -> list[dict]:
    """
    The only part of the motor that READS instead of counting.

    A counter sees that you edited twenty files; it does not see that you asked
    for the same thing three times. That is only in the text, and reading it
    takes a model.

    The insurance against invention is the quote: every pattern has to bring,
    in quotes, something the user really wrote. If it does not quote, it is
    thrown away.

    Off by default: it only runs with MOTOR_REVIEW_READS=1.
    """
    xs = conversations.recent(24)
    if len(xs) < 6:
        return []
    text = conversations.as_text(xs)
    try:
        d = _call(f"{READER_PROMPT}\n\n───────────\n\n{text}")
    except Exception as e:
        print(f"[review] reading failed: {str(e)[-200:]}")
        return []
    try:
        notes = extract_json(d.get("result") or "")
    except Exception:
        return []

    out = []
    for n in notes[:MAX_READ_NOTES]:
        quote = (n.get("cita") or "").strip().strip('"«»')
        # THE RULE: if the WHOLE quote does not really appear in what they
        # wrote, out. A model that paraphrases (or that starts quoting and goes
        # on making things up) is exactly the failure this motor exists not to
        # commit.
        if not quote_is_literal(quote, [x["yours"] for x in xs]):
            print(f"[review] discarded for an invented quote: {n.get('titulo','?')[:60]}")
            continue
        out.append({
            "category": "method",
            "title": (n.get("titulo") or "").strip(),
            "body": (n.get("cuerpo") or "").strip(),
            "facts": [f"you wrote: “{quote}”",
                      f"read from {len(xs)} exchanges of the last 24 hours"],
            "action": (n.get("prompt") or n.get("consejo") or "").strip() or None,
            "fingerprint": "read·" + quote[:40].lower(),
            "origin": "read",
        })
    return out


def review(dry_run=False, save=False, cx=None) -> int:
    cx = cx or open_db(write=True)

    # The review feeds itself. It used to read whatever was in the database
    # assuming the reader was still alive. When the reader stopped on 26/08
    # nobody noticed: the review kept writing perfectly normal-looking notes
    # about data frozen five days earlier. A pass here costs ~2 s on a task of
    # minutes and removes that silent dependency.
    # In --dry-run the pass goes without OpenRouter: "dry" means nothing leaves.
    sources = [f for f in reader.SOURCES if f != "openrouter"] if dry_run else None
    try:
        reader.prepare(cx)
        reader.run_pass(cx, sources=sources)
    except Exception as e:
        # A failed ingestion must not cost you the daily note: it is logged
        # (this used to say nothing at all) and the review runs on whatever is
        # already in the database.
        print(f"[review] the pre-pass failed ({type(e).__name__}: {e}); "
              "reviewing what is already in the database", flush=True)

    findings = detectors.find(cx)

    # What is already buried does not come back. What is already on screen is
    # not duplicated either: the fingerprint is the condition, not the text.
    seen = {r[0] for r in cx.execute("SELECT fingerprint FROM review_notes")}
    new = [h for h in findings if h["fingerprint"] not in seen][:MAX_NOTES]

    # A suggestion whose condition no longer holds is marked `resolved` and
    # leaves the front page. CAREFUL with the word: it means "no longer holds",
    # NOT "someone applied it"; the motor cannot know why it stopped holding.
    # The web shows it that way, and there is no button because it would write
    # to the database from the web.
    alive = {h["fingerprint"] for h in findings}
    slots = ",".join("?" * len(alive)) or "''"
    cx.execute(f"UPDATE review_notes SET status='resolved' WHERE status='new' AND fingerprint NOT IN ({slots})",
               tuple(alive))

    # What is READ goes apart from what is MEASURED and is labelled as such on
    # screen: they are two different kinds of truth and mixing them would be
    # cheating.
    read_notes = [] if dry_run or not reads_conversations() else read_conversations(cx)
    read_notes = [x for x in read_notes if x["fingerprint"] not in seen]

    today = time.strftime("%Y-%m-%d")
    if dry_run or (not new and not read_notes):
        for h in findings:
            print(f"[{h['category']:<8}] {h['subject']}")
            for f in h["facts"]:
                print(f"           · {f}")
        saved = 0
        if dry_run and save:
            # Without a model there is no prose: the headline is the computed
            # subject and the body says so. The figures go in full in the evidence.
            for h in new:
                cx.execute(
                    """INSERT OR IGNORE INTO review_notes
                       (day,category,title,body,evidence,action,status,fingerprint,origin,hook)
                       VALUES (?,?,?,?,?,?,'new',?,'measured',?)""",
                    (today, h["category"], h["subject"],
                     "Finding computed with SQL and saved without phrasing (--dry-run mode, no "
                     "language model). The exact figures are in the evidence.",
                     json.dumps(h["facts"], ensure_ascii=False), h.get("action"),
                     h["fingerprint"], hook_for(h["fingerprint"])),
                )
                saved += 1
        cx.commit()
        print(f"\n{len(new)} new of {len(findings)}"
              + (f" · {saved} saved without phrasing" if save else ""))
        return saved

    t0 = time.time()
    notes, cost, ms = write_notes(new) if new else ([], 0, 0)
    by_index = {n.get("i", i): n for i, n in enumerate(notes)}
    # The review's date is a CALENDAR DAY for whoever reads it, not a
    # timestamp: it goes in local time. With UTC, any pass between midnight and
    # two in the morning was dated the day before and the dashboard showed "last
    # night" pointing at the day before yesterday. (`today` is set above.)
    n = 0
    for i, h in enumerate(new):
        note = by_index.get(i)
        if not note:
            continue
        cx.execute(
            """INSERT OR IGNORE INTO review_notes
               (day,category,title,body,evidence,action,status,fingerprint,hook)
               VALUES (?,?,?,?,?,?,'new',?,?)""",
            (today, h["category"], note["titulo"].strip(), note["cuerpo"].strip(),
             json.dumps(h["facts"], ensure_ascii=False),
             (note.get("prompt") or "").strip() or h.get("action"), h["fingerprint"],
             hook_for(h["fingerprint"])),
        )
        n += 1
    for x in read_notes:
        cx.execute(
            """INSERT OR IGNORE INTO review_notes
               (day,category,title,body,evidence,action,status,fingerprint,origin,hook)
               VALUES (?,?,?,?,?,?,'new',?,'read',?)""",
            (today, x["category"], x["title"], x["body"],
             json.dumps(x["facts"], ensure_ascii=False), x["action"], x["fingerprint"],
             hook_for(x["fingerprint"])),
        )
        n += 1
    cx.commit()
    print(f"[review] {n} notes ({len(read_notes)} from reading you) · {int((time.time()-t0)*1000)} ms · "
          f"cost {f'${cost:.4f}' if cost else 'no data'}")
    return n


def dismiss(ident: int):
    cx = open_db(write=True)
    cx.execute("UPDATE review_notes SET status='dismissed' WHERE id=?", (ident,))
    cx.commit()
    print(f"[review] {ident} buried. It will not be proposed again.")


if __name__ == "__main__":
    if "--dismiss" in sys.argv:
        dismiss(int(sys.argv[sys.argv.index("--dismiss") + 1]))
    else:
        review(dry_run="--dry-run" in sys.argv, save="--save" in sys.argv)
