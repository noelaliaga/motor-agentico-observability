import type { ReactNode } from "react";

/**
 * A native fold (<details>) for the long catalogues.
 *
 * Two hundred grey rows in a row are not information: they are texture. What
 * works is always visible; what sleeps is one click away, with the count in
 * front so the figure does not hide. No JS, no "use client": the browser
 * already knows how to fold.
 */
export function Collapsible({
  closed, open, children,
}: { closed: ReactNode; open: ReactNode; children: ReactNode }) {
  return (
    <details className="group">
      <summary
        className="inline-flex cursor-pointer select-none list-none items-center gap-2 rounded-[4px] border px-3 py-1.5 text-[12px] transition-colors hover:bg-[rgb(255_255_255_/_0.03)] motion-reduce:transition-none [&::-webkit-details-marker]:hidden"
        style={{ color: "var(--text-2)", borderColor: "var(--border)" }}
      >
        <svg
          width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true"
          className="transition-transform group-open:rotate-90 motion-reduce:transition-none"
        >
          <path d="M3 1.5 6.5 5 3 8.5" stroke="currentColor" strokeWidth="1.4"
                strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span className="group-open:hidden">{closed}</span>
        <span className="hidden group-open:inline">{open}</span>
      </summary>
      <div className="mt-2.5">{children}</div>
    </details>
  );
}
