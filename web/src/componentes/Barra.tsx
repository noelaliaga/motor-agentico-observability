"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { MARCAS } from "./Marcas";
import { TONO_SECCION } from "./Piezas";

/* La barra. Sigue el patrón de las capturas: dos grupos, y las herramientas
   conectadas como tarjetas propias abajo — no como una entrada de lista más,
   porque no son secciones: son máquinas.

   La entrada activa se pinta con el tinte de SU sección, no con el cian fijo
   de antes. Así la barra hace de leyenda del código de color sin gastar una
   línea en explicarlo: entras en Memoria y la pastilla es verde, la misma
   verde del héroe que estás mirando. El orden de la lista es el de las
   familias de TONO_SECCION —cian, ámbar, azul, aguamarina, verde, violeta—
   de modo que bajar por la barra es recorrer la escala. */

const OPERACION = [
  { href: "/", texto: "Inicio", icono: "casa", tono: TONO_SECCION.inicio },
  { href: "/conexiones", texto: "Conexiones", icono: "enchufe", tono: TONO_SECCION.conexiones },
  { href: "/dinero", texto: "Dinero", icono: "rayo", tono: TONO_SECCION.dinero },
  { href: "/herramientas", texto: "Herramientas", icono: "piezas", tono: TONO_SECCION.herramientas },
  { href: "/actividad", texto: "Actividad", icono: "pulso", tono: TONO_SECCION.actividad },
  { href: "/skills", texto: "Skills", icono: "chispa", tono: TONO_SECCION.skills },
  { href: "/inventario", texto: "Inventario", icono: "piezas", tono: TONO_SECCION.inventario },
  { href: "/memoria", texto: "Memoria", icono: "cerebro", tono: TONO_SECCION.memoria },
  { href: "/sueno", texto: "El sueño", icono: "luna", tono: TONO_SECCION.sueno },
] as const;

const ICONOS: Record<string, React.ReactNode> = {
  casa:    <path d="M2.5 7 8 2.5 13.5 7v6.5a1 1 0 0 1-1 1h-9a1 1 0 0 1-1-1V7Z" />,
  rayo:    <path d="M9 1.5 3.5 9H7l-.5 5.5L12.5 7H9l.5-5.5Z" />,
  pulso:   <path d="M1.5 8h3l2-5 3 10 2-5h3" />,
  piezas:  <path d="M2.5 2.5h4.2v4.2H2.5zM9.3 2.5h4.2v4.2H9.3zM2.5 9.3h4.2v4.2H2.5zM9.3 9.3h4.2v4.2H9.3z" />,
  cerebro: <path d="M6 2.5a2.2 2.2 0 0 0-2.2 2.2A2 2 0 0 0 2.5 6.6c0 .9.6 1.7 1.4 2a2 2 0 0 0 1.9 2.6c.2 1.3 1.1 2.3 2.2 2.3M10 2.5a2.2 2.2 0 0 1 2.2 2.2 2 2 0 0 1 1.3 1.9c0 .9-.6 1.7-1.4 2a2 2 0 0 1-1.9 2.6c-.2 1.3-1.1 2.3-2.2 2.3" />,
  luna:    <path d="M13 9.6A5.6 5.6 0 0 1 6.4 3 5.8 5.8 0 1 0 13 9.6Z" />,
  chispa:  <path d="M8 1.6 9.6 6l4.4 1.6L9.6 9.2 8 13.6 6.4 9.2 2 7.6 6.4 6 8 1.6Z" />,
  enchufe: <path d="M6 1.8v3.4M10 1.8v3.4M3.6 5.2h8.8v2.6a4.4 4.4 0 0 1-8.8 0V5.2ZM8 12.2v2" />,
};

function Ico({ n }: { n: string }) {
  return (
    <svg viewBox="0 0 16 16" width="15" height="15" fill="none" stroke="currentColor"
         strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {ICONOS[n]}
    </svg>
  );
}

export function Barra({ maquinas }: { maquinas: { id: string; nombre: string; ok: boolean }[] }) {
  const ruta = usePathname();
  return (
    <nav className="fixed inset-y-0 left-0 z-20 hidden w-[236px] flex-col border-r md:flex"
         style={{ background: "var(--suelo)" }} aria-label="Secciones">
      <Link href="/" className="flex items-center gap-2.5 px-5 py-5">
        <Emblema />
        <span>
          <span className="block text-[14px] font-semibold tracking-tight">Motor Agéntico</span>
          <span className="rotulo block">local · solo lectura</span>
        </span>
      </Link>

      <div className="flex-1 overflow-y-auto px-3">
        <p className="rotulo px-2 pb-2 pt-3">// operación</p>
        <ul className="flex flex-col gap-0.5">
          {OPERACION.map((e) => {
            const activo = e.href === "/" ? ruta === "/" : ruta.startsWith(e.href);
            return (
              <li key={e.href}>
                <Link href={e.href} aria-current={activo ? "page" : undefined}
                      className="relative flex items-center gap-2.5 rounded-[4px] px-2.5 py-2 text-[13px] transition-colors"
                      style={activo
                        ? { background: e.tono, color: "#080C10", fontWeight: 600 }
                        : { color: "var(--texto-2)" }}>
                  <Ico n={e.icono} />
                  {e.texto}
                </Link>
              </li>
            );
          })}
        </ul>

        {/* Los dos asistentes tienen tablero propio: no son una línea de
            estado, son máquinas con su vida dentro. Van con su marca. */}
        <p className="rotulo px-2 pb-2 pt-6">// asistentes</p>
        <div className="flex flex-col gap-2">
          {/* Cada marca conserva SU color. La regla de un solo acento manda
              sobre la interfaz, no sobre logotipos ajenos: pintar Hermes de
              cian sería inventarle una identidad que no tiene. */}
          <Asistente href="/maquinas/hermes" activo={ruta.startsWith("/maquinas/hermes")}
                     tono="#F5B301"
                     ok={maquinas.find((m) => m.id === "hermes")?.ok}>
            <span style={{ color: "#F5B301" }}><MARCAS.hermes size={26} /></span>
            <span className="dato text-[12.5px] font-bold tracking-[.14em]"
                  style={{ color: "#F5B301", textShadow: "0 0 14px rgb(245 179 1 / .5)" }}>
              HERMES
            </span>
          </Asistente>
          <Asistente href="/maquinas/openclaw" activo={ruta.startsWith("/maquinas/openclaw")}
                     tono="#FB7185"
                     ok={maquinas.find((m) => m.id === "openclaw")?.ok}>
            <span className="text-[18px] font-bold tracking-tight"
                  style={{
                    background: "linear-gradient(90deg,#FB7185,#F472B6)",
                    WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
                  }}>
              OpenClaw
            </span>
          </Asistente>
        </div>

        <p className="rotulo px-2 pb-2 pt-6">// fuentes</p>
        <div className="flex flex-col gap-1">
          {maquinas.filter((m) => !["hermes", "openclaw"].includes(m.id)).map((m) => (
            <div key={m.id} className="flex items-center gap-2.5 px-2.5 py-1.5">
              <span className="late" style={{ color: m.ok ? "var(--ahorro)" : "var(--texto-3)" }}><i /></span>
              <span className="flex-1 truncate text-[12px]" style={{ color: "var(--texto-2)" }}>{m.nombre}</span>
              <span className="rotulo">{m.ok ? "ok" : "off"}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="border-t px-5 py-3.5">
        <p className="rotulo leading-relaxed">
          el lector no envía nada fuera<br />el sueño con LLM, sí: ver /sueno
        </p>
      </div>
    </nav>
  );
}

/**
 * Una máquina con tablero propio. La marca manda; el punto dice si respira.
 *
 * `tono` es el color de ESA marca: el activo se llena de él, igual que la
 * entrada de sección se llena del suyo. Antes el único aviso de estar dentro
 * de Hermes era un borde cian un punto más claro — invisible al lado de la
 * pastilla llena de las nueve secciones, así que en /maquinas/… la barra
 * parecía no tener sitio activo ninguno.
 */
function Asistente({
  href, activo, ok, tono, children,
}: {
  href: string; activo: boolean; ok?: boolean; tono: string;
  children: React.ReactNode;
}) {
  return (
    <Link href={href} aria-current={activo ? "page" : undefined}
          className="relative flex h-[58px] items-center justify-center gap-2.5 rounded-[6px] transition-colors"
          style={{
            background: activo
              ? `color-mix(in oklab, ${tono} 14%, var(--carta))`
              : "var(--carta)",
            border: `1px solid ${activo
              ? `color-mix(in oklab, ${tono} 52%, transparent)`
              : "var(--borde)"}`,
            boxShadow: activo
              ? `0 12px 38px -22px color-mix(in oklab, ${tono} 70%, transparent)`
              : undefined,
          }}>
      {children}
      <span className="late absolute right-2.5 top-2.5"
            style={{ color: ok ? "var(--ahorro)" : "var(--texto-3)" }}><i /></span>
    </Link>
  );
}

/** El emblema: un engranaje cuadrado. */
function Emblema() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
      <path d="M12 3.2 20.5 7.6v8.8L12 20.8 3.5 16.4V7.6L12 3.2Z" fill="none"
            stroke="var(--ambar)" strokeWidth="1.2" opacity=".6" />
      <circle cx="12" cy="12" r="3.4" fill="none" stroke="var(--ambar)" strokeWidth="1.4" />
      <circle cx="12" cy="12" r="1.1" fill="var(--ambar)" />
    </svg>
  );
}
