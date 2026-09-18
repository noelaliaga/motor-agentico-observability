import "server-only";
import { rows, row } from "./db";

/* What the motor knows about each connected machine, for its own board. */

export type Machine = {
  id: string; name: string; brand: string;
  alive: boolean; note: string | null; error: string | null;
  ms: number; rows: number; last: string | null;
  /** The last pass that ended well. If `alive` is false but this exists,
      what is shown on screen comes from here. */
  lastOk: string | null;
};

export function machine(id: string): Machine | null {
  const s = row<{
    source: string; last_ok: string | null; last_attempt: string | null;
    ms: number; row_count: number; error: string | null; note: string | null;
  }>(`SELECT * FROM health WHERE source = ?`, id);
  if (!s) return null;
  return {
    id, name: id, brand: id, alive: Boolean(s.last_ok) && !s.error,
    note: s.note, error: s.error, ms: s.ms, rows: s.row_count, last: s.last_attempt,
    lastOk: s.last_ok,
  };
}

/* ── Hermes ────────────────────────────────────────────────────────────── */

export function hermesSessions() {
  return rows<{
    id: string; channel: string | null; model: string | null;
    title: string | null; messages: number; started: string | null; ended: string | null;
  }>(`SELECT id, channel, model, title, messages, started, ended
        FROM sessions WHERE source='hermes' ORDER BY ended DESC`);
}

export function hermesByChannel() {
  return rows<{ channel: string; sessions: number; messages: number }>(`
    SELECT COALESCE(channel,'(no channel)') channel, COUNT(*) sessions, SUM(messages) messages
      FROM sessions WHERE source='hermes' GROUP BY channel ORDER BY messages DESC`);
}

export function hermesByModel() {
  return rows<{ model: string; sessions: number; messages: number }>(`
    SELECT COALESCE(model,'(no model)') model, COUNT(*) sessions, SUM(messages) messages
      FROM sessions WHERE source='hermes' GROUP BY model ORDER BY messages DESC`);
}

export function hermesSkills() {
  return rows<{ name: string; uses: number; last_used: string | null; path: string | null }>(`
    SELECT name, uses, last_used, path FROM inventory
     WHERE kind='skill' AND scope='hermes' ORDER BY uses DESC, name`);
}

/* ── OpenClaw ──────────────────────────────────────────────────────────── */

export function clawAgents() {
  return rows<{ name: string; description: string | null; model: string | null }>(`
    SELECT name, description, model FROM inventory
     WHERE kind='agent' AND scope='openclaw' ORDER BY name`);
}

/* ── the whole stack: what is plugged in ───────────────────────────────── */

export function stack() {
  return rows<{
    kind: string; name: string; scope: string;
    description: string | null; uses: number;
  }>(`SELECT kind, name, scope, description, uses FROM inventory
       WHERE kind IN ('mcp','plugin','universe') ORDER BY kind, uses DESC`);
}
