import { Cabecera } from "@/componentes/Cabecera";
import {
  Seccion, Vacio, num, hace, Tarjeta, Azulejo, Insignia, Pastilla, SinDato,
} from "@/componentes/Piezas";
import { MARCAS, TINTE, marcaDe } from "@/componentes/Marcas";
import { Heroe } from "@/componentes/piezas/Heroe";
import { maquina, hermesSesiones, hermesPorCanal, hermesPorModelo, hermesSkills } from "@/lib/maquinas";
import { memoriaResumen } from "@/lib/consultas";

export const dynamic = "force-dynamic";

const ORO = TINTE.hermes;

/** Hermes guarda inicio/fin como epoch en segundos (texto), no como ISO:
    `hace()` de la casa no los entiende, así que aquí se traducen primero. */
function haceEpoch(t: string | null | undefined): string {
  const n = t ? parseFloat(t) : NaN;
  if (!Number.isFinite(n) || n <= 0) return "—";
  const s = Math.max(0, Date.now() / 1000 - n);
  if (s < 60) return `hace ${Math.floor(s)}s`;
  if (s < 3600) return `hace ${Math.floor(s / 60)}m`;
  if (s < 86400) return `hace ${Math.floor(s / 3600)}h`;
  return `hace ${Math.floor(s / 86400)}d`;
}

export default function Hermes() {
  const m = maquina("hermes");
  const sesiones = hermesSesiones();
  const canales = hermesPorCanal();
  const modelos = hermesPorModelo();
  const skills = hermesSkills();
  const mensajes = sesiones.reduce((s, x) => s + x.mensajes, 0);
  const usadas = skills.filter((s) => s.usos > 0);
  const memoria = memoriaResumen().find((r) => r.sistema === "hermes") ?? null;
  const masMensajes = Math.max(...modelos.map((x) => x.mensajes), 1);
  const principal = modelos[0] ?? null;
  const ultimaFin = sesiones.find((s) => s.fin)?.fin ?? null;

  return (
    <>
      <Cabecera ruta="maquinas/hermes" />
      <div className="flex flex-col gap-8 px-6 py-7">

        {/* ── el dashboard del agente: cabecera con su marca ──────────── */}
        <Heroe tinte={ORO} semilla={31}>
          <div className="flex flex-wrap items-start justify-between gap-6 px-7 py-8">
            <div className="flex min-w-0 flex-col gap-3">
              <div className="flex flex-wrap items-center gap-2.5">
                <Insignia color={ORO}>asistente autónomo</Insignia>
                <span className="rotulo">hermes agent · nous research · mit</span>
              </div>
              <h1 className="titular">
                <b style={{ color: ORO, textShadow: "0 0 26px rgb(245 179 1 / .35)" }}>Hermes</b>
              </h1>
              <p className="max-w-[560px] text-[13px] leading-relaxed" style={{ color: "var(--texto-2)" }}>
                Un agente autónomo que atiende por varios canales. El motor lee su base
                en solo lectura: sabe con quién habló, por qué canal y con qué modelo — pero
                no cuánto gastó, porque Hermes no lo apunta.
              </p>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <Pastilla color={ORO} late={Boolean(m?.vivo)}>
                  {m?.vivo ? "base leída" : "base sin leer"}
                </Pastilla>
                {canales.map((c) => (
                  <Insignia key={c.canal}
                            color={c.canal === "telegram" ? TINTE.telegram : undefined}
                            title={`${c.sesiones} sesiones · ${num(c.mensajes)} mensajes`}>
                    {c.canal}
                  </Insignia>
                ))}
              </div>
            </div>

            <span className="azulejo shrink-0"
                  style={{ width: 84, height: 84, borderRadius: 20, ["--tinte" as string]: ORO }}>
              <span style={{ color: ORO }}><MARCAS.hermes size={44} /></span>
            </span>
          </div>
        </Heroe>

        {/* ── las cuatro tarjetas de estado del agente ────────────────── */}
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Tarjeta tinte={ORO} className="p-4">
            <p className="rotulo">agente</p>
            <p className="cifra mt-2 text-[24px]"><SinDato motivo="Hermes no escribe su versión en state.db; no hay número que enseñar." /></p>
            <p className="rotulo mt-1">versión</p>
            <p className="mt-2.5 border-t pt-2 text-[11.5px]" style={{ color: "var(--texto-3)" }}>
              última lectura {hace(m?.ultima)}{m ? ` · ${m.ms} ms` : ""}
            </p>
          </Tarjeta>

          <Tarjeta tinte={principal ? TINTE[marcaDe(principal.modelo)] : undefined} className="p-4">
            <p className="rotulo">modelo más usado</p>
            {principal ? (
              <>
                <div className="mt-2 flex items-center gap-2.5">
                  <Azulejo marca={marcaDe(principal.modelo)} tamano={30} />
                  <p className="min-w-0 truncate text-[13px] font-medium" title={principal.modelo}>
                    {principal.modelo.split("/").at(-1)}
                  </p>
                </div>
                <p className="mt-2.5 border-t pt-2 text-[11.5px]" style={{ color: "var(--texto-3)" }}>
                  {num(principal.mensajes)} mensajes · {principal.sesiones} sesiones
                </p>
              </>
            ) : (
              <p className="cifra mt-2 text-[24px]"><SinDato motivo="Ninguna sesión trae modelo." /></p>
            )}
          </Tarjeta>

          <Tarjeta className="p-4">
            <p className="rotulo">memoria</p>
            {memoria ? (
              <>
                <p className="cifra mt-2 text-[24px]">{num(memoria.total)}</p>
                <p className="rotulo mt-1">archivos en ~/.hermes/memories</p>
                <p className="mt-2.5 border-t pt-2 text-[11.5px]"
                   style={{ color: memoria.rancios ? "var(--gasto)" : "var(--ahorro)" }}>
                  {memoria.rancios ? `${memoria.rancios} sin tocar en 10+ días` : "todos frescos"}
                </p>
              </>
            ) : (
              <p className="cifra mt-2 text-[24px]"><SinDato motivo="El índice de memoria no tiene archivos del sistema hermes." /></p>
            )}
          </Tarjeta>

          <Tarjeta className="p-4">
            <p className="rotulo">sesiones</p>
            <p className="cifra mt-2 text-[24px]">{num(sesiones.length)}</p>
            <p className="rotulo mt-1">{num(mensajes)} mensajes en total</p>
            <p className="mt-2.5 border-t pt-2 text-[11.5px]" style={{ color: "var(--texto-3)" }}>
              la última terminó {haceEpoch(ultimaFin)}
            </p>
          </Tarjeta>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <section className="flex flex-col gap-3">
            <Seccion epigrafe="canales de entrada" tinte={ORO}
                     meta={`${canales.length} canales`}>
              Por dónde le hablas
            </Seccion>
            <Tarjeta className="overflow-hidden">
              {canales.map((c) => (
                <div key={c.canal} className="flex items-center gap-3.5 border-b px-4 py-3 last:border-0">
                  <Azulejo marca={marcaDe(c.canal)} tamano={30}
                           vivo={c.canal === "telegram"} />
                  <span className="flex-1 text-[13px]">{c.canal}</span>
                  <span className="dato" style={{ color: "var(--texto-3)" }}>{c.sesiones} sesiones</span>
                  <span className="cifra w-[70px] text-right" style={{ color: ORO }}>{num(c.mensajes)}</span>
                </div>
              ))}
            </Tarjeta>

            {/* El hueco honesto, pegado a los datos que sí hay. */}
            <Tarjeta className="p-5">
              <Seccion epigrafe="el hueco, con su motivo" tinte={ORO}>
                Por qué aquí no hay dinero
              </Seccion>
              <p className="mt-2.5 text-[13px] leading-relaxed" style={{ color: "var(--texto-2)" }}>
                La tabla <span className="dato">messages</span> de Hermes tiene una columna{" "}
                <span className="dato">token_count</span> y está a <b>cero en las {num(mensajes)} filas</b>.
                No es que gastara poco: es que no lo registra. Estimarlo por la longitud del texto
                sería inventarlo, así que aparece vacío.
              </p>
              <p className="mt-3 text-[12px] leading-relaxed" style={{ color: "var(--texto-3)" }}>
                Su gasto real sí está contado: va dentro del total de OpenRouter, junto con el de
                OpenClaw. Para separarlos hace falta una <i>management key</i> de OpenRouter.
              </p>
            </Tarjeta>
          </section>

          <section className="flex flex-col gap-3">
            <Seccion epigrafe="lo que ha llamado" tinte={ORO}
                     meta={`${modelos.length} modelos`}>
              Con qué modelos
            </Seccion>
            <Tarjeta className="overflow-hidden">
              {modelos.map((x) => (
                <div key={x.modelo} className="border-b px-4 py-2.5 last:border-0">
                  <div className="flex items-center gap-3">
                    <Azulejo marca={marcaDe(x.modelo)} tamano={26} />
                    <span className="min-w-0 flex-1 truncate text-[12.5px]" title={x.modelo}>{x.modelo}</span>
                    <span className="dato" style={{ color: "var(--texto-3)" }}>{x.sesiones} ses.</span>
                    <span className="cifra w-[56px] text-right">{num(x.mensajes)}</span>
                  </div>
                  <span className="barra mt-2 block">
                    <i style={{ width: `${Math.max(1.5, (x.mensajes / masMensajes) * 100)}%`,
                                background: TINTE[marcaDe(x.modelo)] }} />
                  </span>
                </div>
              ))}
            </Tarjeta>
          </section>
        </div>

        <section className="flex flex-col gap-3">
          <Seccion epigrafe="su propio catálogo" tinte={ORO}
                   meta={<span className="rotulo">
                     <span style={{ color: ORO }}>{usadas.length} usadas</span>
                     {" · "}{skills.length - usadas.length} dormidas
                   </span>}>
            Sus skills
          </Seccion>
          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
            {usadas.map((s) => (
              <Tarjeta key={s.nombre} tinte={ORO}
                       className="flex items-center gap-3 px-3.5 py-2.5">
                <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: ORO }} />
                <span className="min-w-0 flex-1 truncate text-[12.5px]">{s.nombre}</span>
                <Insignia color={ORO} title={s.ultimo_uso ? `último uso ${hace(s.ultimo_uso)}` : undefined}>
                  {s.usos} {s.usos === 1 ? "uso" : "usos"}
                </Insignia>
              </Tarjeta>
            ))}
          </div>
          {skills.length > usadas.length ? (
            <Tarjeta className="p-4">
              <p className="rotulo">
                {skills.length - usadas.length} dormidas · instaladas y sin un solo uso registrado
              </p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {skills.filter((s) => !s.usos).map((s) => (
                  <Insignia key={s.nombre} tono="neutro">{s.nombre}</Insignia>
                ))}
              </div>
            </Tarjeta>
          ) : null}
          <p className="text-[11.5px] leading-relaxed" style={{ color: "var(--texto-3)" }}>
            Sale de <span className="dato">~/.hermes/skills/.usage.json</span>, que Hermes
            mantiene solo con el número de usos y la última vez de cada una.
          </p>
        </section>

        <section className="flex flex-col gap-3">
          <Seccion epigrafe="una fila por sesión" tinte={ORO}
                   meta={`${sesiones.length} sesiones`}>
            Sus conversaciones
          </Seccion>
          <Tarjeta className="overflow-x-auto">
            {sesiones.length ? (
              <table className="w-full min-w-[720px]">
                <thead>
                  <tr className="border-b">
                    {["sesión", "canal", "modelo", "mensajes", "última"].map((h) => (
                      <th key={h} className="rotulo px-4 py-2.5 text-left font-normal">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sesiones.map((s) => (
                    <tr key={s.id} className="border-b transition-colors last:border-0 hover:bg-white/[.025]">
                      <td className="px-4 py-2.5">
                        <span className="dato" style={{ color: ORO }}>{s.id.slice(0, 8)}</span>
                        {s.titulo ? (
                          <span className="ml-3 text-[12px]" style={{ color: "var(--texto-2)" }}>{s.titulo}</span>
                        ) : null}
                      </td>
                      <td className="px-4 py-2.5">
                        {s.canal
                          ? <Insignia color={s.canal === "telegram" ? TINTE.telegram : undefined}>{s.canal}</Insignia>
                          : <span className="dato" style={{ color: "var(--texto-3)" }}>—</span>}
                      </td>
                      <td className="dato px-4 py-2.5" style={{ color: "var(--texto-3)" }}>{s.modelo ?? "—"}</td>
                      <td className="dato px-4 py-2.5">{s.mensajes}</td>
                      <td className="dato px-4 py-2.5" style={{ color: "var(--texto-3)" }}>{haceEpoch(s.fin)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <Vacio que="Hermes no ha devuelto ninguna sesión."
                     porque="O su base está vacía, o el motor no la encuentra en ~/.hermes/state.db." />
            )}
          </Tarjeta>
        </section>

        {m ? (
          <p className="rotulo">
            última lectura {hace(m.ultima)} · {m.ms} ms · {num(m.filas)} filas
          </p>
        ) : null}
      </div>
    </>
  );
}
