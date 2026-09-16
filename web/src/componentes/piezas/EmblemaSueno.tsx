/**
 * El emblema de un hallazgo del sueño.
 *
 * Un sigilo geométrico generado por categoría: la MISMA categoría dibuja el
 * MISMO emblema siempre, porque todo sale de una semilla derivada del nombre.
 * Es nuestro sustituto del pixel-art de la referencia: trazo fino, geometría
 * de instrumento y ecos del campo de estrellas — el lenguaje de la casa.
 *
 * Server-safe: SVG puro, sin hooks, sin azar de render. El color llega de
 * fuera (el de la categoría) y todo el dibujo hereda `currentColor`.
 */

/** FNV-1a: del nombre de la categoría a una semilla estable. */
function semillaDe(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** mulberry32 — el mismo PRNG con semilla que usa el campo de estrellas. */
function azar(semilla: number): () => number {
  let a = semilla >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const mm = (n: number) => Math.round(n * 100) / 100;

export function EmblemaSueno({
  categoria, color = "var(--sueno)", tamano = 190, className = "",
}: {
  categoria: string; color?: string; tamano?: number; className?: string;
}) {
  const r = azar(semillaDe("sueño·" + categoria));
  const C = 110; // centro del lienzo 220×220

  const polar = (radio: number, grados: number) => ({
    x: mm(C + radio * Math.cos((grados * Math.PI) / 180)),
    y: mm(C + radio * Math.sin((grados * Math.PI) / 180)),
  });

  // El anillo exterior, a trazos: cada categoría con su cadencia.
  const trazo = `${mm(2 + r() * 4)} ${mm(7 + r() * 9)}`;
  const giroAnillo = mm(r() * 360);

  // La corona de marcas: como un limbo de instrumento.
  const nMarcas = 16 + Math.floor(r() * 12);
  const giroMarcas = r() * 360;
  const cada = 3 + Math.floor(r() * 3);
  const marcas = Array.from({ length: nMarcas }, (_, i) => {
    const a = giroMarcas + (i * 360) / nMarcas;
    const larga = i % cada === 0;
    return { p1: polar(larga ? 72 : 78, a), p2: polar(84, a), larga };
  });

  // El polígono central — 3 a 6 lados — y su sombra girada.
  const lados = 3 + Math.floor(r() * 4);
  const giroPoli = r() * 360;
  const poligono = (radio: number, giro: number) =>
    Array.from({ length: lados }, (_, i) => {
      const p = polar(radio, giro + (i * 360) / lados);
      return `${p.x},${p.y}`;
    }).join(" ");
  const vertices = Array.from({ length: lados }, (_, i) =>
    ({ ...polar(56, giroPoli + (i * 360) / lados), lleno: r() < 0.5 }));

  // La constelación propia: 4-6 puntos enlazados entre corona y polígono.
  const nPuntos = 4 + Math.floor(r() * 3);
  const puntos = Array.from({ length: nPuntos }, () => {
    const a = r() * 360;
    return { ...polar(60 + r() * 26, a), a, radio: mm(1.4 + r() * 1.4) };
  }).sort((p, q) => p.a - q.a);

  return (
    <svg viewBox="0 0 220 220" width={tamano} height={tamano} className={className}
         aria-hidden="true" style={{ color }}>
      {/* el halo del fondo */}
      <radialGradient id={`halo-${semillaDe(categoria)}`} cx="0.5" cy="0.5" r="0.5">
        <stop offset="0" stopColor="currentColor" stopOpacity="0.2" />
        <stop offset="0.7" stopColor="currentColor" stopOpacity="0.05" />
        <stop offset="1" stopColor="currentColor" stopOpacity="0" />
      </radialGradient>
      <circle cx={C} cy={C} r="104" fill={`url(#halo-${semillaDe(categoria)})`} />

      {/* anillo exterior a trazos */}
      <circle cx={C} cy={C} r="96" fill="none" stroke="currentColor" strokeWidth="1"
              strokeDasharray={trazo} opacity="0.55"
              transform={`rotate(${giroAnillo} ${C} ${C})`} />

      {/* corona de marcas */}
      <g stroke="currentColor" strokeWidth="1" strokeLinecap="round">
        {marcas.map((m, i) => (
          <line key={i} x1={m.p1.x} y1={m.p1.y} x2={m.p2.x} y2={m.p2.y}
                opacity={m.larga ? 0.75 : 0.32} />
        ))}
      </g>

      {/* la constelación del hallazgo */}
      <g stroke="currentColor" strokeWidth="0.8" fill="none" opacity="0.5">
        <polyline points={puntos.map((p) => `${p.x},${p.y}`).join(" ")} />
      </g>
      {puntos.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r={p.radio} fill="currentColor" opacity="0.75" />
      ))}

      {/* el polígono y su eco girado */}
      <polygon points={poligono(38, giroPoli + 180 / lados)} fill="none"
               stroke="currentColor" strokeWidth="0.8" opacity="0.28" />
      <polygon points={poligono(56, giroPoli)} fill="none"
               stroke="currentColor" strokeWidth="1.7" opacity="0.95" />
      {vertices.map((v, i) => (
        <circle key={i} cx={v.x} cy={v.y} r={v.lleno ? 3 : 2.1}
                fill={v.lleno ? "currentColor" : "none"}
                stroke="currentColor" strokeWidth="1"
                opacity={v.lleno ? 0.95 : 0.55} />
      ))}

      {/* el núcleo */}
      <circle cx={C} cy={C} r="7.5" fill="none" stroke="currentColor"
              strokeWidth="1.1" opacity="0.7" />
      <circle cx={C} cy={C} r="2.4" fill="currentColor" />
    </svg>
  );
}
