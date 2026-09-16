import { frescura, rango, racha, skills, inventario, conexiones } from "@/lib/consultas";
import { Buscador, type Entrada } from "./Buscador";

/** El nombre del prompt de la cabecera. Configurable, como en el lector. */
const USUARIO = (process.env.MOTOR_USUARIO || "demo").toLowerCase().replace(/[^a-z0-9._-]/g, "");

/** Todo lo que se puede buscar, montado una vez por render en el servidor. */
function buscables(): Entrada[] {
  const e: Entrada[] = [
    { titulo: "Inicio", grupo: "sección", href: "/" },
    { titulo: "Dinero", grupo: "sección", href: "/dinero" },
    { titulo: "Herramientas", grupo: "sección", href: "/herramientas" },
    { titulo: "Conexiones", grupo: "sección", href: "/conexiones" },
    { titulo: "Skills", grupo: "sección", href: "/skills" },
    { titulo: "Actividad", grupo: "sección", href: "/actividad" },
    { titulo: "Inventario", grupo: "sección", href: "/inventario" },
    { titulo: "Memoria", grupo: "sección", href: "/memoria" },
    { titulo: "El sueño", grupo: "sección", href: "/sueno" },
    { titulo: "Hermes", grupo: "máquina", href: "/maquinas/hermes" },
    { titulo: "OpenClaw", grupo: "máquina", href: "/maquinas/openclaw" },
  ];
  for (const s of skills()) {
    e.push({ titulo: s.nombre, grupo: `skill · ${s.ambito}`, href: "/skills",
             nota: s.usos ? `${s.usos}` : undefined });
  }
  for (const a of inventario("agente")) {
    e.push({ titulo: a.nombre, grupo: `agente · ${a.ambito}`, href: "/inventario",
             nota: a.usos ? `${a.usos}` : undefined });
  }
  for (const c of conexiones()) {
    e.push({ titulo: c.nombre, grupo: `conexión · ${c.via}`, href: "/conexiones",
             nota: c.usos ? `${c.usos}` : undefined });
  }
  return e;
}

/**
 * La cabecera de terminal, y el testigo de frescura.
 *
 * El desfase entre el índice y el disco SIEMPRE está en pantalla. Es el
 * antídoto contra el defecto clásico de un tablero con base de datos detrás:
 * enseñar números de ayer como si fueran de ahora. Un desfase invisible es
 * una mentira; uno escrito es un dato.
 */
export function Cabecera({ ruta }: { ruta: string }) {
  const s = frescura();
  const r = rango();
  const ra = racha();
  const parado = s > 30;
  const texto = s > 3600 ? `${Math.floor(s / 3600)} h` : s > 90 ? `${Math.floor(s / 60)} min` : `${s} s`;

  return (
    /* Una sola fila, siempre, y de altura fija. Con `flex-wrap` la cabecera
       medía 52 px en / y en /sueno pero 78 px en las rutas de nombre largo
       (/conexiones, /herramientas, /maquinas/…), así que el héroe de cada
       pantalla arrancaba a una altura distinta: la costura más visible de las
       diez al pasarlas seguidas. Ahora lo que no cabe se retira por orden
       inverso de importancia — el rango de fechas primero, la racha después —
       en vez de empujar una segunda línea. */
    <header className="sticky top-0 z-10 flex h-[54px] items-center gap-x-5 border-b px-6"
            style={{ background: "color-mix(in oklab, var(--pozo) 90%, transparent)", backdropFilter: "blur(14px)" }}>
      <p className="dato shrink-0" style={{ color: "var(--texto-3)" }}>
        <span style={{ color: "var(--ahorro)" }}>{USUARIO}</span>
        <span>@motor</span>
        <span style={{ color: "var(--texto-3)" }}> : </span>
        <span className="rounded-[3px] px-1.5 py-0.5"
              style={{ background: "var(--ambar)", color: "#100C02" }}>~/{ruta}</span>
        <span style={{ color: "var(--texto-3)" }}> $</span>
      </p>

      <div className="ml-auto flex min-w-0 items-center gap-x-5">
        <Buscador entradas={buscables()} />
        {ra.dias > 1 ? (
          <p className="rotulo hidden shrink-0 items-center gap-1.5 xl:flex"
             title={`${ra.total} días con actividad en total`}>
            <span style={{ color: "var(--gasto)" }}>▲</span>
            <span style={{ color: "var(--texto)" }}>{ra.dias}</span> días seguidos
          </p>
        ) : null}
        {r?.desde ? (
          <p className="rotulo hidden shrink-0 2xl:block">
            {r.desde} → {r.hasta} · {r.dias} días
          </p>
        ) : null}
        <p className="rotulo flex shrink-0 items-center gap-2"
           style={{ color: parado ? "var(--alerta)" : "var(--texto-3)" }}>
          <span className="late" style={{ color: parado ? "var(--alerta)" : "var(--ahorro)" }}><i /></span>
          {parado ? `el lector lleva ${texto} parado` : `índice al día · hace ${texto}`}
        </p>
      </div>
    </header>
  );
}
