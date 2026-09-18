"use client";
import { useId, useState, type ReactNode } from "react";

/**
 * A panel's tabs: "SUBSCRIPTIONS | TOKENS · API EQUIV.".
 *
 * It is the only piece of the front page that needs state, so it lives alone
 * in its file with "use client". The panels arrive already rendered from the
 * server: here it is only decided which one is visible. The hidden ones stay
 * mounted with `hidden`: switching tabs does not ask for anything again.
 *
 * Accessible out of the box: tablist/tab/tabpanel linked by id, arrows to move
 * between tabs and the visible focus that globals.css already paints.
 */
export function Tabs({
  label, tabs, right, initial = 0,
}: {
  label: string;
  tabs: { title: string; note?: string; panel: ReactNode }[];
  right?: ReactNode;
  /** Which tab opens by default. */
  initial?: number;
}) {
  const [active, setActive] = useState(initial);
  const base = useId();

  function onKey(e: React.KeyboardEvent) {
    const step = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    const next = (active + step + tabs.length) % tabs.length;
    setActive(next);
    document.getElementById(`${base}-tab-${next}`)?.focus();
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <div role="tablist" aria-label={label} onKeyDown={onKey}
             className="inline-flex gap-1 rounded-[5px] border p-1"
             style={{ background: "var(--card)" }}>
          {tabs.map((p, i) => {
            const on = i === active;
            return (
              <button
                key={p.title}
                id={`${base}-tab-${i}`}
                role="tab"
                aria-selected={on}
                aria-controls={`${base}-panel-${i}`}
                tabIndex={on ? 0 : -1}
                onClick={() => setActive(i)}
                className="cursor-pointer rounded-[3px] px-3 py-2 font-mono text-[10px] uppercase tracking-[.14em] transition-colors duration-150"
                style={{
                  color: on ? "var(--text)" : "var(--text-3)",
                  background: on
                    ? "color-mix(in oklab, var(--amber) 13%, var(--card-high))"
                    : "transparent",
                  border: on
                    ? "1px solid color-mix(in oklab, var(--amber) 30%, transparent)"
                    : "1px solid transparent",
                }}
              >
                {p.title}
                {p.note ? (
                  <span className="ml-1.5" style={{ color: on ? "var(--amber)" : "var(--text-3)" }}>
                    {p.note}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
        {right ? <div className="ml-auto">{right}</div> : null}
      </div>
      {tabs.map((p, i) => (
        <div key={p.title} id={`${base}-panel-${i}`} role="tabpanel"
             aria-labelledby={`${base}-tab-${i}`} hidden={i !== active} className="mt-4">
          {p.panel}
        </div>
      ))}
    </div>
  );
}
