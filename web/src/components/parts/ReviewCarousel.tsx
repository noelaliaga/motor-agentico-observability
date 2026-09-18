"use client";

/**
 * The carousel of nightly-review findings.
 *
 * One finding per screen, whole: its category's emblem on the left, hook,
 * headline, body, the evidence behind it and (if it brings one) the corrected
 * prompt with its copy button. Arrows, dots and "Skip".
 *
 * "Skip" only MOVES FORWARD. The database is read-only by contract, so there
 * is no dismiss that persists here: promising a dismissal that is forgotten
 * on reload would be lying, and in this house nobody lies.
 *
 * It is the page's only client piece: navigation, keyboard and clipboard.
 */

import { useRef, useState, type KeyboardEvent } from "react";
import { Panel, Badge } from "@/components/Parts";
import { CATEGORY_COLOR } from "@/components/Helix";
import { ReviewEmblem } from "./ReviewEmblem";

/** "2026-08-23" → "Aug 23"; the full date stays in the title. */
function shortDate(iso: string): string {
  const f = new Date(iso + "T00:00:00Z");
  if (Number.isNaN(f.getTime())) return iso;
  return new Intl.DateTimeFormat("en-US", {
    day: "numeric", month: "short", timeZone: "UTC",
  }).format(f);
}

export type ReviewFinding = {
  id: number;
  day: string;
  category: string;
  title: string;
  body: string;
  evidence: string[];
  action: string | null;
  status: string;
  hook: string | null;
};

export function ReviewCarousel({ ideas }: { ideas: ReviewFinding[] }) {
  const [index, setIndex] = useState(0);
  const total = ideas.length;
  const go = (i: number) => setIndex(((i % total) + total) % total);

  const keys = (e: KeyboardEvent) => {
    if (e.target !== e.currentTarget) return;
    if (e.key === "ArrowRight") { e.preventDefault(); go(index + 1); }
    if (e.key === "ArrowLeft") { e.preventDefault(); go(index - 1); }
  };

  const s = ideas[index];
  const color = CATEGORY_COLOR[s.category] ?? "var(--review)";

  return (
    <section
      role="group" aria-roledescription="carousel" aria-label="nightly review findings"
      tabIndex={0} onKeyDown={keys} className="outline-offset-4"
    >
      <Panel tint={color} frame className="relative overflow-hidden">

        {/* ── the finding ─────────────────────────────────────────────── */}
        <div key={s.id}
             className="review-anim grid gap-7 p-6 md:min-h-[400px] md:grid-cols-[236px_minmax(0,1fr)] md:p-8">

          {/* the emblem and the finding's signature */}
          <div className="flex flex-row items-center gap-5 md:flex-col md:items-start md:justify-between">
            <ReviewEmblem category={s.category} color={color} size={212}
                          className="shrink-0 max-md:!h-[108px] max-md:!w-[108px]" />
            <div>
              <p className="label">nightly finding</p>
              {s.hook ? (
                <p className="mt-1 text-[13.5px] font-medium" style={{ color: "var(--text)" }}>
                  {s.hook}
                </p>
              ) : null}
            </div>
          </div>

          {/* the content */}
          <div className="flex min-w-0 flex-col">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
              <Badge color={color}>{s.category}</Badge>
              <span className="figure text-[11px]" style={{ color: "var(--text-3)" }}>
                {index + 1} / {total}
              </span>
              {/* `resolved` is set by the review when the condition stops holding; it
                  does not mean anyone applied the suggestion. It is said as it is. */}
              {s.status === "resolved" ? <Badge tone="neutral" title="the condition that triggered it no longer holds; it does not imply it was applied">no longer holds</Badge> : null}
              <span className="datum ml-auto" title={s.day}
                    style={{ color: "var(--text-3)" }}>{shortDate(s.day)}</span>
            </div>

            {s.hook ? (
              <p className="label mt-5" style={{ color, letterSpacing: ".2em" }}>
                {s.hook}
              </p>
            ) : null}

            <h2 className="mt-2 max-w-[640px] text-[21px] font-medium leading-snug tracking-tight">
              {s.title}
            </h2>

            <p className="mt-3 max-w-[640px] text-[13.5px] leading-relaxed"
               style={{ color: "var(--text-2)" }}>
              {s.body}
            </p>

            {/* the evidence: why we suggest it */}
            <div className="mt-5 rounded-[4px] border-l-2 py-1 pl-4"
                 style={{ borderColor: `color-mix(in oklab, ${color} 55%, transparent)` }}>
              <p className="label">why we suggest it</p>
              {s.evidence.length ? (
                <ul className="mt-2 flex flex-col gap-1.5">
                  {s.evidence.map((e) => (
                    <li key={e} className="flex gap-2.5 text-[12.5px] leading-relaxed"
                        style={{ color: "var(--text-2)" }}>
                      <span aria-hidden="true" className="mt-[7px] h-1 w-1 shrink-0 rounded-full"
                            style={{ background: color }} />
                      {e}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-[12.5px] italic" style={{ color: "var(--text-3)" }}>
                  no evidence stored
                </p>
              )}
            </div>

            {/* the corrected prompt, if there is one: it really copies */}
            {s.action ? (
              <div className="mt-5 rounded-[4px] border"
                   style={{ background: "var(--card-high)" }}>
                <div className="flex items-center justify-between gap-3 border-b px-3 py-2">
                  <p className="label">corrected prompt · ready to use</p>
                  <CopyButton text={s.action} />
                </div>
                <pre className="datum overflow-x-auto whitespace-pre-wrap p-3 leading-relaxed"
                     style={{ color: "var(--text-2)" }}>{s.action}</pre>
              </div>
            ) : null}
          </div>
        </div>

        {/* ── the button row ──────────────────────────────────────────── */}
        <div className="flex items-center gap-4 border-t px-6 py-3.5 md:px-8">
          <div className="flex items-center gap-1.5">
            <Arrow heading="back" onClick={() => go(index - 1)} />
            <Arrow heading="forward" onClick={() => go(index + 1)} />
          </div>

          <div className="flex items-center gap-[7px]" role="tablist" aria-label="go to a finding">
            {ideas.map((x, i) => (
              <button key={x.id} type="button" onClick={() => go(i)}
                      role="tab" aria-selected={i === index}
                      aria-label={`finding ${i + 1} of ${total}`}
                      className="flex items-center justify-center p-[5px]">
                <span aria-hidden="true"
                      className="block motion-safe:transition-all motion-safe:duration-200"
                      style={{
                        width: i === index ? 18 : 6, height: 6, borderRadius: 999,
                        background: i === index
                          ? color
                          : "color-mix(in oklab, var(--text-3) 45%, transparent)",
                      }} />
              </button>
            ))}
          </div>

          <button type="button" onClick={() => go(index + 1)}
                  title="moves to the next one; it deletes nothing: the database is read-only"
                  className="label ml-auto flex items-center gap-2 rounded-[3px] border px-3 py-2 motion-safe:transition-colors hover:border-[var(--border-live)] hover:text-[var(--text-2)]">
            <svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor"
                 strokeWidth="1.4" strokeLinecap="round" aria-hidden="true">
              <circle cx="8" cy="8" r="6.4" />
              <path d="M6 6l4 4M10 6l-4 4" />
            </svg>
            skip
          </button>
        </div>
      </Panel>

      <style>{`
        @keyframes review-enter {
          from { opacity: 0; transform: translateY(7px); }
          to   { opacity: 1; transform: none; }
        }
        .review-anim { animation: review-enter .22s cubic-bezier(0.23, 1, 0.32, 1) both; }
        @media (prefers-reduced-motion: reduce) { .review-anim { animation: none; } }
      `}</style>
    </section>
  );
}

function Arrow({ heading, onClick }: { heading: "back" | "forward"; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick}
            aria-label={heading === "back" ? "previous finding" : "next finding"}
            className="flex h-9 w-9 items-center justify-center rounded-[4px] border motion-safe:transition-colors hover:border-[var(--border-live)]"
            style={{ color: "var(--text-2)" }}>
      <svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor"
           strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        {heading === "back" ? <path d="M10 3 5 8l5 5" /> : <path d="m6 3 5 5-5 5" />}
      </svg>
    </button>
  );
}

/** Copy with visible confirmation. If the clipboard fails, it says so. */
function CopyButton({ text }: { text: string }) {
  const [state, setState] = useState<"idle" | "done" | "failed">("idle");
  const clock = useRef<ReturnType<typeof setTimeout> | null>(null);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setState("done");
    } catch {
      setState("failed");
    }
    if (clock.current) clearTimeout(clock.current);
    clock.current = setTimeout(() => setState("idle"), 1800);
  };

  return (
    <button type="button" onClick={copy} aria-live="polite"
            className="label flex items-center gap-1.5 rounded-[3px] border px-2.5 py-1.5 motion-safe:transition-colors hover:border-[var(--border-live)]"
            style={state === "done" ? { color: "var(--saving)", borderColor: "color-mix(in oklab, var(--saving) 45%, transparent)" }
                 : state === "failed" ? { color: "var(--alert)" } : undefined}>
      {state === "done" ? (
        <svg viewBox="0 0 16 16" width="11" height="11" fill="none" stroke="currentColor"
             strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="m3 8.5 3.2 3.2L13 4.9" />
        </svg>
      ) : (
        <svg viewBox="0 0 16 16" width="11" height="11" fill="none" stroke="currentColor"
             strokeWidth="1.3" strokeLinejoin="round" aria-hidden="true">
          <rect x="5.5" y="5.5" width="8" height="8" rx="1.4" />
          <path d="M10.5 5.5v-2a1 1 0 0 0-1-1h-6a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2" />
        </svg>
      )}
      {state === "done" ? "copied" : state === "failed" ? "could not copy" : "copy"}
    </button>
  );
}
