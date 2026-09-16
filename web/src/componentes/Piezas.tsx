import type { ReactNode, CSSProperties } from "react";
import Link from "next/link";
import { MARCAS, TINTE, type NombreMarca } from "./Marcas";

/* Las piezas de la casa. Si algo se usa en dos pantallas, vive aquí. */

/**
 * Una superficie de contenido.
 *
 * Los corchetes en las esquinas ya NO son el valor por defecto: repetidos en
 * cuarenta tarjetas dejaban de ser un sello y pasaban a ser textura. Ahora hay
 * que pedirlos, y sólo los llevan las dos o tres piezas que presiden una
 * pantalla.
 */
export function Carta({
  children, className = "", marco = false, rejilla = false,
}: { children: ReactNode; className?: string; marco?: boolean; rejilla?: boolean }) {
  return (
    <div className={`carta ${marco ? "carta-marco" : ""} ${rejilla ? "rejilla" : ""} ${className}`}>
      {marco ? <span className="esq" aria-hidden="true" /> : null}
      {children}
    </div>
  );
}

/**
 * EL encabezado de sección. Uno solo, para las diez pantallas.
 *
 * Las cinco zonas del panel se rediseñaron por separado y cada una inventó su
 * forma de titular: un rótulo mono, un `/ Título`, una insignia con h2 al
 * lado, un título en minúscula. Cuatro maneras de decir lo mismo hacen que el
 * panel se lea como cuatro productos. Aquí queda una:
 *
 *     · EPÍGRAFE                              meta a la derecha
 *     Título de la sección.
 *     El párrafo de dos líneas que dice qué es esto y de dónde sale.
 *
 * Todo menos el título es opcional, pero el orden nunca cambia. El epígrafe
 * lleva el punto del color de la sección: es lo que hace de leyenda del
 * código de color sin gastar una línea en explicarlo.
 */
export function Seccion({
  children, epigrafe, insignia, nota, meta, tinte = "var(--ambar)", nivel,
}: {
  children: ReactNode;
  epigrafe?: string;
  /** La insignia de categoría, cuando la sección ES una categoría (vía, ámbito). */
  insignia?: ReactNode;
  nota?: ReactNode;
  meta?: ReactNode;
  tinte?: string;
  /** Aceptado por compatibilidad con las llamadas antiguas; ya no cambia nada. */
  nivel?: 1 | 2;
}) {
  void nivel;
  return (
    <div>
      {epigrafe ? (
        <p className="rotulo flex items-center gap-2">
          <span className="h-1 w-1 shrink-0 rounded-full" style={{ background: tinte }} />
          {epigrafe}
        </p>
      ) : null}
      {/* El dato de la derecha va en la LÍNEA DEL TÍTULO, no al pie del bloque.
          Alineado al final del bloque entero caía a la altura del párrafo y
          quedaba a media página de aquello que cuantifica. */}
      <div className={`flex flex-wrap items-center justify-between gap-x-6 gap-y-2 ${epigrafe ? "mt-2" : ""}`}>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          {insignia}
          <h2 className="text-[19px] font-light tracking-tight" style={{ color: "var(--texto)" }}>
            {children}
          </h2>
        </div>
        {meta ? (typeof meta === "string" || typeof meta === "number"
          ? <span className="rotulo">{meta}</span>
          : meta) : null}
      </div>
      {nota ? (
        <p className="mt-1.5 max-w-[620px] text-[12px] leading-relaxed" style={{ color: "var(--texto-3)" }}>
          {nota}
        </p>
      ) : null}
    </div>
  );
}

/**
 * El rótulo de DENTRO de una tarjeta: «por día», «por modelo», «qué sabe de ti».
 *
 * No es un encabezado de sección y ya no se comporta como uno. Una tarjeta que
 * abre con un título de 19 px compite con el de la sección que la contiene;
 * dentro, la etiqueta correcta es la mono pequeña de la casa.
 */
export function Rotulo({ children, vivo }: { children: ReactNode; vivo?: boolean }) {
  return <p className={`rotulo ${vivo ? "rotulo-vivo" : ""}`}>{children}</p>;
}

export function Cifra({
  valor, rotulo, nota, tono = "normal", tamano = 34,
}: {
  valor: ReactNode; rotulo: string; nota?: ReactNode;
  tono?: "normal" | "ambar" | "gasto" | "ahorro" | "apagado" | "alerta";
  tamano?: number;
}) {
  const color = {
    normal: "var(--texto)", ambar: "var(--ambar)", gasto: "var(--gasto)",
    ahorro: "var(--ahorro)", apagado: "var(--texto-3)", alerta: "var(--alerta)",
  }[tono];
  return (
    <div>
      <p className="rotulo">{rotulo}</p>
      <p className="cifra mt-1.5" style={{ color, fontSize: tamano }}>{valor}</p>
      {nota ? <p className="mt-1 text-[11px]" style={{ color: "var(--texto-3)" }}>{nota}</p> : null}
    </div>
  );
}

/** Barra de proporción. Se lee de un vistazo mejor que un porcentaje. */
export function Barra({ parte, color = "var(--gasto)" }: { parte: number; color?: string }) {
  return (
    <span className="barra mt-2 block">
      <i style={{ width: `${Math.max(1.5, Math.min(100, parte * 100))}%`, background: color }} />
    </span>
  );
}

/**
 * El vacío honesto.
 *
 * Una sección sin datos dice QUÉ falta y POR QUÉ. Nunca un cero, que se leería
 * como «no gastó» cuando la verdad es «no lo sé». Es la regla que separa este
 * motor de un tablero bonito que miente.
 */
export function Vacio({ que, porque }: { que: string; porque: string }) {
  return (
    <div className="px-4 py-6">
      <p className="text-[13px]" style={{ color: "var(--texto-2)" }}>{que}</p>
      <p className="mt-1.5 text-[11.5px] leading-relaxed" style={{ color: "var(--texto-3)" }}>{porque}</p>
    </div>
  );
}

export function usd(n: number | null | undefined, dec = 2): string {
  if (n === null || n === undefined) return "sin dato";
  return "$" + n.toLocaleString("es-ES", { minimumFractionDigits: dec, maximumFractionDigits: dec });
}

export function num(n: number | null | undefined): string {
  if (n === null || n === undefined) return "—";
  return n.toLocaleString("es-ES");
}

/** Tokens en escala humana: 1.234.567.890 no se lee; 1,23 B sí. */
export function tok(n: number | null | undefined): string {
  if (!n) return "0";
  if (n >= 1e9) return (n / 1e9).toLocaleString("es-ES", { maximumFractionDigits: 2 }) + " B";
  if (n >= 1e6) return (n / 1e6).toLocaleString("es-ES", { maximumFractionDigits: 1 }) + " M";
  if (n >= 1e3) return (n / 1e3).toLocaleString("es-ES", { maximumFractionDigits: 0 }) + " K";
  return String(n);
}

export function hace(iso: string | null | undefined): string {
  if (!iso) return "—";
  const t = new Date(iso.endsWith("Z") || iso.includes("+") ? iso : iso + "Z").getTime();
  if (Number.isNaN(t)) return "—";
  const s = Math.max(0, (Date.now() - t) / 1000);
  if (s < 60) return `hace ${Math.floor(s)}s`;
  if (s < 3600) return `hace ${Math.floor(s / 60)}m`;
  if (s < 86400) return `hace ${Math.floor(s / 3600)}h`;
  return `hace ${Math.floor(s / 86400)}d`;
}

export function duracion(a: string, b: string): string {
  const ms = new Date(b + (b.endsWith("Z") ? "" : "Z")).getTime()
           - new Date(a + (a.endsWith("Z") ? "" : "Z")).getTime();
  if (!Number.isFinite(ms) || ms < 0) return "—";
  const m = Math.round(ms / 60000);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ${m % 60}m`;
  return `${Math.floor(h / 24)}d ${h % 24}h`;
}

/**
 * El medidor circular de las capturas.
 *
 * Un anillo con el porcentaje dentro. Cuando no hay techo conocido —y con las
 * suscripciones de Claude y ChatGPT no lo hay, porque nadie publica tu cuota
 * desde local— el anillo se queda abierto y dice «sin techo público» en vez de
 * dibujar un porcentaje inventado sobre un límite que no existe.
 */
export function Medidor({
  parte, etiqueta, color = "var(--ambar)", tamano = 74,
}: { parte: number | null; etiqueta?: string; color?: string; tamano?: number }) {
  const r = 30;
  const vuelta = 2 * Math.PI * r;
  const trozo = parte === null ? 0 : Math.max(0, Math.min(1, parte)) * vuelta;
  return (
    <div className="relative shrink-0" style={{ width: tamano, height: tamano }}>
      <svg viewBox="0 0 80 80" width={tamano} height={tamano} aria-hidden="true">
        <circle cx="40" cy="40" r={r} fill="none" strokeWidth="4"
                stroke="rgb(255 255 255 / .07)" />
        {parte !== null ? (
          <circle cx="40" cy="40" r={r} fill="none" strokeWidth="4" stroke={color}
                  strokeLinecap="round" strokeDasharray={`${trozo} ${vuelta}`}
                  transform="rotate(-90 40 40)" />
        ) : null}
      </svg>
      <span className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="cifra text-[15px]" style={{ color: parte === null ? "var(--texto-3)" : color }}>
          {parte === null ? "—" : `${Math.round(parte * 100)}%`}
        </span>
        {etiqueta ? <span className="rotulo mt-0.5 text-[8px]">{etiqueta}</span> : null}
      </span>
    </div>
  );
}

/** Una barra de cuota con su cifra: «LÍMITE 5H  25 / 900». */
export function Cuota({
  rotulo, usado, techo, color = "var(--ambar)",
}: { rotulo: string; usado: number; techo: number | null; color?: string }) {
  return (
    <div>
      <p className="rotulo">
        {rotulo}{"  "}
        <span className="cifra text-[12px]" style={{ color: "var(--texto)" }}>{num(usado)}</span>
        <span style={{ color: "var(--texto-3)" }}> / {techo === null ? "sin techo público" : num(techo)}</span>
      </p>
      <span className="barra mt-1.5 block">
        <i style={{
          width: techo ? `${Math.max(1.5, Math.min(100, (usado / techo) * 100))}%` : "0%",
          background: color,
        }} />
      </span>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   Piezas nuevas (agosto 2026). Todas server-safe: aquí no hay hooks ni
   estado — el hover y el foco los resuelve el CSS de globals.css.
   ═══════════════════════════════════════════════════════════════════════ */

/**
 * El color semántico de cada sección. Un tinte por pantalla, no un tema: el
 * acento de la casa sigue siendo el cian; esto sólo tiñe el héroe, el punto
 * del epígrafe y las piezas que presiden esa pantalla.
 *
 * No son nueve colores sueltos: son CINCO FAMILIAS, y las secciones que
 * cuentan lo mismo comparten tinte a propósito.
 *
 *   cian        la casa y sus enchufes          inicio · conexiones
 *   ámbar       el dinero, y sólo el dinero     dinero
 *   azul        las máquinas y sus turnos       herramientas · actividad
 *   aguamarina  lo que tienes montado           skills · inventario
 *   verde       lo que el motor sabe de ti      memoria
 *   violeta     lo único que piensa             sueño
 *
 * `skills` estaba en ámbar, que en esta casa significa dinero: leía como una
 * tercera pantalla de gasto y arrastraba a /skills entero al dorado que la
 * referencia usa y nosotros no. Skills es un catálogo de lo que tienes, igual
 * que inventario — y ahora se ve.
 */
export const TONO_SECCION = {
  inicio: "var(--ambar)",
  conexiones: "var(--ambar)",
  dinero: "var(--gasto)",
  herramientas: "#38BDF8",
  actividad: "#38BDF8",
  skills: "#5EEAD4",
  inventario: "#5EEAD4",
  memoria: "var(--ahorro)",
  sueno: "var(--sueno)",
} as const;

/**
 * El azulejo: el cuadrado redondeado con el logo de una marca.
 *
 * El tinte sale de TINTE (Marcas.tsx) y tiñe dos cosas: el logo y un
 * resplandor sutil del fondo. `vivo=false` lo apaga entero — una conexión
 * sin configurar se ve gris, no con su color de fiesta.
 */
export function Azulejo({
  marca, tamano = 38, vivo = true, className = "",
}: { marca: NombreMarca; tamano?: number; vivo?: boolean; className?: string }) {
  const Logo = MARCAS[marca];
  return (
    <span
      className={`azulejo ${className}`}
      data-vivo={vivo ? "si" : "no"}
      style={{
        width: tamano, height: tamano, borderRadius: Math.round(tamano * 0.24),
        "--tinte": TINTE[marca],
        color: vivo ? TINTE[marca] : "var(--texto-3)",
      } as CSSProperties}
    >
      <Logo size={Math.round(tamano * 0.52)} />
    </span>
  );
}

const TONOS = {
  neutro: "var(--texto-3)", vivo: "var(--ambar)", ahorro: "var(--ahorro)",
  gasto: "var(--gasto)", alerta: "var(--alerta)", sueno: "var(--sueno)",
} as const;
export type Tono = keyof typeof TONOS;

/**
 * La insignia: el sello rectangular tipo `LAUNCHAGENT` o el badge de
 * categoría con el borde de su color. Para clasificar, no para estados
 * que respiran — para eso está la Pastilla.
 */
export function Insignia({
  children, tono = "neutro", color, title,
}: { children: ReactNode; tono?: Tono; color?: string; title?: string }) {
  return (
    <span className="insignia" title={title}
          style={{ "--tono": color ?? TONOS[tono] } as CSSProperties}>
      {children}
    </span>
  );
}

/**
 * La pastilla: el estado vivo, redondo, tipo `EN VIVO` o `ACTIVA`.
 * `late` añade el punto que respira — sólo para lo que de verdad está
 * pasando AHORA; una pastilla que late en cuarenta sitios no late en
 * ninguno.
 */
export function Pastilla({
  children, tono = "neutro", color, late = false,
}: { children: ReactNode; tono?: Tono; color?: string; late?: boolean }) {
  return (
    <span className="pastilla" style={{ "--tono": color ?? TONOS[tono] } as CSSProperties}>
      {late
        ? <span className="late" style={{ color: "currentcolor" }}><i /></span>
        : <span className="h-1.5 w-1.5 rounded-full" style={{ background: "currentcolor" }} />}
      {children}
    </span>
  );
}

/**
 * La tarjeta con distinciones de color.
 *
 * Superficie de contenido como Carta, más tres cosas que Carta no sabe:
 * - `tinte`: un degradado sutilísimo del color de una marca o sección.
 * - `seleccionada`: el estado fuerte — se llena del tinte, como la tarjeta
 *   violeta de Obsidian en la referencia. Una sola por grupo.
 * - `href`: la tarjeta entera es un enlace, con hover y pisada.
 * Los corchetes (`marco`) siguen reservados a las piezas que presiden.
 */
export function Tarjeta({
  children, tinte, seleccionada = false, marco = false, rejilla = false,
  href, className = "",
}: {
  children: ReactNode; tinte?: string; seleccionada?: boolean; marco?: boolean;
  rejilla?: boolean; href?: string; className?: string;
}) {
  const clases = [
    "carta",
    tinte && !seleccionada ? "carta-tinte" : "",
    seleccionada ? "carta-sel" : "",
    marco ? "carta-marco" : "",
    rejilla ? "rejilla" : "",
    href ? "carta-pulsable block" : "",
    className,
  ].filter(Boolean).join(" ");
  const estilo = tinte ? ({ "--tinte": tinte } as CSSProperties) : undefined;
  const dentro = (
    <>
      {marco ? <span className="esq" aria-hidden="true" /> : null}
      {children}
    </>
  );
  return href
    ? <Link href={href} className={clases} style={estilo}>{dentro}</Link>
    : <div className={clases} style={estilo}>{dentro}</div>;
}

/**
 * La barra de límite: «LÍMITE 5H · 25 / 900» con su barra debajo.
 *
 * Tres verdades posibles, tres dibujos:
 * - uso y techo conocidos → barra llena en proporción (y en alerta desde
 *   el 92%, que es cuando toca mirarla);
 * - techo desconocido → la barra queda vacía y se dice «sin techo público»;
 * - uso desconocido → SinDato, jamás un cero.
 */
export function BarraLimite({
  rotulo, usado, techo, color = "var(--ambar)", motivo,
}: {
  rotulo: string; usado: number | null; techo: number | null;
  color?: string; motivo?: string;
}) {
  if (usado === null) {
    return (
      <div>
        <p className="rotulo">{rotulo}{"  "}<SinDato motivo={motivo} /></p>
        <span className="barra mt-1.5 block"><i style={{ width: 0 }} /></span>
      </div>
    );
  }
  const parte = techo ? usado / techo : null;
  const tonoBarra = parte !== null && parte >= 0.92 ? "var(--alerta)" : color;
  return (
    <div>
      <p className="rotulo">
        {rotulo}{"  "}
        <span className="cifra text-[12px]" style={{ color: "var(--texto)" }}>{num(usado)}</span>
        <span style={{ color: "var(--texto-3)" }}> / {techo === null ? "sin techo público" : num(techo)}</span>
      </p>
      <span className="barra mt-1.5 block">
        <i style={{
          width: parte !== null ? `${Math.max(1.5, Math.min(100, parte * 100))}%` : "0%",
          background: tonoBarra,
        }} />
      </span>
    </div>
  );
}

/**
 * El rail: la fila de tarjetas de acción con icono, título, nota y flecha.
 * Es el «ATENCIÓN AHORA» de la referencia: máximo tres o cuatro cosas que
 * piden un clic. Si hay más de cuatro, no es un rail — es una lista.
 */
export function Rail({
  acciones,
}: {
  acciones: {
    titulo: string; nota?: string; href: string;
    icono?: ReactNode; tono?: string;
  }[];
}) {
  return (
    <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
      {acciones.map((a) => (
        <Tarjeta key={a.href + a.titulo} href={a.href} tinte={a.tono}
                 className="flex items-center gap-3.5 px-4 py-3.5">
          {a.icono ? (
            <span className="shrink-0" style={{ color: a.tono ?? "var(--texto-2)" }}>
              {a.icono}
            </span>
          ) : null}
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[13px] font-medium" style={{ color: "var(--texto)" }}>
              {a.titulo}
            </span>
            {a.nota ? (
              <span className="mt-0.5 block truncate text-[11.5px]" style={{ color: "var(--texto-3)" }}>
                {a.nota}
              </span>
            ) : null}
          </span>
          <svg className="rail-flecha shrink-0" viewBox="0 0 16 16" width="13" height="13"
               fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"
               strokeLinejoin="round" aria-hidden="true"
               style={{ color: "var(--texto-3)" }}>
            <path d="M4.5 11.5 11.5 4.5M6 4.5h5.5V10" />
          </svg>
        </Tarjeta>
      ))}
    </div>
  );
}

/**
 * Sin dato, en línea.
 *
 * Vacio ocupa una sección; esto ocupa el hueco de UNA cifra. Subrayado a
 * trazos y el porqué en el title — la mentira sería el cero.
 */
export function SinDato({ motivo }: { motivo?: string }) {
  return <span className="sin-dato" title={motivo}>sin dato</span>;
}
