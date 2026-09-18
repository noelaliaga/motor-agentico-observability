"use client";

import { useEffect, useRef, useState, type ReactElement } from "react";
import type { BasePair } from "./Chain";

/* ─────────────────────────────────────────────────────────────────────────
   The chain, standing up and in three dimensions.

   The centre is the memory: one base pair per file, sorted by freshness. The
   flanks are the inventory (skills on the left, agents on the right) and they
   are NOT decoration: each dot is an installed piece, solid if it has been
   used and dimmed if it sleeps. The disproportion between what is installed
   and what is used is the story they tell, and that is why each pillar
   carries its seal with the count underneath.

   HOW IT IS BUILT, which is where the craft is:

   · The nucleotides are NOT drawn with `arc()` every frame. One sphere per
     colour is rendered ONCE (with its light, its rim and its halo) and after
     that it is only stamped, scaled. Hundreds of gradient spheres per frame
     cost 15 ms; stamped, under 2.
   · Every primitive in each group is sorted by depth before painting
     (painter's algorithm). The flanks get their own passes: they never
     overlap the centre on screen, so sorting them together would be paying
     for nothing.
   · The canvas REALLY STOPS. The loop only runs while something moves
     (assembly, spin, inertia, view transition); at rest it cancels itself and
     each interaction asks for a single frame. The courtesy spin on entry
     decays on its own: spinning non-stop is the user's choice, not an
     ornament (DESIGN.md doctrine).
   · Depth fog, star parallax and vignette: what is far fades into the
     background, just like in air.

   Scars that must not reopen:
   · Every piece of state that changes with the mouse (hover, controls) lives
     in refs and is MIRRORED from React; never in the big effect's
     dependencies.
   · The flanks arrive as new literals on every render: they live in
     flanksRef, not in the dependencies.
   · The flanks are pillars in screen space: they spin on their own axis and
     are shifted AFTER projecting. Inside the rotation they would orbit the
     centre and sweep the helix every half turn.
   · The assembly and the courtesy spin advance with the CLOCK, never with the
     frame count. Counting frames froze the piece wherever rAF arrives in
     dribs and drabs (background tab, headless capture): the helix stayed in
     its fresh stretch and the flanks were two loose dots.
   ───────────────────────────────────────────────────────────────────────── */

const STALE = 10;

type RGB = [number, number, number];
const PALETTE: { upTo: number; c: RGB; t: string }[] = [
  { upTo: 2, c: [52, 211, 153], t: "today or yesterday" },
  { upTo: STALE, c: [34, 211, 238], t: "this week" },
  { upTo: 30, c: [251, 191, 36], t: "over 10 days" },
  { upTo: 1e9, c: [251, 113, 133], t: "over a month" },
];
const tone = (d: number): RGB => (PALETTE.find((p) => d <= p.upTo) ?? PALETTE[3]).c;
const toneIdx = (d: number) => PALETTE.findIndex((p) => d <= p.upTo);

/* Strand inks, with the dashboard's semantics: skills are the amber section
   (--spend) and agents execute, which is violet (--review).
   The centre keeps the freshness scale. */
const INK_SKILLS: RGB = [251, 191, 36];
const INK_AGENTS: RGB = [167, 139, 250];
const HEX_SKILLS = "#FBBF24";
const HEX_AGENTS = "#A78BFA";

/** A sphere with a highlight, rim and halo, rendered only once per colour. */
function sprite(c: RGB, side = 128): HTMLCanvasElement {
  const cv = document.createElement("canvas");
  cv.width = cv.height = side;
  const x = cv.getContext("2d")!;
  const m = side / 2;
  const R = side * 0.22;

  // the halo, which is what gives the feeling that it emits light
  const halo = x.createRadialGradient(m, m, R * 0.4, m, m, m);
  halo.addColorStop(0, `rgba(${c[0]},${c[1]},${c[2]},.44)`);
  halo.addColorStop(0.35, `rgba(${c[0]},${c[1]},${c[2]},.12)`);
  halo.addColorStop(1, `rgba(${c[0]},${c[1]},${c[2]},0)`);
  x.fillStyle = halo;
  x.fillRect(0, 0, side, side);

  // the body, lit from the top left
  const body = x.createRadialGradient(m - R * 0.36, m - R * 0.38, R * 0.06, m, m, R);
  body.addColorStop(0, "rgba(255,255,255,.95)");
  body.addColorStop(0.24, `rgba(${Math.min(255, c[0] + 60)},${Math.min(255, c[1] + 60)},${Math.min(255, c[2] + 60)},1)`);
  body.addColorStop(0.72, `rgb(${c[0]},${c[1]},${c[2]})`);
  body.addColorStop(1, `rgba(${c[0] * 0.42},${c[1] * 0.42},${c[2] * 0.42},1)`);
  x.beginPath(); x.arc(m, m, R, 0, Math.PI * 2);
  x.fillStyle = body; x.fill();

  // the rim light: what separates a sphere from a circle
  const rim = x.createRadialGradient(m, m, R * 0.72, m, m, R);
  rim.addColorStop(0, "rgba(255,255,255,0)");
  rim.addColorStop(1, `rgba(${Math.min(255, c[0] + 90)},${Math.min(255, c[1] + 90)},${Math.min(255, c[2] + 90)},.5)`);
  x.beginPath(); x.arc(m, m, R, 0, Math.PI * 2);
  x.fillStyle = rim; x.fill();
  return cv;
}

type Prim =
  | { k: "n"; z: number; x: number; y: number; r: number; sp: HTMLCanvasElement; a: number }
  | { k: "d"; z: number; x: number; y: number; r: number; c: RGB; a: number }
  | { k: "l"; z: number; x1: number; y1: number; x2: number; y2: number; c: RGB; op: number; w: number };

export type Flank = { title: string; points: { name: string; uses: number }[] };

/* h: which strand the pointed item belongs to: b(ase pairs), l(eft), r(ight) */
type Focus = { h: "b" | "l" | "r"; i: number } | null;
type Emphasis = "all" | "memory" | "skills" | "agents";
type View = "front" | "threeq" | "top";

const VIEW_X: Record<View, number> = { front: -0.06, threeq: -0.22, top: -0.72 };
const VIEW_LABEL: Record<View, string> = { front: "front", threeq: "¾", top: "top" };
const VIEW_TITLE: Record<View, string> = {
  front: "from the front", threeq: "at three quarters", top: "from above",
};
const VIEW_ICON: Record<View, ReactElement> = {
  front: (
    <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor"
         strokeWidth="1" aria-hidden="true">
      <path d="M3.2 1C7.6 4 7.6 8 3.2 11M8.8 1C4.4 4 4.4 8 8.8 11" />
    </svg>
  ),
  threeq: (
    <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor"
         strokeWidth="1" aria-hidden="true">
      <ellipse cx="6" cy="6" rx="4.6" ry="2.1" transform="rotate(-18 6 6)" />
      <circle cx="6" cy="6" r="0.9" fill="currentColor" stroke="none" />
    </svg>
  ),
  top: (
    <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor"
         strokeWidth="1" aria-hidden="true">
      <circle cx="6" cy="6" r="4.4" />
      <circle cx="6" cy="6" r="0.9" fill="currentColor" stroke="none" />
    </svg>
  ),
};

/* The house pill, compact: the bar is an instrument, not a menu. */
const PILL = { padding: "3px 10px", fontSize: 11, gap: 5 } as const;

/** The seal under each pillar: title, proportion bar and the count that
    matters: how much of what is installed is really used. Without data, it says so. */
function FlankSeal({ f, x, ink, active }: { f: Flank; x: string; ink: string; active: boolean }) {
  const used = f.points.filter((p) => p.uses > 0).length;
  return (
    <div className="pointer-events-none absolute bottom-7 hidden w-[160px] -translate-x-1/2 flex-col items-center gap-1 lg:flex"
         style={{ left: x }}>
      <p className="label" style={active ? { color: ink } : undefined}>{f.title}</p>
      {f.points.length ? (
        <>
          <span className="ratio-bar block w-[76px]">
            <i style={{ width: `${Math.max(2, (used / f.points.length) * 100)}%`, background: ink }} />
          </span>
          <p className="datum" style={{ color: "var(--text-3)", fontSize: 10.5 }}>
            {used} in use · {f.points.length - used} unused
          </p>
        </>
      ) : (
        <p className="datum" style={{ color: "var(--text-3)" }}>no data</p>
      )}
    </div>
  );
}

export function Chain3D({
  pairs, left, right, height = 580,
}: { pairs: BasePair[]; left?: Flank; right?: Flank; height?: number }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [over, setOver] = useState<Focus>(null);
  const [spinningNow, setSpinningNow] = useState(false);
  const spin = useRef({ y: 0.55, x: VIEW_X.threeq, vy: 0, vx: 0 });
  const drag = useRef({ active: false, x: 0, y: 0 });
  const focusRef = useRef<Focus>(null);
  const proj = useRef<{ x: number; y: number; r: number; h: "b" | "l" | "r"; i: number }[]>([]);

  /* The controls: React state for the buttons, a ref mirror for the loop.
     Putting them in the effect's dependencies would restart the assembly on
     every click: scar no. 1 of this piece. */
  const [ctrl, setCtrl] = useState({
    spin: false, speed: 1, emphasis: "all" as Emphasis, filter: [true, true, true, true],
  });
  const ctrlRef = useRef(ctrl);
  const [view, setView] = useState<View | null>("threeq");
  const transRef = useRef<{ x0: number; x1: number; t0: number } | null>(null);
  const impulse = useRef(1);            // the courtesy spin on entry, which decays on its own
  const requestRef = useRef<() => void>(() => {});
  const stillRef = useRef(false);

  /* The flanks go in a ref and NOT in the effect's dependencies.
     The page builds them as object literals, so every render brings new
     references; with them in the dependencies the effect restarted non-stop
     and the assembly went back to zero: the helix stayed assembling itself
     forever. */
  const flanksRef = useRef<{ f: Flank; x: number; h: "l" | "r" }[]>([]);
  flanksRef.current = [
    left ? { f: left, x: -368, h: "l" as const } : null,
    right ? { f: right, x: 368, h: "r" as const } : null,
  ].filter(Boolean) as { f: Flank; x: number; h: "l" | "r" }[];
  const axisRef = useRef<{ y: number; txt: string }[]>([]);
  const [axis, setAxis] = useState<{ y: number; txt: string }[]>([]);

  useEffect(() => { focusRef.current = over; requestRef.current(); }, [over]);
  useEffect(() => { ctrlRef.current = ctrl; requestRef.current(); }, [ctrl]);

  useEffect(() => {
    const c = canvas.current;
    const ctx = c?.getContext("2d");
    if (!c || !ctx) return;

    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    stillRef.current = still;
    impulse.current = still ? 0 : 1;

    const pairSprite = PALETTE.map((p) => sprite(p.c));
    const sideSprite = { l: sprite(INK_SKILLS), r: sprite(INK_AGENTS) } as const;
    const sideInk = { l: INK_SKILLS, r: INK_AGENTS } as const;

    // deterministic stars, spread over a sphere around the scene
    const STARS = 150;
    const stars = Array.from({ length: STARS }, (_, i) => {
      const phi = Math.acos(1 - (2 * (i + 0.5)) / STARS);
      const th = Math.PI * (3 - Math.sqrt(5)) * i;
      const R = 460 + ((i * 37) % 260);
      return {
        x: Math.sin(phi) * Math.cos(th) * R,
        y: Math.cos(phi) * R * 0.62,
        z: Math.sin(phi) * Math.sin(th) * R,
        b: 0.18 + ((i * 13) % 10) / 26,
      };
    });

    /* On the development laptop the swap was tested: retina at 2× is already
       four times the pixels, at 3× it would be nine. Two is the honest cap. */
    let dpr = 1;
    const fit = () => {
      dpr = Math.min(2, window.devicePixelRatio || 1);
      const r = c.getBoundingClientRect();
      c.width = r.width * dpr;
      c.height = r.height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      request();
    };
    const ro = new ResizeObserver(fit);

    const N = pairs.length;
    const TURNS = Math.max(2.5, Math.min(4.2, N / 32));
    const RADIUS = 128;
    const F = 520;
    const ASSEMBLY_MS = 1100;              // clock ms the assembly lasts
    let t0 = 0;                            // ts of the first painted frame
    let assembly = still ? 1 : 0;          // 0 → 1: the chain assembles on entry

    /* ── the loop that knows how to stop ────────────────────────────────
       It runs while something moves; otherwise it cancels itself and the
       canvas stays frozen at zero cost. Each interaction (hover, button,
       resize) asks for a frame with request() and, if nothing else moves, it
       stops again after painting it.

       Each batch asks for the rAF AND arms a 40 ms rescue timer. In a healthy
       tab the rAF arrives first (16.7 ms) and disarms the timer: zero cost,
       everything in step with the screen. Where the rAF is throttled or dead
       (background tab, power saving, the headless capture with a virtual
       clock) the timer keeps the animation going at 25 fps until the scene
       rests, and then BOTH are cancelled: rest still costs zero. */
    let frame = 0, tmr = 0, running = false;
    const animating = () => {
      const g = spin.current, cc = ctrlRef.current;
      return assembly < 1 || drag.current.active || transRef.current !== null ||
             (cc.spin && !still) || impulse.current > 0.085 ||
             g.vy !== 0 || g.vx !== 0;
    };
    const batch = () => {
      frame = requestAnimationFrame(step);
      tmr = window.setTimeout(() => {
        cancelAnimationFrame(frame);
        step(performance.now());     // same clock origin as the rAF ts
      }, 40);
    };
    const step = (ts: number) => {
      clearTimeout(tmr);
      draw(ts);
      if (animating()) batch();
      else running = false;
    };
    const request = () => {
      if (!running) { running = true; batch(); }
    };
    requestRef.current = request;

    let tsPrev = 0;
    function draw(ts: number) {
      const w = c!.width / dpr, h = c!.height / dpr;
      const g = spin.current, cc = ctrlRef.current;
      // time step normalised to 60 fps: at 120 Hz it does not run twice as fast.
      // dtu is the real UNCAPPED delta: what advances with the clock (assembly,
      // impulse) uses it; the capped one only integrates camera velocities.
      const dtu = tsPrev ? ts - tsPrev : 16.7;
      const fdt = Math.min(3, dtu / 16.7);
      tsPrev = ts;

      /* the camera: view transition > drag > own spin */
      const tr = transRef.current;
      if (tr) {
        const p = still ? 1 : Math.min(1, (ts - tr.t0) / 480);
        g.x = tr.x0 + (tr.x1 - tr.x0) * (1 - Math.pow(1 - p, 3));  // cubic ease-out
        if (p >= 1) transRef.current = null;
      } else if (!drag.current.active) {
        let target = 0;
        if (cc.spin && !still) {
          // the breathing: the continuous spin undulates by 22 %, it is not a lathe
          target = 0.0032 * cc.speed * (1 + 0.22 * Math.sin(ts * 0.00035));
        } else if (impulse.current > 0.085) {
          target = 0.0032 * impulse.current;
        }
        impulse.current *= Math.pow(0.997, dtu / 16.7); // the courtesy dies in ~14 s of clock
        g.vy += (target - g.vy) * Math.min(1, 0.05 * fdt);
        g.vx *= Math.pow(0.9, fdt);
        if (target === 0 && Math.abs(g.vy) < 0.00012) g.vy = 0;
        if (Math.abs(g.vx) < 0.0001) g.vx = 0;
        g.y += g.vy * fdt;
        g.x = Math.max(-0.78, Math.min(0.78, g.x + g.vx * fdt));
      }

      /* The assembly advances with the clock: counting frames (the previous
         version added 0.014 per frame) left the helix frozen in its fresh
         stretch as soon as the rAF spaced out: scar no. 4. */
      if (!t0) t0 = ts;
      if (assembly < 1) assembly = Math.min(1, (ts - t0) / ASSEMBLY_MS);
      // ease-out-quint: comes in fast and settles
      const e = 1 - Math.pow(1 - assembly, 5);

      ctx!.clearRect(0, 0, w, h);
      const cx = w / 2 + 12, cy = h / 2;
      /* The usable height discounts the perspective, not just the margins.
         A near point is projected with k = F/(F−RADIUS) ≈ 1.33, so the chain
         stretches a third more than it measures: without this discount the
         ends went out of the frame at the top and bottom. */
      const usableH = (h - 96) / 1.34;
      const cosY = Math.cos(g.y), sinY = Math.sin(g.y);
      const cosX = Math.cos(g.x), sinX = Math.sin(g.x);

      const rotate = (x: number, y: number, z: number) => {
        const x2 = x * cosY - z * sinY;
        const z2 = x * sinY + z * cosY;
        return { x: x2, y: y * cosX - z2 * sinX, z: y * sinX + z2 * cosX };
      };
      const P = (p: { x: number; y: number; z: number }) => {
        const k = F / (F + p.z);
        return { x: cx + p.x * k, y: cy + p.y * k, k };
      };

      /* the shared painter: sorts by depth and paints with fog */
      const paint = (ps: Prim[]) => {
        ps.sort((p, q) => q.z - p.z);
        for (const p of ps) {
          const fog = Math.max(0.14, Math.min(1, (F * 0.92) / (F + p.z + RADIUS)));
          if (p.k === "l") {
            ctx!.strokeStyle = `rgba(${p.c[0]},${p.c[1]},${p.c[2]},${Math.min(1, p.op) * fog})`;
            ctx!.lineWidth = p.w * fog;
            ctx!.lineCap = "round";
            ctx!.beginPath(); ctx!.moveTo(p.x1, p.y1); ctx!.lineTo(p.x2, p.y2); ctx!.stroke();
          } else if (p.k === "d") {
            ctx!.fillStyle = `rgba(${p.c[0]},${p.c[1]},${p.c[2]},${Math.min(1, p.a) * fog})`;
            ctx!.beginPath(); ctx!.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx!.fill();
          } else {
            // the sprite carries the halo inside: it is stamped at 4.5× the radius
            const side = p.r * 9;
            ctx!.globalAlpha = Math.min(1, p.a) * fog;
            ctx!.globalCompositeOperation = "lighter";
            ctx!.drawImage(p.sp, p.x - side / 2, p.y - side / 2, side, side);
            ctx!.globalCompositeOperation = "source-over";
            ctx!.globalAlpha = 1;
          }
        }
      };

      /* ── the background: stars with parallax ────────────────────────── */
      ctx!.globalCompositeOperation = "lighter";
      for (const s of stars) {
        const p = P(rotate(s.x, s.y, s.z));
        if (p.k <= 0.05) continue;
        const r = Math.max(0.35, 1.15 * p.k);
        ctx!.fillStyle = `rgba(178,214,232,${s.b * p.k * 0.85})`;
        ctx!.beginPath(); ctx!.arc(p.x, p.y, r, 0, Math.PI * 2); ctx!.fill();
      }
      ctx!.globalCompositeOperation = "source-over";

      /* ── the orbit rings: the floor of the scene ──────────────────────
         Elliptical through the projection itself: they tell you at what
         inclination you are looking without a separate indicator. */
      ctx!.lineWidth = 1;
      for (const [rad, op] of [[RADIUS * 1.55, 0.16], [RADIUS * 2.3, 0.1], [RADIUS * 3.1, 0.06]] as const) {
        ctx!.beginPath();
        for (let a = 0; a <= 64; a++) {
          const th = (a / 64) * Math.PI * 2;
          const p = P(rotate(Math.cos(th) * rad, usableH * 0.5 + 26, Math.sin(th) * rad));
          a ? ctx!.lineTo(p.x, p.y) : ctx!.moveTo(p.x, p.y);
        }
        ctx!.strokeStyle = `rgba(120,180,210,${op})`;
        ctx!.stroke();
      }

      const focus = focusRef.current;
      const emph = cc.emphasis;
      /* Emphasis and hover dim what is not in play: multipliers per strand. */
      const mMem = (emph === "all" || emph === "memory" ? 1 : 0.12) *
                   (focus && focus.h !== "b" ? 0.25 : 1);

      const vis: { x: number; y: number; r: number; h: "b" | "l" | "r"; i: number }[] = [];
      let hud: { x: number; y: number; r: number; c: RGB } | null = null;

      /* ── the flank strands: the inventory ───────────────────────────── */
      ctx!.globalCompositeOperation = "lighter";
      if (w >= 880) {
        for (const { f, x: shift, h: side } of flanksRef.current) {
          const ink = sideInk[side];
          const sp = sideSprite[side];
          const mSide = (emph === "all" || emph === (side === "l" ? "skills" : "agents") ? 1 : 0.1) *
                        (focus ? (focus.h === side ? 1 : 0.22) : 1);
          const M0 = f.points.length;
          if (!M0 || mSide < 0.02) continue;

          /* Sampling that KEEPS every used one. Sampling blindly ate exactly
             the lit ones (they come sorted by uses) and the flank lost its
             story: 274 installed, 16 in use. */
          const used: number[] = [], dormant: number[] = [];
          f.points.forEach((p, k2) => (p.uses > 0 ? used : dormant).push(k2));
          const CAP = 96;              // more points than this is a tube, not a strand
          const room = Math.max(8, CAP - used.length);
          const step2 = Math.max(1, Math.ceil(dormant.length / room));
          const idxs = used.concat(dormant.filter((_, j) => j % step2 === 0)).sort((a, b) => a - b);
          const M = idxs.length;
          // the flanks assemble one beat after the centre
          const shownF = Math.ceil(M * Math.max(0, Math.min(1, (e - 0.3) / 0.7)));

          const rF = 40, turnsF = Math.max(3, Math.min(6.5, M / 16));
          const heightF = usableH * 1.06;
          const primsF: Prim[] = [];
          const prev: ({ x: number; y: number; z: number } | null)[] = [null, null];

          for (let j = 0; j < shownF; j++) {
            const k2 = idxs[j];
            const p0 = f.points[k2];
            /* position by sampled index: even spread along the pillar.
               They come sorted by uses, so what is alive stays on top as a
               block and the dormant tail takes everything else: the
               disproportion reads vertically */
            const t = M === 1 ? 0.5 : j / (M - 1);
            const ang = t * Math.PI * 2 * turnsF;
            const y2 = (t - 0.5) * heightF;
            const alive = p0.uses > 0;
            const activeP = focus !== null && focus.h === side && focus.i === k2;

            /* pillar in screen space: rotated on its axis, shifted afterwards */
            const pair: { x: number; y: number; k: number; z: number }[] = [];
            for (const hb of [0, 1] as const) {
              const a2 = ang + hb * Math.PI;
              const r0 = rotate(Math.cos(a2) * rF, y2, Math.sin(a2) * rF);
              const q = P(r0);
              const point = { x: q.x + shift, y: q.y, k: q.k, z: r0.z };
              pair.push(point);
              const o = prev[hb];
              if (o) primsF.push({
                k: "l", z: (o.z + point.z) / 2, x1: o.x, y1: o.y, x2: point.x, y2: point.y,
                c: [130, 175, 200], op: 0.18 * mSide, w: 0.9,
              });
              prev[hb] = point;
            }
            primsF.push({
              k: "l", z: (pair[0].z + pair[1].z) / 2,
              x1: pair[0].x, y1: pair[0].y, x2: pair[1].x, y2: pair[1].y,
              c: alive ? ink : [116, 140, 155],
              op: (alive ? 0.32 : 0.15) * mSide * (activeP ? 2.4 : 1), w: alive ? 1 : 0.7,
            });
            for (let ie = 0; ie < 2; ie++) {
              const q = pair[ie];
              if (alive) {
                const r2 = (2.1 + Math.min(2.9, Math.log2(1 + p0.uses) * 0.95)) * q.k *
                           (ie ? 0.6 : 1) * (activeP ? 1.45 : 1);
                primsF.push({ k: "n", z: q.z, x: q.x, y: q.y, r: r2, sp, a: (activeP ? 1 : 0.85) * mSide });
                if (activeP && !ie) hud = { x: q.x, y: q.y, r: r2, c: ink };
              } else {
                primsF.push({
                  k: "d", z: q.z, x: q.x, y: q.y,
                  r: Math.max(0.6, (activeP ? 2.4 : 1.8) * q.k),
                  c: [152, 174, 188], a: (activeP ? 0.9 : 0.5) * mSide,
                });
                if (activeP && !ie) hud = { x: q.x, y: q.y, r: 3, c: [150, 172, 186] };
              }
            }
            vis.push({ x: pair[0].x, y: pair[0].y, r: Math.max(9, 4 * pair[0].k + 5), h: side, i: k2 });
          }
          paint(primsF);
        }
      }
      ctx!.globalCompositeOperation = "source-over";

      /* ── the centre: the memory ─────────────────────────────────────── */
      const focusB = focus && focus.h === "b" ? focus.i : null;
      const prims: Prim[] = [];
      const pairsP: { a: ReturnType<typeof rotate>; z: ReturnType<typeof rotate> }[] = [];
      const shown = Math.ceil(N * e);

      for (let i = 0; i < N; i++) {
        const t = N === 1 ? 0.5 : i / (N - 1);
        const ang = t * Math.PI * 2 * TURNS;
        const y = (t - 0.5) * usableH;
        pairsP.push({
          a: rotate(Math.cos(ang) * RADIUS, y, Math.sin(ang) * RADIUS),
          z: rotate(Math.cos(ang + Math.PI) * RADIUS, y, Math.sin(ang + Math.PI) * RADIUS),
        });
      }

      const marks: { y: number; txt: string }[] = [];
      let lastStretch = "";

      for (let i = 0; i < shown; i++) {
        const b = pairs[i];
        const { a, z } = pairsP[i];
        const pa = P(a), pz = P(z);
        const ci = toneIdx(b.days);
        const col = PALETTE[ci].c;
        const mB = mMem * (cc.filter[ci] ? 1 : 0.06);   // the freshness filter
        const active = focusB === i;
        const dimmed = focusB !== null && !active;
        const rr = (2.1 + Math.min(3.1, Math.sqrt(b.degree) * 1.1)) * pa.k;

        prims.push({
          k: "l", z: (a.z + z.z) / 2, x1: pa.x, y1: pa.y, x2: pz.x, y2: pz.y,
          c: col, op: (active ? 1 : dimmed ? 0.08 : 0.32) * mB, w: active ? 3 : 1,
        });
        prims.push({ k: "n", z: a.z, x: pa.x, y: pa.y, r: active ? rr + 2.6 : rr, sp: pairSprite[ci], a: (dimmed ? 0.16 : 0.92) * mB });
        prims.push({ k: "n", z: z.z, x: pz.x, y: pz.y, r: active ? rr * 1.1 : rr * 0.66, sp: pairSprite[ci], a: (dimmed ? 0.12 : 0.6) * mB });
        if (active) hud = { x: pa.x, y: pa.y, r: rr + 2.6, c: col };
        vis.push({ x: pa.x, y: pa.y, r: Math.max(8, rr + 5), h: "b", i });

        // the axis: a mark whenever the freshness stretch changes
        const stretch = String(ci);
        if (stretch !== lastStretch) {
          lastStretch = stretch;
          const my = P({ x: 0, y: (i / Math.max(1, N - 1) - 0.5) * usableH, z: 0 }).y;
          // the first mark falls below the header, not above it
          if (my > 56 && my < h - 44) marks.push({ y: my, txt: PALETTE[ci].t });
        }
      }

      for (let i = 1; i < shown; i++) {
        for (const hb of ["a", "z"] as const) {
          const p = pairsP[i - 1][hb], q = pairsP[i][hb];
          const pp = P(p), pq = P(q);
          prims.push({
            k: "l", z: (p.z + q.z) / 2, x1: pp.x, y1: pp.y, x2: pq.x, y2: pq.y,
            c: [163, 205, 224], op: (focusB !== null ? 0.14 : 0.46) * mMem, w: 1.5,
          });
        }
      }

      proj.current = vis;
      // The axis only re-renders if its labels change: if it updated every
      // frame, React would repaint 60 times a second a text that does not move.
      const signature = marks.map((m) => m.txt).join("|");
      if (signature !== axisRef.current.map((m) => m.txt).join("|") || marks.length !== axisRef.current.length) {
        axisRef.current = marks; setAxis(marks);
      }

      paint(prims);

      /* ── the focus reticle: the HUD of an instrument, not of the scene ── */
      if (hud) {
        ctx!.strokeStyle = `rgba(${hud.c[0]},${hud.c[1]},${hud.c[2]},.85)`;
        ctx!.lineWidth = 1;
        ctx!.beginPath(); ctx!.arc(hud.x, hud.y, hud.r + 5, 0, Math.PI * 2); ctx!.stroke();
        for (let q = 0; q < 4; q++) {
          const a2 = (Math.PI / 2) * q + Math.PI / 4;
          ctx!.beginPath();
          ctx!.moveTo(hud.x + Math.cos(a2) * (hud.r + 8), hud.y + Math.sin(a2) * (hud.r + 8));
          ctx!.lineTo(hud.x + Math.cos(a2) * (hud.r + 12), hud.y + Math.sin(a2) * (hud.r + 12));
          ctx!.stroke();
        }
      }

      if (N === 0) {
        ctx!.fillStyle = "rgba(147,163,176,.8)";
        ctx!.font = "11px ui-monospace, monospace";
        ctx!.textAlign = "center";
        ctx!.fillText("no files in the memory: there is no chain to draw", cx, cy);
      }

      /* ── the horizon: a low light that grounds the scene ────────────── */
      const hz = ctx!.createLinearGradient(0, h - 190, 0, h);
      hz.addColorStop(0, "rgba(34,211,238,0)");
      hz.addColorStop(1, "rgba(34,211,238,.075)");
      ctx!.fillStyle = hz; ctx!.fillRect(0, h - 190, w, 190);

      /* ── the corner reticle: the frame of an instrument ─────────────── */
      ctx!.strokeStyle = "rgba(150,200,220,.22)";
      ctx!.lineWidth = 1;
      const MM = 16, L = 18;
      for (const [ex, ey, dx, dy] of [[MM, MM, 1, 1], [w - MM, MM, -1, 1],
                                      [MM, h - MM, 1, -1], [w - MM, h - MM, -1, -1]] as const) {
        ctx!.beginPath();
        ctx!.moveTo(ex + dx * L, ey); ctx!.lineTo(ex, ey); ctx!.lineTo(ex, ey + dy * L);
        ctx!.stroke();
      }

      /* ── vignette: the air of the room ──────────────────────────────── */
      const v = ctx!.createRadialGradient(cx, cy, Math.min(w, h) * 0.22, cx, cy, Math.max(w, h) * 0.72);
      v.addColorStop(0, "rgba(4,7,10,0)");
      v.addColorStop(1, "rgba(4,7,10,.82)");
      ctx!.fillStyle = v; ctx!.fillRect(0, 0, w, h);
    }

    fit();
    ro.observe(c);
    request();
    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(tmr);
      running = false;
      requestRef.current = () => {};
      ro.disconnect();
    };
  }, [pairs]);

  function down(e: React.PointerEvent) {
    drag.current = { active: true, x: e.clientX, y: e.clientY };
    setSpinningNow(true);
    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
    requestRef.current();
  }
  function move(e: React.PointerEvent) {
    const a = drag.current;
    if (a.active) {
      const dx = e.clientX - a.x, dy = e.clientY - a.y;
      spin.current.y += dx * 0.0072;
      spin.current.x = Math.max(-0.78, Math.min(0.78, spin.current.x + dy * 0.005));
      spin.current.vy = dx * 0.0016;
      // tilting by hand invalidates the view chosen in the bar
      if (Math.abs(dy) > 2 && view !== null) setView(null);
      a.x = e.clientX; a.y = e.clientY;
      return;
    }
    const r = canvas.current!.getBoundingClientRect();
    const mx = e.clientX - r.left, my = e.clientY - r.top;
    let best: (typeof proj.current)[number] | null = null;
    let dist = 16;
    for (const p of proj.current) {
      const d = Math.hypot(p.x - mx, p.y - my);
      if (d < Math.max(dist, p.r)) { dist = d; best = p; }
    }
    const s: Focus = best ? { h: best.h, i: best.i } : null;
    const same = s === null ? over === null : over !== null && s.h === over.h && s.i === over.i;
    if (!same) setOver(s);
  }
  function up(e: React.PointerEvent) {
    drag.current.active = false;
    setSpinningNow(false);
    (e.currentTarget as Element).releasePointerCapture?.(e.pointerId);
    requestRef.current();
  }

  /* The alternative to dragging: arrows to rotate, space for the motor. */
  function key(e: React.KeyboardEvent) {
    const g = spin.current;
    let used = true;
    switch (e.key) {
      case "ArrowLeft": g.y -= 0.12; break;
      case "ArrowRight": g.y += 0.12; break;
      case "ArrowUp": g.x = Math.max(-0.78, g.x - 0.07); if (view !== null) setView(null); break;
      case "ArrowDown": g.x = Math.min(0.78, g.x + 0.07); if (view !== null) setView(null); break;
      case " ": impulse.current = 0; setCtrl((cc) => ({ ...cc, spin: !cc.spin })); break;
      default: used = false;
    }
    if (used) { e.preventDefault(); requestRef.current(); }
  }

  function goToView(v: View) {
    setView(v);
    const g = spin.current;
    if (stillRef.current) g.x = VIEW_X[v];
    else transRef.current = { x0: g.x, x1: VIEW_X[v], t0: performance.now() };
    requestRef.current();
  }

  const focusPair = over?.h === "b" ? pairs[over.i] : null;
  const flankOf = over?.h === "l" ? left : over?.h === "r" ? right : null;
  const focusPoint = over && flankOf ? flankOf.points[over.i] : null;

  const STRANDS: { id: Emphasis; t: string; dot?: string }[] = [
    { id: "all", t: "all" },
    { id: "memory", t: "memory", dot: "#34D399" },
    { id: "skills", t: "skills", dot: HEX_SKILLS },
    { id: "agents", t: "agents", dot: HEX_AGENTS },
  ];

  return (
    <figure className="overflow-hidden rounded-[8px]"
            style={{
              border: "1px solid var(--border)",
              boxShadow: "inset 0 1px 0 rgb(255 255 255 / .04), 0 22px 60px -30px rgb(0 0 0 / .9)",
            }}>
      <div className="relative"
           style={{ background: "radial-gradient(88% 76% at 52% 40%, #06121b 0%, #030608 72%)" }}>
        <canvas ref={canvas} className="block w-full touch-none select-none"
                style={{ height, cursor: spinningNow ? "grabbing" : "grab" }}
                tabIndex={0}
                aria-label="three-dimensional helix of the memory; arrows to rotate it, space to start or stop the spin"
                onPointerDown={down} onPointerMove={move} onPointerUp={up}
                onPointerLeave={(e) => { up(e); setOver(null); }}
                onKeyDown={key} />

        {/* the freshness axis, on the left and over the canvas */}
        <div className="pointer-events-none absolute inset-y-0 left-0 w-[168px]">
          {axis.map((m) => (
            <div key={m.txt + m.y} className="absolute left-5 flex items-center gap-2"
                 style={{ top: m.y - 6 }}>
              <span className="h-px w-4" style={{ background: "var(--border-strong, rgb(255 255 255 / .16))" }} />
              <span className="label">{m.txt}</span>
            </div>
          ))}
        </div>

        {/* the reading of what is pointed at, top left */}
        <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between p-5">
          <div className="max-w-[440px]">
            {focusPair ? (
              <>
                <p className="text-[15px] leading-tight"
                   style={{ color: `rgb(${tone(focusPair.days).join(",")})` }}>{focusPair.title}</p>
                <p className="datum mt-1 text-[11px]" style={{ color: "var(--text-3)" }}>
                  {focusPair.system} · {focusPair.type} · {focusPair.degree}{" "}
                  {focusPair.degree === 1 ? "link" : "links"} ·{" "}
                  {focusPair.days === 0 ? "touched today" : `${focusPair.days} ${focusPair.days === 1 ? "day" : "days"} ago`}
                </p>
              </>
            ) : focusPoint && over ? (
              <>
                <p className="text-[15px] leading-tight"
                   style={{ color: focusPoint.uses > 0 ? (over.h === "l" ? HEX_SKILLS : HEX_AGENTS) : "var(--text-2)" }}>
                  {focusPoint.name}
                </p>
                <p className="datum mt-1 text-[11px]" style={{ color: "var(--text-3)" }}>
                  {over.h === "l" ? "skill" : "agent"} ·{" "}
                  {focusPoint.uses > 0
                    ? `${focusPoint.uses} ${focusPoint.uses === 1 ? "invocation" : "invocations"}`
                    : "installed, never invoked"}
                </p>
              </>
            ) : (
              <p className="label">drag or use the arrows to rotate · the cursor identifies each point</p>
            )}
          </div>
          <p className="label shrink-0">{pairs.length} base pairs</p>
        </div>

        {/* the flank seals: the disproportion, under each pillar.
            The canvas centre is shifted 12 px (cx = w/2 + 12): both seals
            compensate for it to fall under THEIR pillar, not under 50 %. */}
        {left ? <FlankSeal f={left} x="calc(50% - 356px)" ink={HEX_SKILLS} active={ctrl.emphasis === "skills"} /> : null}
        {right ? <FlankSeal f={right} x="calc(50% + 380px)" ink={HEX_AGENTS} active={ctrl.emphasis === "agents"} /> : null}

        <p className="pointer-events-none absolute bottom-4 left-5 label">freshest on top</p>
      </div>

      {/* ── the control bar: an instrument, not an ornament ───────────── */}
      <div role="toolbar" aria-label="helix controls"
           className="flex flex-wrap items-center gap-x-5 gap-y-2 border-t px-4 py-2.5"
           style={{ background: "rgb(255 255 255 / .015)" }}>
        <div className="flex items-center gap-1.5">
          <span className="label mr-1">view</span>
          {(Object.keys(VIEW_X) as View[]).map((v) => (
            <button key={v} type="button" className="pill" style={PILL}
                    data-active={view === v ? "yes" : "no"} aria-pressed={view === v}
                    title={VIEW_TITLE[v]} onClick={() => goToView(v)}>
              {VIEW_ICON[v]}{VIEW_LABEL[v]}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1.5">
          <span className="label mr-1">spin</span>
          <button type="button" className="pill" style={PILL}
                  data-active={ctrl.spin ? "yes" : "no"} aria-pressed={ctrl.spin}
                  title="start or stop the continuous spin (space)"
                  onClick={() => { impulse.current = 0; setCtrl((cc) => ({ ...cc, spin: !cc.spin })); }}>
            {ctrl.spin ? "spinning" : "at rest"}
          </button>
          {([0.5, 1, 2] as const).map((v) => (
            <button key={v} type="button" className="pill datum" style={PILL}
                    data-active={ctrl.spin && ctrl.speed === v ? "yes" : "no"}
                    aria-pressed={ctrl.spin && ctrl.speed === v}
                    aria-label={`spin at speed ${v}`}
                    onClick={() => { impulse.current = 0; setCtrl((cc) => ({ ...cc, speed: v, spin: true })); }}>
              ×{v === 0.5 ? "½" : v}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1.5">
          <span className="label mr-1">strand</span>
          {STRANDS.map((hb) => (
            <button key={hb.id} type="button" className="pill" style={PILL}
                    data-active={ctrl.emphasis === hb.id ? "yes" : "no"}
                    aria-pressed={ctrl.emphasis === hb.id}
                    onClick={() => setCtrl((cc) => ({ ...cc, emphasis: hb.id }))}>
              {hb.dot ? <span className="h-2 w-2 rounded-full" style={{ background: hb.dot }} aria-hidden="true" /> : null}
              {hb.t}
            </button>
          ))}
        </div>

        {/* the freshness legend is also the filter: it is touched, not looked at */}
        <div className="ml-auto flex items-center gap-1.5">
          <span className="label mr-1">freshness</span>
          {PALETTE.map((p, i2) => (
            <button key={p.t} type="button" className="pill"
                    style={{ ...PILL, opacity: ctrl.filter[i2] ? 1 : 0.38 }}
                    aria-pressed={ctrl.filter[i2]}
                    title={ctrl.filter[i2] ? `dim “${p.t}”` : `light up “${p.t}” again`}
                    onClick={() => setCtrl((cc) => {
                      const f = [...cc.filter]; f[i2] = !f[i2];
                      return { ...cc, filter: f };
                    })}>
              <span className="h-2 w-2 rounded-full"
                    style={{ background: ctrl.filter[i2] ? `rgb(${p.c.join(",")})` : "rgb(255 255 255 / .25)" }}
                    aria-hidden="true" />
              {p.t}
            </button>
          ))}
        </div>
      </div>

      <figcaption className="sr-only">
        Three-dimensional double helix of the system's memory: {pairs.length} files sorted
        by freshness, from the most recent on top to the oldest at the bottom, coloured from green (today)
        to pink (untouched for over a month).
        {left ? ` On the left, ${left.title}: ${left.points.filter((p) => p.uses > 0).length} in use out of ${left.points.length}.` : ""}
        {right ? ` On the right, ${right.title}: ${right.points.filter((p) => p.uses > 0).length} in use out of ${right.points.length}.` : ""}
        {" "}The scene is rotated by dragging or with the keyboard arrows; the bottom bar
        controls the view, the spin, which strand is emphasised and which freshness stretches are shown.
      </figcaption>
    </figure>
  );
}
