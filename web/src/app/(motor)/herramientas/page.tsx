import { Cabecera } from "@/componentes/Cabecera";
import { Tira } from "@/componentes/Titular";
import {
  Carta, Rotulo, Seccion, Barra, Medidor, BarraLimite, Azulejo, Insignia, Pastilla,
  SinDato, usd, num, tok, TONO_SECCION,
} from "@/componentes/Piezas";
import { Heroe } from "@/componentes/piezas/Heroe";
import { TarjetaEnlace } from "@/componentes/piezas/TarjetaEnlace";
import { TINTE, type NombreMarca } from "@/componentes/Marcas";
import {
  HERRAMIENTAS, resumenHerramienta, modelosDe, diasDe, ventanas, realOpenRouter,
} from "@/lib/herramientas";
import { suscripciones } from "@/lib/consultas";

export const dynamic = "force-dynamic";

const TONO = TONO_SECCION.herramientas;

/**
 * El eje temporal sin trampas: diasDe() sólo devuelve días CON filas, así
 * que un mes con huecos se comprimía en silencio y las barras quedaban
 * pegadas como si el uso hubiera sido continuo. Aquí se rellena el rango
 * completo — la base registra cada turno, luego la ausencia de filas en un
 * día ES un cero real, no un dato inventado. Esos días se dibujan como
 * hueco neutro («sin uso»), no como barra medida.
 */
function rangoDias(dias: { dia: string; usd: number; turnos: number }[]) {
  if (!dias.length) return [];
  const porDia = new Map(dias.map((d) => [d.dia, d]));
  const fin = new Date(dias[dias.length - 1].dia + "T00:00:00Z").getTime();
  const rango: { dia: string; usd: number; turnos: number; sinUso: boolean }[] = [];
  for (let t = new Date(dias[0].dia + "T00:00:00Z").getTime(); t <= fin; t += 86400000) {
    const clave = new Date(t).toISOString().slice(0, 10);
    const d = porDia.get(clave);
    rango.push(d ? { ...d, sinUso: false } : { dia: clave, usd: 0, turnos: 0, sinUso: true });
  }
  return rango;
}

export default async function Herramientas({
  searchParams,
}: { searchParams: Promise<{ h?: string }> }) {
  const sp = await searchParams;
  const sel = HERRAMIENTAS.find((x) => x.id === sp.h) ?? HERRAMIENTAS[0];
  const tinteSel = TINTE[sel.marca as NombreMarca];

  const res = resumenHerramienta(sel.fuente);
  const modelos = sel.fuente ? modelosDe(sel.fuente) : [];
  const dias = sel.fuente ? diasDe(sel.fuente) : [];
  const real = realOpenRouter();
  const subs = suscripciones();

  const medidas = HERRAMIENTAS.filter((h) => h.sabe !== "sin gasto").length;
  const ciegas = HERRAMIENTAS.length - medidas;

  const rango = rangoDias(dias);
  const maxDia = Math.max(...dias.map((d) => d.usd), 0.01);
  const totalUsd = res?.usd ?? 0;

  return (
    <>
      <Cabecera ruta="herramientas" />
      <div className="flex flex-col gap-9 px-6 py-7">

        <Heroe tinte={TONO} semilla={31}>
          <div className="flex flex-col gap-3 px-7 py-8">
            <div className="flex flex-wrap items-center gap-2.5">
              <Insignia color={TONO}>herramientas · las máquinas</Insignia>
              <span className="rotulo">lo que corre en esta casa</span>
            </div>
            <h1 className="titular max-w-[680px]">
              <b>{HERRAMIENTAS.length}</b> <span>máquinas conectadas</span>
            </h1>
            <p className="max-w-[640px] text-[13px] leading-relaxed" style={{ color: "var(--texto-2)" }}>
              Elige una y verás lo que gasta, con qué modelos y cuánto lleva consumido en esta
              ventana. Las que no registran su consumo lo dicen en voz alta — «sin dato» es un
              dato; un cero sería una mentira.
            </p>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <Pastilla tono="ahorro">{medidas} con gasto medido</Pastilla>
              <Pastilla tono="gasto">{ciegas} sin contador propio</Pastilla>
            </div>
          </div>
        </Heroe>

        {/* ── el selector: la elegida se llena del color de su marca ────── */}
        <div className="grid gap-2.5 sm:grid-cols-3 xl:grid-cols-5">
          {HERRAMIENTAS.map((h) => {
            const activa = h.id === sel.id;
            const r = resumenHerramienta(h.fuente);
            return (
              <TarjetaEnlace key={h.id} href={`/herramientas?h=${h.id}`}
                             seleccionada={activa} tinte={TINTE[h.marca as NombreMarca]}
                             className="px-4 py-3.5">
                <div className="flex items-center gap-2.5">
                  <Azulejo marca={h.marca as NombreMarca} tamano={32} />
                  <span className="min-w-0 flex-1 truncate text-[13px] font-medium"
                        style={{ color: activa ? "var(--texto)" : "var(--texto-2)" }}>
                    {h.nombre}
                  </span>
                </div>
                <p className="cifra mt-3 text-[19px]"
                   style={{ color: h.sabe === "sin gasto" ? "var(--texto-3)" : "var(--texto)" }}>
                  {h.sabe === "sin gasto"
                    ? <SinDato motivo={h.porque ?? undefined} />
                    : usd(r?.usd ?? 0)}
                </p>
                <p className="rotulo mt-1">{h.proveedor}</p>
              </TarjetaEnlace>
            );
          })}
        </div>

        {/* ── la elegida ──────────────────────────────────────────────── */}
        <section className="flex flex-col gap-4">
          <Seccion epigrafe="la máquina elegida" tinte={tinteSel}
                   meta={<Insignia color={tinteSel}>{sel.pago}</Insignia>}>
            {sel.nombre}
          </Seccion>

          {sel.sabe === "sin gasto" ? (
            <Carta className="p-6">
              <div className="flex flex-wrap items-start gap-5">
                {/* La máquina está viva — lo que falta es su contador, no ella.
                    El azulejo conserva su color; el hueco lo dice la cifra. */}
                <Azulejo marca={sel.marca as NombreMarca} tamano={52} />
                <div className="min-w-[260px] flex-1">
                  <p className="cifra text-[27px]"><SinDato motivo="no registra su consumo" /></p>
                  <p className="mt-2.5 max-w-[680px] text-[13px] leading-relaxed"
                     style={{ color: "var(--texto-2)" }}>
                    {sel.porque}
                  </p>
                  {["hermes", "openclaw"].includes(sel.id) ? (
                    <p className="mt-4 border-t pt-3.5 text-[12.5px] leading-relaxed"
                       style={{ color: "var(--texto-3)" }}>
                      Lo que sí está contado es su dinero real:{" "}
                      <b style={{ color: "var(--alerta)" }}>{usd(real)}</b> facturados en
                      OpenRouter, que cubren Hermes y OpenClaw juntos. Separarlos exige
                      una <i>management key</i>.
                    </p>
                  ) : null}
                </div>
              </div>
            </Carta>
          ) : (
            <>
              <Tira datos={[
                { rotulo: "equivalente en api", valor: usd(totalUsd), tono: "var(--gasto)" },
                { rotulo: "turnos", valor: num(res?.turnos ?? 0) },
                { rotulo: "sesiones", valor: num(res?.sesiones ?? 0) },
                {
                  rotulo: "desde",
                  // La fecha es una sola palabra: partida en dos líneas («2026-/07-18»)
                  // deja de ser una fecha. Un punto menos de cuerpo y no se parte.
                  valor: <span className="whitespace-nowrap text-[21px]">{res?.desde ?? "—"}</span>,
                  tono: "var(--texto-2)",
                },
              ]} />

              <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
                {/* flex-col + flex-1: la tarjeta hermana («por modelo») manda
                    en la altura de la fila, y antes el gráfico se quedaba en
                    sus 7rem fijos con un tercio de tarjeta vacío debajo. */}
                <Carta rejilla className="flex flex-col p-5">
                  <Rotulo>por día</Rotulo>
                  <div role="img"
                       aria-label={`Gasto por día del ${rango[0]?.dia} al ${rango.at(-1)?.dia}: ${usd(totalUsd)} en total`}
                       className="mt-4 flex min-h-28 flex-1 items-end gap-[3px]">
                    {rango.map((d) =>
                      d.sinUso ? (
                        /* Día sin una sola fila: cero real. Se dibuja como
                           hueco neutro, no como barra medida del color del
                           gasto — la diferencia entre «no usó» y «gastó poco»
                           tiene que verse. */
                        <span key={d.dia} className="flex-1 rounded-t-[2px]"
                              title={`${d.dia} · sin uso`}
                              style={{ height: 2, background: "rgb(255 255 255 / .09)" }} />
                      ) : (
                        <span key={d.dia} className="flex-1 rounded-t-[2px]"
                              title={`${d.dia} · ${usd(d.usd)} · ${d.turnos} turnos`}
                              style={{
                                height: `${Math.max(2, (d.usd / maxDia) * 100)}%`,
                                background: d.usd > maxDia * 0.6 ? tinteSel
                                          : `color-mix(in oklab, ${tinteSel} 45%, transparent)`,
                              }} />
                      ))}
                  </div>
                  <p className="rotulo mt-2">{rango[0]?.dia} → {rango.at(-1)?.dia}</p>
                </Carta>

                <Carta className="p-5">
                  <Rotulo>por modelo</Rotulo>
                  <div className="mt-3.5 flex flex-col gap-3">
                    {modelos.map((m) => {
                      const sinTarifa = m.sin_tarifa > 0 && !m.usd;
                      return (
                        <div key={m.modelo}>
                          <div className="flex items-baseline justify-between gap-3">
                            <span className="min-w-0 flex-1 truncate text-[12.5px]">{m.modelo}</span>
                            <span className="cifra text-[13px]"
                                  style={{ color: sinTarifa ? "var(--texto-3)" : "var(--texto)" }}>
                              {sinTarifa ? "sin tarifa" : usd(m.usd)}
                            </span>
                          </div>
                          <Barra parte={totalUsd ? (m.usd ?? 0) / totalUsd : 0} color={tinteSel} />
                          <p className="rotulo mt-1">{num(m.turnos)} turnos · {tok(m.salida)} de salida</p>
                        </div>
                      );
                    })}
                  </div>
                </Carta>
              </div>
            </>
          )}
        </section>

        {/* ── límites y ventanas ──────────────────────────────────────── */}
        <section className="flex flex-col gap-4">
          <Seccion epigrafe="uso en vivo" tinte={TONO}
                   meta={<Pastilla color={TONO} late>en vivo</Pastilla>}>
            Límites y ventanas del plan
          </Seccion>

          <Carta className="overflow-hidden">
            {HERRAMIENTAS.filter((h) => h.fuente).map((h) => {
              const tinte = TINTE[h.marca as NombreMarca];
              const sub = subs.find((s) => s.cubre.includes(h.fuente!));
              // Hermes y OpenClaw no escriben NADA en la tabla de uso: su
              // COUNT(*) da cero porque no hay filas, no porque no se usaran.
              // Ese cero disfrazado de medida es justo lo que este panel jura
              // no enseñar — así que su fila dice «sin dato», con el porqué.
              const ciega = h.sabe === "sin gasto";
              const w = ciega ? null : ventanas(h.fuente!);
              const motivo = ciega ? (h.porque ?? "no registra su consumo") : undefined;
              // El pico histórico por hora es la única referencia REAL que hay
              // para dar contexto: cuánto has llegado a usar tú, no cuánto te
              // dejan. El techo del plan no se publica desde local.
              const ref = Math.max((w?.pico ?? 0) * 5, 1);
              const parte = w?.cinco ? Math.min(1, w.cinco.turnos / ref) : null;
              return (
                <div key={h.id}
                     className="flex flex-wrap items-center gap-x-7 gap-y-4 border-b px-5 py-5 last:border-0">
                  {/* El porqué del porcentaje, donde se mira — no sólo en la
                      nota al pie: se mide contra tu pico histórico, que es
                      la única referencia real que existe. */}
                  <span className="shrink-0"
                        title={ciega
                          ? motivo
                          : `turnos de las últimas 5 h frente a tu pico histórico: ${num(w?.pico ?? 0)} turnos/hora × 5`}>
                    <Medidor parte={parte} etiqueta="5h" color={tinte} />
                  </span>
                  <div className="flex w-[190px] items-center gap-3">
                    <Azulejo marca={h.marca as NombreMarca} tamano={34} />
                    <div className="min-w-0">
                      <p className="truncate text-[14px]">{h.nombre}</p>
                      <p className="rotulo mt-1 truncate">{sub?.nombre ?? h.pago}</p>
                    </div>
                  </div>
                  <div className="flex min-w-[260px] flex-1 flex-col gap-3">
                    <BarraLimite rotulo="últimas 5 horas" usado={w ? w.cinco?.turnos ?? 0 : null}
                                 techo={null} color={tinte} motivo={motivo} />
                    <BarraLimite rotulo="últimos 7 días" usado={w ? w.semana?.turnos ?? 0 : null}
                                 techo={null} color={tinte} motivo={motivo} />
                  </div>
                  <div className="text-right">
                    <p className="rotulo">tokens · 7 días</p>
                    <p className="cifra mt-1 text-[17px]">
                      {w ? tok(w.semana?.tokens ?? 0) : <SinDato motivo={motivo} />}
                    </p>
                  </div>
                </div>
              );
            })}
          </Carta>

          <p className="max-w-[760px] text-[11.5px] leading-relaxed" style={{ color: "var(--texto-3)" }}>
            Los porcentajes miden tu consumo contra <b>tu propio pico histórico</b>, no contra la
            cuota del plan: ni Anthropic ni OpenAI publican tu límite desde la máquina. Dibujar
            un «25 / 900» exigiría inventarme el 900, así que la casilla del techo dice lo que
            hay — que no se sabe.
          </p>
        </section>
      </div>
    </>
  );
}
