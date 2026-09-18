-- ═══════════════════════════════════════════════════════════════════════
--  The agentic motor's index. The ONLY source of the schema: 18 tables.
--  No source creates tables on its own; columns added after the first
--  version also live in `MIGRATIONS` (reader.py).
--
--  THE RULE ABOVE ALL OTHERS: FACTS are stored here, not CONCLUSIONS.
--  Tokens go into the database; money is computed at read time, against `pricing`.
--
--  If dollars were stored, the day a price changed the whole history would
--  become a lie. And it is not hypothetical: the Sonnet 5 launch price
--  ($2/$10) expires on 31 August 2026.
-- ═══════════════════════════════════════════════════════════════════════

PRAGMA journal_mode = WAL;      -- the reader writes while the web reads
PRAGMA foreign_keys = ON;

-- ── the central fact: one turn of a model ────────────────────────────────
CREATE TABLE IF NOT EXISTS usage (
  id              INTEGER PRIMARY KEY,
  source          TEXT NOT NULL,        -- claude_code | codex | hermes | openclaw
  session         TEXT,
  project         TEXT,                 -- from cwd; in Codex, from the directory
  ts              TEXT NOT NULL,        -- ISO 8601 in UTC, ALWAYS
  model           TEXT NOT NULL,
  speed           TEXT,                 -- standard | fast  (fast costs double)
  effort          TEXT,                 -- low | medium | high | xhigh | max
  -- The six counters SEPARATELY. Merging them falsifies the money: the 1 h
  -- cache costs 2× the input and the 5 min one 1.25×; a cache read, 0.1×.
  t_input         INTEGER NOT NULL DEFAULT 0,
  t_output        INTEGER NOT NULL DEFAULT 0,
  t_thinking      INTEGER NOT NULL DEFAULT 0,
  t_cache_read    INTEGER NOT NULL DEFAULT 0,
  t_cache_5m      INTEGER NOT NULL DEFAULT 0,
  t_cache_1h      INTEGER NOT NULL DEFAULT 0,
  branch          TEXT,
  ref             TEXT UNIQUE           -- message id: makes loading idempotent
);
CREATE INDEX IF NOT EXISTS ix_usage_ts      ON usage(ts);
CREATE INDEX IF NOT EXISTS ix_usage_model   ON usage(model);
CREATE INDEX IF NOT EXISTS ix_usage_session ON usage(session);
CREATE INDEX IF NOT EXISTS ix_usage_source  ON usage(source);

-- ── the price, with a date and a provenance ──────────────────────────────
-- A money figure without provenance is an opinion.
CREATE TABLE IF NOT EXISTS pricing (
  model           TEXT NOT NULL,
  valid_from      TEXT NOT NULL,        -- ISO; NULL in `valid_to` = in force
  valid_to        TEXT,
  usd_input       REAL NOT NULL,        -- $ per million
  usd_output      REAL NOT NULL,
  mult_cache_read REAL NOT NULL DEFAULT 0.10,
  mult_cache_5m   REAL NOT NULL DEFAULT 1.25,
  mult_cache_1h   REAL NOT NULL DEFAULT 2.00,
  provenance      TEXT NOT NULL,
  checked_on      TEXT NOT NULL,
  PRIMARY KEY (model, valid_from)
);

-- ── sessions: the unit of "how much did this task cost" ──────────────────
CREATE TABLE IF NOT EXISTS sessions (
  id              TEXT PRIMARY KEY,
  source          TEXT NOT NULL,
  started         TEXT,
  ended           TEXT,
  project         TEXT,
  branch          TEXT,
  channel         TEXT,                 -- telegram | cli | …  (Hermes)
  model           TEXT,
  title           TEXT,                 -- the first prompt, trimmed
  messages        INTEGER NOT NULL DEFAULT 0
);

-- ── what you asked for. The most sensitive table in the database. ────────
CREATE TABLE IF NOT EXISTS prompts (
  id              INTEGER PRIMARY KEY,
  session         TEXT,
  source          TEXT NOT NULL,
  ts              TEXT NOT NULL,
  text            TEXT NOT NULL,
  ref             TEXT UNIQUE
);
CREATE INDEX IF NOT EXISTS ix_prompts_ts ON prompts(ts);

-- ── which tools and which skills were really invoked ─────────────────────
CREATE TABLE IF NOT EXISTS invocations (
  id              INTEGER PRIMARY KEY,
  ts              TEXT NOT NULL,
  session         TEXT,
  source          TEXT NOT NULL,
  kind            TEXT NOT NULL,        -- tool | skill | agent | mcp
  name            TEXT NOT NULL,
  ref             TEXT UNIQUE
);
CREATE INDEX IF NOT EXISTS ix_inv_name ON invocations(kind, name);
CREATE INDEX IF NOT EXISTS ix_inv_ts   ON invocations(ts);

-- ── what is declared, used or not ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS inventory (
  kind            TEXT NOT NULL,        -- agent | skill | mcp | plugin
  name            TEXT NOT NULL,
  scope           TEXT NOT NULL,        -- global | project | hermes | openclaw | multiverso
  path            TEXT,
  description     TEXT,
  model           TEXT,
  modified        TEXT,
  uses            INTEGER DEFAULT 0,    -- crossed with `invocations`
  last_used       TEXT,
  PRIMARY KEY (kind, name, scope)
);

-- ── the memory system and its freshness ──────────────────────────────────
CREATE TABLE IF NOT EXISTS memory (
  path            TEXT PRIMARY KEY,
  system          TEXT NOT NULL,        -- vault (MOTOR_NOTES) | multiverso | claude-mem | hermes
  title           TEXT,
  modified        TEXT,
  days_untouched  INTEGER,
  bytes           INTEGER,
  links_out       INTEGER DEFAULT 0,
  links_in        INTEGER DEFAULT 0,
  type            TEXT                  -- core | decision | session | skill | file
);

-- ── the edges of the memory graph ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS links (
  origin          TEXT NOT NULL,
  target          TEXT NOT NULL,
  PRIMARY KEY (origin, target)
);

-- ── four loose figures that do not deserve a table of their own ──────────
CREATE TABLE IF NOT EXISTS motor_state (name TEXT PRIMARY KEY, value TEXT);

-- ── the denominator of the ROI ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS subscriptions (
  name            TEXT PRIMARY KEY,
  usd_month       REAL NOT NULL,
  covers          TEXT NOT NULL,        -- which sources it pays for
  since           TEXT,
  note            TEXT
);

-- ── money that really leaves the account ─────────────────────────────────
CREATE TABLE IF NOT EXISTS real_spend (
  provider        TEXT NOT NULL,
  ts              TEXT NOT NULL,
  usd             REAL NOT NULL,
  detail          TEXT,
  PRIMARY KEY (provider, ts)
);

-- ── the nightly review: it suggests, it never executes ───────────────────
CREATE TABLE IF NOT EXISTS review_notes (
  id              INTEGER PRIMARY KEY,
  day             TEXT NOT NULL,
  category        TEXT NOT NULL,        -- skill | memory | model | cost | hygiene
  title           TEXT NOT NULL,
  body            TEXT NOT NULL,
  evidence        TEXT,                 -- the figures behind it, as JSON
  action          TEXT,                 -- what you would copy and paste
  -- new | resolved | dismissed. CAREFUL: the review sets `resolved` ONLY when
  -- the condition stops holding (on screen: "no longer holds"). It does not
  -- mean anyone applied the suggestion: the motor cannot know that.
  status          TEXT NOT NULL DEFAULT 'new',
  fingerprint     TEXT UNIQUE,          -- so tomorrow does not repeat the same thing
  origin          TEXT DEFAULT 'measured', -- measured (counters) | read (conversations)
  hook            TEXT                  -- two imperative words, derived from the fingerprint
);

-- ── the incremental part: how much of each file was already read ─────────
CREATE TABLE IF NOT EXISTS read_cursors (
  path            TEXT PRIMARY KEY,
  inode           INTEGER,              -- if it changes, the file was recreated: re-read it all
  bytes_read      INTEGER NOT NULL DEFAULT 0,
  mtime           REAL,
  last_read       TEXT
);

-- ── the health of the reader itself ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS health (
  source          TEXT PRIMARY KEY,
  last_ok         TEXT,
  last_attempt    TEXT,
  ms              INTEGER,
  row_count       INTEGER,
  error           TEXT,                 -- really failed
  note            TEXT                  -- worked, but there is something to say
);

-- ── what will run without you: a snapshot, not a history (sources/cron.py) ─
CREATE TABLE IF NOT EXISTS scheduled (
  id              TEXT PRIMARY KEY,
  engine          TEXT NOT NULL,        -- launchd | hermes
  name            TEXT NOT NULL,
  schedule        TEXT,
  next_run        TEXT,
  active          INTEGER NOT NULL DEFAULT 0,
  detail          TEXT
);

-- ── what you have plugged in (sources/connections.py) ────────────────────
CREATE TABLE IF NOT EXISTS connections (
  id              TEXT PRIMARY KEY,
  name            TEXT NOT NULL,
  via             TEXT NOT NULL,        -- connector | mcp
  brand           TEXT,
  detail          TEXT,
  status          TEXT NOT NULL,
  origin          TEXT,
  uses            INTEGER DEFAULT 0,
  last_used       TEXT
);

-- ── the subscribed plan, name → value (sources/plan.py) ──────────────────
CREATE TABLE IF NOT EXISTS plan (name TEXT PRIMARY KEY, value TEXT);

-- ── every time the API said no (sources/plan.py) ─────────────────────────
CREATE TABLE IF NOT EXISTS rate_limits (
  ts              TEXT PRIMARY KEY,
  kind            TEXT,
  limit_window    TEXT,
  reset_ts        TEXT,
  extra_status    TEXT,
  extra_reason    TEXT,
  session         TEXT
);
