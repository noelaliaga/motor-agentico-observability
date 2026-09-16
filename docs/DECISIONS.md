# Decisions and why

Written while the tool was being built (August 2026), translated and lightly
edited for this public copy. Figures quoted here come from the author's real
usage before 2026-09-13; the underlying dataset is not published.

## 1 · A separate app, not a section of a deployable dashboard

The author already had a web dashboard meant to be deployed to a server, with
a rule that nothing in it reads from the local disk. This tool is the
opposite: it reads hundreds of MB of local transcripts and **must never be
deployed**. Putting it inside the deployable app would have turned every
future deploy into a chance to leak all of it.

*Discarded:* a sidecar plus a tab in the deployable app (elegant, but ships
interface code towards the server) and a locked section (one bug in the lock
exposes every transcript).

## 2 · SQLite, even though re-reading everything is fast

Measured: re-reading all transcripts (839 MB at the time) took **0.93 s**, so
the index was not needed *for speed*. It is needed so that **history survives**
Claude Code rotating or deleting its transcripts, and so the nightly review
remembers what it suggested yesterday.

The known cost of an index is lag. It is handled head-on: incremental byte
offsets every 2 s (passes of ~200 ms) and **the lag always on screen**
("index up to date · 2 s ago", red when the reader stops).

## 3 · `inode`, not just the path

If a file rotates, the path stays the same but the content is new. Without
comparing the inode, the reader would `seek()` into the middle of a new file
and read garbage **silently**. (Covered by `tests/test_cola.py`.)

## 4 · Facts, not conclusions

Tokens go to the database; money is computed at read time. Prices carry
`desde`/`hasta` (valid from/to) and `procedencia` (source). A money figure
without a source is an opinion. A model without a known price sums `NULL`,
never `0`, and the UI says "no price".

## 5 · `error` and `nota` are different columns

This came from a real bug: "Hermes does not record tokens" was stored as an
error, and the sidebar painted Hermes, OpenClaw and OpenRouter grey as if they
were down. **A dashboard that calls a live thing dead lies just like one that
invents numbers.** Now `error` means something failed; `nota` is a caveat about
something that worked.

## 6 · The bug the design itself caught

`uso.ref UNIQUE` (the message id) revealed that Claude Code writes **one JSONL
line per content block**, each carrying the same `usage` object: 6,948 of
11,286 lines were repeats (about ×2.6 lines per message). The author's previous
hand-made calculation summed all of them and its **spend figure came out ×2.3
too high**. The ×2.3 is the spend overcount, not the line ratio; the original
notes do not break down why the two ratios differ, so both are quoted as measured.

Nobody would have noticed by looking at the number: an inflated total is just
as believable as the right one. The dedup is tested in
`tests/test_claude_code.py` and *illustrated* in `make demo`, whose generator
deliberately writes ~2.3 lines per message; the demo does not independently
reproduce the real ratio.

## 7 · Not a single text box that sends anything

The reference dashboard that inspired the layout embeds a chat console to talk
to an agent. Discarded on purpose: as soon as there is a field that sends a
message, "read-only" depends on nobody misusing it. Talking to agents belongs
to tools that already have a kill switch and an audit log.

## 8 · `node:sqlite` is requested from Node, not imported

A normal import gets bundled by Turbopack, and in the server render chunk it
ends up calling `require`, which does not exist there. Result: **HTTP 500 on
every page** with "Failed to load external module", which never mentions
SQLite. `process.getBuiltinModule("node:sqlite")` returns the native module
without going through the bundler.

Its rows also come with a **null prototype**: they behave like normal objects
until one is passed to a client component, and React refuses to serialise it.
A `{...row}` spread in the data layer fixes it at the root.

## 9 · The graph is drawn by hand

Custom force simulation, no d3: repulsion, springs and a pull to the centre.
With ~140 nodes that is ~9,400 pairs per frame, comfortably 60 fps. Initial
positions come from a golden-angle spiral, not `Math.random()`, so the map is
recognisable between visits and the server and the browser draw the same thing.

A `[[link]]` to a note that does not exist **is not drawn**: it is counted
apart as broken. A line into nothing would be inventing half the graph.

## Added for the public version (September 2026)

- **Paths only from `MOTOR_*` variables**, stored relative to the home (`~/…`)
  so screenshots do not leak a username. No reading of other apps' `.env`
  files: the OpenRouter key is taken from the process environment only.
- **The nightly review's privacy**: conversation reading is behind
  `MOTOR_SUENO_LEE=1` (off by default); `--seco` (dry run) sends nothing and is
  what the demo uses. The original README claimed "not a single byte leaves the
  machine", which was false once the review called an LLM.
- **Exposure guard**: `src/proxy.ts` answers 403 to any non-loopback `Host`.
- **One schema file** with all 18 tables (four used to be created by sources at
  run time) and a row counter that reports new rows instead of processed lines.
