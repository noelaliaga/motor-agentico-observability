/**
 * The web layer can read but never write.
 *
 * Runs with plain Node (`npm test`): `node --experimental-strip-types --test`.
 * base.ts starts with `import "server-only"`, which throws outside a React
 * Server Components build; the test registers an empty module in its place
 * before importing base.ts. Everything else is the real code.
 */
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { DatabaseSync } = require("node:sqlite") as typeof import("node:sqlite");

// Swap "server-only" for an empty module (synchronous resolve hook, Node >= 22.15).
type Resolver = (s: string, c: unknown) => { url: string; shortCircuit?: boolean };
const nodeModule = require("node:module") as {
  registerHooks: (h: { resolve: (s: string, c: unknown, next: Resolver) => ReturnType<Resolver> }) => void;
};
nodeModule.registerHooks({
  resolve(spec, ctx, next) {
    if (spec === "server-only") return { url: "data:text/javascript,export {}", shortCircuit: true };
    return next(spec, ctx);
  },
});

// The temp dir lives inside the repo (ignored by git), not in the system /tmp.
const dir = mkdtempSync(join(import.meta.dirname, "..", ".tmp-test-"));
const ruta = join(dir, "motor.sqlite");

let base: typeof import("../src/lib/base.ts");

before(async () => {
  const db = new DatabaseSync(ruta);
  db.exec("CREATE TABLE uso (id INTEGER PRIMARY KEY, modelo TEXT); INSERT INTO uso (modelo) VALUES ('a'), ('b');");
  db.close();
  process.env.MOTOR_BASE = ruta;
  base = await import("../src/lib/base.ts");
});

after(() => rmSync(dir, { recursive: true, force: true }));

function cuenta(): number {
  const db = new DatabaseSync(ruta, { readOnly: true });
  const n = (db.prepare("SELECT COUNT(*) n FROM uso").get() as { n: number }).n;
  db.close();
  return n;
}

test("reads rows as plain objects (no null prototype)", () => {
  const rs = base.filas<{ modelo: string }>("SELECT modelo FROM uso ORDER BY id");
  assert.deepEqual(rs.map((r) => r.modelo), ["a", "b"]);
  assert.equal(Object.getPrototypeOf(rs[0]), Object.prototype);
  assert.equal(base.existe(), true);
});

test("an INSERT through the web layer is rejected by SQLite", () => {
  const avisos: string[] = [];
  const original = console.warn;
  console.warn = (...a: unknown[]) => { avisos.push(a.join(" ")); };
  try {
    const r = base.filas("INSERT INTO uso (modelo) VALUES ('c') RETURNING id");
    assert.deepEqual(r, []);
  } finally {
    console.warn = original;
  }
  assert.equal(cuenta(), 2, "the row must not have been written");
  assert.match(avisos.join("\n"), /readonly|read-only|read only/i);
});

test("DELETE, DROP and CREATE TEMP are rejected too, for being read-only", () => {
  for (const sql of ["DELETE FROM uso", "DROP TABLE uso", "CREATE TEMP TABLE sonda (x)"]) {
    const avisos: string[] = [];
    const original = console.warn;
    console.warn = (...a: unknown[]) => { avisos.push(a.join(" ")); };
    try {
      assert.deepEqual(base.filas(sql), [], sql);
    } finally {
      console.warn = original;
    }
    assert.match(avisos.join("\n"), /readonly|read-only|read only|query_only/i, sql);
  }
  assert.equal(cuenta(), 2);
  const db = new DatabaseSync(ruta, { readOnly: true });
  const tabla = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='uso'").get();
  db.close();
  assert.ok(tabla, "the table must still exist");
});

test("the connection has query_only switched on", () => {
  const q = base.fila<Record<string, number>>("PRAGMA query_only");
  assert.equal(Number(Object.values(q ?? {})[0]), 1);
});
