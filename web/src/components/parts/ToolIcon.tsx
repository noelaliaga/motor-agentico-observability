import type { ReactNode } from "react";

/**
 * The icons of a session's tools, in the house stroke.
 *
 * They used to be text glyphs (❯_, ◫, ✎…) that each font paints its own way.
 * A 16×16 SVG with the same stroke width as the logos in Brands.tsx looks
 * identical everywhere and withstands zoom. What has no icon falls back to
 * its first two letters: better honest than a drawing that says nothing.
 */
const STROKES: Record<string, ReactNode> = {
  Bash: (<><path d="M3 5.2 6.2 8 3 10.8" /><path d="M8.2 11h4.8" /></>),
  Read: (<><path d="M4 2.8h5.5L12 5.3v7.9H4V2.8Z" /><path d="M9.5 2.8v2.5H12" /><path d="M6 8h4M6 10.3h4" opacity=".6" /></>),
  Edit: (<><path d="m9.8 3.4 2.8 2.8-6.7 6.7-3.2.4.4-3.2 6.7-6.7Z" /><path d="m8.7 4.5 2.8 2.8" opacity=".6" /></>),
  Write: (<><path d="M4 2.8h5.5L12 5.3v7.9H4V2.8Z" /><path d="M8 6.6v3.6M6.2 8.4h3.6" /></>),
  WebFetch: (<><circle cx="8" cy="8" r="5.4" /><path d="M2.6 8h10.8M8 2.6c3.4 3.2 3.4 7.6 0 10.8-3.4-3.2-3.4-7.6 0-10.8Z" opacity=".6" /></>),
  WebSearch: (<><circle cx="7" cy="7" r="4.2" /><path d="m10.2 10.2 3.2 3.2" /></>),
  Glob: (<path d="M8 2.8v10.4M3.5 5.4l9 5.2M3.5 10.6l9-5.2" />),
  Grep: (<><path d="M3 4h10M3 8h6M3 12h8" /><circle cx="11.5" cy="10.5" r="2.4" opacity=".7" /></>),
  Task: (<path d="M8 2.5 13.5 8 8 13.5 2.5 8 8 2.5Z" />),
  Agent: (<path d="M8 2.5 13.5 8 8 13.5 2.5 8 8 2.5Z" />),
  TodoWrite: (<><rect x="2.8" y="2.8" width="10.4" height="10.4" rx="2" /><path d="m5.5 8 1.8 1.8 3.4-3.6" /></>),
  TaskUpdate: (<><rect x="2.8" y="2.8" width="10.4" height="10.4" rx="2" /><path d="m5.5 8 1.8 1.8 3.4-3.6" /></>),
};

export function hasIcon(name: string): boolean {
  return name in STROKES;
}

export function ToolIcon({ name, size = 13 }: { name: string; size?: number }) {
  const stroke = STROKES[name];
  if (!stroke) return null;
  return (
    <svg viewBox="0 0 16 16" width={size} height={size} fill="none" stroke="currentColor"
         strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {stroke}
    </svg>
  );
}
