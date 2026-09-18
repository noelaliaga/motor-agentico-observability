import "server-only";
import { join } from "node:path";

/**
 * `node:sqlite` is requested from Node at run time, not imported.
 *
 * The normal import gets bundled by Turbopack, and in the server render chunk
 * it ends up calling `require`, which does not exist in that context. The
 * result was a 500 on EVERY page, with a message that did not mention SQLite:
 * "Failed to load external module". `process.getBuiltinModule` exists exactly
 * for this: it returns the native module without going through the bundler.
 */
type Row = Record<string, unknown>;
interface Statement { all(...a: unknown[]): Row[]; get(...a: unknown[]): Row | undefined }
interface Database { prepare(sql: string): Statement; exec(sql: string): void }

function sqlite(): { DatabaseSync: new (r: string, o?: { readOnly?: boolean }) => Database } {
  const m = (process as unknown as {
    getBuiltinModule?: (n: string) => unknown;
  }).getBuiltinModule?.("node:sqlite");
  if (!m) throw new Error("This Node does not ship node:sqlite without flags. Node 22.15 or later is required.");
  return m as { DatabaseSync: new (r: string, o?: { readOnly?: boolean }) => Database };
}

/* ─────────────────────────────────────────────────────────────────────────
   The database, ALWAYS read-only.

   It is not a promise that can be forgotten in a review: `readOnly: true`
   makes SQLite reject any write at connection level. Even if someone wrote
   an INSERT in this app, it would not reach the database.

   Second lock: `PRAGMA query_only = ON`, and it is checked that it stuck. A
   Node that silently ignored the `readOnly` option (unknown option = ignored
   option) still could not write, and if the pragma does not apply the
   connection is not used.

   `node:sqlite` is native and flag-free since Node 22.13 (22.15 for the
   tests). Zero dependencies.
   ───────────────────────────────────────────────────────────────────────── */

// Without MOTOR_DB, the reader's default database: `data/motor.sqlite` at the
// repo root (the web runs from `web/`). Never a path from a particular machine.
const PATH = process.env.MOTOR_DB || join(process.cwd(), "..", "data", "motor.sqlite");

let db: Database | null = null;

function open(): Database {
  if (db) return db;
  const { DatabaseSync } = sqlite();
  const fresh = new DatabaseSync(PATH, { readOnly: true });
  fresh.exec("PRAGMA query_only = ON");
  const q = fresh.prepare("PRAGMA query_only").get();
  if (!q || Number(Object.values(q)[0]) !== 1) {
    throw new Error("Could not put the database in read-only mode (PRAGMA query_only).");
  }
  db = fresh;
  return db;
}

export function rows<T = Record<string, unknown>>(sql: string, ...args: unknown[]): T[] {
  try {
    // `node:sqlite` returns objects with a NULL PROTOTYPE. They look like
    // normal objects and work the same… until one travels to a client
    // component: React refuses to serialise them and the whole page returns a
    // 500 whose message does not mention SQLite anywhere. The spread turns
    // them into real objects and the problem disappears at the root.
    const raw = open().prepare(sql).all(...args) as Row[];
    return raw.map((r) => ({ ...r })) as T[];
  } catch (e) {
    // A failing query leaves its section empty with the reason written down.
    // It never brings the whole page down. A write also lands here: the
    // connection is readOnly and SQLite rejects it.
    console.warn("[motor:sql]", (e as Error).message);
    return [];
  }
}

export function row<T = Record<string, unknown>>(sql: string, ...args: unknown[]): T | null {
  return (rows<T>(sql, ...args)[0] as T) ?? null;
}

export function exists(): boolean {
  try { open().prepare("SELECT 1 FROM usage LIMIT 1").get(); return true; }
  catch { return false; }
}

/**
 * The money, in one single place.
 *
 * The JOIN by dates is what stops a price change from poisoning the past:
 * every turn is valued at the price in force THAT day. And the LEFT JOIN is
 * deliberate: a model without a known price does NOT add zero: it adds
 * `null`, and it is counted apart in `unpriced` so it can be said on screen.
 */
export const COST = `
  (u.t_input      * t.usd_input
 + u.t_output     * t.usd_output
 + u.t_cache_read * t.usd_input * t.mult_cache_read
 + u.t_cache_5m   * t.usd_input * t.mult_cache_5m
 + u.t_cache_1h   * t.usd_input * t.mult_cache_1h) / 1000000.0`;

export const PRICE_JOIN = `
  LEFT JOIN pricing t
    ON t.model = (CASE WHEN u.speed='fast' THEN u.model || '  ⚡' ELSE u.model END)
   AND date(u.ts) >= date(t.valid_from)
   AND (t.valid_to IS NULL OR date(u.ts) <= date(t.valid_to))`;
