"use client";

import { useEffect, useRef, useState, type ReactElement } from "react";
import type { Base } from "./Cadena";

/* ─────────────────────────────────────────────────────────────────────────
   La cadena, de pie y en tres dimensiones.

   El centro es la memoria: un par de bases por archivo, ordenados por
   frescura. Los flancos son el inventario — skills a la izquierda, agentes a
   la derecha — y NO son decorado: cada punto es una pieza instalada, con
   cuerpo si se ha usado y apagada si duerme. La desproporción entre lo
   instalado y lo usado es la historia que cuentan, y por eso cada pilar
   lleva su sello con la cuenta debajo.

   CÓMO ESTÁ HECHA, que es donde está el nivel:

   · Los nucleótidos NO se dibujan con `arc()` cada fotograma. Se rinde una
     esfera por color UNA vez —con su luz, su borde y su halo— y después sólo
     se estampa escalada. Cientos de esferas con degradado por fotograma
     cuestan 15 ms; estampadas, menos de 2.
   · Todos los primitivos de cada grupo se ordenan por profundidad antes de
     pintar (pintor). Los flancos van en pasadas propias: nunca se solapan
     con el centro en pantalla, así que ordenarlos juntos sería pagar por nada.
   · El lienzo PARA de verdad. El bucle sólo corre mientras algo se mueve
     (ensamblado, giro, inercia, transición de vista); en reposo se cancela
     y cada interacción pide un único fotograma. El giro de cortesía de la
     entrada decae solo: girar sin parar es una elección del usuario, no un
     adorno (doctrina de DESIGN.md).
   · Niebla por profundidad, paralaje de estrellas y viñeta: lo lejano se
     apaga hacia el fondo, igual que en el aire.

   Cicatrices que no se reabren:
   · Todo estado que cambia con el ratón (hover, controles) vive en refs y
     se ESPEJA desde React; jamás en las dependencias del efecto grande.
   · Los flancos llegan como literales nuevos en cada render: viven en
     flancosRef, no en las dependencias.
   · Los flancos son pilares en espacio de pantalla: giran sobre su propio
     eje y se desplazan DESPUÉS de proyectar. Dentro de la rotación,
     orbitarían el centro y barrerían la hélice cada media vuelta.
   · El ensamblado y el giro de cortesía avanzan con el RELOJ, nunca con la
     cuenta de fotogramas. Contarlos congelaba la pieza donde el rAF llega a
     cuentagotas (pestaña al fondo, captura headless): la hélice se quedaba
     en su tramo fresco y los flancos eran dos puntos sueltos.
   ───────────────────────────────────────────────────────────────────────── */

const RANCIO = 10;

type RGB = [number, number, number];
const PALETA: { hasta: number; c: RGB; t: string }[] = [
  { hasta: 2, c: [52, 211, 153], t: "hoy o ayer" },
  { hasta: RANCIO, c: [34, 211, 238], t: "esta semana" },
  { hasta: 30, c: [251, 191, 36], t: "más de 10 días" },
  { hasta: 1e9, c: [251, 113, 133], t: "más de un mes" },
];
const tono = (d: number): RGB => (PALETA.find((p) => d <= p.hasta) ?? PALETA[3]).c;
const idxTono = (d: number) => PALETA.findIndex((p) => d <= p.hasta);

/* Tintas de hebra, con la semántica del panel: las skills son la sección
   ámbar (--gasto) y los agentes ejecutan, que es el violeta (--sueno).
   El centro conserva la escala de frescura. */
const TINTA_SKILLS: RGB = [251, 191, 36];
const TINTA_AGENTES: RGB = [167, 139, 250];
const HEX_SKILLS = "#FBBF24";
const HEX_AGENTES = "#A78BFA";

/** Una esfera con luz alta, borde y halo, rendida una sola vez por color. */
function sprite(c: RGB, lado = 128): HTMLCanvasElement {
  const cv = document.createElement("canvas");
  cv.width = cv.height = lado;
  const x = cv.getContext("2d")!;
  const m = lado / 2;
  const R = lado * 0.22;

  // el halo, que es lo que da la sensación de que emite
  const halo = x.createRadialGradient(m, m, R * 0.4, m, m, m);
  halo.addColorStop(0, `rgba(${c[0]},${c[1]},${c[2]},.44)`);
  halo.addColorStop(0.35, `rgba(${c[0]},${c[1]},${c[2]},.12)`);
  halo.addColorStop(1, `rgba(${c[0]},${c[1]},${c[2]},0)`);
  x.fillStyle = halo;
  x.fillRect(0, 0, lado, lado);

  // el cuerpo, iluminado desde arriba a la izquierda
  const cuerpo = x.createRadialGradient(m - R * 0.36, m - R * 0.38, R * 0.06, m, m, R);
  cuerpo.addColorStop(0, "rgba(255,255,255,.95)");
  cuerpo.addColorStop(0.24, `rgba(${Math.min(255, c[0] + 60)},${Math.min(255, c[1] + 60)},${Math.min(255, c[2] + 60)},1)`);
  cuerpo.addColorStop(0.72, `rgb(${c[0]},${c[1]},${c[2]})`);
  cuerpo.addColorStop(1, `rgba(${c[0] * 0.42},${c[1] * 0.42},${c[2] * 0.42},1)`);
  x.beginPath(); x.arc(m, m, R, 0, Math.PI * 2);
  x.fillStyle = cuerpo; x.fill();

  // el filo de luz del borde: lo que separa una esfera de un círculo
  const filo = x.createRadialGradient(m, m, R * 0.72, m, m, R);
  filo.addColorStop(0, "rgba(255,255,255,0)");
  filo.addColorStop(1, `rgba(${Math.min(255, c[0] + 90)},${Math.min(255, c[1] + 90)},${Math.min(255, c[2] + 90)},.5)`);
  x.beginPath(); x.arc(m, m, R, 0, Math.PI * 2);
  x.fillStyle = filo; x.fill();
  return cv;
}

type Prim =
  | { k: "n"; z: number; x: number; y: number; r: number; sp: HTMLCanvasElement; a: number }
  | { k: "d"; z: number; x: number; y: number; r: number; c: RGB; a: number }
  | { k: "l"; z: number; x1: number; y1: number; x2: number; y2: number; c: RGB; op: number; w: number };

export type Flanco = { titulo: string; puntos: { nombre: string; usos: number }[] };

/* h: a qué hebra pertenece lo apuntado — b(ases), i(zquierda), d(erecha) */
type Foco = { h: "b" | "i" | "d"; i: number } | null;
type Enfoque = "todo" | "memoria" | "skills" | "agentes";
type Vista = "frente" | "tresq" | "cenital";

const VISTA_X: Record<Vista, number> = { frente: -0.06, tresq: -0.22, cenital: -0.72 };
const ETIQ_VISTA: Record<Vista, string> = { frente: "frente", tresq: "¾", cenital: "cenital" };
const TITULO_VISTA: Record<Vista, string> = {
  frente: "de frente", tresq: "a tres cuartos", cenital: "desde arriba",
};
const ICONO_VISTA: Record<Vista, ReactElement> = {
  frente: (
    <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor"
         strokeWidth="1" aria-hidden="true">
      <path d="M3.2 1C7.6 4 7.6 8 3.2 11M8.8 1C4.4 4 4.4 8 8.8 11" />
    </svg>
  ),
  tresq: (
    <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor"
         strokeWidth="1" aria-hidden="true">
      <ellipse cx="6" cy="6" rx="4.6" ry="2.1" transform="rotate(-18 6 6)" />
      <circle cx="6" cy="6" r="0.9" fill="currentColor" stroke="none" />
    </svg>
  ),
  cenital: (
    <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor"
         strokeWidth="1" aria-hidden="true">
      <circle cx="6" cy="6" r="4.4" />
      <circle cx="6" cy="6" r="0.9" fill="currentColor" stroke="none" />
    </svg>
  ),
};

/* La píldora de la casa, en compacto: la barra es un instrumento, no un menú. */
const PILL = { padding: "3px 10px", fontSize: 11, gap: 5 } as const;

/** El sello bajo cada pilar: título, barra de proporción y la cuenta que
    importa — cuánto de lo instalado se usa de verdad. Sin datos, se dice. */
function SelloFlanco({ f, x, tinta, activo }: { f: Flanco; x: string; tinta: string; activo: boolean }) {
  const usados = f.puntos.filter((p) => p.usos > 0).length;
  return (
    <div className="pointer-events-none absolute bottom-7 hidden w-[160px] -translate-x-1/2 flex-col items-center gap-1 lg:flex"
         style={{ left: x }}>
      <p className="rotulo" style={activo ? { color: tinta } : undefined}>{f.titulo}</p>
      {f.puntos.length ? (
        <>
          <span className="barra block w-[76px]">
            <i style={{ width: `${Math.max(2, (usados / f.puntos.length) * 100)}%`, background: tinta }} />
          </span>
          <p className="dato" style={{ color: "var(--texto-3)", fontSize: 10.5 }}>
            {usados} en uso · {f.puntos.length - usados} sin usar
          </p>
        </>
      ) : (
        <p className="dato" style={{ color: "var(--texto-3)" }}>sin datos</p>
      )}
    </div>
  );
}

export function Cadena3D({
  bases, izq, der, alto = 580,
}: { bases: Base[]; izq?: Flanco; der?: Flanco; alto?: number }) {
  const lienzo = useRef<HTMLCanvasElement>(null);
  const [sobre, setSobre] = useState<Foco>(null);
  const [girando, setGirando] = useState(false);
  const giro = useRef({ y: 0.55, x: VISTA_X.tresq, vy: 0, vx: 0 });
  const arrastre = useRef({ activo: false, x: 0, y: 0 });
  const focoRef = useRef<Foco>(null);
  const proy = useRef<{ x: number; y: number; r: number; h: "b" | "i" | "d"; i: number }[]>([]);

  /* Los controles: estado React para los botones, espejo en ref para el
     bucle. Meterlos en las dependencias del efecto reiniciaría el montaje
     con cada clic — la cicatriz nº 1 de esta pieza. */
  const [ctrl, setCtrl] = useState({
    girar: false, vel: 1, enfoque: "todo" as Enfoque, filtro: [true, true, true, true],
  });
  const ctrlRef = useRef(ctrl);
  const [vista, setVista] = useState<Vista | null>("tresq");
  const transRef = useRef<{ x0: number; x1: number; t0: number } | null>(null);
  const impulso = useRef(1);            // el giro de cortesía de la entrada, que decae solo
  const pedirRef = useRef<() => void>(() => {});
  const quietoRef = useRef(false);

  /* Los flancos van en un ref y NO en las dependencias del efecto.
     La página los construye como objetos literales, así que cada render trae
     referencias nuevas; con ellos en las dependencias el efecto se reiniciaba
     sin parar y el montaje volvía a cero — la hélice se quedaba ensamblándose
     para siempre. */
  const flancosRef = useRef<{ f: Flanco; x: number; h: "i" | "d" }[]>([]);
  flancosRef.current = [
    izq ? { f: izq, x: -368, h: "i" as const } : null,
    der ? { f: der, x: 368, h: "d" as const } : null,
  ].filter(Boolean) as { f: Flanco; x: number; h: "i" | "d" }[];
  const ejeRef = useRef<{ y: number; txt: string }[]>([]);
  const [eje, setEje] = useState<{ y: number; txt: string }[]>([]);

  useEffect(() => { focoRef.current = sobre; pedirRef.current(); }, [sobre]);
  useEffect(() => { ctrlRef.current = ctrl; pedirRef.current(); }, [ctrl]);

  useEffect(() => {
    const c = lienzo.current;
    const ctx = c?.getContext("2d");
    if (!c || !ctx) return;

    const quieto = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    quietoRef.current = quieto;
    impulso.current = quieto ? 0 : 1;

    const spriteBase = PALETA.map((p) => sprite(p.c));
    const spriteLado = { i: sprite(TINTA_SKILLS), d: sprite(TINTA_AGENTES) } as const;
    const tintaLado = { i: TINTA_SKILLS, d: TINTA_AGENTES } as const;

    // estrellas deterministas, repartidas en una esfera alrededor de la escena
    const ESTRELLAS = 150;
    const estrellas = Array.from({ length: ESTRELLAS }, (_, i) => {
      const phi = Math.acos(1 - (2 * (i + 0.5)) / ESTRELLAS);
      const th = Math.PI * (3 - Math.sqrt(5)) * i;
      const R = 460 + ((i * 37) % 260);
      return {
        x: Math.sin(phi) * Math.cos(th) * R,
        y: Math.cos(phi) * R * 0.62,
        z: Math.sin(phi) * Math.sin(th) * R,
        b: 0.18 + ((i * 13) % 10) / 26,
      };
    });

    /* En el portátil de desarrollo se probó el swap: el retina a 2× ya son cuatro
       veces los píxeles, a 3× serían nueve. Dos es el tope honesto. */
    let dpr = 1;
    const ajustar = () => {
      dpr = Math.min(2, window.devicePixelRatio || 1);
      const r = c.getBoundingClientRect();
      c.width = r.width * dpr;
      c.height = r.height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      pedir();
    };
    const ro = new ResizeObserver(ajustar);

    const N = bases.length;
    const VUELTAS = Math.max(2.5, Math.min(4.2, N / 32));
    const RADIO = 128;
    const F = 520;
    const DURA_MONTAJE = 1100;             // ms de reloj que dura el ensamblado
    let t0 = 0;                            // ts del primer fotograma pintado
    let montaje = quieto ? 1 : 0;          // 0 → 1: la cadena se ensambla al entrar

    /* ── el bucle que sabe pararse ──────────────────────────────────────
       Corre mientras algo se mueva; si no, se cancela a sí mismo y el
       lienzo queda congelado a coste cero. Cada interacción (hover, botón,
       resize) pide un fotograma con pedir() y, si nada más se mueve, se
       vuelve a parar tras pintarlo.

       Cada tanda pide el rAF Y arma un temporizador de socorro a 40 ms.
       En una pestaña sana el rAF llega antes (16,7 ms) y desarma el
       temporizador: coste cero, todo va a compás de pantalla. Donde el rAF
       está estrangulado o muerto (pestaña al fondo, ahorro de energía, la
       captura headless con reloj virtual) el temporizador sostiene la
       animación a 25 fps hasta que la escena repose — y entonces AMBOS se
       cancelan: el reposo sigue costando cero. */
    let marco = 0, tmr = 0, corriendo = false;
    const animando = () => {
      const g = giro.current, cc = ctrlRef.current;
      return montaje < 1 || arrastre.current.activo || transRef.current !== null ||
             (cc.girar && !quieto) || impulso.current > 0.085 ||
             g.vy !== 0 || g.vx !== 0;
    };
    const tanda = () => {
      marco = requestAnimationFrame(paso);
      tmr = window.setTimeout(() => {
        cancelAnimationFrame(marco);
        paso(performance.now());     // mismo origen de reloj que el ts del rAF
      }, 40);
    };
    const paso = (ts: number) => {
      clearTimeout(tmr);
      dibujar(ts);
      if (animando()) tanda();
      else corriendo = false;
    };
    const pedir = () => {
      if (!corriendo) { corriendo = true; tanda(); }
    };
    pedirRef.current = pedir;

    let tsAnt = 0;
    function dibujar(ts: number) {
      const w = c!.width / dpr, h = c!.height / dpr;
      const g = giro.current, cc = ctrlRef.current;
      // paso de tiempo normalizado a 60 fps: a 120 Hz no corre al doble.
      // dtu es el delta real SIN capar: lo que avanza con el reloj (montaje,
      // impulso) lo usa a él; el capado sólo integra velocidades de cámara.
      const dtu = tsAnt ? ts - tsAnt : 16.7;
      const fdt = Math.min(3, dtu / 16.7);
      tsAnt = ts;

      /* la cámara: transición de vista > arrastre > giro propio */
      const tr = transRef.current;
      if (tr) {
        const p = quieto ? 1 : Math.min(1, (ts - tr.t0) / 480);
        g.x = tr.x0 + (tr.x1 - tr.x0) * (1 - Math.pow(1 - p, 3));  // ease-out cúbico
        if (p >= 1) transRef.current = null;
      } else if (!arrastre.current.activo) {
        let objetivo = 0;
        if (cc.girar && !quieto) {
          // la respiración: el giro continuo ondula un 22 %, no es un torno
          objetivo = 0.0032 * cc.vel * (1 + 0.22 * Math.sin(ts * 0.00035));
        } else if (impulso.current > 0.085) {
          objetivo = 0.0032 * impulso.current;
        }
        impulso.current *= Math.pow(0.997, dtu / 16.7); // la cortesía muere en ~14 s de reloj
        g.vy += (objetivo - g.vy) * Math.min(1, 0.05 * fdt);
        g.vx *= Math.pow(0.9, fdt);
        if (objetivo === 0 && Math.abs(g.vy) < 0.00012) g.vy = 0;
        if (Math.abs(g.vx) < 0.0001) g.vx = 0;
        g.y += g.vy * fdt;
        g.x = Math.max(-0.78, Math.min(0.78, g.x + g.vx * fdt));
      }

      /* El ensamblado avanza con el reloj: contar fotogramas (la versión
         anterior sumaba 0.014 por fotograma) dejaba la hélice congelada en su
         tramo fresco en cuanto el rAF se espaciaba — la cicatriz nº 4. */
      if (!t0) t0 = ts;
      if (montaje < 1) montaje = Math.min(1, (ts - t0) / DURA_MONTAJE);
      // ease-out-quint: entra rápido y se posa
      const e = 1 - Math.pow(1 - montaje, 5);

      ctx!.clearRect(0, 0, w, h);
      const cx = w / 2 + 12, cy = h / 2;
      /* El alto útil descuenta la perspectiva, no sólo los márgenes.
         Un punto cercano se proyecta con k = F/(F−RADIO) ≈ 1,33, así que la
         cadena se estira un tercio más de lo que mide: sin este descuento los
         extremos se salían del marco por arriba y por abajo. */
      const altoU = (h - 96) / 1.34;
      const cosY = Math.cos(g.y), sinY = Math.sin(g.y);
      const cosX = Math.cos(g.x), sinX = Math.sin(g.x);

      const rotar = (x: number, y: number, z: number) => {
        const x2 = x * cosY - z * sinY;
        const z2 = x * sinY + z * cosY;
        return { x: x2, y: y * cosX - z2 * sinX, z: y * sinX + z2 * cosX };
      };
      const P = (p: { x: number; y: number; z: number }) => {
        const k = F / (F + p.z);
        return { x: cx + p.x * k, y: cy + p.y * k, k };
      };

      /* el pintor compartido: ordena por profundidad y pinta con niebla */
      const pintar = (ps: Prim[]) => {
        ps.sort((p, q) => q.z - p.z);
        for (const p of ps) {
          const niebla = Math.max(0.14, Math.min(1, (F * 0.92) / (F + p.z + RADIO)));
          if (p.k === "l") {
            ctx!.strokeStyle = `rgba(${p.c[0]},${p.c[1]},${p.c[2]},${Math.min(1, p.op) * niebla})`;
            ctx!.lineWidth = p.w * niebla;
            ctx!.lineCap = "round";
            ctx!.beginPath(); ctx!.moveTo(p.x1, p.y1); ctx!.lineTo(p.x2, p.y2); ctx!.stroke();
          } else if (p.k === "d") {
            ctx!.fillStyle = `rgba(${p.c[0]},${p.c[1]},${p.c[2]},${Math.min(1, p.a) * niebla})`;
            ctx!.beginPath(); ctx!.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx!.fill();
          } else {
            // el sprite lleva el halo dentro: se estampa a 4,5× el radio
            const lado = p.r * 9;
            ctx!.globalAlpha = Math.min(1, p.a) * niebla;
            ctx!.globalCompositeOperation = "lighter";
            ctx!.drawImage(p.sp, p.x - lado / 2, p.y - lado / 2, lado, lado);
            ctx!.globalCompositeOperation = "source-over";
            ctx!.globalAlpha = 1;
          }
        }
      };

      /* ── el fondo: estrellas con paralaje ───────────────────────────── */
      ctx!.globalCompositeOperation = "lighter";
      for (const s of estrellas) {
        const p = P(rotar(s.x, s.y, s.z));
        if (p.k <= 0.05) continue;
        const r = Math.max(0.35, 1.15 * p.k);
        ctx!.fillStyle = `rgba(178,214,232,${s.b * p.k * 0.85})`;
        ctx!.beginPath(); ctx!.arc(p.x, p.y, r, 0, Math.PI * 2); ctx!.fill();
      }
      ctx!.globalCompositeOperation = "source-over";

      /* ── los anillos de órbita: el suelo de la escena ─────────────────
         Elípticos por la propia proyección: dicen a qué inclinación estás
         mirando sin necesidad de un indicador aparte. */
      ctx!.lineWidth = 1;
      for (const [rad, op] of [[RADIO * 1.55, 0.16], [RADIO * 2.3, 0.1], [RADIO * 3.1, 0.06]] as const) {
        ctx!.beginPath();
        for (let a = 0; a <= 64; a++) {
          const th = (a / 64) * Math.PI * 2;
          const p = P(rotar(Math.cos(th) * rad, altoU * 0.5 + 26, Math.sin(th) * rad));
          a ? ctx!.lineTo(p.x, p.y) : ctx!.moveTo(p.x, p.y);
        }
        ctx!.strokeStyle = `rgba(120,180,210,${op})`;
        ctx!.stroke();
      }

      const foco = focoRef.current;
      const enf = cc.enfoque;
      /* Enfoque y hover apagan lo que no toca: multiplicadores por hebra. */
      const mMem = (enf === "todo" || enf === "memoria" ? 1 : 0.12) *
                   (foco && foco.h !== "b" ? 0.25 : 1);

      const vis: { x: number; y: number; r: number; h: "b" | "i" | "d"; i: number }[] = [];
      let hud: { x: number; y: number; r: number; c: RGB } | null = null;

      /* ── las hebras de los flancos: el inventario ───────────────────── */
      ctx!.globalCompositeOperation = "lighter";
      if (w >= 880) {
        for (const { f, x: desp, h: lado } of flancosRef.current) {
          const tinta = tintaLado[lado];
          const sp = spriteLado[lado];
          const mLado = (enf === "todo" || enf === (lado === "i" ? "skills" : "agentes") ? 1 : 0.1) *
                        (foco ? (foco.h === lado ? 1 : 0.22) : 1);
          const M0 = f.puntos.length;
          if (!M0 || mLado < 0.02) continue;

          /* Muestreo que CONSERVA todos los usados. Muestrear a ciegas se
             comía justo los encendidos —vienen ordenados por usos— y el
             flanco perdía su historia: 274 instaladas, 16 en uso. */
          const usados: number[] = [], dormidos: number[] = [];
          f.puntos.forEach((p, k2) => (p.usos > 0 ? usados : dormidos).push(k2));
          const TOPE = 96;              // más puntos que esto es un tubo, no una hebra
          const hueco = Math.max(8, TOPE - usados.length);
          const paso2 = Math.max(1, Math.ceil(dormidos.length / hueco));
          const idxs = usados.concat(dormidos.filter((_, j) => j % paso2 === 0)).sort((a, b) => a - b);
          const M = idxs.length;
          // los flancos ensamblan un compás después del centro
          const vistoF = Math.ceil(M * Math.max(0, Math.min(1, (e - 0.3) / 0.7)));

          const rF = 40, vueltasF = Math.max(3, Math.min(6.5, M / 16));
          const altoF = altoU * 1.06;
          const primsF: Prim[] = [];
          const prev: ({ x: number; y: number; z: number } | null)[] = [null, null];

          for (let j = 0; j < vistoF; j++) {
            const k2 = idxs[j];
            const p0 = f.puntos[k2];
            /* posición por índice muestreado: reparto uniforme del pilar.
               Vienen ordenados por usos, así que lo vivo queda arriba en
               bloque y la cola dormida ocupa todo lo demás — la
               desproporción se lee en vertical */
            const t = M === 1 ? 0.5 : j / (M - 1);
            const ang = t * Math.PI * 2 * vueltasF;
            const y2 = (t - 0.5) * altoF;
            const vivo = p0.usos > 0;
            const activoP = foco !== null && foco.h === lado && foco.i === k2;

            /* pilar en espacio de pantalla: se rota en su eje, se desplaza después */
            const par: { x: number; y: number; k: number; z: number }[] = [];
            for (const hb of [0, 1] as const) {
              const a2 = ang + hb * Math.PI;
              const r0 = rotar(Math.cos(a2) * rF, y2, Math.sin(a2) * rF);
              const q = P(r0);
              const punto = { x: q.x + desp, y: q.y, k: q.k, z: r0.z };
              par.push(punto);
              const o = prev[hb];
              if (o) primsF.push({
                k: "l", z: (o.z + punto.z) / 2, x1: o.x, y1: o.y, x2: punto.x, y2: punto.y,
                c: [130, 175, 200], op: 0.18 * mLado, w: 0.9,
              });
              prev[hb] = punto;
            }
            primsF.push({
              k: "l", z: (par[0].z + par[1].z) / 2,
              x1: par[0].x, y1: par[0].y, x2: par[1].x, y2: par[1].y,
              c: vivo ? tinta : [116, 140, 155],
              op: (vivo ? 0.32 : 0.15) * mLado * (activoP ? 2.4 : 1), w: vivo ? 1 : 0.7,
            });
            for (let ie = 0; ie < 2; ie++) {
              const q = par[ie];
              if (vivo) {
                const r2 = (2.1 + Math.min(2.9, Math.log2(1 + p0.usos) * 0.95)) * q.k *
                           (ie ? 0.6 : 1) * (activoP ? 1.45 : 1);
                primsF.push({ k: "n", z: q.z, x: q.x, y: q.y, r: r2, sp, a: (activoP ? 1 : 0.85) * mLado });
                if (activoP && !ie) hud = { x: q.x, y: q.y, r: r2, c: tinta };
              } else {
                primsF.push({
                  k: "d", z: q.z, x: q.x, y: q.y,
                  r: Math.max(0.6, (activoP ? 2.4 : 1.8) * q.k),
                  c: [152, 174, 188], a: (activoP ? 0.9 : 0.5) * mLado,
                });
                if (activoP && !ie) hud = { x: q.x, y: q.y, r: 3, c: [150, 172, 186] };
              }
            }
            vis.push({ x: par[0].x, y: par[0].y, r: Math.max(9, 4 * par[0].k + 5), h: lado, i: k2 });
          }
          pintar(primsF);
        }
      }
      ctx!.globalCompositeOperation = "source-over";

      /* ── el centro: la memoria ──────────────────────────────────────── */
      const focoB = foco && foco.h === "b" ? foco.i : null;
      const prims: Prim[] = [];
      const pares: { a: ReturnType<typeof rotar>; z: ReturnType<typeof rotar> }[] = [];
      const visto = Math.ceil(N * e);

      for (let i = 0; i < N; i++) {
        const t = N === 1 ? 0.5 : i / (N - 1);
        const ang = t * Math.PI * 2 * VUELTAS;
        const y = (t - 0.5) * altoU;
        pares.push({
          a: rotar(Math.cos(ang) * RADIO, y, Math.sin(ang) * RADIO),
          z: rotar(Math.cos(ang + Math.PI) * RADIO, y, Math.sin(ang + Math.PI) * RADIO),
        });
      }

      const marcas: { y: number; txt: string }[] = [];
      let ultimoTramo = "";

      for (let i = 0; i < visto; i++) {
        const b = bases[i];
        const { a, z } = pares[i];
        const pa = P(a), pz = P(z);
        const ci = idxTono(b.dias);
        const col = PALETA[ci].c;
        const mB = mMem * (cc.filtro[ci] ? 1 : 0.06);   // el filtro de frescura
        const activo = focoB === i;
        const apagado = focoB !== null && !activo;
        const rr = (2.1 + Math.min(3.1, Math.sqrt(b.grado) * 1.1)) * pa.k;

        prims.push({
          k: "l", z: (a.z + z.z) / 2, x1: pa.x, y1: pa.y, x2: pz.x, y2: pz.y,
          c: col, op: (activo ? 1 : apagado ? 0.08 : 0.32) * mB, w: activo ? 3 : 1,
        });
        prims.push({ k: "n", z: a.z, x: pa.x, y: pa.y, r: activo ? rr + 2.6 : rr, sp: spriteBase[ci], a: (apagado ? 0.16 : 0.92) * mB });
        prims.push({ k: "n", z: z.z, x: pz.x, y: pz.y, r: activo ? rr * 1.1 : rr * 0.66, sp: spriteBase[ci], a: (apagado ? 0.12 : 0.6) * mB });
        if (activo) hud = { x: pa.x, y: pa.y, r: rr + 2.6, c: col };
        vis.push({ x: pa.x, y: pa.y, r: Math.max(8, rr + 5), h: "b", i });

        // el eje: una marca cuando cambia el tramo de frescura
        const tramo = String(ci);
        if (tramo !== ultimoTramo) {
          ultimoTramo = tramo;
          const my = P({ x: 0, y: (i / Math.max(1, N - 1) - 0.5) * altoU, z: 0 }).y;
          // la primera marca cae debajo de la cabecera, no encima
          if (my > 56 && my < h - 44) marcas.push({ y: my, txt: PALETA[ci].t });
        }
      }

      for (let i = 1; i < visto; i++) {
        for (const hb of ["a", "z"] as const) {
          const p = pares[i - 1][hb], q = pares[i][hb];
          const pp = P(p), pq = P(q);
          prims.push({
            k: "l", z: (p.z + q.z) / 2, x1: pp.x, y1: pp.y, x2: pq.x, y2: pq.y,
            c: [163, 205, 224], op: (focoB !== null ? 0.14 : 0.46) * mMem, w: 1.5,
          });
        }
      }

      proy.current = vis;
      // El eje sólo se re-renderiza si cambian sus etiquetas: si se
      // actualizara cada fotograma, React repintaría 60 veces por segundo un
      // texto que no se mueve.
      const firma = marcas.map((m) => m.txt).join("|");
      if (firma !== ejeRef.current.map((m) => m.txt).join("|") || marcas.length !== ejeRef.current.length) {
        ejeRef.current = marcas; setEje(marcas);
      }

      pintar(prims);

      /* ── la retícula del foco: el HUD de un instrumento, no de la escena ── */
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
        ctx!.fillText("sin archivos en la memoria — no hay cadena que dibujar", cx, cy);
      }

      /* ── el horizonte: una luz baja que asienta la escena ───────────── */
      const hz = ctx!.createLinearGradient(0, h - 190, 0, h);
      hz.addColorStop(0, "rgba(34,211,238,0)");
      hz.addColorStop(1, "rgba(34,211,238,.075)");
      ctx!.fillStyle = hz; ctx!.fillRect(0, h - 190, w, 190);

      /* ── la retícula de las esquinas: el marco de un instrumento ─────── */
      ctx!.strokeStyle = "rgba(150,200,220,.22)";
      ctx!.lineWidth = 1;
      const MM = 16, L = 18;
      for (const [ex, ey, dx, dy] of [[MM, MM, 1, 1], [w - MM, MM, -1, 1],
                                      [MM, h - MM, 1, -1], [w - MM, h - MM, -1, -1]] as const) {
        ctx!.beginPath();
        ctx!.moveTo(ex + dx * L, ey); ctx!.lineTo(ex, ey); ctx!.lineTo(ex, ey + dy * L);
        ctx!.stroke();
      }

      /* ── viñeta: el aire de la sala ─────────────────────────────────── */
      const v = ctx!.createRadialGradient(cx, cy, Math.min(w, h) * 0.22, cx, cy, Math.max(w, h) * 0.72);
      v.addColorStop(0, "rgba(4,7,10,0)");
      v.addColorStop(1, "rgba(4,7,10,.82)");
      ctx!.fillStyle = v; ctx!.fillRect(0, 0, w, h);
    }

    ajustar();
    ro.observe(c);
    pedir();
    return () => {
      cancelAnimationFrame(marco);
      clearTimeout(tmr);
      corriendo = false;
      pedirRef.current = () => {};
      ro.disconnect();
    };
  }, [bases]);

  function abajo(e: React.PointerEvent) {
    arrastre.current = { activo: true, x: e.clientX, y: e.clientY };
    setGirando(true);
    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
    pedirRef.current();
  }
  function mover(e: React.PointerEvent) {
    const a = arrastre.current;
    if (a.activo) {
      const dx = e.clientX - a.x, dy = e.clientY - a.y;
      giro.current.y += dx * 0.0072;
      giro.current.x = Math.max(-0.78, Math.min(0.78, giro.current.x + dy * 0.005));
      giro.current.vy = dx * 0.0016;
      // inclinar a mano invalida la vista elegida en la barra
      if (Math.abs(dy) > 2 && vista !== null) setVista(null);
      a.x = e.clientX; a.y = e.clientY;
      return;
    }
    const r = lienzo.current!.getBoundingClientRect();
    const mx = e.clientX - r.left, my = e.clientY - r.top;
    let mejor: (typeof proy.current)[number] | null = null;
    let dist = 16;
    for (const p of proy.current) {
      const d = Math.hypot(p.x - mx, p.y - my);
      if (d < Math.max(dist, p.r)) { dist = d; mejor = p; }
    }
    const s: Foco = mejor ? { h: mejor.h, i: mejor.i } : null;
    const igual = s === null ? sobre === null : sobre !== null && s.h === sobre.h && s.i === sobre.i;
    if (!igual) setSobre(s);
  }
  function arriba(e: React.PointerEvent) {
    arrastre.current.activo = false;
    setGirando(false);
    (e.currentTarget as Element).releasePointerCapture?.(e.pointerId);
    pedirRef.current();
  }

  /* La alternativa al arrastre: flechas para girar, espacio para el motor. */
  function tecla(e: React.KeyboardEvent) {
    const g = giro.current;
    let usado = true;
    switch (e.key) {
      case "ArrowLeft": g.y -= 0.12; break;
      case "ArrowRight": g.y += 0.12; break;
      case "ArrowUp": g.x = Math.max(-0.78, g.x - 0.07); if (vista !== null) setVista(null); break;
      case "ArrowDown": g.x = Math.min(0.78, g.x + 0.07); if (vista !== null) setVista(null); break;
      case " ": impulso.current = 0; setCtrl((cc) => ({ ...cc, girar: !cc.girar })); break;
      default: usado = false;
    }
    if (usado) { e.preventDefault(); pedirRef.current(); }
  }

  function irVista(v: Vista) {
    setVista(v);
    const g = giro.current;
    if (quietoRef.current) g.x = VISTA_X[v];
    else transRef.current = { x0: g.x, x1: VISTA_X[v], t0: performance.now() };
    pedirRef.current();
  }

  const focoBase = sobre?.h === "b" ? bases[sobre.i] : null;
  const flancoDe = sobre?.h === "i" ? izq : sobre?.h === "d" ? der : null;
  const focoPunto = sobre && flancoDe ? flancoDe.puntos[sobre.i] : null;

  const HEBRAS: { id: Enfoque; t: string; dot?: string }[] = [
    { id: "todo", t: "todo" },
    { id: "memoria", t: "memoria", dot: "#34D399" },
    { id: "skills", t: "skills", dot: HEX_SKILLS },
    { id: "agentes", t: "agentes", dot: HEX_AGENTES },
  ];

  return (
    <figure className="overflow-hidden rounded-[8px]"
            style={{
              border: "1px solid var(--borde)",
              boxShadow: "inset 0 1px 0 rgb(255 255 255 / .04), 0 22px 60px -30px rgb(0 0 0 / .9)",
            }}>
      <div className="relative"
           style={{ background: "radial-gradient(88% 76% at 52% 40%, #06121b 0%, #030608 72%)" }}>
        <canvas ref={lienzo} className="block w-full touch-none select-none"
                style={{ height: alto, cursor: girando ? "grabbing" : "grab" }}
                tabIndex={0}
                aria-label="hélice tridimensional de la memoria; flechas para girarla, espacio para arrancar o frenar el giro"
                onPointerDown={abajo} onPointerMove={mover} onPointerUp={arriba}
                onPointerLeave={(e) => { arriba(e); setSobre(null); }}
                onKeyDown={tecla} />

        {/* el eje de frescura, a la izquierda y sobre el lienzo */}
        <div className="pointer-events-none absolute inset-y-0 left-0 w-[168px]">
          {eje.map((m) => (
            <div key={m.txt + m.y} className="absolute left-5 flex items-center gap-2"
                 style={{ top: m.y - 6 }}>
              <span className="h-px w-4" style={{ background: "var(--borde-fuerte, rgb(255 255 255 / .16))" }} />
              <span className="rotulo">{m.txt}</span>
            </div>
          ))}
        </div>

        {/* la lectura de lo apuntado, arriba a la izquierda */}
        <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between p-5">
          <div className="max-w-[440px]">
            {focoBase ? (
              <>
                <p className="text-[15px] leading-tight"
                   style={{ color: `rgb(${tono(focoBase.dias).join(",")})` }}>{focoBase.titulo}</p>
                <p className="dato mt-1 text-[11px]" style={{ color: "var(--texto-3)" }}>
                  {focoBase.sistema} · {focoBase.tipo} · {focoBase.grado}{" "}
                  {focoBase.grado === 1 ? "enlace" : "enlaces"} ·{" "}
                  {focoBase.dias === 0 ? "tocado hoy" : `hace ${focoBase.dias} ${focoBase.dias === 1 ? "día" : "días"}`}
                </p>
              </>
            ) : focoPunto && sobre ? (
              <>
                <p className="text-[15px] leading-tight"
                   style={{ color: focoPunto.usos > 0 ? (sobre.h === "i" ? HEX_SKILLS : HEX_AGENTES) : "var(--texto-2)" }}>
                  {focoPunto.nombre}
                </p>
                <p className="dato mt-1 text-[11px]" style={{ color: "var(--texto-3)" }}>
                  {sobre.h === "i" ? "skill" : "agente"} ·{" "}
                  {focoPunto.usos > 0
                    ? `${focoPunto.usos} ${focoPunto.usos === 1 ? "invocación" : "invocaciones"}`
                    : sobre.h === "i" ? "instalada, nunca invocada" : "instalado, nunca invocado"}
                </p>
              </>
            ) : (
              <p className="rotulo">arrastra o flechas para girar · el cursor identifica cada punto</p>
            )}
          </div>
          <p className="rotulo shrink-0">{bases.length} pares de bases</p>
        </div>

        {/* los sellos de los flancos: la desproporción, debajo de cada pilar.
            El centro del lienzo está corrido 12 px (cx = w/2 + 12): ambos
            sellos lo compensan para caer bajo SU pilar, no bajo el 50 %. */}
        {izq ? <SelloFlanco f={izq} x="calc(50% - 356px)" tinta={HEX_SKILLS} activo={ctrl.enfoque === "skills"} /> : null}
        {der ? <SelloFlanco f={der} x="calc(50% + 380px)" tinta={HEX_AGENTES} activo={ctrl.enfoque === "agentes"} /> : null}

        <p className="pointer-events-none absolute bottom-4 left-5 rotulo">lo más fresco arriba</p>
      </div>

      {/* ── la barra de control: un instrumento, no un adorno ─────────── */}
      <div role="toolbar" aria-label="controles de la hélice"
           className="flex flex-wrap items-center gap-x-5 gap-y-2 border-t px-4 py-2.5"
           style={{ background: "rgb(255 255 255 / .015)" }}>
        <div className="flex items-center gap-1.5">
          <span className="rotulo mr-1">vista</span>
          {(Object.keys(VISTA_X) as Vista[]).map((v) => (
            <button key={v} type="button" className="pildora" style={PILL}
                    data-activa={vista === v ? "si" : "no"} aria-pressed={vista === v}
                    title={TITULO_VISTA[v]} onClick={() => irVista(v)}>
              {ICONO_VISTA[v]}{ETIQ_VISTA[v]}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1.5">
          <span className="rotulo mr-1">giro</span>
          <button type="button" className="pildora" style={PILL}
                  data-activa={ctrl.girar ? "si" : "no"} aria-pressed={ctrl.girar}
                  title="arrancar o frenar el giro continuo (espacio)"
                  onClick={() => { impulso.current = 0; setCtrl((cc) => ({ ...cc, girar: !cc.girar })); }}>
            {ctrl.girar ? "girando" : "en reposo"}
          </button>
          {([0.5, 1, 2] as const).map((v) => (
            <button key={v} type="button" className="pildora dato" style={PILL}
                    data-activa={ctrl.girar && ctrl.vel === v ? "si" : "no"}
                    aria-pressed={ctrl.girar && ctrl.vel === v}
                    aria-label={`girar a velocidad ${v}`}
                    onClick={() => { impulso.current = 0; setCtrl((cc) => ({ ...cc, vel: v, girar: true })); }}>
              ×{v === 0.5 ? "½" : v}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1.5">
          <span className="rotulo mr-1">hebra</span>
          {HEBRAS.map((hb) => (
            <button key={hb.id} type="button" className="pildora" style={PILL}
                    data-activa={ctrl.enfoque === hb.id ? "si" : "no"}
                    aria-pressed={ctrl.enfoque === hb.id}
                    onClick={() => setCtrl((cc) => ({ ...cc, enfoque: hb.id }))}>
              {hb.dot ? <span className="h-2 w-2 rounded-full" style={{ background: hb.dot }} aria-hidden="true" /> : null}
              {hb.t}
            </button>
          ))}
        </div>

        {/* la leyenda de frescura es también el filtro: se toca, no se mira */}
        <div className="ml-auto flex items-center gap-1.5">
          <span className="rotulo mr-1">frescura</span>
          {PALETA.map((p, i2) => (
            <button key={p.t} type="button" className="pildora"
                    style={{ ...PILL, opacity: ctrl.filtro[i2] ? 1 : 0.38 }}
                    aria-pressed={ctrl.filtro[i2]}
                    title={ctrl.filtro[i2] ? `atenuar «${p.t}»` : `volver a encender «${p.t}»`}
                    onClick={() => setCtrl((cc) => {
                      const f = [...cc.filtro]; f[i2] = !f[i2];
                      return { ...cc, filtro: f };
                    })}>
              <span className="h-2 w-2 rounded-full"
                    style={{ background: ctrl.filtro[i2] ? `rgb(${p.c.join(",")})` : "rgb(255 255 255 / .25)" }}
                    aria-hidden="true" />
              {p.t}
            </button>
          ))}
        </div>
      </div>

      <figcaption className="sr-only">
        Doble hélice tridimensional de la memoria del sistema: {bases.length} archivos ordenados
        por frescura, del más reciente arriba al más antiguo abajo, coloreados de verde (hoy)
        a rosa (más de un mes sin tocar).
        {izq ? ` A la izquierda, ${izq.titulo}: ${izq.puntos.filter((p) => p.usos > 0).length} en uso de ${izq.puntos.length}.` : ""}
        {der ? ` A la derecha, ${der.titulo}: ${der.puntos.filter((p) => p.usos > 0).length} en uso de ${der.puntos.length}.` : ""}
        {" "}La escena se gira arrastrando o con las flechas del teclado; la barra inferior
        controla la vista, el giro, qué hebra se enfoca y qué tramos de frescura se muestran.
      </figcaption>
    </figure>
  );
}
