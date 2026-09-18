import "server-only";
import { rows } from "./db";

/**
 * Like the house's `recentMemory`, but with the file's path.
 * It is needed because there are genuinely repeated titles in the database
 * (the same `MEMORY.md` lives in several claude-mem projects): without the path
 * there is neither a stable key for React nor a way to tell them apart on screen.
 */
export function recentMemoryWithPath(limit = 14) {
  return rows<{ title: string; system: string; days_untouched: number; path: string }>(`
    SELECT title, system, days_untouched, path FROM memory
     WHERE days_untouched IS NOT NULL ORDER BY days_untouched ASC LIMIT ?`, limit);
}
