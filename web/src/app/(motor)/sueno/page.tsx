import { Cabecera } from "@/componentes/Cabecera";
import { Tarjeta, Seccion, Insignia, Pastilla, num, hace } from "@/componentes/Piezas";
import { Heroe } from "@/componentes/piezas/Heroe";
import { HeliceCabecera } from "@/componentes/Helice";
import { NOMBRE_FUENTE } from "@/componentes/Marcas";
import { CarruselSueno, type HallazgoSueno } from "@/componentes/piezas/CarruselSueno";
import { AzulejoFuente, tinteFuente } from "@/componentes/piezas/AzulejoFuente";
import { sueno, salud } from "@/lib/consultas";

export const dynamic = "force-dynamic";

/* ─────────────────────────────────────────────────────────────────────────
   El sueño.

   Cada mañana mira las últimas 24 horas y te propone mejoras. Es el único
   sitio del motor donde algo *piensa* — y aun así **no ejecuta nada**: cada
   hallazgo trae la evidencia que lo sostiene y, cuando lo hay, un prompt
   corregido listo para copiar. Tú decides si lo aplicas.

   La pantalla es un héroe con el cielo del sueño y un carrusel: UN hallazgo
   por pantalla, entero, con su emblema de categoría. El emblema es un sigilo
   generado por semilla — la misma categoría dibuja el mismo emblema siempre.

   Va en violeta porque es lo único que no es un dato medido, y eso tiene que
   notarse a un metro de la pantalla. Dentro de cada tarjeta manda el color de
   su categoría: ésa es la distinción, no un tema nuevo.
   ───────────────────────────────────────────────────────────────────────── */

function fechaLarga(iso: string): string {
  const f = new Date(iso + "T00:00:00Z");
  if (Number.isNaN(f.getTime())) return iso;
  return new Intl.DateTimeFormat("es-ES", {
    weekday: "long", day: "numeric", month: "long", timeZone: "UTC",
  }).format(f);
}

export default function Sueno() {
  const ideas: HallazgoSueno[] = sueno().map((s) => {
    let ev: string[] = [];
    try { ev = JSON.parse(s.evidencia || "[]"); } catch { ev = []; }
    return {
      id: s.id, fecha: s.fecha, categoria: s.categoria, titulo: s.titulo,
      cuerpo: s.cuerpo, evidencia: ev, accion: s.accion || null,
      estado: s.estado, gancho: s.gancho || null,
    };
  });

  const nuevas = ideas.filter((s) => s.estado === "nueva").length;
  const conPrompt = ideas.filter((s) => s.accion).length;
  const ultima = ideas[0]?.fecha ?? null;

  return (
    <>
      <Cabecera ruta="sueño" />
      <div className="flex flex-col gap-8 px-6 py-7">

        {/* ── el héroe: el cielo del sueño ───────────────────────────── */}
        <Heroe tinte="var(--sueno)" semilla={31} estrellas={150}>
          <div className="pointer-events-none absolute bottom-7 right-9 opacity-60 max-lg:hidden"
               aria-hidden="true">
            <HeliceCabecera ancho={250} />
          </div>
          <div className="relative p-7 pb-8 md:p-10 md:pb-11">
            <div className="flex flex-wrap items-center gap-2.5">
              <Insignia color="var(--sueno)">revisión del sueño</Insignia>
              {ultima ? <span className="rotulo">{fechaLarga(ultima)}</span> : null}
            </div>

            {ideas.length ? (
              <>
                <h1 className="mt-4 max-w-[860px] text-balance text-[30px] font-light leading-[1.12] tracking-tight md:text-[38px]">
                  {nuevas > 0 ? (
                    <>El sueño encontró{" "}
                      <b className="font-semibold">{nuevas} {nuevas === 1 ? "idea" : "ideas"}</b>{" "}
                      que vale la pena ver.</>
                  ) : (
                    <>No hay hallazgos nuevos — quedan{" "}
                      <b className="font-semibold">{ideas.length}</b> en el archivo.</>
                  )}
                </h1>
                <p className="mt-3 max-w-[560px] text-[13px] leading-relaxed"
                   style={{ color: "var(--texto-2)" }}>
                  Sugiere, no ejecuta: cada hallazgo llega con la evidencia que lo
                  sostiene{conPrompt ? <> y {conPrompt} de {ideas.length} traen el prompt
                  corregido, listo para copiar</> : null}. El motor nunca toca tus archivos.
                </p>
              </>
            ) : (
              <>
                <h1 className="mt-4 max-w-[860px] text-balance text-[30px] font-light leading-[1.12] tracking-tight md:text-[38px]">
                  El sueño está <b className="font-semibold">esperando despertar</b>.
                </h1>
                <p className="mt-3 max-w-[560px] text-[13px] leading-relaxed"
                   style={{ color: "var(--texto-2)" }}>
                  Todavía no hay ningún hallazgo guardado. Cuando el sueño corra, sus
                  ideas aparecerán aquí con su evidencia y, cuando lo haya, el prompt
                  corregido listo para copiar. Abajo está el estado real de cada fuente
                  que leerá esa noche.
                </p>
              </>
            )}

          </div>
        </Heroe>

        {/* ── qué sale de la máquina: dicho en pantalla, no sólo en el código ── */}
        <Tarjeta className="p-4">
          <p className="rotulo" style={{ color: "var(--sueno)" }}>privacidad del sueño</p>
          <p className="mt-1.5 max-w-[860px] text-[12px] leading-relaxed" style={{ color: "var(--texto-2)" }}>
            Los hallazgos se calculan con SQL en esta máquina. <b>Con --seco</b> no sale nada. Sin --seco,
            los <b>hechos</b> de cada hallazgo —que pueden incluir el inicio de un prompt, títulos de notas o
            nombres de proyecto— se envían a Anthropic con <span className="dato">claude -p</span> para
            redactarlos. Leer tus conversaciones (<span className="dato">MOTOR_SUENO_LEE=1</span>) está
            apagado por defecto. Las notas guardadas «sin redactar» vienen del modo --seco.
          </p>
        </Tarjeta>

        {/* ── el carrusel de hallazgos ───────────────────────────────── */}
        {ideas.length ? <CarruselSueno ideas={ideas} /> : null}

        <Fuentes />
      </div>
    </>
  );
}

/**
 * Las fuentes del sueño: lo que leerá esta noche, con su estado REAL.
 *
 * «Respondiendo» aquí significa exactamente esto: la última pasada del lector
 * terminó sin error. No es un «EN VIVO» decorativo — sale de la tabla `salud`,
 * fila a fila, con la hora de la última lectura buena al lado.
 */
function Fuentes() {
  const fuentes = salud();
  if (!fuentes.length) return null;
  const ok = fuentes.filter((f) => Boolean(f.ultima_ok) && !f.error).length;
  const conNota = fuentes.some((f) => f.nota && !f.error);

  return (
    <section className="flex flex-col gap-4">
      <Seccion epigrafe="las fuentes de anoche" tinte="var(--sueno)"
               nota="El sueño sólo puede sugerir sobre lo que consiguió leer: una fuente caída es un hueco en los hallazgos, no un hallazgo menos."
               meta={`${ok} de ${fuentes.length} respondiendo`}>
        Lo que lee el sueño
      </Seccion>
      <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
        {fuentes.map((f) => {
          const viva = Boolean(f.ultima_ok) && !f.error;
          const nombre = NOMBRE_FUENTE[f.fuente]
            ?? f.fuente.charAt(0).toUpperCase() + f.fuente.slice(1);
          return (
            <Tarjeta key={f.fuente}
                     tinte={viva ? tinteFuente(f.fuente) : "var(--alerta)"}
                     className="flex items-center gap-3 px-4 py-3">
              <AzulejoFuente fuente={f.fuente} tamano={34} vivo={viva} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-medium">{nombre}</p>
                <p className="dato mt-0.5 truncate" style={{ color: "var(--texto-3)" }}
                   title={f.nota ?? undefined}>
                  {f.error
                    ? f.error
                    : <>{num(f.filas)} {f.filas === 1 ? "fila" : "filas"} · leída {hace(f.ultima_ok)}{f.nota ? " · *" : ""}</>}
                </p>
              </div>
              {viva
                ? <Pastilla tono="ahorro">ok</Pastilla>
                : <Pastilla tono="alerta">error</Pastilla>}
            </Tarjeta>
          );
        })}
      </div>
      {conNota ? (
        <p className="rotulo">* la fuente responde pero con matices — el detalle, al pasar el ratón</p>
      ) : null}
    </section>
  );
}
