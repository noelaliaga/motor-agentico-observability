import type { CSSProperties } from "react";

/**
 * The star field with its constellations.
 *
 * It is the background of the section heroes: the night sky from the
 * reference, but with the house tint (or the one of the section that asks for it).
 *
 * DETERMINISTIC by contract: no Math.random() in render. Everything comes from
 * a seed (mulberry32), so the server and the client paint the same stars and
 * React does not complain about hydration. The same seed always draws the
 * same sky; if a screen wants another sky, it changes the seed.
 *
 * It lives in its own file and not in Parts.tsx because it is generative
 * code: ~40 lines of geometry that share nothing with the data parts. It is
 * still a server component: pure SVG, no canvas or hooks.
 */

/** mulberry32: the shortest seeded PRNG that is still decent. */
function random(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function Constellation({
  seed = 7, stars = 150, tint = "var(--amber)", lines = true, className = "",
}: {
  seed?: number; stars?: number; tint?: string;
  lines?: boolean; className?: string;
}) {
  const r = random(seed);
  const WIDTH = 1000, HEIGHT = 420;

  // The stars: denser at the top, as on a horizon.
  const points = Array.from({ length: stars }, (_, i) => ({
    x: +(r() * WIDTH).toFixed(1),
    y: +(Math.pow(r(), 1.35) * HEIGHT).toFixed(1),
    radius: +(0.5 + r() * 1.25).toFixed(2),
    brightness: +(0.25 + r() * 0.6).toFixed(2),
    live: r() < 0.16,           // only a few twinkle
    delay: +(r() * 5).toFixed(2),
    id: i,
  }));

  // Two constellations: chains of 4-6 stars close to each other.
  const chains: (typeof points)[] = [];
  if (lines) {
    for (let c = 0; c < 2; c++) {
      const cx = WIDTH * (0.18 + r() * 0.64);
      const cy = HEIGHT * (0.15 + r() * 0.4);
      const near = points
        .map((p) => ({ p, d: (p.x - cx) ** 2 + (p.y - cy) ** 2 }))
        .sort((a, b) => a.d - b.d)
        .slice(0, 4 + Math.floor(r() * 3))
        .map((x) => x.p);
      // sorted by x so the line does not cross itself
      chains.push(near.sort((a, b) => a.x - b.x));
    }
  }

  return (
    <svg
      className={`pointer-events-none absolute inset-0 h-full w-full ${className}`}
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`} preserveAspectRatio="xMidYMid slice"
      aria-hidden="true" style={{ color: tint }}
    >
      {/* the tint's glow, at the top and to one side: never uniform */}
      <radialGradient id={`haze-${seed}`} cx="0.25" cy="0" r="1">
        <stop offset="0" stopColor="currentColor" stopOpacity="0.2" />
        <stop offset="0.55" stopColor="currentColor" stopOpacity="0.05" />
        <stop offset="1" stopColor="currentColor" stopOpacity="0" />
      </radialGradient>
      <rect width={WIDTH} height={HEIGHT} fill={`url(#haze-${seed})`} />

      {chains.map((chain, i) => (
        <g key={i} stroke="currentColor" strokeWidth="0.8" opacity="0.42" fill="none">
          <polyline points={chain.map((p) => `${p.x},${p.y}`).join(" ")} />
          {chain.map((p) => (
            <circle key={p.id} cx={p.x} cy={p.y} r="2.2" fill="none" opacity="0.8" />
          ))}
        </g>
      ))}

      {points.map((p) => (
        <circle
          key={p.id} cx={p.x} cy={p.y} r={p.radius} fill="#F3F5F7"
          opacity={p.live ? undefined : p.brightness}
          className={p.live ? "star-live" : undefined}
          style={p.live ? ({ animationDelay: `${p.delay}s` } as CSSProperties) : undefined}
        />
      ))}
    </svg>
  );
}
