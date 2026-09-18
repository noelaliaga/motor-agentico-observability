/**
 * The emblem of a nightly-review finding.
 *
 * A geometric sigil generated per category: the SAME category always draws
 * the SAME emblem, because everything comes from a seed derived from the name.
 * It is our substitute for the reference's pixel art: fine stroke, instrument
 * geometry and echoes of the star field: the house language.
 *
 * Server-safe: pure SVG, no hooks, no render randomness. The colour comes from
 * outside (the category's) and the whole drawing inherits `currentColor`.
 */

/** FNV-1a: from the category name to a stable seed. */
function seedOf(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * The seeds of the known categories, pinned as numbers.
 *
 * They are the FNV-1a hashes of the names the categories had before the code
 * moved to English, so each category keeps drawing exactly the emblem it drew
 * before. A category not listed here gets a seed from its own name.
 */
const SEEDS: Record<string, number> = {
  method: 3965398719, model: 3984892115, cost: 2968039931, memory: 1739615705,
  skill: 334349218, hygiene: 1460552032, focus: 698449424,
};

/** mulberry32: the same seeded PRNG the star field uses. */
function random(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const mm = (n: number) => Math.round(n * 100) / 100;

export function ReviewEmblem({
  category, color = "var(--review)", size = 190, className = "",
}: {
  category: string; color?: string; size?: number; className?: string;
}) {
  const r = random(SEEDS[category] ?? seedOf("review·" + category));
  const C = 110; // centre of the 220×220 canvas

  const polar = (radius: number, degrees: number) => ({
    x: mm(C + radius * Math.cos((degrees * Math.PI) / 180)),
    y: mm(C + radius * Math.sin((degrees * Math.PI) / 180)),
  });

  // The outer ring, dashed: each category with its own cadence.
  const dash = `${mm(2 + r() * 4)} ${mm(7 + r() * 9)}`;
  const ringTurn = mm(r() * 360);

  // The crown of ticks: like an instrument's limb.
  const nTicks = 16 + Math.floor(r() * 12);
  const ticksTurn = r() * 360;
  const every = 3 + Math.floor(r() * 3);
  const ticks = Array.from({ length: nTicks }, (_, i) => {
    const a = ticksTurn + (i * 360) / nTicks;
    const long = i % every === 0;
    return { p1: polar(long ? 72 : 78, a), p2: polar(84, a), long };
  });

  // The central polygon (3 to 6 sides) and its rotated shadow.
  const sides = 3 + Math.floor(r() * 4);
  const polyTurn = r() * 360;
  const polygon = (radius: number, turn: number) =>
    Array.from({ length: sides }, (_, i) => {
      const p = polar(radius, turn + (i * 360) / sides);
      return `${p.x},${p.y}`;
    }).join(" ");
  const vertices = Array.from({ length: sides }, (_, i) =>
    ({ ...polar(56, polyTurn + (i * 360) / sides), filled: r() < 0.5 }));

  // Its own constellation: 4-6 linked points between crown and polygon.
  const nPoints = 4 + Math.floor(r() * 3);
  const points = Array.from({ length: nPoints }, () => {
    const a = r() * 360;
    return { ...polar(60 + r() * 26, a), a, radius: mm(1.4 + r() * 1.4) };
  }).sort((p, q) => p.a - q.a);

  return (
    <svg viewBox="0 0 220 220" width={size} height={size} className={className}
         aria-hidden="true" style={{ color }}>
      {/* the background halo */}
      <radialGradient id={`halo-${seedOf(category)}`} cx="0.5" cy="0.5" r="0.5">
        <stop offset="0" stopColor="currentColor" stopOpacity="0.2" />
        <stop offset="0.7" stopColor="currentColor" stopOpacity="0.05" />
        <stop offset="1" stopColor="currentColor" stopOpacity="0" />
      </radialGradient>
      <circle cx={C} cy={C} r="104" fill={`url(#halo-${seedOf(category)})`} />

      {/* dashed outer ring */}
      <circle cx={C} cy={C} r="96" fill="none" stroke="currentColor" strokeWidth="1"
              strokeDasharray={dash} opacity="0.55"
              transform={`rotate(${ringTurn} ${C} ${C})`} />

      {/* crown of ticks */}
      <g stroke="currentColor" strokeWidth="1" strokeLinecap="round">
        {ticks.map((m, i) => (
          <line key={i} x1={m.p1.x} y1={m.p1.y} x2={m.p2.x} y2={m.p2.y}
                opacity={m.long ? 0.75 : 0.32} />
        ))}
      </g>

      {/* the finding's constellation */}
      <g stroke="currentColor" strokeWidth="0.8" fill="none" opacity="0.5">
        <polyline points={points.map((p) => `${p.x},${p.y}`).join(" ")} />
      </g>
      {points.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r={p.radius} fill="currentColor" opacity="0.75" />
      ))}

      {/* the polygon and its rotated echo */}
      <polygon points={polygon(38, polyTurn + 180 / sides)} fill="none"
               stroke="currentColor" strokeWidth="0.8" opacity="0.28" />
      <polygon points={polygon(56, polyTurn)} fill="none"
               stroke="currentColor" strokeWidth="1.7" opacity="0.95" />
      {vertices.map((v, i) => (
        <circle key={i} cx={v.x} cy={v.y} r={v.filled ? 3 : 2.1}
                fill={v.filled ? "currentColor" : "none"}
                stroke="currentColor" strokeWidth="1"
                opacity={v.filled ? 0.95 : 0.55} />
      ))}

      {/* the core */}
      <circle cx={C} cy={C} r="7.5" fill="none" stroke="currentColor"
              strokeWidth="1.1" opacity="0.7" />
      <circle cx={C} cy={C} r="2.4" fill="currentColor" />
    </svg>
  );
}
