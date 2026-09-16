/* ─────────────────────────────────────────────────────────────────────────
   La hélice del sueño.

   No es un adorno: es la estructura de la página. El sueño empareja lo que
   HICISTE con lo que PODRÍA MEJORAR, y cada hallazgo es un par de bases entre
   las dos hebras. La posición en la cadena es el orden; el color del travesaño,
   la categoría.

   Dibujada a mano en SVG, sin una sola dependencia y determinista: la misma
   cadena en el servidor y en el navegador, y la misma entre visitas.

   El detalle que la hace leerse como una hélice y no como dos ondas paralelas:
   donde las hebras se cruzan, los travesaños se estrechan y se apagan. Eso es
   la profundidad. Sin ello son dos curvas y ya está.
   ───────────────────────────────────────────────────────────────────────── */

const mm = (n: number) => Math.round(n * 100) / 100;

/**
 * Vueltas que da la cadena en un tramo.
 *
 * 1,5 no es un número bonito elegido a ojo: con 1,5 el punto medio de CADA
 * tramo cae siempre en la parte más abierta de la hélice, fila tras fila
 * (la fase avanza 3π, media vuelta exacta, y el medio queda a cuarto de
 * vuelta del cruce). Como el travesaño marcado va justo en el medio, el
 * hallazgo se lee siempre como un par de bases separadas y nunca como un
 * bulto en el cruce. Cambiar este número reintroduce ese bulto.
 */
const VUELTAS = 1.5;

/**
 * Lo que avanza la fase de un tramo al siguiente.
 *
 * La página apila tramos y necesita saber dónde dejó la cadena el anterior.
 * Sale de aquí y no de una constante repetida allí: si cambio las vueltas, la
 * cadena sigue siendo continua sin tener que acordarme de dos sitios.
 */
export const PASO_FASE = Math.PI * 2 * VUELTAS;

export const COLOR_CATEGORIA: Record<string, string> = {
  método: "var(--sueno)",
  modelo: "var(--ambar)",
  coste: "var(--gasto)",
  memoria: "var(--ahorro)",
  skill: "#F472B6",
  higiene: "var(--texto-2)",
  foco: "#38BDF8",
};

/**
 * Un tramo de hélice, del alto que le pida su fila.
 *
 * `fase` continúa donde la dejó el tramo anterior, así que apilados forman una
 * cadena continua aunque cada nota mida distinto. `preserveAspectRatio="none"`
 * deja que se estire sin romper esa continuidad.
 */
export function TramoHelice({
  fase, color = "var(--sueno)", acento, ancho = 64, alto = 200, marcado = true,
}: {
  fase: number; color?: string; acento?: string;
  ancho?: number; alto?: number; marcado?: boolean;
}) {
  // La hebra es siempre el sueño; el travesaño marcado es el que cambia. En
  // esta casa el violeta significa una cosa sola, y pintar la cadena del color
  // de la categoría se la comía.
  const marca = acento ?? color;
  const cx = ancho / 2;
  const amp = ancho / 2 - 7;
  const PASOS = 40;

  const punto = (t: number, hebra: 0 | 1) => {
    const a = fase + t * Math.PI * 2 * VUELTAS + hebra * Math.PI;
    return { x: mm(cx + Math.sin(a) * amp), y: mm(t * alto), z: Math.cos(a) };
  };

  const hebra = (h: 0 | 1) =>
    Array.from({ length: PASOS + 1 }, (_, i) => punto(i / PASOS, h))
      .map((p, i) => `${i ? "L" : "M"}${p.x} ${p.y}`)
      .join(" ");

  const TRAVESANOS = 7;
  const barras = Array.from({ length: TRAVESANOS }, (_, i) => {
    const t = (i + 0.5) / TRAVESANOS;
    const a = punto(t, 0), b = punto(t, 1);
    // |z| alto = hebras de canto, cruzándose → travesaño corto y tenue
    const abierto = 1 - Math.abs(a.z);
    return { a, b, abierto, medio: i === Math.floor(TRAVESANOS / 2) };
  });

  return (
    <svg viewBox={`0 0 ${ancho} ${alto}`} width={ancho} height="100%"
         preserveAspectRatio="none" aria-hidden="true" className="block">
      <path d={hebra(1)} fill="none" stroke={color} strokeWidth="1.1" opacity=".26" />
      {barras.map((b, i) => (
        <line key={i} x1={b.a.x} y1={b.a.y} x2={b.b.x} y2={b.b.y}
              stroke={b.medio && marcado ? marca : "var(--texto-3)"}
              strokeWidth={b.medio && marcado ? 1.8 : 1}
              strokeLinecap="round"
              opacity={mm((b.medio && marcado ? 0.85 : 0.3) * (0.25 + b.abierto * 0.75))} />
      ))}
      <path d={hebra(0)} fill="none" stroke={color} strokeWidth="1.6" opacity=".72" />
      {barras.filter((b) => b.medio && marcado).map((b, i) => (
        <g key={`n${i}`}>
          <circle cx={b.a.x} cy={b.a.y} r="9" fill={marca} opacity=".16" />
          <circle cx={b.a.x} cy={b.a.y} r="4" fill={marca} />
          <circle cx={b.b.x} cy={b.b.y} r="3" fill={marca} opacity=".55" />
        </g>
      ))}
    </svg>
  );
}

/** La firma de la sección: una hélice corta, tumbada. */
export function HeliceCabecera({ ancho = 260 }: { ancho?: number }) {
  const alto = 46, amp = 13, cy = alto / 2, PASOS = 90, vueltas = 3.4;
  const punto = (t: number, h: 0 | 1) => {
    const a = t * Math.PI * 2 * vueltas + h * Math.PI;
    return { x: mm(t * ancho), y: mm(cy + Math.sin(a) * amp), z: Math.cos(a) };
  };
  const hebra = (h: 0 | 1) =>
    Array.from({ length: PASOS + 1 }, (_, i) => punto(i / PASOS, h))
      .map((p, i) => `${i ? "L" : "M"}${p.x} ${p.y}`).join(" ");
  const barras = Array.from({ length: 26 }, (_, i) => {
    const t = (i + 0.5) / 26;
    const a = punto(t, 0), b = punto(t, 1);
    return { a, b, abierto: 1 - Math.abs(a.z) };
  });
  return (
    <svg viewBox={`0 0 ${ancho} ${alto}`} width={ancho} height={alto} aria-hidden="true">
      <path d={hebra(1)} fill="none" stroke="var(--sueno)" strokeWidth="1" opacity=".24" />
      {barras.map((b, i) => (
        <line key={i} x1={b.a.x} y1={b.a.y} x2={b.b.x} y2={b.b.y}
              stroke="var(--sueno)" strokeWidth="1" strokeLinecap="round"
              opacity={mm(0.1 + b.abierto * 0.42)} />
      ))}
      <path d={hebra(0)} fill="none" stroke="var(--sueno)" strokeWidth="1.5" opacity=".7" />
    </svg>
  );
}
