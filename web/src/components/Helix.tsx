/* ─────────────────────────────────────────────────────────────────────────
   The nightly review's helix.

   It is not an ornament: it is the structure of the page. The review pairs
   what you DID with what COULD IMPROVE, and each finding is a base pair
   between the two strands. The position in the chain is the order; the
   colour of the rung, the category.

   Drawn by hand in SVG, without a single dependency and deterministic: the
   same chain on the server and in the browser, and the same between visits.

   The detail that makes it read as a helix and not as two parallel waves:
   where the strands cross, the rungs narrow and fade. That is the depth.
   Without it they are just two curves.
   ───────────────────────────────────────────────────────────────────────── */

const mm = (n: number) => Math.round(n * 100) / 100;

/**
 * Turns the chain makes in one stretch.
 *
 * 1.5 is not a pretty number chosen by eye: with 1.5 the midpoint of EACH
 * stretch always falls on the most open part of the helix, row after row
 * (the phase advances 3π, exactly half a turn, and the middle stays a quarter
 * turn away from the crossing). Since the marked rung goes right in the
 * middle, the finding always reads as a separated base pair and never as a
 * lump at the crossing. Changing this number brings that lump back.
 */
const TURNS = 1.5;

/**
 * How much the phase advances from one stretch to the next.
 *
 * The page stacks stretches and needs to know where the previous one left the
 * chain. It comes from here and not from a constant repeated there: if I
 * change the turns, the chain stays continuous without having to remember two places.
 */
export const PHASE_STEP = Math.PI * 2 * TURNS;

export const CATEGORY_COLOR: Record<string, string> = {
  method: "var(--review)",
  model: "var(--amber)",
  cost: "var(--spend)",
  memory: "var(--saving)",
  skill: "#F472B6",
  hygiene: "var(--text-2)",
  focus: "#38BDF8",
};

/**
 * A stretch of helix, as tall as its row asks for.
 *
 * `phase` continues where the previous stretch left it, so stacked they form
 * a continuous chain even if each note has a different height.
 * `preserveAspectRatio="none"` lets it stretch without breaking that continuity.
 */
export function HelixStretch({
  phase, color = "var(--review)", accent, width = 64, height = 200, marked = true,
}: {
  phase: number; color?: string; accent?: string;
  width?: number; height?: number; marked?: boolean;
}) {
  // The strand is always the review; the marked rung is what changes. In
  // this house violet means one thing only, and painting the chain in the
  // category's colour swallowed it.
  const mark = accent ?? color;
  const cx = width / 2;
  const amp = width / 2 - 7;
  const STEPS = 40;

  const point = (t: number, strand: 0 | 1) => {
    const a = phase + t * Math.PI * 2 * TURNS + strand * Math.PI;
    return { x: mm(cx + Math.sin(a) * amp), y: mm(t * height), z: Math.cos(a) };
  };

  const strand = (h: 0 | 1) =>
    Array.from({ length: STEPS + 1 }, (_, i) => point(i / STEPS, h))
      .map((p, i) => `${i ? "L" : "M"}${p.x} ${p.y}`)
      .join(" ");

  const RUNGS = 7;
  const bars = Array.from({ length: RUNGS }, (_, i) => {
    const t = (i + 0.5) / RUNGS;
    const a = point(t, 0), b = point(t, 1);
    // high |z| = strands edge-on, crossing → short and faint rung
    const open = 1 - Math.abs(a.z);
    return { a, b, open, middle: i === Math.floor(RUNGS / 2) };
  });

  return (
    <svg viewBox={`0 0 ${width} ${height}`} width={width} height="100%"
         preserveAspectRatio="none" aria-hidden="true" className="block">
      <path d={strand(1)} fill="none" stroke={color} strokeWidth="1.1" opacity=".26" />
      {bars.map((b, i) => (
        <line key={i} x1={b.a.x} y1={b.a.y} x2={b.b.x} y2={b.b.y}
              stroke={b.middle && marked ? mark : "var(--text-3)"}
              strokeWidth={b.middle && marked ? 1.8 : 1}
              strokeLinecap="round"
              opacity={mm((b.middle && marked ? 0.85 : 0.3) * (0.25 + b.open * 0.75))} />
      ))}
      <path d={strand(0)} fill="none" stroke={color} strokeWidth="1.6" opacity=".72" />
      {bars.filter((b) => b.middle && marked).map((b, i) => (
        <g key={`n${i}`}>
          <circle cx={b.a.x} cy={b.a.y} r="9" fill={mark} opacity=".16" />
          <circle cx={b.a.x} cy={b.a.y} r="4" fill={mark} />
          <circle cx={b.b.x} cy={b.b.y} r="3" fill={mark} opacity=".55" />
        </g>
      ))}
    </svg>
  );
}

/** The section's signature: a short helix, lying down. */
export function HeaderHelix({ width = 260 }: { width?: number }) {
  const height = 46, amp = 13, cy = height / 2, STEPS = 90, turns = 3.4;
  const point = (t: number, h: 0 | 1) => {
    const a = t * Math.PI * 2 * turns + h * Math.PI;
    return { x: mm(t * width), y: mm(cy + Math.sin(a) * amp), z: Math.cos(a) };
  };
  const strand = (h: 0 | 1) =>
    Array.from({ length: STEPS + 1 }, (_, i) => point(i / STEPS, h))
      .map((p, i) => `${i ? "L" : "M"}${p.x} ${p.y}`).join(" ");
  const bars = Array.from({ length: 26 }, (_, i) => {
    const t = (i + 0.5) / 26;
    const a = point(t, 0), b = point(t, 1);
    return { a, b, open: 1 - Math.abs(a.z) };
  });
  return (
    <svg viewBox={`0 0 ${width} ${height}`} width={width} height={height} aria-hidden="true">
      <path d={strand(1)} fill="none" stroke="var(--review)" strokeWidth="1" opacity=".24" />
      {bars.map((b, i) => (
        <line key={i} x1={b.a.x} y1={b.a.y} x2={b.b.x} y2={b.b.y}
              stroke="var(--review)" strokeWidth="1" strokeLinecap="round"
              opacity={mm(0.1 + b.open * 0.42)} />
      ))}
      <path d={strand(0)} fill="none" stroke="var(--review)" strokeWidth="1.5" opacity=".7" />
    </svg>
  );
}
