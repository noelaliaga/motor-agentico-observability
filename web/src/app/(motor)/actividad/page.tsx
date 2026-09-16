import { Cabecera } from "@/componentes/Cabecera";
import {
  Seccion, Tarjeta, Carta, Azulejo, Insignia, Pastilla, Barra, SinDato,
  usd, num, hace, duracion, TONO_SECCION,
} from "@/componentes/Piezas";
import { marcaDe, tinteDe, NOMBRE_FUENTE } from "@/componentes/Marcas";
import { HeroeCatalogo } from "@/componentes/piezas/HeroeCatalogo";
import { IconoHerramienta, tieneIcono } from "@/componentes/piezas/IconoHerramienta";
import { ultimosPrompts, masInvocado, herramientasDeSesion } from "@/lib/consultas";
import { resumenActividad, sesionesRecientes, porFuenteHonesto } from "@/lib/consultas-actividad";

export const dynamic = "force-dynamic";

const TONO = TONO_SECCION.actividad;

/** «1 turno», «85 turnos»: el plural no se regatea. */
function n_(n: number, sing: string, plur = sing + "s"): string {
  return `${num(n)} ${n === 1 ? sing : plur}`;
}

/** ¿Pasó hace menos de diez minutos? Para que sólo lata lo que está vivo. */
function reciente(iso: string | null | undefined): boolean {
  if (!iso) return false;
  const t = new Date(iso.endsWith("Z") || iso.includes("+") ? iso : iso + "Z").getTime();
  return Number.isFinite(t) && Date.now() - t < 10 * 60 * 1000;
}

/** Los iconos de lo que se usó en una sesión. Un vistazo dice más que una lista. */
function Chips({ items }: { items: { clase: string; nombre: string; n: number }[] }) {
  const orden = ["Bash", "Read", "Edit", "Write", "WebFetch", "WebSearch"];
  const herr = items.filter((x) => x.clase === "herramienta");
  const mcp = items.filter((x) => x.clase === "mcp");
  const vistos = [
    ...orden.filter((o) => herr.some((h) => h.nombre === o)),
    ...herr.filter((h) => !orden.includes(h.nombre)).map((h) => h.nombre).slice(0, 2),
  ].slice(0, 5);
  if (!vistos.length && !mcp.length) return <span style={{ color: "var(--texto-3)" }}>—</span>;
  return (
    <span className="flex items-center gap-1">
      {vistos.map((v) => (
        <span key={v} title={v} aria-label={v}
              className="flex h-[22px] min-w-[22px] items-center justify-center rounded-[3px] px-1"
              style={{ background: "var(--carta-alta)", border: "1px solid var(--borde)",
                       color: "var(--texto-2)" }}>
          {tieneIcono(v)
            ? <IconoHerramienta nombre={v} />
            : <span className="dato text-[10px]">{v.slice(0, 2)}</span>}
        </span>
      ))}
      {mcp.length ? (
        <span title={mcp.map((m) => m.nombre).join(", ")}
              className="dato flex h-[22px] items-center rounded-[3px] px-1.5 text-[10px]"
              style={{ background: `color-mix(in oklab, ${TONO} 12%, transparent)`, color: TONO }}>
          mcp {mcp.length}
        </span>
      ) : null}
    </span>
  );
}

/** El chip de máquina: azulejo pequeño con el logo y el nombre al lado. */
function ChipMaquina({ fuente }: { fuente: string }) {
  return (
    <span className="inline-flex items-center gap-2">
      <Azulejo marca={marcaDe(fuente)} tamano={22} />
      <span className="whitespace-nowrap text-[12px]" style={{ color: "var(--texto-2)" }}>
        {NOMBRE_FUENTE[fuente] ?? fuente}
      </span>
    </span>
  );
}

export default function Actividad() {
  const V = 3650 as const;
  const resumen = resumenActividad(V);
  const sesiones = sesionesRecientes(V, 40);
  const usadas = herramientasDeSesion(sesiones.map((s) => s.id));
  const prompts = ultimosPrompts(18);
  const fuentes = porFuenteHonesto(V);
  const herramientas = masInvocado("herramienta", 10);
  const totalTurnos = fuentes.reduce((s, f) => s + f.turnos, 0);

  return (
    <>
      <Cabecera ruta="actividad" />
      <div className="flex flex-col gap-9 px-6 py-7 pb-14">

        <HeroeCatalogo
          tinte={TONO} semilla={47} insignia="actividad"
          meta={resumen?.proyectos ? `${num(resumen.proyectos)} proyectos con actividad` : undefined}
          cifra={num(resumen?.sesiones ?? 0)}
          resto={`sesiones · ${num(resumen?.turnos ?? 0)} turnos registrados`}
          extra={
            reciente(sesiones[0]?.fin)
              ? <Pastilla color={TONO} late>trabajando ahora</Pastilla>
              : sesiones[0]
                ? <Insignia tono="neutro">última sesión {hace(sesiones[0].fin)}</Insignia>
                : null
          }
        >
          Cada sesión de tus máquinas y lo que pasó dentro: en qué proyecto, con qué
          skills y herramientas. La pregunta de esta pantalla es qué estabas haciendo —
          el coste va al final, donde le toca.
        </HeroeCatalogo>

        {/* ── reparto por máquina, con su marca ───────────────────────── */}
        <section className="flex flex-col gap-3">
          <Seccion epigrafe="reparto por máquina" tinte={TONO}
                   meta="turnos por fuente, toda la historia">
            Quién hace el trabajo
          </Seccion>
          <div className="grid gap-3"
               style={{ gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 250px), 1fr))" }}>
            {fuentes.map((f) => {
              const marca = marcaDe(f.fuente);
              const tinte = tinteDe(f.fuente);
              const parte = totalTurnos ? f.turnos / totalTurnos : 0;
              return (
                <Tarjeta key={f.fuente} tinte={tinte} className="p-4">
                  <div className="flex items-center gap-3">
                    <Azulejo marca={marca} tamano={34} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-medium" style={{ color: "var(--texto)" }}>
                        {NOMBRE_FUENTE[f.fuente] ?? f.fuente}
                      </p>
                      <p className="rotulo mt-0.5">{Math.round(parte * 100)}% de los turnos</p>
                    </div>
                  </div>
                  <p className="cifra mt-4 text-[26px]" style={{ color: "var(--texto)" }}>
                    {num(f.turnos)}
                  </p>
                  <p className="rotulo mt-0.5">
                    {f.turnos === 1 ? "turno" : "turnos"} · {n_(f.sesiones, "sesión", "sesiones")}
                  </p>
                  <p className="rotulo mt-1">
                    {f.usd === null
                      ? <SinDato motivo="Esta fuente no registra tokens con tarifa conocida." />
                      : <>{usd(f.usd)} equiv. api</>}
                  </p>
                  <Barra parte={parte} color={tinte} />
                </Tarjeta>
              );
            })}
          </div>
        </section>

        {/* ── la tabla de sesiones: la sesión manda ───────────────────── */}
        <section className="flex flex-col gap-3">
          <Seccion epigrafe="el registro" tinte={TONO} meta="las 40 más recientes">
            Cada sesión, y qué pasó dentro
          </Seccion>
          <Carta className="overflow-x-auto">
            <table className="w-full min-w-[1020px]">
              <thead>
                <tr className="border-b">
                  {[
                    ["sesión", "text-left"], ["máquina", "text-left"], ["proyecto", "text-left"],
                    ["skill", "text-left"], ["con qué", "text-left"], ["cuándo", "text-left"],
                    ["coste", "text-right"],
                  ].map(([h, al]) => (
                    <th key={h} scope="col"
                        className={`rotulo whitespace-nowrap px-3 py-2.5 font-normal ${al}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sesiones.map((s) => (
                  <tr key={s.id}
                      className="border-b align-top transition-colors last:border-0 hover:bg-[rgb(255_255_255_/_0.02)]">
                    <td className="px-3 py-3.5">
                      {s.titulo ? (
                        <p className="max-w-[280px] truncate text-[13px]"
                           style={{ color: "var(--texto)" }} title={s.titulo}>
                          {s.titulo}
                        </p>
                      ) : (
                        <p className="max-w-[280px] truncate text-[13px] italic"
                           style={{ color: "var(--texto-3)" }}>
                          sesión sin prompt guardado
                        </p>
                      )}
                      <p className="dato mt-1" style={{ color: "var(--texto-3)" }}>
                        {s.id.slice(0, 8)} · {n_(s.turnos, "turno")}
                      </p>
                    </td>
                    <td className="px-3 py-3.5"><ChipMaquina fuente={s.fuente} /></td>
                    <td className="max-w-[130px] truncate px-3 py-3.5 text-[12px]"
                        style={{ color: "var(--texto-2)" }}>{s.proyecto ?? "—"}</td>
                    <td className="whitespace-nowrap px-3 py-3.5">
                      {(() => {
                        const sk = (usadas.get(s.id) ?? []).filter((x) => x.clase === "skill");
                        if (!sk.length) return <span style={{ color: "var(--texto-3)" }}>—</span>;
                        const corto = sk[0].nombre.split(":").pop() ?? sk[0].nombre;
                        const nombre = corto.length > 17 ? corto.slice(0, 15) + "…" : corto;
                        return (
                          <Insignia color={TONO} title={sk.map((x) => x.nombre).join(", ")}>
                            {nombre}{sk.length > 1 ? ` +${sk.length - 1}` : ""}
                          </Insignia>
                        );
                      })()}
                    </td>
                    <td className="whitespace-nowrap px-3 py-3.5"><Chips items={usadas.get(s.id) ?? []} /></td>
                    <td className="whitespace-nowrap px-3 py-3.5">
                      <p className="dato" style={{ color: "var(--texto-2)" }}>{hace(s.inicio)}</p>
                      <p className="dato mt-1" style={{ color: "var(--texto-3)" }}>{duracion(s.inicio, s.fin)}</p>
                    </td>
                    <td className="dato whitespace-nowrap px-3 py-3.5 text-right"
                        style={{ color: "var(--texto-3)" }}>
                      {s.usd === null
                        ? <SinDato motivo="Ningún turno de esta sesión tiene tarifa conocida." />
                        : <span title={s.sin_tarifa
                            ? `${num(s.sin_tarifa)} turnos sin tarifa conocida: el equivalente real es mayor`
                            : "equivalente en API de los tokens de la sesión"}>
                            {usd(s.usd)}{s.sin_tarifa ? "+" : ""}
                          </span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Carta>
        </section>

        <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
          {/* ── la línea de tiempo: lo que le pediste ─────────────────── */}
          <section className="flex flex-col gap-3">
            <Seccion epigrafe="en orden" tinte={TONO} meta="los últimos prompts">
              Línea de tiempo
            </Seccion>
            <div className="flex flex-col gap-2">
              {prompts.map((p, i) => {
                const vivo = i === 0 && reciente(p.ts);
                return (
                  <Carta key={p.ts + i} className="px-4 py-3">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      {vivo
                        ? <span className="late" style={{ color: TONO }}><i /></span>
                        : <span className="h-1.5 w-1.5 rounded-full"
                                style={{ background: "rgb(255 255 255 / .18)" }} />}
                      <span className="dato" style={{ color: TONO }}>{p.sesion?.slice(0, 8)}</span>
                      <span className="rotulo">{NOMBRE_FUENTE[p.fuente] ?? p.fuente}</span>
                      {p.proyecto ? <span className="rotulo">{p.proyecto}</span> : null}
                      <span className="rotulo ml-auto">{hace(p.ts)}</span>
                    </div>
                    <p className="mt-1.5 line-clamp-2 text-[12.5px] leading-relaxed"
                       style={{ color: "var(--texto-2)" }}>{p.texto}</p>
                  </Carta>
                );
              })}
            </div>
          </section>

          <section className="flex flex-col gap-3">
            <Seccion epigrafe="el instrumental" tinte={TONO}>Con qué trabaja</Seccion>
            <Carta className="overflow-hidden">
              {herramientas.map((h) => (
                <div key={h.nombre}
                     className="flex items-center justify-between gap-3 border-b px-4 py-2.5 last:border-0">
                  <span className="inline-flex min-w-0 items-center gap-2.5">
                    <span className="shrink-0" style={{ color: "var(--texto-3)" }}>
                      {tieneIcono(h.nombre)
                        ? <IconoHerramienta nombre={h.nombre} tamano={14} />
                        : <span className="dato text-[10px]">{h.nombre.slice(0, 2)}</span>}
                    </span>
                    <span className="truncate text-[12.5px]" style={{ color: "var(--texto)" }}>
                      {h.nombre}
                    </span>
                  </span>
                  <span className="cifra text-[13px]" style={{ color: TONO }}>{num(h.n)}</span>
                </div>
              ))}
            </Carta>
            <p className="text-[11.5px] leading-relaxed" style={{ color: "var(--texto-3)" }}>
              Sale de los bloques <span className="dato">tool_use</span> de las transcripciones:
              no es lo que tienes instalado, es lo que de verdad se ha ejecutado.
            </p>
          </section>
        </div>
      </div>
    </>
  );
}
