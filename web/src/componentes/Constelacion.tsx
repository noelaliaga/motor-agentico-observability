import type { CSSProperties } from "react";

/**
 * El campo de estrellas con sus constelaciones.
 *
 * Es el fondo de los héroes de sección — el cielo del sueño de la referencia,
 * pero con el tinte de la casa (o el de la sección que lo pida).
 *
 * DETERMINISTA por contrato: nada de Math.random() en render. Todo sale de
 * una semilla (mulberry32), así el servidor y el cliente pintan las mismas
 * estrellas y React no protesta por hidratación. La misma semilla dibuja el
 * mismo cielo siempre; si una pantalla quiere otro cielo, cambia de semilla.
 *
 * Va en un archivo propio y no en Piezas.tsx porque es código generativo:
 * ~40 líneas de geometría que no comparten nada con las piezas de datos.
 * Sigue siendo un componente de servidor — es SVG puro, sin canvas ni hooks.
 */

/** mulberry32: el PRNG con semilla más corto que sigue siendo decente. */
function azar(semilla: number): () => number {
  let a = semilla >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function Constelacion({
  semilla = 7, estrellas = 150, tinte = "var(--ambar)", lineas = true, className = "",
}: {
  semilla?: number; estrellas?: number; tinte?: string;
  lineas?: boolean; className?: string;
}) {
  const r = azar(semilla);
  const ANCHO = 1000, ALTO = 420;

  // Las estrellas: más densas arriba, como en un horizonte.
  const puntos = Array.from({ length: estrellas }, (_, i) => ({
    x: +(r() * ANCHO).toFixed(1),
    y: +(Math.pow(r(), 1.35) * ALTO).toFixed(1),
    radio: +(0.5 + r() * 1.25).toFixed(2),
    brillo: +(0.25 + r() * 0.6).toFixed(2),
    viva: r() < 0.16,           // sólo unas pocas titilan
    espera: +(r() * 5).toFixed(2),
    id: i,
  }));

  // Dos constelaciones: cadenas de 4-6 estrellas cercanas entre sí.
  const cadenas: (typeof puntos)[] = [];
  if (lineas) {
    for (let c = 0; c < 2; c++) {
      const cx = ANCHO * (0.18 + r() * 0.64);
      const cy = ALTO * (0.15 + r() * 0.4);
      const cerca = puntos
        .map((p) => ({ p, d: (p.x - cx) ** 2 + (p.y - cy) ** 2 }))
        .sort((a, b) => a.d - b.d)
        .slice(0, 4 + Math.floor(r() * 3))
        .map((x) => x.p);
      // ordenadas por x para que la línea no se cruce sobre sí misma
      cadenas.push(cerca.sort((a, b) => a.x - b.x));
    }
  }

  return (
    <svg
      className={`pointer-events-none absolute inset-0 h-full w-full ${className}`}
      viewBox={`0 0 ${ANCHO} ${ALTO}`} preserveAspectRatio="xMidYMid slice"
      aria-hidden="true" style={{ color: tinte }}
    >
      {/* el resplandor del tinte, arriba y a un lado — nunca uniforme */}
      <radialGradient id={`bruma-${semilla}`} cx="0.25" cy="0" r="1">
        <stop offset="0" stopColor="currentColor" stopOpacity="0.2" />
        <stop offset="0.55" stopColor="currentColor" stopOpacity="0.05" />
        <stop offset="1" stopColor="currentColor" stopOpacity="0" />
      </radialGradient>
      <rect width={ANCHO} height={ALTO} fill={`url(#bruma-${semilla})`} />

      {cadenas.map((cadena, i) => (
        <g key={i} stroke="currentColor" strokeWidth="0.8" opacity="0.42" fill="none">
          <polyline points={cadena.map((p) => `${p.x},${p.y}`).join(" ")} />
          {cadena.map((p) => (
            <circle key={p.id} cx={p.x} cy={p.y} r="2.2" fill="none" opacity="0.8" />
          ))}
        </g>
      ))}

      {puntos.map((p) => (
        <circle
          key={p.id} cx={p.x} cy={p.y} r={p.radio} fill="#F3F5F7"
          opacity={p.viva ? undefined : p.brillo}
          className={p.viva ? "estrella-viva" : undefined}
          style={p.viva ? ({ animationDelay: `${p.espera}s` } as CSSProperties) : undefined}
        />
      ))}
    </svg>
  );
}
