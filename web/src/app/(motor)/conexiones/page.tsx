import { Cabecera } from "@/componentes/Cabecera";
import {
  Tarjeta, Seccion, Azulejo, Insignia, Pastilla, num, hace, TONO_SECCION,
} from "@/componentes/Piezas";
import { Heroe } from "@/componentes/piezas/Heroe";
import { TINTE, marcaDe, type NombreMarca } from "@/componentes/Marcas";
import { conexiones, type Conexion } from "@/lib/consultas";

export const dynamic = "force-dynamic";

/* Cada vía tiene su color de categoría: la insignia del encabezado y nada
   más. El tinte de cada tarjeta es el de SU marca, no el de la vía. */
const VIAS = [
  {
    via: "conector", titulo: "Conectores de Claude", color: "var(--ambar)",
    pie: "Los que enchufaste desde tu cuenta y viajan contigo a cualquier sesión.",
  },
  {
    via: "mcp", titulo: "Servidores MCP", color: "#38BDF8",
    pie: "Declarados en ~/.claude.json y en los .mcp.json listados en MOTOR_MCP_JSON.",
  },
];

const marcaConexion = (c: Conexion): NombreMarca =>
  marcaDe(`${c.nombre} ${c.marca ?? ""}`);

const tonoEstado = (estado: string): string =>
  estado === "sin configurar" ? "var(--gasto)" : "var(--ahorro)";

export default function Conexiones() {
  const todas = conexiones();
  const usadas = todas.filter((c) => c.usos > 0);
  const flojas = todas.filter((c) => c.estado === "sin configurar");
  const vias = new Set(todas.map((c) => c.via)).size;

  return (
    <>
      <Cabecera ruta="conexiones" />
      <div className="flex flex-col gap-9 px-6 py-7">

        {/* semilla 11 cruzaba una constelación por medio del titular;
            la 53 deja las líneas en el cielo de la derecha. */}
        <Heroe tinte={TONO_SECCION.conexiones} semilla={53}>
          <div className="flex flex-col gap-3 px-7 py-8">
            <div className="flex flex-wrap items-center gap-2.5">
              <Insignia color={TONO_SECCION.conexiones}>conexiones · el stack</Insignia>
              <span className="rotulo">{vias} vías de entrada</span>
            </div>
            <h1 className="titular max-w-[680px]">
              <b>{todas.length}</b> <span>cosas enchufadas al stack</span>
            </h1>
            <p className="max-w-[640px] text-[13px] leading-relaxed" style={{ color: "var(--texto-2)" }}>
              Cada conexión DECLARADA que el motor ha encontrado en esta máquina — conectores de
              Claude y servidores MCP —, cruzada con cuántas veces se invocó de verdad. Declarada
              no significa que responda: el motor lee configuración, no prueba funciones.
              Cuántas más activas, más contexto tiene el sueño para decirte algo que sirva.
            </p>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <Pastilla tono="ahorro">{num(usadas.length)} usadas de verdad</Pastilla>
              <Pastilla tono={flojas.length ? "gasto" : "neutro"}>
                {num(flojas.length)} sin configurar
              </Pastilla>
            </div>
          </div>
        </Heroe>

        {VIAS.map((v) => {
          const grupo = todas.filter((c) => c.via === v.via);
          if (!grupo.length) return null;
          return (
            <section key={v.via} className="flex flex-col gap-3">
              <Seccion insignia={<Insignia color={v.color}>{v.via}</Insignia>}
                       tinte={v.color} nota={v.pie}
                       meta={`${grupo.length} en esta vía`}>
                {v.titulo}
              </Seccion>
              <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
                {grupo.map((c) =>
                  v.via === "disco"
                    ? <FichaDisco key={c.id} c={c} />
                    : <Ficha key={c.id} c={c} />)}
              </div>
            </section>
          );
        })}

        {/* La nota de seguridad va en pantalla, no sólo en el código. */}
        <p className="max-w-[760px] text-[11.5px] leading-relaxed" style={{ color: "var(--texto-3)" }}>
          El motor no abre ningún archivo <span className="dato">.env</span>. De un servidor MCP guarda
          el ejecutable (sin argumentos) o la URL sin query y con los segmentos con pinta de
          token enmascarados, y <b>cuántas</b> variables de entorno usa: ni sus nombres ni sus
          valores aparecen en ninguna pantalla. Un panel que puede filtrar una service key por
          descuido no es un panel: es un incidente esperando.
        </p>
      </div>
    </>
  );
}

/* La coletilla de los conectores se repite nueve veces; el pie de la sección
   ya la dice una. Repetirla en cada tarjeta es ruido, no información. */
const COLETILLA = "conectado alguna vez desde tu cuenta de Claude";

function Ficha({ c }: { c: Conexion }) {
  const marca = marcaConexion(c);
  const viva = c.estado !== "sin configurar";
  const detalle = c.detalle && c.detalle !== COLETILLA ? c.detalle : null;
  return (
    <Tarjeta tinte={viva ? TINTE[marca] : undefined} className="p-4">
      <div className="flex items-center gap-3">
        <Azulejo marca={marca} vivo={viva} tamano={38} />
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <p className="min-w-0 flex-1 truncate text-[13.5px] font-medium"
               style={{ color: viva ? "var(--texto)" : "var(--texto-3)" }}>{c.nombre}</p>
            {c.usos ? (
              <span className="cifra text-[12px]" style={{ color: "var(--ambar)" }}
                    title={`${num(c.usos)} usos registrados`}>{num(c.usos)}</span>
            ) : null}
          </div>
          {/* Sin truncate: a 900px de ancho «sin usar todavía» quedaba en
              «SIN USAR TODAV…» en media pantalla. Que envuelva a dos líneas:
              el punto se queda alineado con la primera. */}
          <p className="rotulo mt-1.5 flex items-start gap-1.5" style={{ color: tonoEstado(c.estado) }}>
            <span className="mt-[3px] h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: "currentColor" }} />
            <span className="min-w-0">
              {c.estado}
              {c.ultimo_uso ? <span style={{ color: "var(--texto-3)" }}> · último uso {hace(c.ultimo_uso)}</span>
               : viva && !c.usos ? <span style={{ color: "var(--texto-3)" }}> · sin usar todavía</span>
               : null}
            </span>
          </p>
        </div>
      </div>
      {detalle ? (
        <p className="mt-2.5 truncate border-t pt-2.5 text-[11.5px]"
           style={{ color: "var(--texto-3)" }} title={detalle}>
          {detalle}
        </p>
      ) : null}
    </Tarjeta>
  );
}

/**
 * La vía en disco merece su propia ficha: aquí el dato que importa es el
 * TAMAÑO del contexto — cuántas notas, cuántos universos. El detalle llega
 * del lector como texto («3706 notas en /ruta»); si algún día cambia de
 * forma, se enseña tal cual en vez de romperse o inventar.
 */
function FichaDisco({ c }: { c: Conexion }) {
  const marca = marcaConexion(c);
  const abierta = c.estado === "abierta";
  const tinte = TINTE[marca];

  const notas = /^(\d+) notas en (.+)$/.exec(c.detalle ?? "");
  const universos = /^(\d+) universos indexados(?: · (.+))?$/.exec(c.detalle ?? "");
  const cifra = notas?.[1] ?? universos?.[1] ?? null;
  const unidad = notas ? "notas" : universos ? "universos indexados" : null;
  const resto = notas?.[2] ?? universos?.[2] ?? null;

  // «Obsidian · Mi bóveda» repite lo que ya dice el rótulo de debajo:
  // la tarjeta enseña el nombre propio y el rótulo dice de qué app es.
  const nombre = c.nombre.replace(/^Obsidian · /, "");

  return (
    <Tarjeta tinte={tinte} seleccionada={abierta} className="p-4">
      <div className="flex items-start gap-3">
        <Azulejo marca={marca} tamano={44} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13.5px] font-medium" style={{ color: "var(--texto)" }}>
            {nombre}
          </p>
          <p className="rotulo mt-1">{marca === "obsidian" ? "bóveda de obsidian" : "índice de la casa"}</p>
        </div>
        <span className="shrink-0">
          {abierta
            ? <Pastilla color={tinte} late>abierta ahora</Pastilla>
            : <Pastilla tono="ahorro">{c.estado}</Pastilla>}
        </span>
      </div>
      <div className="mt-4 flex items-baseline gap-2">
        {cifra ? (
          <>
            <span className="cifra text-[27px]" style={{ color: "var(--texto)" }}>{num(+cifra)}</span>
            <span className="rotulo">{unidad}</span>
          </>
        ) : (
          <span className="text-[12.5px]" style={{ color: "var(--texto-2)" }}>{c.detalle ?? "—"}</span>
        )}
      </div>
      {resto ? (
        <p className="mt-1.5 truncate text-[11px]" style={{ color: "var(--texto-3)" }} title={resto}>
          {resto}
        </p>
      ) : null}
    </Tarjeta>
  );
}
