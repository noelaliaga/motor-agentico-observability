import "server-only";
import { rows, row, COST, PRICE_JOIN } from "./db";
import type { WindowDays } from "./queries";

/**
 * The activity screen's own reads.
 *
 * They live apart because queries.ts has another owner. Two deep differences
 * with what was already there:
 *
 * - The order is BY RECENCY, not by cost. The screen's question is "what were
 *   you doing", and that is answered with the latest session on top.
 * - The cost is NOT coalesced to zero. A source with no known price returns
 *   `null` and the screen says "no data"; a zero here would be a number that
 *   looks measured and is not.
 */

function since(days: WindowDays): string {
  return `-${days} days`;
}

export function activitySummary(days: WindowDays) {
  return row<{ sessions: number; turns: number; projects: number }>(`
    SELECT COUNT(DISTINCT session) sessions, COUNT(*) turns,
           COUNT(DISTINCT project) projects
      FROM usage
     WHERE datetime(ts) >= datetime('now', ?) AND session IS NOT NULL`, since(days));
}

export type RecentSession = {
  id: string; source: string; project: string | null; title: string | null;
  started: string; ended: string; turns: number;
  usd: number | null; unpriced: number; models: string;
};

export function recentSessions(days: WindowDays, limit = 40): RecentSession[] {
  return rows<RecentSession>(`
    SELECT u.session id, MAX(u.source) source, MAX(u.project) project,
           (SELECT substr(p.text,1,180) FROM prompts p WHERE p.session=u.session ORDER BY p.ts LIMIT 1) title,
           MIN(u.ts) started, MAX(u.ts) ended, COUNT(*) turns,
           SUM(${COST}) usd,
           SUM(CASE WHEN t.usd_input IS NULL THEN 1 ELSE 0 END) unpriced,
           GROUP_CONCAT(DISTINCT u.model) models
      FROM usage u ${PRICE_JOIN}
     WHERE datetime(u.ts) >= datetime('now', ?) AND u.session IS NOT NULL
     GROUP BY u.session ORDER BY MAX(u.ts) DESC LIMIT ?`, since(days), limit);
}

export type HonestSource = {
  source: string; turns: number; sessions: number;
  usd: number | null; unpriced: number;
};

/** The split by source, without dressing up as zero what has no price. */
export function honestBySource(days: WindowDays): HonestSource[] {
  return rows<HonestSource>(`
    SELECT u.source, COUNT(*) turns, COUNT(DISTINCT u.session) sessions,
           SUM(${COST}) usd,
           SUM(CASE WHEN t.usd_input IS NULL THEN 1 ELSE 0 END) unpriced
      FROM usage u ${PRICE_JOIN}
     WHERE datetime(u.ts) >= datetime('now', ?)
     GROUP BY u.source ORDER BY turns DESC`, since(days));
}
