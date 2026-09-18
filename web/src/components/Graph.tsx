"use client";

import { useEffect, useMemo, useRef, useState } from "react";

/* ─────────────────────────────────────────────────────────────────────────
   The memory graph.

   A force simulation written by hand, without d3 or any other dependency:
   repulsion between all nodes, springs on the edges and a gentle pull towards
   the centre. With 138 nodes that is 9,400 pairs per frame, which runs at
   60 fps on any machine without breaking a sweat.

   The initial positions come from a golden spiral, not from Math.random():
   the graph has to start THE SAME on the server and in the browser, and this
   way the map of your memory is also recognisable between visits instead of a
   different drawing every time.

   It stops on its own when the system cools down, and it does not start if
   the system asks for reduced motion.
   ───────────────────────────────────────────────────────────────────────── */

export type GraphNode = {
  path: string; title: string; system: string; type: string;
  days: number; degree: number;
};
export type GraphEdge = { o: number; d: number };

const COLOR: Record<string, string> = {
  core: "#34D399",
  file: "#CBD5E1",
  decision: "#A78BFA",
  session: "#38BDF8",
  skill: "#F472B6",
  stale: "#FBBF24",
};
const NAME: Record<string, string> = {
  core: "Core", file: "File", decision: "Decision",
  session: "Session", skill: "Skill", stale: "Stale",
};
const STALE = 10;

type View = "macro" | "mid" | "micro" | "total";
const VIEWS: { v: View; degree: number; t: string }[] = [
  { v: "macro", degree: 6, t: "MACRO" },
  { v: "mid", degree: 3, t: "MID" },
  { v: "micro", degree: 1, t: "MICRO" },
  { v: "total", degree: 0, t: "TOTAL" },
];

const color = (n: GraphNode) => (n.days > STALE ? COLOR.stale : COLOR[n.type] ?? COLOR.file);

/** Square root, not linear: with 30 links a node would be a ball covering its
    neighbours. This way the range reads and the biggest one still fits. */
const radius = (n: GraphNode) => 2.2 + Math.sqrt(n.degree) * 2.3;

export function Graph({ nodes, edges }: { nodes: GraphNode[]; edges: GraphEdge[] }) {
  const [view, setView] = useState<View>("mid");
  const [running, setRunning] = useState(true);
  const [over, setOver] = useState<number | null>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const frame = useRef<number | null>(null);
  const bodies = useRef<{ x: number; y: number; vx: number; vy: number }[]>([]);

  /* The node under the cursor goes in a REF, not only in state.
     Here lived the bug that made the graph go crazy: `over` was among the
     simulation effect's dependencies, so every mouse movement restarted it
     with the temperature at its maximum. It never got to cool down: the more
     you looked at it, the more it moved. */
  const focusRef = useRef<number | null>(null);
  const runningRef = useRef(true);
  const scale = useRef({ k: 1, cx: 0, cy: 0 });
  useEffect(() => { focusRef.current = over; }, [over]);
  useEffect(() => { runningRef.current = running; }, [running]);

  const cut = VIEWS.find((x) => x.v === view)!.degree;
  const { vis, eds } = useMemo(() => {
    const vis: number[] = [];
    nodes.forEach((n, i) => { if (n.degree >= cut) vis.push(i); });
    const index = new Map(vis.map((i, k) => [i, k]));
    const eds = edges
      .filter((a) => index.has(a.o) && index.has(a.d))
      .map((a) => ({ o: index.get(a.o)!, d: index.get(a.d)! }));
    return { vis, eds };
  }, [nodes, edges, cut]);

  useEffect(() => {
    const c = canvas.current;
    const ctx = c?.getContext("2d");
    if (!c || !ctx) return;

    /* Deterministic initial positions: golden spiral. No Math.random() nor
       anything that changes between visits: the map of your memory has to be
       recognisable, not a different drawing every time. */
    const GOLDEN = Math.PI * (3 - Math.sqrt(5));
    const b = vis.map((_, i) => {
      const r = 26 * Math.sqrt(i + 1);
      const a = GOLDEN * i;
      return { x: Math.cos(a) * r, y: Math.sin(a) * r, vx: 0, vy: 0 };
    });
    bodies.current = b;
    const N = b.length;

    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let temp = still ? 0 : 1;

    /* CONSTELLATIONS, NOT CONFETTI.
       With only repulsion and springs, 138 nodes spread evenly over the
       canvas and the result is a cloud of loose dots. What creates clusters
       is a third force: each node pulls towards the centre of ITS system
       (vault, claude-mem, Hermes). That turns the cloud into islands with
       bridges between them, which is the real shape of your memory. */
    const families = [...new Set(vis.map((i) => nodes[i].system))];
    const anchor = families.map((_, k) => {
      const a = (k / families.length) * Math.PI * 2 - Math.PI / 2;
      return { x: Math.cos(a) * 190, y: Math.sin(a) * 190 };
    });
    const whose = vis.map((i) => families.indexOf(nodes[i].system));

    const REPULSION = 2600;
    const D2_MIN = 90;      // two nodes cannot get closer than this: without it the
                            // force tends to infinity and they shoot off
    const V_MAX = 34;       // velocity ceiling. The missing safety net

    function simulate() {
      for (let i = 0; i < N; i++) {
        for (let j = i + 1; j < N; j++) {
          let dx = b[j].x - b[i].x, dy = b[j].y - b[i].y;
          let d2 = dx * dx + dy * dy;
          if (d2 < D2_MIN) {
            // overlapping: they separate along a fixed diagonal, not at random
            dx = dx || (i % 2 ? 1 : -1) * 3;
            dy = dy || 3;
            d2 = D2_MIN;
          }
          const d = Math.sqrt(d2);
          const f = REPULSION / d2;
          const ux = (dx / d) * f, uy = (dy / d) * f;
          b[i].vx -= ux; b[i].vy -= uy;
          b[j].vx += ux; b[j].vy += uy;
        }
      }
      for (const a of eds) {
        const dx = b[a.d].x - b[a.o].x, dy = b[a.d].y - b[a.o].y;
        const d = Math.max(1, Math.hypot(dx, dy));
        const f = (d - 78) * 0.02;
        const ux = (dx / d) * f, uy = (dy / d) * f;
        b[a.o].vx += ux; b[a.o].vy += uy;
        b[a.d].vx -= ux; b[a.d].vy -= uy;
      }
      for (let i = 0; i < N; i++) {
        const a = anchor[whose[i]];
        b[i].vx += (a.x - b[i].x) * 0.010;
        b[i].vy += (a.y - b[i].y) * 0.010;
        b[i].vx -= b[i].x * 0.0016;
        b[i].vy -= b[i].y * 0.0016;
        b[i].vx *= 0.82; b[i].vy *= 0.82;
        // the velocity ceiling, before moving anything
        const v = Math.hypot(b[i].vx, b[i].vy);
        if (v > V_MAX) { b[i].vx = (b[i].vx / v) * V_MAX; b[i].vy = (b[i].vy / v) * V_MAX; }
        b[i].x += b[i].vx * temp; b[i].y += b[i].vy * temp;
      }
      temp *= 0.972;
    }

    /* The layout is solved BEFORE painting the first frame: that way the
       graph appears already in place and not stumbling around in front of you. */
    if (!still) for (let k = 0; k < 220; k++) simulate();
    temp = 0.35;

    function paint() {
      const w = c!.width / devicePixelRatio, h = c!.height / devicePixelRatio;
      ctx!.clearRect(0, 0, w, h);
      /* The framing is computed on the BOX the nodes occupy, not on their
         distance to the origin. As soon as there are groups with their own
         anchors the centre of mass stops being at (0,0) and the graph spills
         out on one side: framing from the origin only worked with a
         symmetric cloud. */
      let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
      for (const p of b) {
        if (p.x < x0) x0 = p.x; if (p.x > x1) x1 = p.x;
        if (p.y < y0) y0 = p.y; if (p.y > y1) y1 = p.y;
      }
      const M = 34;   // margin so the halos are not cut off
      const k = Math.min((w - M * 2) / Math.max(1, x1 - x0), (h - M * 2) / Math.max(1, y1 - y0));
      const cx = w / 2 - ((x0 + x1) / 2) * k;
      const cy = h / 2 - ((y0 + y1) / 2) * k;
      scale.current = { k, cx, cy };
      const P = (i: number) => ({ x: cx + b[i].x * k, y: cy + b[i].y * k });
      const focus = focusRef.current;

      /* Edges first and in `lighter` mode: where many cross, the colour adds
         up and the luminous weave appears. It is what separates a graph that
         looks like a constellation from one that looks like a grey cobweb. */
      ctx!.globalCompositeOperation = "lighter";
      ctx!.lineWidth = 0.7;
      for (const a of eds) {
        const p = P(a.o), q = P(a.d);
        const live = focus !== null && (a.o === focus || a.d === focus);
        ctx!.strokeStyle = live ? "rgba(52,211,153,.75)" : "rgba(90,150,180,.20)";
        ctx!.lineWidth = live ? 1.4 : 0.7;
        ctx!.beginPath(); ctx!.moveTo(p.x, p.y); ctx!.lineTo(q.x, q.y); ctx!.stroke();
      }

      /* The halo is drawn with a real radial gradient, not with a translucent
         circle: a flat disc looks like a flat disc. */
      for (let i = 0; i < N; i++) {
        const n = nodes[vis[i]];
        const p = P(i);
        const r = radius(n);
        const inside = focus === i;
        if (r < 3.4 && !inside) continue;
        const g = ctx!.createRadialGradient(p.x, p.y, 0, p.x, p.y, r * (inside ? 6.5 : 4.6));
        const col = color(n);
        g.addColorStop(0, col + (inside ? "aa" : "66"));
        g.addColorStop(0.42, col + "22");
        g.addColorStop(1, col + "00");
        ctx!.fillStyle = g;
        ctx!.beginPath(); ctx!.arc(p.x, p.y, r * (inside ? 6.5 : 4.6), 0, Math.PI * 2);
        ctx!.fill();
      }
      ctx!.globalCompositeOperation = "source-over";

      for (let i = 0; i < N; i++) {
        const n = nodes[vis[i]];
        const p = P(i);
        const r = radius(n);
        const inside = focus === i;
        ctx!.beginPath();
        ctx!.arc(p.x, p.y, r + (inside ? 2.4 : 0), 0, Math.PI * 2);
        ctx!.fillStyle = color(n);
        ctx!.globalAlpha = inside ? 1 : 0.92;
        ctx!.fill();
        // the highlight at the top left: what turns a circle into a sphere
        // without spending a single extra frame
        if (r > 3.2) {
          ctx!.globalAlpha = inside ? 0.85 : 0.5;
          ctx!.beginPath();
          ctx!.arc(p.x - r * 0.3, p.y - r * 0.3, r * 0.38, 0, Math.PI * 2);
          ctx!.fillStyle = "#fff"; ctx!.fill();
        }
        ctx!.globalAlpha = 1;
      }
      if (focus !== null && b[focus]) {
        const n = nodes[vis[focus]];
        const p = P(focus);
        ctx!.font = "12px ui-monospace, monospace";
        ctx!.fillStyle = "#F3F5F7";
        ctx!.fillText(n.title, p.x + 12, p.y - 8);
        ctx!.fillStyle = "#6E7D8A";
        ctx!.fillText(`${n.system} · ${n.degree} links · ${n.days}d ago`, p.x + 12, p.y + 7);
      }
    }

    /* The loop ONLY simulates while there is energy left. When the system
       cools down it stops computing and only repaints if the cursor changes:
       a graph that keeps trembling forever is not alive, it is broken. */
    let previous: number | null = -2;
    function step() {
      const moves = runningRef.current && temp > 0.02;
      if (moves) simulate();
      if (moves || focusRef.current !== previous) {
        previous = focusRef.current;
        paint();
      }
      frame.current = requestAnimationFrame(step);
    }
    paint();
    frame.current = requestAnimationFrame(step);
    return () => { if (frame.current) cancelAnimationFrame(frame.current); };
  }, [vis, eds, nodes]);

  /* The canvas adapts to the container and to the screen density. Without
     this, on a Retina screen everything comes out blurry and at half size. */
  useEffect(() => {
    const c = canvas.current;
    if (!c) return;
    const fit = () => {
      const r = c.getBoundingClientRect();
      c.width = r.width * devicePixelRatio;
      c.height = r.height * devicePixelRatio;
      c.getContext("2d")?.scale(devicePixelRatio, devicePixelRatio);
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(c);
    return () => ro.disconnect();
  }, []);

  function mouse(e: React.MouseEvent<HTMLCanvasElement>) {
    const r = canvas.current!.getBoundingClientRect();
    const mx = e.clientX - r.left, my = e.clientY - r.top;
    const b = bodies.current;
    // The same scale it was painted with, not one recomputed by eye: if they
    // do not match, the node that lights up is not the one under you.
    const { k, cx, cy } = scale.current;
    let best: number | null = null, dist = 15;
    for (let i = 0; i < b.length; i++) {
      const d = Math.hypot(cx + b[i].x * k - mx, cy + b[i].y * k - my);
      if (d < dist) { dist = d; best = i; }
    }
    if (best !== over) setOver(best);
  }

  const types = useMemo(() => {
    const c = new Map<string, number>();
    for (const i of vis) {
      const n = nodes[i];
      const t = n.days > STALE ? "stale" : n.type;
      c.set(t, (c.get(t) ?? 0) + 1);
    }
    return [...c.entries()].sort((a, b) => b[1] - a[1]);
  }, [vis, nodes]);

  return (
    <div className="flex flex-col gap-3">
      <div className="relative overflow-hidden rounded-[6px]"
           style={{
             background: "radial-gradient(120% 90% at 50% 45%, #071018 0%, #04070A 62%)",
             border: "1px solid var(--border)",
           }}>
        <canvas ref={canvas} className="block h-[520px] w-full cursor-crosshair"
                onMouseMove={mouse} onMouseLeave={() => setOver(null)} />
        {/* the legend, inside the canvas as in the reference */}
        <div className="absolute bottom-3 left-3 flex flex-wrap gap-x-3.5 gap-y-1.5 rounded-[5px] px-3 py-2"
             style={{ background: "rgb(4 7 10 / .74)", border: "1px solid var(--border)" }}>
          {types.map(([t, n]) => (
            <span key={t} className="label flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full" style={{ background: COLOR[t] ?? COLOR.file }} />
              {NAME[t] ?? t} <span style={{ color: "var(--text-3)" }}>{n}</span>
            </span>
          ))}
        </div>
        <p className="label absolute right-3 top-3">
          {vis.length} nodes · {eds.length} links
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="label mr-1">view</span>
        {VIEWS.map((x) => (
          <button key={x.v} onClick={() => setView(x.v)}
                  className="label rounded-[3px] px-3 py-1.5 transition-colors"
                  style={x.v === view
                    ? { background: "var(--amber)", color: "#04222A" }
                    : { background: "var(--card)", border: "1px solid var(--border)" }}>
            {x.t}
          </button>
        ))}
        <button onClick={() => setRunning((v) => !v)}
                className="label ml-auto rounded-[3px] px-3 py-1.5"
                style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
          {running ? "pause" : "resume"}
        </button>
      </div>
    </div>
  );
}
