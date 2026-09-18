import "server-only";
import { rows, row, COST, PRICE_JOIN } from "./db";

/* ─────────────────────────────────────────────────────────────────────────
   The tools, one by one.

   Five machines, five different realities: two know their spend in detail,
   one knows it in real money, and two do not know it. The section shows
   that difference instead of covering it up with zeros.
   ───────────────────────────────────────────────────────────────────────── */

export type Tool = {
  id: string;
  name: string;
  provider: string;
  brand: string;
  /** How it is paid: flat fee, per use, or included in another one. */
  billing: string;
  /** What the motor can know about it. */
  knows: "exact" | "real" | "no spend";
  /** Why, when it does not know. */
  why: string | null;
  source: string | null;
};

export const TOOLS: Tool[] = [
  {
    id: "claude_code", name: "Claude Code", provider: "Anthropic", brand: "anthropic",
    billing: "subscription (see subscriptions table)", knows: "exact", why: null, source: "claude_code",
  },
  {
    id: "codex", name: "Codex", provider: "OpenAI", brand: "openai",
    billing: "subscription (see subscriptions table)", knows: "exact", why: null, source: "codex",
  },
  {
    id: "chatgpt", name: "ChatGPT Plus", provider: "OpenAI", brand: "openai",
    billing: "monthly fee", knows: "no spend",
    why: "The ChatGPT subscription does not expose consumption through an API. What is measured is " +
         "Codex, which is what runs in your terminal with that same account.",
    source: null,
  },
  {
    id: "hermes", name: "Hermes Agent", provider: "Nous Research", brand: "hermes",
    billing: "OpenRouter, per use", knows: "no spend",
    why: "Its messages table has a tokens column and it is zero in every " +
         "row. It does not record it, so nothing is estimated here: it is left empty.",
    source: "hermes",
  },
  {
    id: "openclaw", name: "OpenClaw", provider: "OpenClaw", brand: "openclaw",
    billing: "OpenRouter, per use", knows: "no spend",
    why: "Its logs store neither the model nor the tokens per call. There is nothing to read.",
    source: "openclaw",
  },
];

export function toolSummary(source: string | null) {
  if (!source) return null;
  return row<{ usd: number; turns: number; sessions: number; first_day: string; last_day: string }>(`
    SELECT COALESCE(SUM(${COST}),0) usd, COUNT(*) turns,
           COUNT(DISTINCT u.session) sessions, MIN(date(u.ts)) first_day, MAX(date(u.ts)) last_day
      FROM usage u ${PRICE_JOIN} WHERE u.source = ?`, source);
}

export function modelsOf(source: string) {
  return rows<{ model: string; turns: number; output: number; usd: number | null; unpriced: number }>(`
    SELECT u.model, COUNT(*) turns, SUM(u.t_output) output, SUM(${COST}) usd,
           SUM(CASE WHEN t.usd_input IS NULL THEN 1 ELSE 0 END) unpriced
      FROM usage u ${PRICE_JOIN} WHERE u.source = ?
     GROUP BY u.model ORDER BY usd DESC NULLS LAST`, source);
}

export function daysOf(source: string) {
  return rows<{ day: string; usd: number; turns: number }>(`
    SELECT date(u.ts) day, COALESCE(SUM(${COST}),0) usd, COUNT(*) turns
      FROM usage u ${PRICE_JOIN} WHERE u.source = ?
     GROUP BY day ORDER BY day`, source);
}

/** The total really billed, which covers Hermes and OpenClaw together. */
export function realOpenRouter() {
  return row<{ usd: number }>(
    `SELECT COALESCE(MAX(usd),0) usd FROM real_spend WHERE provider='openrouter'`)?.usd ?? 0;
}


/**
 * The usage windows: five hours and seven days.
 *
 * What CAN be measured is how much you have used. What CANNOT is your
 * ceiling: neither Anthropic nor OpenAI publish your quota from the machine.
 * So the consumption is shown and the limit is said to be unavailable,
 * instead of drawing a percentage over a made-up number.
 */
export function usageWindows(source: string) {
  const five = row<{ turns: number; tokens: number }>(`
    SELECT COUNT(*) turns, COALESCE(SUM(t_output + t_input),0) tokens
      FROM usage WHERE source = ? AND datetime(ts) >= datetime('now','-5 hours')`, source);
  const week = row<{ turns: number; tokens: number }>(`
    SELECT COUNT(*) turns, COALESCE(SUM(t_output + t_input),0) tokens
      FROM usage WHERE source = ? AND datetime(ts) >= datetime('now','-7 days')`, source);
  const peak = row<{ turns: number }>(`
    SELECT MAX(n) turns FROM (
      SELECT COUNT(*) n FROM usage WHERE source = ?
       GROUP BY strftime('%Y-%m-%d %H', ts))`, source);
  return { five, week, peak: peak?.turns ?? 0 };
}
