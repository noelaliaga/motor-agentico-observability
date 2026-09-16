import { Cabecera } from "@/componentes/Cabecera";
import {
  Seccion, Tarjeta, Medidor, Pastilla, Insignia, Barra, num, hace, TONO_SECCION,
} from "@/componentes/Piezas";
import { HeroeCatalogo } from "@/componentes/piezas/HeroeCatalogo";
import { Mosaico } from "@/componentes/piezas/Mosaico";
import { Plegable } from "@/componentes/piezas/Plegable";
import { InsigniaAmbito, tonoAmbito } from "@/componentes/piezas/Ambito";
import { skills, skillsPorAmbito, masInvocado } from "@/lib/consultas";

export const dynamic = "force-dynamic";

const AMBITO = {
  global: "globales", proyecto: "de proyecto", hermes: "de Hermes",
} as Record<string, string>;

export default function Skills() {
  const todas = skills();
  const porAmbito = skillsPorAmbito();
  const top = masInvocado("skill", 10);
  const usadas = todas.filter((s) => s.usos > 0);
  const sinEstrenar = todas.length - usadas.length;
  const maxTop = Math.max(...top.map((t) => t.n), 1);
  const TONO = TONO_SECCION.skills;

  return (
    <>
      <Cabecera ruta="skills" />
      <div className="flex flex-col gap-9 px-6 py-7 pb-14">

        <HeroeCatalogo
          tinte={TONO} semilla={21} insignia="skills"
          meta={`${porAmbito.length} ámbitos · uso contado en transcripciones`}
          cifra={num(usadas.length)}
          resto={`de ${num(todas.length)} skills se han usado alguna vez`}
          extra={
            <>
              <Pastilla color={TONO}>{num(usadas.length)} en activo</Pastilla>
              <Insignia tono="neutro">{num(sinEstrenar)} sin estrenar</Insignia>
            </>
          }
        >
          Lo que tienes empaquetado y listo para invocar. El número que importa no es
          cuántas hay: es cuántas han trabajado alguna vez — el resto son horas de
          empaquetado que todavía no rinden nada.
        </HeroeCatalogo>

        {/* ── la desproporción, contada con el cuerpo ─────────────────── */}
        <section className="flex flex-col gap-3">
          <Seccion epigrafe="lo empaquetado frente a lo usado" tinte={TONO}
                   nota="Cada cuadrado es una skill instalada; encendido, una que se ha llegado a invocar."
                   meta={`${usadas.length} de ${todas.length}`}>
            La desproporción
          </Seccion>
          <Tarjeta rejilla className="grid items-center gap-7 p-6 lg:grid-cols-[auto_1fr]">
            <Medidor
              parte={todas.length ? usadas.length / todas.length : null}
              etiqueta="estrenadas" color={TONO} tamano={104}
            />
            <div className="min-w-0">
              <Mosaico
                total={todas.length} vivos={usadas.length} color={TONO}
                etiqueta={`${usadas.length} skills usadas de ${todas.length} instaladas`}
              />
              <p className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-[11.5px]"
                 style={{ color: "var(--texto-3)" }}>
                <span className="inline-flex items-center gap-2">
                  <span className="h-2 w-2 rounded-[2px]" style={{ background: TONO }} />
                  usada alguna vez
                </span>
                <span className="inline-flex items-center gap-2">
                  <span className="h-2 w-2 rounded-[2px]" style={{ background: "rgb(255 255 255 / .06)" }} />
                  instalada y a oscuras
                </span>
              </p>
            </div>
          </Tarjeta>
        </section>

        {/* ── las que sí trabajan ─────────────────────────────────────── */}
        <section className="flex flex-col gap-3">
          <Seccion epigrafe="las que sí trabajan" tinte={TONO}
                   meta="invocaciones reales, no declaradas">
            Las que más disparas
          </Seccion>
          <div className="grid gap-2 md:grid-cols-2">
            {top.map((s, i) => (
              <Tarjeta key={s.nombre} tinte={i === 0 ? TONO : undefined} seleccionada={i === 0}
                       className="flex items-center gap-3.5 px-4 py-3">
                <span className="cifra w-6 shrink-0 text-[12px]" style={{ color: "var(--texto-3)" }}>
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px]" style={{ color: "var(--texto)" }}>
                    {s.nombre}
                  </span>
                  <span className="rotulo">último uso {hace(s.ultimo)}</span>
                </span>
                <span className="hidden w-[84px] shrink-0 sm:block">
                  <Barra parte={s.n / maxTop} color={TONO} />
                </span>
                <span className="cifra w-[52px] shrink-0 text-right text-[16px]" style={{ color: TONO }}>
                  {num(s.n)}
                </span>
              </Tarjeta>
            ))}
          </div>
        </section>

        {/* ── el catálogo, por ámbito ─────────────────────────────────── */}
        {porAmbito.map((a) => {
          const grupo = todas.filter((s) => s.ambito === a.ambito);
          const vivas = grupo.filter((s) => s.usos > 0);
          const dormidas = grupo.filter((s) => !s.usos);
          const tono = tonoAmbito(a.ambito);
          const fila = (s: (typeof grupo)[number]) => (
            <div key={s.ambito + s.nombre}
                 className="flex items-baseline gap-2.5 rounded-[4px] px-3 py-2"
                 style={{ background: s.usos ? "var(--carta)" : "transparent",
                          border: `1px solid ${s.usos ? "var(--borde)" : "transparent"}` }}>
              <span className="h-1.5 w-1.5 shrink-0 rounded-full"
                    style={{ background: s.usos ? tono : "rgb(255 255 255 / .14)" }} />
              <span className="min-w-0 flex-1 truncate text-[12.5px]"
                    style={{ color: s.usos ? "var(--texto)" : "var(--texto-3)" }}>{s.nombre}</span>
              <span className="dato text-[11px]"
                    style={{ color: s.usos ? tono : "var(--texto-3)" }}>
                {s.usos || "—"}
              </span>
            </div>
          );
          return (
            <section key={a.ambito} className="flex flex-col gap-3">
              <Seccion insignia={<InsigniaAmbito ambito={a.ambito} />} tinte={tono}
                       meta={<p className="rotulo">
                         <span style={{ color: tono }}>{a.usadas}</span> de {a.total} usadas
                       </p>}>
                Skills {AMBITO[a.ambito] ?? `de ${a.ambito}`}
              </Seccion>
              <Barra parte={a.total ? a.usadas / a.total : 0} color={tono} />
              {vivas.length ? (
                <div className="grid gap-1.5 md:grid-cols-2 xl:grid-cols-3">
                  {vivas.map(fila)}
                </div>
              ) : null}
              {dormidas.length ? (
                <Plegable
                  cerrado={`ver las ${num(dormidas.length)} sin estrenar`}
                  abierto={`plegar las ${num(dormidas.length)} sin estrenar`}
                >
                  <div className="grid gap-1.5 md:grid-cols-2 xl:grid-cols-3">
                    {dormidas.map(fila)}
                  </div>
                </Plegable>
              ) : null}
            </section>
          );
        })}

        <p className="max-w-[720px] text-[11.5px] leading-relaxed" style={{ color: "var(--texto-3)" }}>
          El uso sale de contar las invocaciones reales en tus transcripciones y el{" "}
          <span className="dato">use_count</span> que guarda Hermes. Una skill perfectamente
          escrita que nunca se invocó aparece a cero, porque a cero es como está rindiendo.
        </p>
      </div>
    </>
  );
}
