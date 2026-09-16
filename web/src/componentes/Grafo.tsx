"use client";

import { useEffect, useMemo, useRef, useState } from "react";

/* ─────────────────────────────────────────────────────────────────────────
   El grafo de la memoria.

   Simulación de fuerzas escrita a mano, sin d3 ni ninguna otra dependencia:
   repulsión entre todos los nodos, muelles en las aristas y una atracción
   suave hacia el centro. Con 138 nodos son 9.400 pares por fotograma — eso
   corre a 60 fps en cualquier máquina sin despeinarse.

   Las posiciones iniciales salen de una espiral áurea, no de Math.random():
   el grafo tiene que empezar IGUAL en el servidor y en el navegador, y además
   así el mapa de tu memoria es reconocible entre visitas en vez de un dibujo
   distinto cada vez.

   Se detiene solo cuando el sistema se enfría, y no arranca si el sistema
   pide menos movimiento.
   ───────────────────────────────────────────────────────────────────────── */

export type NodoG = {
  ruta: string; titulo: string; sistema: string; tipo: string;
  dias: number; grado: number;
};
export type AristaG = { o: number; d: number };

const COLOR: Record<string, string> = {
  nucleo: "#34D399",
  archivo: "#CBD5E1",
  decision: "#A78BFA",
  sesion: "#38BDF8",
  habilidad: "#F472B6",
  obsoleto: "#FBBF24",
};
const NOMBRE: Record<string, string> = {
  nucleo: "Núcleo", archivo: "Archivo", decision: "Decisión",
  sesion: "Sesión", habilidad: "Habilidad", obsoleto: "Obsoleto",
};
const RANCIO = 10;

type Vista = "macro" | "medio" | "micro" | "total";
const VISTAS: { v: Vista; grado: number; t: string }[] = [
  { v: "macro", grado: 6, t: "MACRO" },
  { v: "medio", grado: 3, t: "MEDIO" },
  { v: "micro", grado: 1, t: "MICRO" },
  { v: "total", grado: 0, t: "TOTAL" },
];

const color = (n: NodoG) => (n.dias > RANCIO ? COLOR.obsoleto : COLOR[n.tipo] ?? COLOR.archivo);

/** Raíz cuadrada, no lineal: con 30 enlaces un nodo sería una pelota y taparía
    a sus vecinos. Así el rango se lee y el más grande sigue cabiendo. */
const radio = (n: NodoG) => 2.2 + Math.sqrt(n.grado) * 2.3;

export function Grafo({ nodos, aristas }: { nodos: NodoG[]; aristas: AristaG[] }) {
  const [vista, setVista] = useState<Vista>("medio");
  const [corriendo, setCorriendo] = useState(true);
  const [sobre, setSobre] = useState<number | null>(null);
  const lienzo = useRef<HTMLCanvasElement>(null);
  const marco = useRef<number | null>(null);
  const cuerpos = useRef<{ x: number; y: number; vx: number; vy: number }[]>([]);

  /* El nodo bajo el cursor va en un REF, no sólo en el estado.
     Aquí estuvo el fallo que hacía que el grafo se volviera loco: `sobre`
     estaba entre las dependencias del efecto de simulación, así que cada
     movimiento del ratón la reiniciaba con la temperatura al máximo. Nunca
     llegaba a enfriarse — cuanto más lo mirabas, más se movía. */
  const focoRef = useRef<number | null>(null);
  const corriendoRef = useRef(true);
  const escala = useRef({ k: 1, cx: 0, cy: 0 });
  useEffect(() => { focoRef.current = sobre; }, [sobre]);
  useEffect(() => { corriendoRef.current = corriendo; }, [corriendo]);

  const corte = VISTAS.find((x) => x.v === vista)!.grado;
  const { vis, ars } = useMemo(() => {
    const vis: number[] = [];
    nodos.forEach((n, i) => { if (n.grado >= corte) vis.push(i); });
    const indice = new Map(vis.map((i, k) => [i, k]));
    const ars = aristas
      .filter((a) => indice.has(a.o) && indice.has(a.d))
      .map((a) => ({ o: indice.get(a.o)!, d: indice.get(a.d)! }));
    return { vis, ars };
  }, [nodos, aristas, corte]);

  useEffect(() => {
    const c = lienzo.current;
    const ctx = c?.getContext("2d");
    if (!c || !ctx) return;

    /* Posiciones iniciales deterministas: espiral áurea. Ni Math.random() ni
       nada que cambie entre visitas — el mapa de tu memoria tiene que ser
       reconocible, no un dibujo distinto cada vez. */
    const AUREO = Math.PI * (3 - Math.sqrt(5));
    const b = vis.map((_, i) => {
      const r = 26 * Math.sqrt(i + 1);
      const a = AUREO * i;
      return { x: Math.cos(a) * r, y: Math.sin(a) * r, vx: 0, vy: 0 };
    });
    cuerpos.current = b;
    const N = b.length;

    const quieto = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let temp = quieto ? 0 : 1;

    /* CONSTELACIONES, NO CONFETI.
       Con sólo repulsión y muelles, 138 nodos se reparten uniformes por el
       lienzo y el resultado es una nube de puntos sueltos. Lo que crea
       agrupaciones es una tercera fuerza: cada nodo tira hacia el centro de
       SU sistema (bóveda, claude-mem, Hermes). Eso convierte la nube en
       islas con puentes entre ellas, que es la forma real de tu memoria. */
    const familias = [...new Set(vis.map((i) => nodos[i].sistema))];
    const ancla = familias.map((_, k) => {
      const a = (k / familias.length) * Math.PI * 2 - Math.PI / 2;
      return { x: Math.cos(a) * 190, y: Math.sin(a) * 190 };
    });
    const deQuien = vis.map((i) => familias.indexOf(nodos[i].sistema));

    const REPULSION = 2600;
    const D2_MIN = 90;      // dos nodos no pueden acercarse más: sin esto, la
                            // fuerza tiende a infinito y salen disparados
    const V_MAX = 34;       // techo de velocidad. El seguro que faltaba

    function simular() {
      for (let i = 0; i < N; i++) {
        for (let j = i + 1; j < N; j++) {
          let dx = b[j].x - b[i].x, dy = b[j].y - b[i].y;
          let d2 = dx * dx + dy * dy;
          if (d2 < D2_MIN) {
            // superpuestos: se separan por una diagonal fija, no al azar
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
      for (const a of ars) {
        const dx = b[a.d].x - b[a.o].x, dy = b[a.d].y - b[a.o].y;
        const d = Math.max(1, Math.hypot(dx, dy));
        const f = (d - 78) * 0.02;
        const ux = (dx / d) * f, uy = (dy / d) * f;
        b[a.o].vx += ux; b[a.o].vy += uy;
        b[a.d].vx -= ux; b[a.d].vy -= uy;
      }
      for (let i = 0; i < N; i++) {
        const a = ancla[deQuien[i]];
        b[i].vx += (a.x - b[i].x) * 0.010;
        b[i].vy += (a.y - b[i].y) * 0.010;
        b[i].vx -= b[i].x * 0.0016;
        b[i].vy -= b[i].y * 0.0016;
        b[i].vx *= 0.82; b[i].vy *= 0.82;
        // el techo de velocidad, antes de mover nada
        const v = Math.hypot(b[i].vx, b[i].vy);
        if (v > V_MAX) { b[i].vx = (b[i].vx / v) * V_MAX; b[i].vy = (b[i].vy / v) * V_MAX; }
        b[i].x += b[i].vx * temp; b[i].y += b[i].vy * temp;
      }
      temp *= 0.972;
    }

    /* Se resuelve el reparto ANTES de pintar el primer fotograma: así el
       grafo aparece ya colocado y no dando tumbos delante de ti. */
    if (!quieto) for (let k = 0; k < 220; k++) simular();
    temp = 0.35;

    function pintar() {
      const w = c!.width / devicePixelRatio, h = c!.height / devicePixelRatio;
      ctx!.clearRect(0, 0, w, h);
      /* El encuadre se calcula sobre la CAJA que ocupan los nodos, no sobre su
         distancia al origen. En cuanto hay grupos con anclas propias el centro
         de masas deja de estar en (0,0) y el grafo se sale por un lado —
         encuadrar desde el origen sólo funcionaba con una nube simétrica. */
      let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
      for (const p of b) {
        if (p.x < x0) x0 = p.x; if (p.x > x1) x1 = p.x;
        if (p.y < y0) y0 = p.y; if (p.y > y1) y1 = p.y;
      }
      const M = 34;   // margen para que los halos no se corten
      const k = Math.min((w - M * 2) / Math.max(1, x1 - x0), (h - M * 2) / Math.max(1, y1 - y0));
      const cx = w / 2 - ((x0 + x1) / 2) * k;
      const cy = h / 2 - ((y0 + y1) / 2) * k;
      escala.current = { k, cx, cy };
      const P = (i: number) => ({ x: cx + b[i].x * k, y: cy + b[i].y * k });
      const foco = focoRef.current;

      /* Las aristas primero y en modo `lighter`: donde se cruzan muchas, el
         color se suma y aparece la trama luminosa. Es lo que separa un grafo
         que parece una constelación de uno que parece una telaraña gris. */
      ctx!.globalCompositeOperation = "lighter";
      ctx!.lineWidth = 0.7;
      for (const a of ars) {
        const p = P(a.o), q = P(a.d);
        const vivo = foco !== null && (a.o === foco || a.d === foco);
        ctx!.strokeStyle = vivo ? "rgba(52,211,153,.75)" : "rgba(90,150,180,.20)";
        ctx!.lineWidth = vivo ? 1.4 : 0.7;
        ctx!.beginPath(); ctx!.moveTo(p.x, p.y); ctx!.lineTo(q.x, q.y); ctx!.stroke();
      }

      /* El halo se dibuja con un degradado radial de verdad, no con un
         círculo translúcido: un disco plano se ve como un disco plano. */
      for (let i = 0; i < N; i++) {
        const n = nodos[vis[i]];
        const p = P(i);
        const r = radio(n);
        const dentro = foco === i;
        if (r < 3.4 && !dentro) continue;
        const g = ctx!.createRadialGradient(p.x, p.y, 0, p.x, p.y, r * (dentro ? 6.5 : 4.6));
        const col = color(n);
        g.addColorStop(0, col + (dentro ? "aa" : "66"));
        g.addColorStop(0.42, col + "22");
        g.addColorStop(1, col + "00");
        ctx!.fillStyle = g;
        ctx!.beginPath(); ctx!.arc(p.x, p.y, r * (dentro ? 6.5 : 4.6), 0, Math.PI * 2);
        ctx!.fill();
      }
      ctx!.globalCompositeOperation = "source-over";

      for (let i = 0; i < N; i++) {
        const n = nodos[vis[i]];
        const p = P(i);
        const r = radio(n);
        const dentro = foco === i;
        ctx!.beginPath();
        ctx!.arc(p.x, p.y, r + (dentro ? 2.4 : 0), 0, Math.PI * 2);
        ctx!.fillStyle = color(n);
        ctx!.globalAlpha = dentro ? 1 : 0.92;
        ctx!.fill();
        // el punto de luz arriba a la izquierda: lo que convierte un círculo
        // en una esfera sin gastar un solo fotograma más
        if (r > 3.2) {
          ctx!.globalAlpha = dentro ? 0.85 : 0.5;
          ctx!.beginPath();
          ctx!.arc(p.x - r * 0.3, p.y - r * 0.3, r * 0.38, 0, Math.PI * 2);
          ctx!.fillStyle = "#fff"; ctx!.fill();
        }
        ctx!.globalAlpha = 1;
      }
      if (foco !== null && b[foco]) {
        const n = nodos[vis[foco]];
        const p = P(foco);
        ctx!.font = "12px ui-monospace, monospace";
        ctx!.fillStyle = "#F3F5F7";
        ctx!.fillText(n.titulo, p.x + 12, p.y - 8);
        ctx!.fillStyle = "#6E7D8A";
        ctx!.fillText(`${n.sistema} · ${n.grado} enlaces · hace ${n.dias}d`, p.x + 12, p.y + 7);
      }
    }

    /* El bucle SÓLO simula mientras queda energía. Cuando el sistema se
       enfría deja de calcular y se limita a repintar si cambia el cursor —
       un grafo que sigue temblando para siempre no está vivo, está roto. */
    let anterior: number | null = -2;
    function paso() {
      const mueve = corriendoRef.current && temp > 0.02;
      if (mueve) simular();
      if (mueve || focoRef.current !== anterior) {
        anterior = focoRef.current;
        pintar();
      }
      marco.current = requestAnimationFrame(paso);
    }
    pintar();
    marco.current = requestAnimationFrame(paso);
    return () => { if (marco.current) cancelAnimationFrame(marco.current); };
  }, [vis, ars, nodos]);

  /* El lienzo se ajusta al contenedor y a la densidad de pantalla. Sin esto,
     en una pantalla Retina todo sale borroso y a mitad de tamaño. */
  useEffect(() => {
    const c = lienzo.current;
    if (!c) return;
    const ajustar = () => {
      const r = c.getBoundingClientRect();
      c.width = r.width * devicePixelRatio;
      c.height = r.height * devicePixelRatio;
      c.getContext("2d")?.scale(devicePixelRatio, devicePixelRatio);
    };
    ajustar();
    const ro = new ResizeObserver(ajustar);
    ro.observe(c);
    return () => ro.disconnect();
  }, []);

  function raton(e: React.MouseEvent<HTMLCanvasElement>) {
    const r = lienzo.current!.getBoundingClientRect();
    const mx = e.clientX - r.left, my = e.clientY - r.top;
    const b = cuerpos.current;
    // La misma escala con la que se pintó, no una recalculada a ojo: si no
    // coinciden, el nodo que se ilumina no es el que tienes debajo.
    const { k, cx, cy } = escala.current;
    let mejor: number | null = null, dist = 15;
    for (let i = 0; i < b.length; i++) {
      const d = Math.hypot(cx + b[i].x * k - mx, cy + b[i].y * k - my);
      if (d < dist) { dist = d; mejor = i; }
    }
    if (mejor !== sobre) setSobre(mejor);
  }

  const tipos = useMemo(() => {
    const c = new Map<string, number>();
    for (const i of vis) {
      const n = nodos[i];
      const t = n.dias > RANCIO ? "obsoleto" : n.tipo;
      c.set(t, (c.get(t) ?? 0) + 1);
    }
    return [...c.entries()].sort((a, b) => b[1] - a[1]);
  }, [vis, nodos]);

  return (
    <div className="flex flex-col gap-3">
      <div className="relative overflow-hidden rounded-[6px]"
           style={{
             background: "radial-gradient(120% 90% at 50% 45%, #071018 0%, #04070A 62%)",
             border: "1px solid var(--borde)",
           }}>
        <canvas ref={lienzo} className="block h-[520px] w-full cursor-crosshair"
                onMouseMove={raton} onMouseLeave={() => setSobre(null)} />
        {/* la leyenda, dentro del lienzo como en la referencia */}
        <div className="absolute bottom-3 left-3 flex flex-wrap gap-x-3.5 gap-y-1.5 rounded-[5px] px-3 py-2"
             style={{ background: "rgb(4 7 10 / .74)", border: "1px solid var(--borde)" }}>
          {tipos.map(([t, n]) => (
            <span key={t} className="rotulo flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full" style={{ background: COLOR[t] ?? COLOR.archivo }} />
              {NOMBRE[t] ?? t} <span style={{ color: "var(--texto-3)" }}>{n}</span>
            </span>
          ))}
        </div>
        <p className="rotulo absolute right-3 top-3">
          {vis.length} nodos · {ars.length} enlaces
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="rotulo mr-1">vista</span>
        {VISTAS.map((x) => (
          <button key={x.v} onClick={() => setVista(x.v)}
                  className="rotulo rounded-[3px] px-3 py-1.5 transition-colors"
                  style={x.v === vista
                    ? { background: "var(--ambar)", color: "#04222A" }
                    : { background: "var(--carta)", border: "1px solid var(--borde)" }}>
            {x.t}
          </button>
        ))}
        <button onClick={() => setCorriendo((v) => !v)}
                className="rotulo ml-auto rounded-[3px] px-3 py-1.5"
                style={{ background: "var(--carta)", border: "1px solid var(--borde)" }}>
          {corriendo ? "pausa" : "seguir"}
        </button>
      </div>
    </div>
  );
}
