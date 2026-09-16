# Motor Agéntico · agentic usage observability

Local, **read-only** observability for AI coding agents (Claude Code, Codex,
Hermes Agent, OpenClaw, OpenRouter): an incremental JSONL → SQLite reader in
plain Python, a token-based cost model with dated pricing, a Next.js 16
dashboard that opens the database with `readOnly: true`, and a nightly review
in which SQL finds the facts and an LLM is only allowed to phrase them.

> **Extracted from a personal tool in daily use since August 2026** and
> published with a synthetic data generator. The author's real dataset
> (prompts, transcripts, spend) is **not** part of this repository.
>
> **Do not deploy it.** It has no authentication by design, reads your local
> transcripts and only answers on `127.0.0.1`.

![Home screen, synthetic data](docs/capturas/inicio.png)
<sub>All screenshots are taken from `make demo`: invented projects, example.com addresses, generated numbers.</sub>

---

## The problem

When you use several coding agents every day, three questions have no answer
in any single place:

1. **What does this actually cost?** Subscriptions hide per-token cost, prices
   change on fixed dates, and each tool logs usage differently (or not at all).
2. **What do I really use?** Hundreds of installed skills, agents and MCP
   servers, and no way to know which ones were ever invoked.
3. **What could I do better?** Patterns like building without a plan, a
   marathon session or a cache that never hits only show up in the logs.

Sending transcripts to a SaaS to answer that was not acceptable, so the tool
reads the files that the agents already write on disk, keeps an index in
SQLite, and never writes anywhere else.

## What it shows

| Screen | Question it answers |
|---|---|
| **Home** | last night's review · spend vs subscription · how to spend less · what runs unattended |
| **Money** (`/dinero`) | by model, day, project and tool · cache savings · the auditable price table |
| **Tools** (`/herramientas`) | each agent, what the tool can and cannot know about its spend |
| **Connections** | Claude connectors and MCP servers *declared*, crossed with real invocations |
| **Skills** / **Inventory** | installed vs actually invoked |
| **Activity** | every session and its cost · timeline of prompts |
| **Memory** | freshness of memory notes, `[[link]]` graph, broken links counted apart |
| **Nightly review** (`/sueno`) | findings with their evidence and a copy-paste prompt |
| **Hermes · OpenClaw** | per-agent boards from their own config and state |

| | |
|---|---|
| ![Money](docs/capturas/dinero.png) | ![Nightly review](docs/capturas/sueno.png) |
| ![Activity](docs/capturas/actividad.png) | ![Memory](docs/capturas/memoria.png) |

All eleven screens are in [`docs/capturas/`](docs/capturas/) (regenerate with `make capturas` while `make demo` is running).

## Architecture

```mermaid
flowchart LR
  subgraph disk["Local disk (read-only)"]
    CC["~/.claude/projects/**/*.jsonl"]
    CX["~/.codex/sessions"]
    HM["Hermes state.db (mode=ro)"]
    MEM["memory notes .md"]
    CFG["~/.claude.json · .mcp.json · LaunchAgents"]
  end
  OR[("OpenRouter API<br/>only with a key")]
  CC & CX & HM & MEM & CFG -->|"byte offset + inode"| L["lector.py<br/>loop every 2 s"]
  OR -->|"every 5 min"| L
  L -->|"INSERT OR IGNORE · ref UNIQUE"| DB[("motor.sqlite<br/>tokens, not dollars")]
  T["tarifas: price per model<br/>with valid-from / valid-to"] --> DB
  DB -->|"node:sqlite readOnly"| W["Next.js 16 · 127.0.0.1<br/>proxy.ts: 403 if Host ≠ loopback"]
  subgraph review["Nightly review (launchd 07:00)"]
    D["detectores.py · pure SQL"] --> R["claude -p, all tools disabled<br/>only phrases the facts"]
  end
  DB --> D
  R -->|"notes + evidence"| DB
```

- **Reader** (`lector/`, Python 3.11+, standard library only). The only
  component that writes, and only to its own database. One module per source
  in `lector/fuentes/`; a failing source rolls back, records the error in
  `salud` and does not stop the others.
- **Schema** (`lector/esquema.sql`): 18 tables in one file, plus additive
  migrations for databases created by older versions.
- **Web** (`web/`, Next.js 16, React 19, Tailwind v4). Server components only,
  no API routes, no server actions, no database driver: `node:sqlite` opened
  read-only.
- **Nightly review** (`lector/sonar.py`). Detectors are SQL
  (`detectores.py`, `habitos.py`); the model receives computed facts and has
  every tool disabled. Notes quoting the user are dropped unless the quote
  appears literally in the transcript.

## Design decisions (summary)

Full reasoning, written while building it: [`docs/DECISIONS.md`](docs/DECISIONS.md).

1. **A separate local app**, never a section of something deployable.
2. **SQLite even though a full re-read took under a second**: history must
   survive transcript rotation, and the lag is always shown on screen.
3. **Compare the inode, not just the path**, or a rotated file is read from
   the middle, silently.
4. **Store tokens, compute money at read time** against prices with validity
   dates and a source. Unknown price → `NULL`, never `0`.
5. **`error` and `nota` are different columns**: "Hermes does not record
   tokens" is a caveat, not an outage.
6. **`ref UNIQUE` caught a ×2.3 overcount** (see Lessons).
7. **No text box that sends anything**: read-only as a property, not a promise.
8. **`process.getBuiltinModule("node:sqlite")`** to dodge the bundler, and
   `{...row}` to fix null-prototype rows breaking React serialisation.
9. **Hand-written, deterministic force graph**; broken links are counted, not drawn.

## Run it

Requirements: **Python 3.11+**, **Node.js ≥ 22.5** for the dashboard (`node:sqlite`;
the web tests use `module.registerHooks`, so they need Node ≥ 22.15), `make`, `curl`.
Tested locally with Python 3.14 and Node 26; CI uses Python 3.11/3.12 and Node 22.

```bash
make demo      # synthetic home → 2 reader passes (with a file rotation) → review --seco → web
               # open http://127.0.0.1:8797
make test      # pytest + ruff + node:test + tsc
```

`make demo` never looks at your real home: every `MOTOR_*` variable points
inside `data/demo/`, `launchctl`/`hermes` commands are disabled, OpenRouter
keys are unset, and the review runs in dry mode (`--seco`), so **nothing is
sent anywhere**. It uses port 8797 so it cannot be confused with an instance
on real data (default 8796).

On your own data:

```bash
python3 lector/lector.py --bucle     # or ./arrancar.sh for reader + web together
python3 lector/sonar.py --seco       # findings only, fully local
```

Configuration is environment variables only — see [`.env.example`](.env.example)
(names only). Paths are stored relative to your home (`~/…`). For something that
survives a reboot there are launchd templates in [`launchd/`](launchd/).

### What leaves the machine

| Component | Sends data? |
|---|---|
| Reader, all sources except OpenRouter | No. Files are read; other programs' databases are opened `mode=ro` |
| OpenRouter source | Calls `openrouter.ai` with **your** key, only if `OPENROUTER_API_KEY` is set |
| Nightly review with `--seco` | No |
| Nightly review without `--seco` | **Yes.** The facts of each finding go to Anthropic via `claude -p`. Facts can include the start of a prompt, memory note titles and project names |
| `MOTOR_SUENO_LEE=1` (off by default) | **Yes.** Excerpts of the last 24 h of conversations, to look for patterns |
| Web | No. Read-only, loopback only |

## Honest status

Figures from the author's real usage, **aggregated, cut off before 2026-09-13**
(later sessions were affected by the portfolio review itself). The dataset is
not published. "Capability" means it worked end-to-end at least once with
evidence; "sustained use" means it kept running in practice.

| Piece | Capability | Evidence | Sustained use |
|---|---|---|---|
| Claude Code ingestion (usage, prompts, tool invocations) | **Demonstrated** | ~23,000 usage rows since 18 Jul 2026; reader loop running continuously since 31 Aug with no tracebacks in its log | **Yes** |
| Dedup by `ref UNIQUE` (the ×2.3) | **Demonstrated** | 6,948 of 11,286 lines were repeats; reproduced with synthetic data (`make demo`: about 5,400 lines carrying `usage` → about 2,300 rows, the same ×2.3) | Yes, implicit in the whole series |
| Re-read on rotation (inode) | **Implemented and tested** | `tests/test_cola.py` and the rotation step in `make demo`. No logged rotation event in real use | — |
| Codex ingestion | **Demonstrated** | about 1,100 usage rows from mid-July to mid-September; no Codex use after that, not a failure | Yes, while Codex was in use |
| Hermes Agent: sessions and skill usage | **Demonstrated** | Session count matched Hermes' own `state.db` | Yes (re-reads all its rows every pass; not incremental) |
| Hermes / OpenClaw token spend | **Not available** | Those tools do not record tokens; shown as "no data" with the reason | — |
| OpenRouter real spend (total) | **Demonstrated** | Daily readings since 23 Aug | Yes |
| OpenRouter per-model breakdown | **Not demonstrated** | Needs a management key that was never configured | — |
| Web dashboard, read-only (11 screens) | **Demonstrated** | Used daily on `127.0.0.1` since 23 Aug in `next dev`. Production build (`next build && next start`) verified on synthetic data for this repo | Yes (dev server) |
| Nightly review: SQL detectors + LLM phrasing | **Demonstrated** | ~85 notes over 19 days; total LLM cost of the review ≈ $3.22; two failed runs visible in its log; a few missed days when the laptop was asleep | **Yes** |
| Review notes that quote the user, verified quote | **Demonstrated** | Notes with `origen='leído'` kept only when the quote was literal | Yes (this is the mode that sends prompt excerpts; now off by default) |
| "Recommendations applied" | **Not demonstrated** | No note was ever marked applied. `resuelta` is set automatically when the condition stops holding ("no longer holds" on screen) | — |
| Functional health check of agents | **Not demonstrated** | See Limits | — |
| Portability to another machine | **Demonstrated for this repo** | All paths via `MOTOR_*`; CI runs the demo on Ubuntu | — |

## Limits

- **Local and single-user.** No auth, no multi-tenant anything. Loopback only.
- **No functional health check.** The tool reads files and database rows; it
  does not prove that an agent's tools answer. In real use it showed an agent
  as **healthy while that agent's MCP tools had been down for about 20 days**:
  the process was alive and its database kept growing, so every signal the
  tool measured was green.
- **Hermes and OpenClaw do not record tokens**, so their spend is shown empty;
  their real cost is inside the OpenRouter total.
- **`resuelta` is automatic.** It means "the condition is gone", not "someone
  followed the advice". The tool cannot know why.
- **Prices are a hand-maintained table** with a source and a date; OpenAI
  prices are marked unverified. A model without a price is counted apart.
- **Subscription window usage is unknown**: Claude Code does not persist it;
  only rate-limit rejections are recorded.
- **macOS-centric extras**: the scheduled-jobs source reads LaunchAgents and
  can call `launchctl list`. The core reader and the web run anywhere (CI is Ubuntu).
- Not done: incremental Hermes reads, log rotation for the reader loop,
  an OpenTelemetry exporter.

## Lessons

**1 · The first result was proving the author wrong (×2.3).** Claude Code
writes one JSONL line per content block, each repeating the same `usage`
object. The previous hand-made spend calculation summed every line. Making the
message id `UNIQUE` and inserting with `INSERT OR IGNORE` turned the reader
idempotent and, as a side effect, showed that the earlier number was 2.3 times
too high. Nothing about the inflated total looked wrong; only a constraint in
the schema could catch it.

**2 · Process health ≠ function health.** The dashboard's health model is "the
last read of this source succeeded". That is honest about the *reader*, but it
said nothing about whether the agent could still do its job: for weeks it
showed green for an agent whose tools were failing. Measuring that requires
exercising the function (e.g. calling an MCP server), which this tool
deliberately does not do. The UI now says "declared" instead of implying
"working".

## Tests and CI

- `tests/` (pytest, 32 tests, no network, no real home): incremental reading
  (offset, half-written line, rotation by inode, truncation, independent
  cursors), dedup and the new-rows counter, cost with the price in force vs
  expired vs unknown, `error` vs `nota`, a crashing source not stopping the
  others, migrating an old database, the 18-table schema, the review with
  `subprocess` mocked (invented quote discarded, fenced JSON, conversation
  reading off by default, dry run never calls the model), and privacy checks
  (MCP env variable names never stored, no account email, no absolute home paths).
- `web/tests/` (`node:test`): `base.ts` rejects `INSERT`/`DELETE`/`DROP`;
  loopback host detection used by the 403 guard.
- `.github/workflows/ci.yml`: ruff + pytest (3.11, 3.12); `npm ci`, `tsc`,
  node tests, `next build`; and a job that runs `make demo` and `curl`s three
  screens plus a spoofed `Host` expecting 403.

## Repository layout

```
lector/            reader, schema, pricing, nightly review (Python, stdlib)
  fuentes/         one module per source
web/               Next.js dashboard (read-only)
demo/              synthetic home generator
tests/             pytest suite
docs/              DECISIONS.md, screenshots
launchd/           plist templates (__REPO__, __HOME__ placeholders)
scripts/           headless-Chrome screenshots of the demo
```

## Glossary (Spanish identifiers → English)

The code and UI are in Spanish; the identifiers are kept as they were written.

| Spanish | English |
|---|---|
| motor agéntico | agentic engine (the whole tool) |
| lector | reader (the ingestion process) |
| fuentes / fuente | sources / source |
| base | database |
| uso | usage (one model turn) |
| tarifas | pricing table |
| desde / hasta | valid from / valid to |
| procedencia | source of a figure |
| sesiones · prompts · invocaciones | sessions · prompts · tool invocations |
| inventario | inventory (declared agents, skills, MCP, plugins) |
| memoria · enlaces | memory notes · links |
| salud · error · nota | health · error · caveat |
| lectura · Cola | read cursor · incremental tail reader |
| sueño / sonar | nightly review / to run the review |
| detectores · hábitos · hallazgo | detectors · habits · finding |
| huella | fingerprint of a finding (dedup key) |
| resuelta | "no longer holds" (set automatically) |
| --seco | dry run (no LLM) |
| gasto real | real money spent |
| suscripciones | subscriptions |
| conexiones · conector | connections · connector |
| programado | scheduled jobs |
| topes | rate-limit rejections |
| casa · usuario | home directory · user name |
| corta | shorten a path to `~/…` |

## Credits and third parties

- Reads data produced by **Claude Code** (Anthropic), **Codex CLI** (OpenAI),
  **Hermes Agent** by Nous Research (MIT license), **OpenClaw** and the **OpenRouter** API. It is not affiliated
  with any of them.
- MCP servers are listed as described by the
  **[Model Context Protocol](https://modelcontextprotocol.io)** specification.
- Built with **Next.js**, **React** and **Tailwind CSS** (MIT). Pricing comes
  from Anthropic's published model table as noted in `lector/tarifas.py`.
- Brand icons in `web/src/componentes/Marcas.tsx` are simplified hand-drawn
  glyphs used only to label where a number comes from; trademarks belong to
  their owners.
- The private original also has a **Remotion** video pipeline; it is not
  included here because its assets were screenshots of real data.
- The "never deployed · read-only · no fake zeros" rules were inspired by a
  public video about local agent dashboards.

## License

[MIT](LICENSE) © 2026 Noel Aliaga
