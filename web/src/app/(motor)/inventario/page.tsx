import { Cabecera } from "@/componentes/Cabecera";
import {
  Seccion, Tarjeta, Medidor, Pastilla, Insignia, num, hace, TONO_SECCION,
} from "@/componentes/Piezas";
import { HeroeCatalogo } from "@/componentes/piezas/HeroeCatalogo";
import { InsigniaAmbito, tonoAmbito } from "@/componentes/piezas/Ambito";
import { Plegable } from "@/componentes/piezas/Plegable";
import { inventario, resumenInventario, masInvocado } from "@/lib/consultas";

/** Muchas descripciones llegan de la base con un «- » delante: fuera. */
function limpia(texto: string): string {
  return texto.replace(/^[\s·–—-]+/, "");
}

export const dynamic = "force-dynamic";

const CLASES = [
  { clase: "agente", titulo: "Agentes", pie: "globales de Claude Code y de OpenClaw" },
  { clase: "skill",  titulo: "Skills",  pie: "globales y de Hermes" },
  { clase: "mcp",    titulo: "MCP",     pie: "servidores declarados en tus .mcp.json" },
  { clase: "plugin", titulo: "Plugins", pie: "de Claude Code" },
];

export default function Inventario() {
  const resumen = resumenInventario().filter((r) => r.clase !== "universo");
  const invocados = masInvocado("skill", 12);
  const totalPiezas = resumen.reduce((s, r) => s + r.total, 0);
  const totalUsados = resumen.reduce((s, r) => s + r.usados, 0);
  const TONO = TONO_SECCION.inventario;

  return (
    <>
      <Cabecera ruta="inventario" />
      <div className="flex flex-col gap-9 px-6 py-7 pb-14">

        <HeroeCatalogo
          tinte={TONO} semilla={33} insignia="inventario"
          meta="agentes · skills · mcp · plugins"
          cifra={num(totalPiezas)}
          resto="piezas declaradas en esta máquina"
          extra={
            <>
              <Pastilla color={TONO}>{num(totalUsados)} en uso</Pastilla>
              <Insignia tono="neutro">{num(totalPiezas - totalUsados)} dormidas</Insignia>
            </>
          }
        >
          Todo lo que tienes declarado en tus máquinas, y cuánto de eso trabaja de
          verdad. El uso no se declara: se cruza contra las invocaciones reales de
          tus transcripciones.
        </HeroeCatalogo>

        {/* ── la cifra incómoda, una por clase ─────────────────────────── */}
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {CLASES.map((c) => {
            const r = resumen.find((x) => x.clase === c.clase);
            if (!r) return null;
            const dormidos = r.total - r.usados;
            return (
              <Tarjeta key={c.clase} className="flex items-center gap-4 p-5">
                <Medidor parte={r.total ? r.usados / r.total : null}
                         etiqueta="en uso" color={TONO} tamano={72} />
                <div className="min-w-0">
                  <p className="rotulo">{c.titulo}</p>
                  <p className="cifra mt-1 text-[27px]" style={{ color: "var(--texto)" }}>
                    {num(r.total)}
                  </p>
                  <p className="mt-0.5 text-[11.5px]" style={{ color: "var(--texto-3)" }}>
                    {num(r.usados)} en uso
                    {dormidos > 0 ? (
                      <span style={{ color: "var(--gasto)" }}> · {num(dormidos)} dormidos</span>
                    ) : null}
                  </p>
                </div>
              </Tarjeta>
            );
          })}
        </div>

        {/* ── lo que sí se dispara ─────────────────────────────────────── */}
        <section className="flex flex-col gap-3">
          <Seccion epigrafe="lo que de verdad se invoca" tinte={TONO}
                   meta="contadas en transcripciones">
            Las skills que más disparas
          </Seccion>
          <Tarjeta className="overflow-x-auto">
            <table className="w-full min-w-[520px]">
              <thead>
                <tr className="border-b">
                  <th scope="col" className="rotulo px-4 py-2.5 text-left font-normal">skill</th>
                  <th scope="col" className="rotulo px-4 py-2.5 text-left font-normal">último uso</th>
                  <th scope="col" className="rotulo px-4 py-2.5 text-right font-normal">usos</th>
                </tr>
              </thead>
              <tbody>
                {invocados.length ? invocados.map((s) => (
                  <tr key={s.nombre} className="border-b last:border-0">
                    <td className="max-w-[380px] truncate px-4 py-2.5 text-[13px]"
                        style={{ color: "var(--texto)" }}>{s.nombre}</td>
                    <td className="dato px-4 py-2.5" style={{ color: "var(--texto-3)" }}>{hace(s.ultimo)}</td>
                    <td className="cifra px-4 py-2.5 text-right text-[14px]" style={{ color: TONO }}>
                      {num(s.n)}
                    </td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={3} className="px-4 py-6 text-[12.5px]" style={{ color: "var(--texto-3)" }}>
                      Todavía no hay ninguna invocación registrada.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </Tarjeta>
        </section>

        {/* ── el catálogo, clase a clase ───────────────────────────────── */}
        {CLASES.map((c) => {
          const items = inventario(c.clase);
          if (!items.length) return null;
          const usados = items.filter((i) => i.usos > 0);
          const dormidos = items.filter((i) => !i.usos);
          return (
            <section key={c.clase} className="flex flex-col gap-3">
              <Seccion tinte={TONO} epigrafe={c.pie}
                       meta={
                         <span className="rotulo">
                           <span style={{ color: TONO }}>{usados.length} en uso</span>
                           {" · "}{dormidos.length} dormidos
                         </span>
                       }>
                {c.titulo}
              </Seccion>
              {(() => {
                const carta = (i: (typeof items)[number]) => (
                  <Tarjeta key={c.clase + i.nombre + i.ambito} className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <span className="h-1.5 w-1.5 shrink-0 rounded-full"
                            style={{ background: i.usos ? tonoAmbito(i.ambito) : "rgb(255 255 255 / .14)" }} />
                      <span className="min-w-0 flex-1 truncate text-[13px]"
                            style={{ color: i.usos ? "var(--texto)" : "var(--texto-2)" }}>{i.nombre}</span>
                      <InsigniaAmbito ambito={i.ambito} />
                      <span className="dato w-[46px] shrink-0 text-right"
                            style={{ color: i.usos ? tonoAmbito(i.ambito) : "var(--texto-3)" }}>
                        {i.usos || "—"}
                      </span>
                    </div>
                    {i.descripcion ? (
                      <p className="mt-1 line-clamp-2 pl-[18px] text-[11.5px] leading-snug"
                         style={{ color: "var(--texto-3)" }}>{limpia(i.descripcion)}</p>
                    ) : null}
                  </Tarjeta>
                );
                return (
                  <>
                    {usados.length ? (
                      <div className="grid gap-2 lg:grid-cols-2">{usados.map(carta)}</div>
                    ) : null}
                    {dormidos.length ? (
                      <Plegable
                        cerrado={`ver los ${num(dormidos.length)} dormidos`}
                        abierto={`plegar los ${num(dormidos.length)} dormidos`}
                      >
                        <div className="grid gap-2 lg:grid-cols-2">{dormidos.map(carta)}</div>
                      </Plegable>
                    ) : null}
                  </>
                );
              })()}
            </section>
          );
        })}

        <p className="max-w-[720px] text-[11.5px] leading-relaxed" style={{ color: "var(--texto-3)" }}>
          El uso no se declara: se cruza. Sale de contar los bloques{" "}
          <span className="dato">tool_use</span> de tus transcripciones y el{" "}
          <span className="dato">use_count</span> que guarda Hermes. Un agente sin
          invocaciones aparece a cero aunque esté perfectamente escrito.
        </p>
      </div>
    </>
  );
}
