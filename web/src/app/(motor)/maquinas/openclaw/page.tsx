import { Cabecera } from "@/componentes/Cabecera";
import {
  Seccion, Vacio, num, hace, Tarjeta, Azulejo, Insignia, Pastilla, SinDato,
} from "@/componentes/Piezas";
import { TINTE, marcaDe } from "@/componentes/Marcas";
import { Heroe } from "@/componentes/piezas/Heroe";
import { maquina, clawAgentes } from "@/lib/maquinas";

export const dynamic = "force-dynamic";

const ROSA = TINTE.openclaw;

/** La configuración de un agente de OpenClaw, si su descripción es el JSON
    de openclaw.json. No se estima nada: o el JSON parsea, o se enseña crudo. */
function configDe(desc: string | null): { primary?: string; fallbacks?: string[] } | null {
  if (!desc) return null;
  try {
    const j: unknown = JSON.parse(desc);
    if (j && typeof j === "object" && ("primary" in j || "fallbacks" in j)) {
      return j as { primary?: string; fallbacks?: string[] };
    }
  } catch { /* no era JSON: se enseña tal cual */ }
  return null;
}

export default function OpenClaw() {
  const m = maquina("openclaw");
  const agentes = clawAgentes();

  return (
    <>
      <Cabecera ruta="maquinas/openclaw" />
      <div className="flex flex-col gap-8 px-6 py-7">

        {/* ── el dashboard de la máquina: cabecera con su marca ───────── */}
        <Heroe tinte={ROSA} semilla={47}>
          <div className="flex flex-wrap items-start justify-between gap-6 px-7 py-8">
            <div className="flex min-w-0 flex-col gap-3">
              <div className="flex flex-wrap items-center gap-2.5">
                <Insignia color={ROSA}>agente autónomo</Insignia>
                <span className="rotulo">sólo lectura · openclaw.json</span>
              </div>
              <h1 className="titular">
                <b style={{ color: ROSA, textShadow: "0 0 26px rgb(251 113 133 / .3)" }}>OpenClaw</b>
              </h1>
              <p className="max-w-[560px] text-[13px] leading-relaxed" style={{ color: "var(--texto-2)" }}>
                Un agente autónomo con sus propios agentes y modelos. De él, el motor sólo puede leer su configuración
                — sus registros no guardan consumo.
              </p>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                {m?.vivo ? (
                  <Pastilla color={ROSA} late>config leída</Pastilla>
                ) : m?.error && m.ultimaOk ? (
                  <Pastilla tono="alerta">lector con fallo</Pastilla>
                ) : (
                  <Pastilla tono="neutro">config sin leer</Pastilla>
                )}
                {m?.error && m.ultimaOk ? (
                  <Insignia tono="neutro" title="lo que ves abajo viene de esa pasada">
                    última lectura buena {hace(m.ultimaOk)}
                  </Insignia>
                ) : null}
                <Insignia tono="neutro">
                  {agentes.length} {agentes.length === 1 ? "agente declarado" : "agentes declarados"}
                </Insignia>
              </div>
            </div>

            <span className="azulejo shrink-0"
                  style={{ width: 84, height: 84, borderRadius: 20,
                           ["--tinte" as string]: ROSA, color: ROSA }}>
              <OpenClawLogo size={44} />
            </span>
          </div>
        </Heroe>

        {/* ── las cuatro tarjetas de estado ───────────────────────────── */}
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Tarjeta tinte={ROSA} className="p-4">
            <p className="rotulo">agentes</p>
            <p className="cifra mt-2 text-[24px]">{num(agentes.length)}</p>
            <p className="rotulo mt-1">declarados en openclaw.json</p>
            <p className="mt-2.5 border-t pt-2 text-[11.5px]" style={{ color: "var(--texto-3)" }}>
              es lo único que el motor puede leer de él
            </p>
          </Tarjeta>

          <Tarjeta className="p-4">
            <p className="rotulo">gasto propio</p>
            <p className="cifra mt-2 text-[24px]">
              <SinDato motivo="Sus registros no guardan ni modelo, ni tokens, ni coste por llamada." />
            </p>
            <p className="rotulo mt-1">no lo registra</p>
            <p className="mt-2.5 border-t pt-2 text-[11.5px]" style={{ color: "var(--texto-3)" }}>
              su dinero real va dentro del total de OpenRouter
            </p>
          </Tarjeta>

          <Tarjeta className="p-4">
            <p className="rotulo">última lectura buena</p>
            <p className="cifra mt-2 text-[24px]">{hace(m?.error ? m?.ultimaOk : m?.ultima)}</p>
            <p className="rotulo mt-1">
              {!m ? "sin registro"
                : m.error ? `el intento de ${hace(m.ultima)} falló`
                : `${m.ms} ms · ${num(m.filas)} filas`}
            </p>
            <p className="mt-2.5 border-t pt-2 text-[11.5px]" style={{ color: "var(--texto-3)" }}>
              el lector pasa por aquí en cada ciclo
            </p>
          </Tarjeta>

          <Tarjeta tinte={m?.error ? "var(--alerta)" : undefined} className="p-4">
            <p className="rotulo">estado del lector</p>
            <div className="mt-2.5">
              <Pastilla tono={m?.vivo ? "ahorro" : m?.error ? "alerta" : "neutro"}>
                {m?.vivo ? "leído" : m?.error ? "con error" : "sin leer"}
              </Pastilla>
            </div>
            {m?.error ? (
              <p className="dato mt-3 break-words border-t pt-2 text-[11px] leading-relaxed"
                 style={{ color: "var(--alerta)" }}>
                {m.error}
              </p>
            ) : (
              <p className="mt-3 border-t pt-2 text-[11.5px]" style={{ color: "var(--texto-3)" }}>
                la última pasada terminó sin errores
              </p>
            )}
          </Tarjeta>
        </div>

        <Tarjeta className="p-5">
          <Seccion epigrafe="el límite del lector" tinte="var(--alerta)">
            Lo que este motor NO puede saber de OpenClaw
          </Seccion>
          <p className="mt-2.5 max-w-[720px] text-[13px] leading-relaxed" style={{ color: "var(--texto-2)" }}>
            Sus registros —<span className="dato">~/.openclaw/logs</span>— no guardan ni modelo,
            ni tokens, ni coste por llamada. No hay nada que leer, así que aquí no aparece una
            cifra de gasto: aparece este párrafo.
          </p>
          <p className="mt-3 text-[12px] leading-relaxed" style={{ color: "var(--texto-3)" }}>
            Lo que sí está contado es su dinero real, mezclado con el de Hermes en el total de
            OpenRouter. Separarlos exige una <i>management key</i>.
          </p>
        </Tarjeta>

        <section className="flex flex-col gap-3">
          <Seccion epigrafe="la cadena de reservas" tinte="var(--alerta)"
                   meta={m?.error && m.ultimaOk
                     ? `de openclaw.json · leído ${hace(m.ultimaOk)}`
                     : "de openclaw.json, tal cual"}>
            Sus agentes
          </Seccion>
          {agentes.length ? (
            <div className="flex flex-col gap-4">
              {agentes.map((a) => {
                // openclaw.json guarda la cadena de modelos donde caiga:
                // unas veces en la descripción, otras en la columna modelo.
                const conf = configDe(a.descripcion) ?? configDe(a.modelo);
                const modeloPlano = a.modelo && !configDe(a.modelo) ? a.modelo : null;
                const descPlana = a.descripcion && !configDe(a.descripcion) ? a.descripcion : null;
                return (
                  <Tarjeta key={a.nombre} tinte={ROSA} className="p-5">
                    <div className="flex flex-wrap items-center gap-3">
                      <p className="text-[14px] font-medium">{a.nombre}</p>
                      <Insignia color={ROSA}>agente</Insignia>
                      {modeloPlano ? <span className="dato" style={{ color: "var(--texto-3)" }}>{modeloPlano}</span> : null}
                    </div>

                    {conf ? (
                      <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                        {conf.primary ? (
                          <Tarjeta tinte={TINTE[marcaDe(conf.primary)]} seleccionada
                                   className="flex items-center gap-3 px-3.5 py-3">
                            <Azulejo marca={marcaDe(conf.primary)} tamano={32} />
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-[12.5px] font-medium"
                                    title={conf.primary}>{conf.primary.split("/").at(-1)}</span>
                              <span className="dato block truncate" style={{ color: "var(--texto-3)" }}>
                                {conf.primary}
                              </span>
                            </span>
                            <Insignia color={ROSA}>primario</Insignia>
                          </Tarjeta>
                        ) : null}
                        {(conf.fallbacks ?? []).map((f, i) => (
                          <Tarjeta key={f} tinte={TINTE[marcaDe(f)]}
                                   className="flex items-center gap-3 px-3.5 py-3">
                            <Azulejo marca={marcaDe(f)} tamano={32} />
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-[12.5px] font-medium"
                                    title={f}>{f.split("/").at(-1)}</span>
                              <span className="dato block truncate" style={{ color: "var(--texto-3)" }}>{f}</span>
                            </span>
                            <Insignia tono="neutro">reserva {i + 1}</Insignia>
                          </Tarjeta>
                        ))}
                      </div>
                    ) : null}
                    {descPlana ? (
                      <p className="dato mt-3 leading-relaxed" style={{ color: "var(--texto-2)" }}>
                        {descPlana}
                      </p>
                    ) : null}

                    {conf ? (
                      <p className="mt-3 text-[11.5px] leading-relaxed" style={{ color: "var(--texto-3)" }}>
                        La cadena de reservas es literal: si el primario falla, OpenClaw baja
                        al siguiente. No es una preferencia del motor — es su configuración.
                      </p>
                    ) : null}
                  </Tarjeta>
                );
              })}
            </div>
          ) : (
            <Tarjeta>
              <Vacio que="No hay agentes declarados en openclaw.json."
                     porque="O no se han configurado todavía, o el archivo tiene otra forma de la esperada." />
            </Tarjeta>
          )}
        </section>

        {m?.nota ? (
          <p className="text-[11.5px] leading-relaxed" style={{ color: "var(--texto-3)" }}>{m.nota}</p>
        ) : null}
      </div>
    </>
  );
}

/** La garra, en grande para el héroe. El mismo trazo que MARCAS.openclaw. */
function OpenClawLogo({ size = 30 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor"
         strokeWidth="1.4" strokeLinecap="round" aria-hidden="true">
      <path d="M6 4.5v7M9.7 3.6v8M14.3 3.6v8M18 4.5v7" />
      <path d="M5.2 11c0 4.4 3 8.5 6.8 8.5s6.8-4.1 6.8-8.5" />
    </svg>
  );
}
