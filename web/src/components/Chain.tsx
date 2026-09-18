"use client";

import { useMemo, useState } from "react";

/* ─────────────────────────────────────────────────────────────────────────
   The memory chain.

   A horizontal double helix where EACH BASE PAIR IS A FILE of your memory
   system, sorted by freshness: what you touched today on the left, what has
   been frozen for months on the right.

   It is not a pretty metaphor laid over the data: it is the reading. At a
   glance you see where your memory stops being green and starts being amber,
   which is exactly the point where the AI starts working with expired context.

   Drawn entirely in SVG and without simulation: no forces, no frames, nothing
   that can become unstable. Each file's position is its place in the chain,
   and it does not move.
   ───────────────────────────────────────────────────────────────────────── */

export type BasePair = {
  path: string; title: string; system: string; type: string; days: number; degree: number;
};

const STALE = 10;
const mm = (n: number) => Math.round(n * 100) / 100;

/** Green when fresh, amber when it ages, red when it is no longer useful. */
function tone(days: number): string {
  if (days <= 2) return "#34D399";
  if (days <= STALE) return "#22D3EE";
  if (days <= 30) return "#FBBF24";
  return "#FB7185";
}

export function Chain({ pairs }: { pairs: BasePair[] }) {
  const [over, setOver] = useState<number | null>(null);
  const [system, setSystem] = useState<string | null>(null);

  const systems = useMemo(
    () => [...new Set(pairs.map((b) => b.system))].sort(),
    [pairs],
  );
  const vis = useMemo(
    () => pairs.filter((b) => !system || b.system === system),
    [pairs, system],
  );

  const WIDTH = 1180, HEIGHT = 260, MARGIN = 26;
  const cy = HEIGHT / 2;
  const amp = 74;
  const n = Math.max(1, vis.length);
  const usable = WIDTH - MARGIN * 2;
  // The turns adapt to the number of pairs so the chain always fills the
  // width with the same rhythm, whether it has 12 files or 138.
  const TURNS = Math.max(3, Math.min(9, Math.round(n / 16)));

  const point = (i: number, strand: 0 | 1) => {
    const t = n === 1 ? 0.5 : i / (n - 1);
    const a = t * Math.PI * 2 * TURNS + strand * Math.PI;
    return { x: mm(MARGIN + t * usable), y: mm(cy + Math.sin(a) * amp), z: Math.cos(a) };
  };

  const strand = (h: 0 | 1) => {
    const STEPS = 420;
    return Array.from({ length: STEPS + 1 }, (_, k) => {
      const t = k / STEPS;
      const a = t * Math.PI * 2 * TURNS + h * Math.PI;
      return `${k ? "L" : "M"}${mm(MARGIN + t * usable)} ${mm(cy + Math.sin(a) * amp)}`;
    }).join(" ");
  };

  const focus = over !== null ? vis[over] : null;
  const stale = vis.filter((b) => b.days > STALE).length;

  return (
    <div className="flex flex-col gap-3">
      {/* ── filter by system ───────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2">
        <button onClick={() => { setSystem(null); setOver(null); }}
                className="pill" data-active={system === null ? "yes" : "no"}>
          <span className="h-2 w-2 rounded-full" style={{ background: "var(--text-3)" }} />
          all <span style={{ color: "var(--text-3)" }}>{pairs.length}</span>
        </button>
        {systems.map((s) => {
          const count = pairs.filter((b) => b.system === s).length;
          return (
            <button key={s} onClick={() => { setSystem(s); setOver(null); }}
                    className="pill" data-active={system === s ? "yes" : "no"}>
              <span className="h-2 w-2 rounded-full" style={{ background: "var(--amber)" }} />
              {s} <span style={{ color: "var(--text-3)" }}>{count}</span>
            </button>
          );
        })}
      </div>

      <div className="relative overflow-hidden rounded-[6px]"
           style={{
             background: "radial-gradient(130% 100% at 22% 50%, #08131a 0%, #04070A 68%)",
             border: "1px solid var(--border)",
           }}>
        <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="block w-full"
             style={{ height: 260 }} onMouseLeave={() => setOver(null)}>
          <defs>
            <filter id="glow" x="-60%" y="-60%" width="220%" height="220%">
              <feGaussianBlur stdDeviation="3.4" result="b" />
              <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
          </defs>

          {/* the back strand, dimmed */}
          <path d={strand(1)} fill="none" stroke="#5B7A8C" strokeWidth="1.2" opacity=".3" />

          {/* the rungs: one file each */}
          {vis.map((b, i) => {
            const a = point(i, 0), z = point(i, 1);
            const open = 1 - Math.abs(a.z);
            const active = over === i;
            return (
              <line key={b.path} x1={a.x} y1={a.y} x2={z.x} y2={z.y}
                    stroke={tone(b.days)} strokeLinecap="round"
                    strokeWidth={active ? 3 : 1.3}
                    opacity={mm((active ? 1 : 0.5) * (0.28 + open * 0.72))} />
            );
          })}

          {/* the front one, whole */}
          <path d={strand(0)} fill="none" stroke="#9FC7D8" strokeWidth="1.7" opacity=".62" />

          {/* the nucleotides */}
          {vis.map((b, i) => {
            const a = point(i, 0), z = point(i, 1);
            const active = over === i;
            const col = tone(b.days);
            const r = 2.2 + Math.min(3.4, Math.sqrt(b.degree) * 1.15);
            return (
              <g key={b.path} onMouseEnter={() => setOver(i)} style={{ cursor: "crosshair" }}>
                {/* generous grab area: the rungs are thin */}
                <rect x={a.x - 5} y={0} width={10} height={HEIGHT} fill="transparent" />
                <circle cx={a.x} cy={a.y} r={active ? r + 2.2 : r}
                        fill={col} opacity={active ? 1 : 0.9}
                        filter={active || b.degree > 6 ? "url(#glow)" : undefined} />
                <circle cx={z.x} cy={z.y} r={active ? r * 0.9 : r * 0.62}
                        fill={col} opacity={active ? 0.8 : 0.42} />
              </g>
            );
          })}
        </svg>

        {/* the axis: from today's to the frozen */}
        <div className="pointer-events-none absolute inset-x-0 bottom-2.5 flex justify-between px-6">
          <span className="label">touched today</span>
          <span className="label" style={{ color: "var(--text-3)" }}>
            {vis.length} files · {stale} stale
          </span>
          <span className="label">frozen</span>
        </div>

        {/* the card of the file under the cursor */}
        <div className="pointer-events-none absolute left-5 top-4 max-w-[420px]">
          {focus ? (
            <>
              <p className="text-[14px]" style={{ color: tone(focus.days) }}>{focus.title}</p>
              <p className="datum mt-1 text-[11px]" style={{ color: "var(--text-3)" }}>
                {focus.system} · {focus.type} · {focus.degree}{" "}
                {focus.degree === 1 ? "link" : "links"} ·{" "}
                {focus.days === 0 ? "touched today"
                  : `${focus.days} ${focus.days === 1 ? "day" : "days"} ago`}
              </p>
            </>
          ) : (
            <p className="label">move the cursor over the chain</p>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
        {[["#34D399", "today or yesterday"], ["#22D3EE", "this week"],
          ["#FBBF24", "over 10 days"], ["#FB7185", "over a month"]].map(([c, t]) => (
          <span key={t} className="label flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full" style={{ background: c }} />{t}
          </span>
        ))}
        <span className="label ml-auto">the nucleotide's thickness is how many notes point to it</span>
      </div>
    </div>
  );
}
