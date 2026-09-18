import "server-only";
import { rows, row, COST, PRICE_JOIN } from "./db";

/* The motor's reads. All read-only, all with their honest empty state. */

export type WindowDays = 1 | 7 | 28 | 3650;

function since(days: WindowDays): string {
  return `-${days} days`;
}

/* ── the money ─────────────────────────────────────────────────────────── */

export type ByModel = {
  model: string; speed: string | null; turns: number;
  output: number; cache_read: number; usd: number | null; unpriced: number;
};

export function byModel(days: WindowDays): ByModel[] {
  return rows<ByModel>(`
    SELECT u.model, u.speed, COUNT(*) turns,
           SUM(u.t_output) output, SUM(u.t_cache_read) cache_read,
           SUM(${COST}) usd,
           SUM(CASE WHEN t.usd_input IS NULL THEN 1 ELSE 0 END) unpriced
      FROM usage u ${PRICE_JOIN}
     WHERE datetime(u.ts) >= datetime('now', ?)
     GROUP BY u.model, u.speed
     ORDER BY usd DESC NULLS LAST`, since(days));
}

export function totalUsd(days: WindowDays): number {
  return row<{ v: number }>(`
    SELECT COALESCE(SUM(${COST}),0) v FROM usage u ${PRICE_JOIN}
     WHERE datetime(u.ts) >= datetime('now', ?)`, since(days))?.v ?? 0;
}

export function byDay(days: WindowDays) {
  return rows<{ day: string; usd: number; turns: number }>(`
    SELECT date(u.ts) day, COALESCE(SUM(${COST}),0) usd, COUNT(*) turns
      FROM usage u ${PRICE_JOIN}
     WHERE datetime(u.ts) >= datetime('now', ?)
     GROUP BY day ORDER BY day`, since(days));
}

export function byProject(days: WindowDays) {
  return rows<{ project: string; usd: number; turns: number; sessions: number }>(`
    SELECT COALESCE(u.project,'(no project)') project,
           COALESCE(SUM(${COST}),0) usd, COUNT(*) turns,
           COUNT(DISTINCT u.session) sessions
      FROM usage u ${PRICE_JOIN}
     WHERE datetime(u.ts) >= datetime('now', ?)
     GROUP BY project ORDER BY usd DESC LIMIT 12`, since(days));
}

export function bySource(days: WindowDays) {
  return rows<{ source: string; usd: number; turns: number }>(`
    SELECT u.source, COALESCE(SUM(${COST}),0) usd, COUNT(*) turns
      FROM usage u ${PRICE_JOIN}
     WHERE datetime(u.ts) >= datetime('now', ?)
     GROUP BY u.source ORDER BY usd DESC`, since(days));
}

export function cacheSummary(days: WindowDays) {
  return row<{ read: number; w5m: number; w1h: number; input: number; output: number }>(`
    SELECT COALESCE(SUM(t_cache_read),0) read, COALESCE(SUM(t_cache_5m),0) w5m,
           COALESCE(SUM(t_cache_1h),0) w1h, COALESCE(SUM(t_input),0) input,
           COALESCE(SUM(t_output),0) output
      FROM usage WHERE datetime(ts) >= datetime('now', ?)`, since(days));
}

/** What it would cost if there were NO cache: everything at full input price. */
export function withoutCache(days: WindowDays): number {
  return row<{ v: number }>(`
    SELECT COALESCE(SUM(
      ((u.t_input + u.t_cache_read + u.t_cache_5m + u.t_cache_1h) * t.usd_input
       + u.t_output * t.usd_output) / 1000000.0), 0) v
      FROM usage u ${PRICE_JOIN}
     WHERE datetime(u.ts) >= datetime('now', ?)`, since(days))?.v ?? 0;
}

export function subscriptions() {
  return rows<{ name: string; usd_month: number; covers: string; note: string }>(
    `SELECT * FROM subscriptions ORDER BY usd_month DESC`);
}

export function realSpend() {
  return rows<{ provider: string; ts: string; usd: number; detail: string }>(
    `SELECT * FROM real_spend ORDER BY ts DESC LIMIT 40`);
}

/* ── activity ──────────────────────────────────────────────────────────── */

/** Which tools and which skill were used in each session, for the chips. */
export function toolsBySession(sessions: string[]) {
  if (!sessions.length) return new Map<string, { kind: string; name: string; n: number }[]>();
  const slots = sessions.map(() => "?").join(",");
  const rs = rows<{ session: string; kind: string; name: string; n: number }>(`
    SELECT session, kind, name, COUNT(*) n FROM invocations
     WHERE session IN (${slots}) AND kind IN ('tool','skill','agent','mcp')
     GROUP BY session, kind, name ORDER BY n DESC`, ...sessions);
  const m = new Map<string, { kind: string; name: string; n: number }[]>();
  for (const r of rs) {
    const l = m.get(r.session) ?? [];
    l.push({ kind: r.kind, name: r.name, n: r.n });
    m.set(r.session, l);
  }
  return m;
}

export function expensiveSessions(days: WindowDays, limit = 30) {
  return rows<{
    id: string; source: string; project: string | null; title: string | null;
    started: string; ended: string; turns: number; usd: number; models: string;
  }>(`
    SELECT u.session id, MAX(u.source) source, MAX(u.project) project,
           (SELECT substr(p.text,1,180) FROM prompts p WHERE p.session=u.session ORDER BY p.ts LIMIT 1) title,
           MIN(u.ts) started, MAX(u.ts) ended, COUNT(*) turns,
           COALESCE(SUM(${COST}),0) usd,
           GROUP_CONCAT(DISTINCT u.model) models
      FROM usage u ${PRICE_JOIN}
     WHERE datetime(u.ts) >= datetime('now', ?) AND u.session IS NOT NULL
     GROUP BY u.session ORDER BY usd DESC LIMIT ?`, since(days), limit);
}

export function latestPrompts(limit = 40) {
  return rows<{ ts: string; text: string; session: string; source: string; project: string | null }>(`
    SELECT p.ts, p.text, p.session, p.source,
           (SELECT MAX(u.project) FROM usage u WHERE u.session = p.session) project
      FROM prompts p ORDER BY p.ts DESC LIMIT ?`, limit);
}

/* ── inventory ─────────────────────────────────────────────────────────── */

export function inventory(kind: string) {
  return rows<{
    name: string; scope: string; description: string | null;
    model: string | null; uses: number; last_used: string | null; path: string | null;
  }>(`SELECT name, scope, description, model, uses, last_used, path
        FROM inventory WHERE kind = ? ORDER BY uses DESC, name`, kind);
}

export function inventorySummary() {
  return rows<{ kind: string; total: number; used: number }>(`
    SELECT kind, COUNT(*) total, SUM(CASE WHEN uses>0 THEN 1 ELSE 0 END) used
      FROM inventory GROUP BY kind ORDER BY total DESC`);
}

export function mostInvoked(kind: string, limit = 12) {
  return rows<{ name: string; n: number; last: string }>(`
    SELECT name, COUNT(*) n, MAX(ts) last FROM invocations
     WHERE kind = ? GROUP BY name ORDER BY n DESC LIMIT ?`, kind, limit);
}

/* ── memory ────────────────────────────────────────────────────────────── */

export function memorySummary() {
  return rows<{ system: string; total: number; stale: number; median: number }>(`
    SELECT system, COUNT(*) total,
           SUM(CASE WHEN days_untouched > 10 THEN 1 ELSE 0 END) stale,
           AVG(days_untouched) median
      FROM memory WHERE days_untouched IS NOT NULL GROUP BY system ORDER BY total DESC`);
}

export function staleMemory(limit = 24) {
  return rows<{ title: string; system: string; days_untouched: number; path: string }>(`
    SELECT title, system, days_untouched, path FROM memory
     WHERE days_untouched IS NOT NULL ORDER BY days_untouched DESC LIMIT ?`, limit);
}

export function recentMemory(limit = 14) {
  return rows<{ title: string; system: string; days_untouched: number }>(`
    SELECT title, system, days_untouched FROM memory
     WHERE days_untouched IS NOT NULL ORDER BY days_untouched ASC LIMIT ?`, limit);
}

/* ── health of the motor itself ────────────────────────────────────────── */

export function health() {
  return rows<{
    source: string; last_ok: string | null; last_attempt: string | null;
    ms: number; row_count: number; error: string | null; note: string | null;
  }>(`SELECT * FROM health ORDER BY source`);
}

export function freshness() {
  return row<{ seconds: number }>(`
    SELECT CAST((julianday('now') - julianday(MAX(last_attempt))) * 86400 AS INTEGER) seconds
      FROM health`)?.seconds ?? 999999;
}

export function range() {
  return row<{ first_day: string; last_day: string; days: number }>(`
    SELECT MIN(date(ts)) first_day, MAX(date(ts)) last_day,
           CAST(julianday(MAX(ts)) - julianday(MIN(ts)) AS INTEGER) + 1 days FROM usage`);
}

/* ── the nightly review ────────────────────────────────────────────────── */

export function reviewNotes() {
  return rows<{
    id: number; day: string; category: string; title: string;
    body: string; evidence: string | null; action: string | null; status: string;
    hook: string | null; origin: string | null; fingerprint: string;
  }>(`SELECT * FROM review_notes WHERE status <> 'dismissed' ORDER BY day DESC, id DESC LIMIT 12`);
}

/* ── what will run on its own ──────────────────────────────────────────── */

export function scheduled() {
  return rows<{
    id: string; engine: string; name: string;
    schedule: string | null; next_run: string | null; active: number; detail: string | null;
  }>(`SELECT * FROM scheduled ORDER BY active DESC, engine, name`);
}

/** The channels through which your assistants can reach you. */
export function channels() {
  return rows<{ channel: string; sessions: number; last: string | null }>(`
    SELECT channel, COUNT(*) sessions, MAX(ended) last FROM sessions
     WHERE channel IS NOT NULL GROUP BY channel ORDER BY sessions DESC`);
}

/** Last night's review notes, for the front page. */
export function latestReview() {
  const f = row<{ day: string }>(`SELECT MAX(day) day FROM review_notes WHERE status='new'`);
  if (!f?.day) return { day: null, ideas: [] as ReturnType<typeof reviewNotes> };
  return {
    day: f.day,
    ideas: rows<{ id: number; category: string; title: string; body: string; hook: string | null }>(
      `SELECT id, category, title, body, hook FROM review_notes
        WHERE status='new' AND day=? ORDER BY id`, f.day),
  };
}

/* ── the plan and its walls ────────────────────────────────────────────── */

/** What you subscribe to, as Claude Code itself has it written down. */
export function plan() {
  const f = rows<{ name: string; value: string | null }>(`SELECT name, value FROM plan`);
  const d = Object.fromEntries(f.map((r) => [r.name, r.value]));
  return {
    name: d.plan ?? null,
    detail: d.plan_detail ?? null,
    type: d.account_type ?? null,
    since: d.since ?? null,
    extraEnabled: d.extra_enabled === "1",
    extraReason: d.extra_reason ?? null,
  };
}

/**
 * Every time the API stopped you, grouped by wall.
 *
 * One single limit freezes the main session and all its agents at the same
 * time: seven records for a single wall. Counting them separately would make
 * you believe you hit the limit seven times, so they are grouped by window
 * and the number of sessions it reached is given.
 */
export function rateLimits(limit = 8) {
  return rows<{
    limit_window: string | null; since: string; reset_ts: string | null; sessions: number;
    extra_reason: string | null;
  }>(`
    SELECT limit_window, MIN(ts) since, reset_ts, COUNT(DISTINCT session) sessions,
           MAX(extra_reason) extra_reason
      FROM rate_limits GROUP BY limit_window, reset_ts
     ORDER BY since DESC LIMIT ?`, limit);
}

/* ── what you have plugged in ──────────────────────────────────────────── */

export type Connection = {
  id: string; name: string; via: string; brand: string | null;
  detail: string | null; status: string; origin: string | null;
  uses: number; last_used: string | null;
};

export function connections() {
  return rows<Connection>(`
    SELECT * FROM connections
     ORDER BY CASE via WHEN 'connector' THEN 0 WHEN 'mcp' THEN 1 ELSE 2 END,
              uses DESC, name`);
}

/* ── the memory graph ──────────────────────────────────────────────────── */

/** The files as base pairs, from the freshest to the most frozen. */
export function memoryChain() {
  return rows<{
    path: string; title: string; system: string; type: string; days: number; degree: number;
  }>(`
    SELECT m.path, COALESCE(m.title, m.path) title, m.system,
           COALESCE(m.type,'file') type,
           COALESCE(m.days_untouched, 999) days,
           (SELECT COUNT(*) FROM links e WHERE e.origin = m.path OR e.target = m.path) degree
      FROM memory m WHERE m.days_untouched IS NOT NULL
     ORDER BY m.days_untouched ASC, m.path`);
}

export function memoryGraph() {
  const nodes = rows<{
    path: string; title: string; system: string; type: string;
    days: number; degree: number;
  }>(`
    SELECT m.path, COALESCE(m.title, m.path) title, m.system,
           COALESCE(m.type,'file') type,
           COALESCE(m.days_untouched, 999) days,
           (SELECT COUNT(*) FROM links e WHERE e.origin = m.path OR e.target = m.path) degree
      FROM memory m WHERE m.days_untouched IS NOT NULL
     ORDER BY degree DESC, m.path`);
  const pos = new Map(nodes.map((n, i) => [n.path, i]));
  const edges = rows<{ origin: string; target: string }>(`SELECT * FROM links`)
    .map((a) => ({ o: pos.get(a.origin) ?? -1, d: pos.get(a.target) ?? -1 }))
    .filter((a) => a.o >= 0 && a.d >= 0 && a.o !== a.d);
  const missing = Number(
    row<{ value: string }>(`SELECT value FROM motor_state WHERE name='missing_links'`)?.value ?? 0);
  return { nodes, edges, missing };
}

/* ── skills, with a life of their own ──────────────────────────────────── */

export function skills() {
  return rows<{
    name: string; scope: string; description: string | null;
    uses: number; last_used: string | null; modified: string | null;
  }>(`SELECT name, scope, description, uses, last_used, modified
        FROM inventory WHERE kind='skill' ORDER BY uses DESC, name`);
}

export function skillsByScope() {
  return rows<{ scope: string; total: number; used: number }>(`
    SELECT scope, COUNT(*) total, SUM(CASE WHEN uses>0 THEN 1 ELSE 0 END) used
      FROM inventory WHERE kind='skill' GROUP BY scope ORDER BY total DESC`);
}

/** The streak: how many days in a row, counting back from today, had usage. */
export function streak() {
  const days = new Set(rows<{ d: string }>(
    `SELECT DISTINCT date(ts) d FROM usage ORDER BY d DESC`).map((x) => x.d));
  let n = 0;
  const today = new Date();
  for (;;) {
    const key = today.toISOString().slice(0, 10);
    if (!days.has(key)) {
      // Today can still be empty early in the morning: the streak is only
      // broken if there was nothing yesterday either.
      if (n === 0) { today.setDate(today.getDate() - 1); continue; }
      break;
    }
    n += 1;
    today.setDate(today.getDate() - 1);
    if (n > 400) break;
  }
  return { days: n, total: days.size };
}

/* ── how to save ───────────────────────────────────────────────────────────
   Concrete moves with their saving COMPUTED, not estimated by eye. Each one
   states the sum behind it: without that it would be brochure advice.      */

export type Move = {
  title: string; why: string; saving: number | null; unit: string;
};

export function waysToSave(days: WindowDays): Move[] {
  const out: Move[] = [];

  // 1 · short turns on an expensive model → the same work on Haiku
  const short = row<{ n: number; output: number; input: number; cache: number }>(`
    SELECT COUNT(*) n, COALESCE(SUM(t_output),0) output,
           COALESCE(SUM(t_input),0) input, COALESCE(SUM(t_cache_read),0) cache
      FROM usage
     WHERE datetime(ts) >= datetime('now', ?)
       AND model IN ('claude-opus-5','claude-fable-5','claude-opus-4-8')
       AND t_output < 350`, `-${days} days`);
  if (short && short.n > 100) {
    // Haiku 4.5: $1 input / $5 output. A cache read is paid at 0.1×.
    const onHaiku = (short.input * 1 + short.output * 5 + short.cache * 0.1) / 1e6;
    const now = (short.input * 5 + short.output * 25 + short.cache * 0.5) / 1e6;
    out.push({
      title: "Send the simple reads to Haiku",
      why: `${short.n.toLocaleString("en-US")} turns returned fewer than 350 tokens. ` +
           `At Haiku 4.5 prices the same tokens would cost $${onHaiku.toFixed(2)} instead of $${now.toFixed(2)}.`,
      saving: now - onHaiku, unit: "dollars in the window",
    });
  }

  // 2 · one-hour cache where the five-minute one would do
  const c1h = row<{ t: number }>(`
    SELECT COALESCE(SUM(t_cache_1h),0) t FROM usage
     WHERE datetime(ts) >= datetime('now', ?)`, `-${days} days`);
  if (c1h && c1h.t > 5_000_000) {
    // 2× against 1.25× of the input; at $5/M that is $3.75 per million.
    out.push({
      title: "Check the one-hour cache",
      why: `${(c1h.t / 1e6).toFixed(0)} million tokens were written with a one-hour TTL, ` +
           `which costs 2× the input. With five minutes it would be 1.25×.`,
      saving: (c1h.t * 5 * 0.75) / 1e6, unit: "dollars if everything fit in 5 min",
    });
  }

  // 3 · the project that takes the money
  const top = rows<{ project: string; usd: number }>(`
    SELECT COALESCE(u.project,'(no project)') project, COALESCE(SUM(${COST}),0) usd
      FROM usage u ${PRICE_JOIN}
     WHERE datetime(u.ts) >= datetime('now', ?)
     GROUP BY project ORDER BY usd DESC LIMIT 2`, `-${days} days`);
  if (top.length === 2 && top[0].usd > top[1].usd * 3) {
    out.push({
      title: `Almost everything goes into “${top[0].project}”`,
      why: `$${top[0].usd.toFixed(2)} against $${top[1].usd.toFixed(2)} for the next one. ` +
           `If that project is not this week's priority, the split does not match the plan.`,
      saving: null, unit: "",
    });
  }

  // 4 · skills never used: it does not save money, it saves time
  const sk = row<{ total: number; used: number }>(`
    SELECT COUNT(*) total, SUM(CASE WHEN uses>0 THEN 1 ELSE 0 END) used
      FROM inventory WHERE kind='skill'`);
  if (sk && sk.total - sk.used > 50) {
    out.push({
      title: "Package what you repeat into a skill",
      why: `You have ${sk.total} skills and use ${sk.used}. Reusing a session with context ` +
           `already loaded costs less than explaining everything again every time.`,
      saving: null, unit: "",
    });
  }
  return out;
}

/** The two strands flanking the memory: what you know how to do and who does it. */
export function flanks() {
  const skills = rows<{ name: string; uses: number }>(
    `SELECT name, uses FROM inventory WHERE kind='skill' ORDER BY uses DESC, name`);
  const agents = rows<{ name: string; uses: number }>(
    `SELECT name, uses FROM inventory WHERE kind='agent' ORDER BY uses DESC, name`);
  return { skills, agents };
}
