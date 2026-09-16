import Link from "next/link";
import type { ReactNode } from "react";
import { Cabecera } from "@/componentes/Cabecera";
import {
  Carta, Tarjeta, Rotulo, Seccion, Cifra, Barra, Azulejo, Insignia, Pastilla,
  Medidor, BarraLimite, Rail, SinDato, usd, tok, num, hace,
} from "@/componentes/Piezas";
import { marcaDe, tinteDe, NOMBRE_FUENTE } from "@/componentes/Marcas";
import { Constelacion } from "@/componentes/Constelacion";
import { Pestanas } from "@/componentes/piezas/Pestanas";
import {
  porModelo, totalUsd, porDia, porProyecto, suscripciones, gastoReal,
  cacheResumen, sinCache, resumenInventario, memoriaResumen, salud, rango,
  sesionesCaras, racha, programado, canales, suenoUltimo, comoAhorrar,
  plan, topes,
} from "@/lib/consultas";
import { existe } from "@/lib/base";

export const dynamic = "force-dynamic";

export default function Inicio() {
  if (!existe()) return <SinBase />;

  const V = 28 as const;
  const total = totalUsd(V);
  const modelos = porModelo(V).filter((m) => m.turnos > 0);
  const dias = porDia(V);
  const subs = suscripciones();
  const real = gastoReal();
  const cache = cacheResumen(V);
  const elPlan = plan();
  const paredes = topes();
  const bruto = sinCache(V);
  const inv = resumenInventario();
  const mem = memoriaResumen();
  const r = rango();
  const ra = racha();
  const caras = sesionesCaras(V, 5);
  const sueno = suenoUltimo();

  // El ROI: lo que te habría costado por API contra lo que pagas de cuota.
  //
  // La cuota se prorratea a LA MISMA ventana con la que se midió el gasto.
  // Si el gasto y la cuota se miden en ventanas distintas, el ROI sale
  // falseado: comparar dos ventanas distintas es la forma más fácil de que un
  // tablero mienta sin que nadie lo note.
  const cuotaMes = subs.reduce((s, x) => s + x.usd_mes, 0);
  const diasDato = Math.min(V, r?.dias || V);
  const cuota = (cuotaMes * diasDato) / 30.44;
  const roi = cuota > 0 ? total / cuota : null;
  const ahorroCache = bruto - total;
  const gastadoReal = real.filter((x) => x.proveedor === "openrouter")
                          .reduce((s, x) => Math.max(s, x.usd), 0);

  // La serie del pulso: los últimos 28 días CON sus ceros. Un día sin filas
  // dentro del rango del índice es un día sin uso de verdad — el cero aquí
  // es un dato, no un hueco. Antes del primer día indexado no hay serie.
  const porFecha = new Map(dias.map((d) => [d.dia, d]));
  const serie: { dia: string; turnos: number; usd: number }[] = [];
  for (let i = V - 1; i >= 0; i--) {
    const f = new Date(Date.now() - i * 86400e3).toISOString().slice(0, 10);
    if (r?.desde && f < r.desde) continue;
    const d = porFecha.get(f);
    serie.push({ dia: f, turnos: d?.turnos ?? 0, usd: d?.usd ?? 0 });
  }
  // «Últimos 7 días» = hoy y los 6 anteriores. Con `hoy - 7` el filtro
  // abarcaba OCHO fechas y el delta comparaba 8 días contra 7 — la
  // desigualdad exacta contra la que avisa el comentario del delta.
  const corte7 = new Date(Date.now() - 6 * 86400e3).toISOString().slice(0, 10);
  const corte14 = new Date(Date.now() - 13 * 86400e3).toISOString().slice(0, 10);
  const dias7 = Math.max(1, serie.filter((d) => d.dia >= corte7).length);
  const turnos7 = serie.filter((d) => d.dia >= corte7).reduce((s, d) => s + d.turnos, 0);
  const turnosPrev = serie.filter((d) => d.dia >= corte14 && d.dia < corte7)
                          .reduce((s, d) => s + d.turnos, 0);
  // El delta sólo se enseña con una semana anterior COMPLETA en el índice:
  // comparar 7 días contra 3 indexados inflaría el porcentaje sin avisar.
  const semanaPreviaCompleta = !!r?.desde && r.desde <= corte14;
  const delta = semanaPreviaCompleta && turnosPrev > 0
    ? (turnos7 - turnosPrev) / turnosPrev : null;
  const proyectos7 = porProyecto(7).length;
  const peorDia = dias.reduce((a, b) => (b.usd > (a?.usd ?? 0) ? b : a), dias[0]);

  // La tasa de caché: de todo lo que entró al contexto, cuánto vino de caché.
  const entrado = (cache?.lee ?? 0) + (cache?.entrada ?? 0);
  const tasaCache = entrado > 0 ? (cache?.lee ?? 0) / entrado : null;

  // El modelo que se lleva el gasto, para el donut de participación.
  const top = modelos.find((m) => (m.usd ?? 0) > 0) ?? null;
  const parteTop = top && total > 0 ? (top.usd ?? 0) / total : null;

  return (
    <>
      <Cabecera ruta="" />
      <div className="flex flex-col gap-9 px-6 py-7">

        <Anoche />
        <Pulso serie={serie} turnos7={turnos7} dias7={dias7} delta={delta}
               proyectos7={proyectos7} racha={ra.dias} />
        <Atencion ideas={sueno.ideas.length} fecha={sueno.fecha} mem={mem} inv={inv} racha={ra.dias} />

        {/* ── el dinero: qué pagas y qué sacas ───────────────────────── */}
        <section className="flex flex-col gap-5">
          <Seccion
            epigrafe={`gasto en ia · últimos ${diasDato} días`}
            tinte="var(--gasto)"
            nota={<>Estás en suscripción, así que casi nada de esto se factura: es lo que la API
                    medida cobraría por los mismos tokens. El único dinero que sale de verdad
                    está abajo, en rosa.</>}
            meta={roi ? (
              <div className="rounded-[5px] px-4 py-2.5 text-right"
                   style={{ border: "1px solid color-mix(in oklab, var(--ahorro) 35%, transparent)",
                            background: "color-mix(in oklab, var(--ahorro) 8%, transparent)" }}>
                <p className="cifra text-[26px]" style={{ color: "var(--ahorro)" }}>
                  ×{roi.toLocaleString("es-ES", { maximumFractionDigits: 1 })}
                </p>
                <p className="rotulo mt-0.5">roi de la cuota</p>
              </div>
            ) : undefined}
          >
            Pagas <b>{usd(cuota)}</b> de cuota · sacas <b>{usd(total)}</b> en tokens
          </Seccion>

          <Pestanas
            etiqueta="Gasto en IA" inicial={1}
            derecha={<span className="rotulo">cuota fija · {usd(cuotaMes, 0)}/mes</span>}
            pestanas={[
              {
                titulo: "suscripciones",
                nota: String(subs.length),
                panel: (
                  <div className="grid gap-3 sm:grid-cols-3">
                    {subs.map((s) => {
                      // La nota que sólo repite el precio de arriba no aporta:
                      // «100 $/mes» bajo un «$100 /mes» es ruido, no dato.
                      const notaUtil = s.nota &&
                        !(s.usd_mes && /mes/i.test(s.nota) &&
                          s.nota.replace(/\D/g, "") === String(s.usd_mes));
                      return (
                      <Tarjeta key={s.nombre} tinte={tinteDe(s.cubre)} className="p-4">
                        <div className="flex items-center gap-3">
                          <Azulejo marca={marcaDe(s.cubre)} tamano={36} />
                          <div className="min-w-0">
                            <p className="truncate text-[13px] font-medium">{s.nombre}</p>
                            <p className="rotulo mt-0.5">
                              cubre {s.cubre.split(",").map((c) => NOMBRE_FUENTE[c.trim()] ?? c.trim()).join(" · ")}
                            </p>
                          </div>
                        </div>
                        <p className="cifra mt-4 text-[26px]">
                          {s.usd_mes ? usd(s.usd_mes, 0) : "por uso"}
                          {s.usd_mes ? (
                            <span className="text-[12px]" style={{ color: "var(--texto-3)" }}> /mes</span>
                          ) : null}
                        </p>
                        {notaUtil ? (
                          <p className="mt-1.5 text-[10.5px] leading-snug" style={{ color: "var(--texto-3)" }}>
                            {s.nota}
                          </p>
                        ) : null}
                      </Tarjeta>
                      );
                    })}
                  </div>
                ),
              },
              {
                titulo: "tokens · equiv. api",
                panel: (
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    {modelos.map((m, i) => {
                      const parte = total ? (m.usd ?? 0) / total : 0;
                      const sinTarifa = m.sin_tarifa > 0 && !m.usd;
                      const tinte = tinteDe(m.modelo);
                      return (
                        <Tarjeta key={m.modelo + m.velocidad} tinte={tinte}
                                 seleccionada={i === 0} className="p-4">
                          <div className="flex items-start gap-2.5">
                            <Azulejo marca={marcaDe(m.modelo)} tamano={30} />
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-[13px]">{m.modelo}</p>
                              <p className="rotulo mt-0.5">
                                {m.velocidad === "fast" ? "modo rápido · doble tarifa" : `${num(m.turnos)} turnos`}
                              </p>
                            </div>
                          </div>
                          <p className="cifra mt-3 text-[22px]"
                             style={{ color: sinTarifa ? "var(--texto-3)" : "var(--texto)" }}>
                            {sinTarifa ? "sin tarifa" : usd(m.usd)}
                          </p>
                          {sinTarifa ? (
                            <p className="mt-1 text-[10.5px] leading-snug" style={{ color: "var(--texto-3)" }}>
                              no tengo su precio publicado, así que no invento la cifra
                            </p>
                          ) : (
                            <>
                              <Barra parte={parte} color={tinte} />
                              <p className="rotulo mt-1.5">
                                {(parte * 100).toFixed(0)}% del total · {tok(m.salida)} de salida
                              </p>
                            </>
                          )}
                        </Tarjeta>
                      );
                    })}
                  </div>
                ),
              },
            ]}
          />

          <div className="tira grid-cols-1 sm:grid-cols-3">
            <div>
              <Cifra rotulo="dinero real que ha salido" valor={usd(gastadoReal)} tono="alerta" tamano={24}
                     nota="OpenRouter · lo único de este panel que se factura" />
            </div>
            <div>
              <Cifra rotulo="lo que te ahorró la caché" valor={usd(ahorroCache)} tono="ahorro" tamano={24}
                     nota={`sin caché habría costado ${usd(bruto)}`} />
            </div>
            <div>
              {peorDia ? (
                <Cifra rotulo="el peor día de la ventana" valor={usd(peorDia.usd)} tono="gasto" tamano={24}
                       nota={`${peorDia.dia} · ${num(peorDia.turnos)} turnos`} />
              ) : (
                <Cifra rotulo="el peor día de la ventana" valor={<SinDato motivo="sin días con gasto en la ventana" />}
                       tono="apagado" tamano={24} />
              )}
            </div>
          </div>
        </section>

        <ComoAhorrar />

        {/* ── uso en vivo: medidores y límites, sin inventar techos ──── */}
        <section className="flex flex-col gap-5">
          <Seccion
            epigrafe="uso en vivo"
            nota={<>Lo que se puede medir desde esta máquina, medido; lo que ningún proveedor
                    publica —tu cuota de suscripción— dicho a la cara, no rellenado con un cero.</>}
          >
            Límites y ventanas del plan
          </Seccion>
          <div className="grid gap-4 lg:grid-cols-3">
            <Tarjeta tinte={tinteDe("claude")} className="flex gap-5 p-5">
              <div className="flex flex-col items-center gap-3">
                <Azulejo marca="anthropic" tamano={38} />
                <Medidor parte={null} color={tinteDe("claude")} tamano={72} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-3">
                  <p className="text-[13px] font-medium">{elPlan.nombre ?? "Claude"}</p>
                  {elPlan.desde && <span className="rotulo shrink-0">desde {elPlan.desde}</span>}
                </div>
                {elPlan.detalle && (
                  <p className="mt-0.5 text-[11px]" style={{ color: "var(--texto-3)" }}>{elPlan.detalle}</p>
                )}
                <div className="mt-3 flex flex-col gap-3">
                  <BarraLimite rotulo="límite 5 h" usado={null} techo={null} color={tinteDe("claude")}
                               motivo="El consumo de la ventana en curso viaja en la respuesta de la API y no se guarda en ninguna parte" />
                  <BarraLimite rotulo="ventana semanal" usado={null} techo={null} color={tinteDe("claude")}
                               motivo="El consumo de la ventana en curso viaja en la respuesta de la API y no se guarda en ninguna parte" />
                </div>
                {/* Lo que sí queda escrito: el instante en que te frenaron. */}
                {paredes.length > 0 ? (
                  <div className="mt-3.5 border-t pt-3" style={{ borderColor: "var(--linea)" }}>
                    <p className="rotulo">
                      te ha frenado {paredes.length === 1 ? "una vez" : `${paredes.length} veces`}
                    </p>
                    <p className="mt-1.5 text-[11.5px] leading-relaxed" style={{ color: "var(--texto-2)" }}>
                      la última, {hace(paredes[0].desde)} en la {paredes[0].ventana ?? "ventana del plan"}
                      {paredes[0].sesiones > 1 && <> — congeló {paredes[0].sesiones} sesiones a la vez</>}.
                    </p>
                  </div>
                ) : (
                  <p className="mt-3 text-[10.5px] leading-snug" style={{ color: "var(--texto-3)" }}>
                    nunca has llegado a tocar el techo
                  </p>
                )}
                {elPlan.extraActivado && elPlan.extraMotivo === "out_of_credits" && (
                  <p className="mt-2.5">
                    <Pastilla tono="alerta">uso extra sin crédito</Pastilla>
                  </p>
                )}
              </div>
            </Tarjeta>

            <Tarjeta className="flex items-center gap-5 p-5">
              <Medidor parte={tasaCache} color="var(--ahorro)" tamano={88} />
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-medium">Acierto de caché</p>
                <p className="mt-1.5 text-[11.5px] leading-relaxed" style={{ color: "var(--texto-2)" }}>
                  {tok(cache?.lee)} tokens del contexto llegaron leídos de caché, a un décimo de precio.
                </p>
                <p className="rotulo mt-2.5">
                  te ahorró <span style={{ color: "var(--ahorro)" }}>{usd(ahorroCache)}</span> en {diasDato} días
                </p>
              </div>
            </Tarjeta>

            <Tarjeta tinte={top ? tinteDe(top.modelo) : undefined} className="flex items-center gap-5 p-5">
              <Medidor parte={parteTop}
                       color={top ? tinteDe(top.modelo) : "var(--texto-3)"} tamano={88} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2.5">
                  {top ? <Azulejo marca={marcaDe(top.modelo)} tamano={26} /> : null}
                  <p className="truncate text-[13px] font-medium">{top ? top.modelo : "sin gasto con tarifa"}</p>
                </div>
                {top ? (
                  <>
                    <p className="mt-1.5 text-[11.5px] leading-relaxed" style={{ color: "var(--texto-2)" }}>
                      Se lleva {usd(top.usd)} de los {usd(total)} equivalentes de la ventana.
                    </p>
                    <p className="rotulo mt-2.5">{num(top.turnos)} turnos · {tok(top.salida)} de salida</p>
                  </>
                ) : (
                  <p className="mt-1.5 text-[11.5px]" style={{ color: "var(--texto-3)" }}>
                    ningún modelo de la ventana tiene tarifa publicada
                  </p>
                )}
              </div>
            </Tarjeta>
          </div>
          <Estado />
        </section>

        {/* ── las otras tres preguntas, en corto ─────────────────────── */}
        <section className="grid gap-4 lg:grid-cols-3">
          <Tarjeta href="/inventario" className="p-5">
            <Rotulo>qué tienes montado</Rotulo>
            <div className="mt-3.5 flex flex-col gap-2.5">
              {inv.filter((i) => i.clase !== "universo").map((i) => (
                <div key={i.clase} className="flex items-baseline justify-between gap-3">
                  <span className="text-[12.5px]" style={{ color: "var(--texto-2)" }}>{i.clase}s</span>
                  <span className="dato">
                    <span style={{ color: i.usados ? "var(--ambar)" : "var(--texto-3)" }}>{i.usados}</span>
                    <span style={{ color: "var(--texto-3)" }}> / {i.total} usados</span>
                  </span>
                </div>
              ))}
            </div>
            <p className="rotulo mt-4" style={{ color: "var(--ambar)" }}>ver el inventario →</p>
          </Tarjeta>

          <Tarjeta href="/memoria" className="p-5">
            <Rotulo>qué sabe de ti</Rotulo>
            <div className="mt-3.5 flex flex-col gap-2.5">
              {mem.map((m) => (
                <div key={m.sistema} className="flex items-baseline justify-between gap-3">
                  <span className="text-[12.5px]" style={{ color: "var(--texto-2)" }}>{m.sistema}</span>
                  <span className="dato">
                    <span style={{ color: m.rancios ? "var(--gasto)" : "var(--ahorro)" }}>{m.rancios}</span>
                    <span style={{ color: "var(--texto-3)" }}> / {m.total} rancios</span>
                  </span>
                </div>
              ))}
            </div>
            <p className="rotulo mt-4" style={{ color: "var(--ambar)" }}>ver la memoria →</p>
          </Tarjeta>

          <Tarjeta href="/actividad" className="p-5">
            <Rotulo>qué ha hecho</Rotulo>
            <div className="mt-3.5 flex flex-col gap-2.5">
              {caras.slice(0, 4).map((s) => (
                <div key={s.id} className="flex items-baseline justify-between gap-3">
                  <span className="min-w-0 flex-1 truncate text-[12px]" style={{ color: "var(--texto-2)" }}>
                    {s.titulo || s.proyecto || s.id.slice(0, 8)}
                  </span>
                  <span className="dato shrink-0" style={{ color: "var(--gasto)" }}>{usd(s.usd)}</span>
                </div>
              ))}
            </div>
            <p className="rotulo mt-4" style={{ color: "var(--ambar)" }}>ver la actividad →</p>
          </Tarjeta>
        </section>

        <Relojes />
      </div>
    </>
  );
}

/**
 * El pulso: la curva de los últimos 28 días y la cifra grande con su delta.
 * El delta compara los últimos 7 días con los 7 anteriores — dos ventanas
 * IGUALES, que es la única comparación que no miente.
 */
function Pulso({
  serie, turnos7, dias7, delta, proyectos7, racha,
}: {
  serie: { dia: string; turnos: number; usd: number }[];
  turnos7: number; dias7: number; delta: number | null;
  proyectos7: number; racha: number;
}) {
  if (!serie.length) return null;
  const ANCHO = 600, ALTO = 150, M = 8;
  const max = Math.max(...serie.map((d) => d.turnos), 1);
  const pts = serie.map((d, i) => ({
    x: M + (i * (ANCHO - 2 * M)) / Math.max(1, serie.length - 1),
    y: ALTO - M - (d.turnos / max) * (ALTO - 2 * M),
  }));
  const ult = pts.at(-1)!;
  return (
    <section className="grid gap-4 lg:grid-cols-[1.65fr_1fr]">
      <Tarjeta marco rejilla className="flex flex-col p-5">
        <div className="flex items-baseline justify-between gap-4">
          <p className="rotulo">el pulso · turnos por día</p>
          <p className="rotulo">{serie[0].dia} → {serie.at(-1)!.dia}</p>
        </div>
        <svg viewBox={`0 0 ${ANCHO} ${ALTO}`} preserveAspectRatio="none"
             className="mt-4 h-32 w-full flex-1" aria-hidden="true">
          <defs>
            <linearGradient id="pulso-area" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="var(--ambar)" stopOpacity="0.22" />
              <stop offset="1" stopColor="var(--ambar)" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d={`${suave(pts)} L ${ult.x.toFixed(1)} ${ALTO} L ${pts[0].x.toFixed(1)} ${ALTO} Z`}
                fill="url(#pulso-area)" />
          <path d={suave(pts)} fill="none" stroke="var(--ambar)" strokeWidth="2"
                strokeLinecap="round" strokeLinejoin="round"
                vectorEffect="non-scaling-stroke" />
          <circle cx={ult.x} cy={ult.y} r="3.5" fill="var(--ambar)" />
          <circle cx={ult.x} cy={ult.y} r="7" fill="none" stroke="var(--ambar)" opacity="0.35" />
        </svg>
        <p className="rotulo mt-3">
          el mejor día:{" "}
          <span style={{ color: "var(--texto)" }}>
            {num(Math.max(...serie.map((d) => d.turnos), 0))} turnos
          </span>
          {" "}· los ceros son días sin uso, no huecos
        </p>
      </Tarjeta>

      <Tarjeta marco rejilla className="flex flex-col justify-between p-5">
        <div>
          <p className="rotulo flex items-center gap-2">
            <span className="late" style={{ color: "var(--ambar)" }}><i /></span>
            actividad
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <p className="cifra text-[46px] leading-none">{num(turnos7)}</p>
            {delta !== null ? (
              <Insignia tono={delta >= 0 ? "ahorro" : "gasto"}
                        title="últimos 7 días contra los 7 anteriores">
                {delta >= 0 ? "↗" : "↘"} {delta >= 0 ? "+" : ""}
                {(delta * 100).toLocaleString("es-ES", { maximumFractionDigits: 0 })}%
              </Insignia>
            ) : (
              <SinDato motivo="sin semana anterior completa con la que comparar" />
            )}
          </div>
          <p className="mt-2 text-[11.5px]" style={{ color: "var(--texto-3)" }}>
            turnos en los últimos {dias7} {dias7 === 1 ? "día" : "días"} · {proyectos7}{" "}
            {proyectos7 === 1 ? "proyecto" : "proyectos"} con actividad
          </p>
        </div>
        <div className="mt-5 flex flex-col gap-2.5 border-t pt-3.5">
          <div className="flex items-center justify-between gap-3">
            <span className="text-[12px]" style={{ color: "var(--texto-2)" }}>días a cero · {serie.length} días</span>
            <span className="dato">
              <span style={{ color: "var(--texto)" }}>{num(serie.filter((d) => !d.turnos).length)}</span>
              <span style={{ color: "var(--texto-3)" }}> sin uso</span>
            </span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-[12px]" style={{ color: "var(--texto-2)" }}>
              media diaria · {dias7} {dias7 === 1 ? "día" : "días"}
            </span>
            <span className="dato">
              <span style={{ color: "var(--texto)" }}>{num(Math.round(turnos7 / dias7))}</span>
              <span style={{ color: "var(--texto-3)" }}> turnos</span>
            </span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-[12px]" style={{ color: "var(--texto-2)" }}>racha</span>
            <span className="dato">
              <span style={{ color: "var(--gasto)" }}>▲ </span>
              <span style={{ color: "var(--texto)" }}>{racha}</span>
              <span style={{ color: "var(--texto-3)" }}> días seguidos</span>
            </span>
          </div>
        </div>
      </Tarjeta>
    </section>
  );
}

/** Curva Catmull-Rom → cúbicas: la línea pasa por todos los puntos sin picos. */
function suave(pts: { x: number; y: number }[]): string {
  if (pts.length < 2) return "";
  let d = `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)], p1 = pts[i];
    const p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
    d += ` C ${(p1.x + (p2.x - p0.x) / 6).toFixed(1)} ${(p1.y + (p2.y - p0.y) / 6).toFixed(1)},`
       + ` ${(p2.x - (p3.x - p1.x) / 6).toFixed(1)} ${(p2.y - (p3.y - p1.y) / 6).toFixed(1)},`
       + ` ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
  }
  return d;
}

/**
 * Atención ahora: el rail de lo que pide un clic hoy. Máximo tres cosas,
 * todas salidas de la base — si un frente está limpio, su tarjeta no sale.
 */
function Atencion({
  ideas, fecha, mem, inv, racha: dias,
}: {
  ideas: number; fecha: string | null;
  mem: { sistema: string; total: number; rancios: number }[];
  inv: { clase: string; total: number; usados: number }[];
  racha: number;
}) {
  const icono = (d: string) => (
    <svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor"
         strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d} />
    </svg>
  );
  const acciones: { titulo: string; nota: string; href: string; tono: string; icono: ReactNode }[] = [];

  if (ideas > 0) {
    acciones.push({
      titulo: `${ideas} ${ideas === 1 ? "idea del sueño sin leer" : "ideas del sueño sin leer"}`,
      nota: `revisión del ${fecha} · decide cuáles pasan a acción`,
      href: "/sueno", tono: "var(--sueno)",
      icono: icono("M13.5 9.5A5.5 5.5 0 1 1 6.5 2.5a4.5 4.5 0 0 0 7 7Z"),
    });
  }
  const rancios = mem.reduce((s, m) => s + m.rancios, 0);
  const peorSistema = [...mem].sort((a, b) => b.rancios - a.rancios)[0];
  if (rancios > 0) {
    acciones.push({
      titulo: `${rancios} recuerdos llevan más de 10 días sin tocarse`,
      nota: peorSistema ? `${peorSistema.sistema} se lleva ${peorSistema.rancios} · poda o actualiza` : "poda o actualiza",
      href: "/memoria", tono: "var(--gasto)",
      icono: icono("M8 4.5V8l2.5 1.5M14 8A6 6 0 1 1 2 8a6 6 0 0 1 12 0Z"),
    });
  }
  const sk = inv.find((i) => i.clase === "skill");
  if (sk && sk.total - sk.usados > 0) {
    acciones.push({
      titulo: `${sk.total - sk.usados} skills sin estrenar`,
      nota: `de ${sk.total} instaladas · empaqueta lo que repites o poda`,
      href: "/skills", tono: "var(--ambar)",
      icono: icono("M8 1.5 9.8 6l4.7.3-3.6 3 1.1 4.6L8 11.4l-4 2.5 1.1-4.6-3.6-3L6.2 6 8 1.5Z"),
    });
  }
  if (acciones.length < 3 && dias > 1) {
    acciones.push({
      titulo: `${dias} días seguidos abriendo el motor`,
      nota: "racha activa · la actividad de hoy ya cuenta",
      href: "/actividad", tono: "var(--ahorro)",
      icono: icono("M1.5 10.5 6 6l3 2.5 5.5-6M10.5 2.5H14.5V6.5"),
    });
  }
  if (!acciones.length) return null;
  return (
    <section className="flex flex-col gap-4">
      <Seccion epigrafe="atención ahora">Lo que pide un clic hoy</Seccion>
      <Rail acciones={acciones.slice(0, 3)} />
    </section>
  );
}

/**
 * Los movimientos que de verdad mueven la aguja.
 *
 * Cada uno lleva su ahorro CALCULADO con las tarifas reales y la cuenta
 * escrita debajo. Un consejo sin número es un consejo de folleto: aquí, o hay
 * cuenta, o el hueco del ahorro se queda vacío y sólo se explica el porqué.
 */
function ComoAhorrar() {
  const movs = comoAhorrar(28);
  if (!movs.length) return null;
  return (
    <section className="flex flex-col gap-4">
      <Seccion epigrafe="cómo gastar menos" tinte="var(--ahorro)"
               nota="Cada cifra está calculada con tus tokens y las tarifas publicadas — cuando no hay cuenta honesta que hacer, el hueco lo dice.">
        Movimientos de mayor impacto
      </Seccion>
      <Carta className="overflow-hidden">
        {movs.map((m) => (
          <div key={m.titulo} className="flex flex-wrap items-start gap-4 border-b px-5 py-4 last:border-0">
            <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-[5px]"
                  style={{ background: "color-mix(in oklab, var(--ahorro) 13%, transparent)",
                           color: "var(--ahorro)" }}>
              <svg viewBox="0 0 16 16" width="15" height="15" fill="none" stroke="currentColor"
                   strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M2 11.5 6 7l3 2.5L14 4" /><path d="M10.5 4H14v3.5" />
              </svg>
            </span>
            <span className="min-w-0 flex-1">
              <p className="text-[13.5px]">{m.titulo}</p>
              <p className="mt-1 text-[12px] leading-relaxed" style={{ color: "var(--texto-2)" }}>
                {m.porque}
              </p>
            </span>
            <span className="w-[140px] shrink-0 text-right">
              {m.ahorro !== null ? (
                <>
                  <p className="cifra text-[17px]" style={{ color: "var(--ahorro)" }}>{usd(m.ahorro)}</p>
                  <p className="rotulo mt-0.5">{m.unidad}</p>
                </>
              ) : (
                <p className="rotulo">sin cifra que poner</p>
              )}
            </span>
          </div>
        ))}
      </Carta>
    </section>
  );
}

/**
 * Lo que encontró el sueño anoche, arriba del todo: es el gancho.
 * El cielo lo pinta Constelacion — determinista, misma semilla, mismo cielo.
 */
function Anoche() {
  const { fecha, ideas } = suenoUltimo();
  if (!fecha || !ideas.length) return null;
  const visibles = ideas.slice(0, 6);
  return (
    <Link href="/sueno" className="carta-pulsable relative block overflow-hidden rounded-[6px] p-6"
          style={{
            "--tinte": "var(--sueno)",
            border: "1px solid color-mix(in oklab, var(--sueno) 26%, transparent)",
            background: "linear-gradient(120deg, color-mix(in oklab, var(--sueno) 11%, var(--carta)), var(--carta) 62%)",
          } as React.CSSProperties}>
      <Constelacion semilla={11} tinte="var(--sueno)" />
      <div className="relative">
        <div className="flex flex-wrap items-center gap-3">
          <p className="rotulo flex items-center gap-2" style={{ color: "var(--sueno)" }}>
            <span className="late"><i /></span>revisión del sueño · {fecha}
          </p>
          <Pastilla tono="sueno">{ideas.length} nuevas</Pastilla>
        </div>
        <p className="mt-3 text-[26px] font-light tracking-tight">
          Anoche encontré <b className="font-semibold">{ideas.length}</b>{" "}
          {ideas.length === 1 ? "idea que vale la pena ver" : "ideas que vale la pena ver"}.
        </p>
        <p className="mt-1.5 max-w-[640px] text-[12px] leading-relaxed" style={{ color: "var(--texto-2)" }}>
          Cada una sale de tus últimas 24 horas — sesiones, memoria y gasto reales.
          Léelas y decide cuáles pasan a acción.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {visibles.map((x) => (
            <span key={x.id} className="inline-flex items-center gap-2 rounded-[4px] px-2.5 py-1.5 text-[11.5px]"
                  style={{ background: "color-mix(in oklab, var(--sueno) 13%, transparent)",
                           color: "var(--texto-2)" }}>
              <span className="rotulo" style={{ color: "var(--sueno)", fontSize: 8.5 }}>{x.categoria}</span>
              {x.titulo.length > 64 ? x.titulo.slice(0, 64) + "…" : x.titulo}
            </span>
          ))}
          {ideas.length > visibles.length ? (
            <span className="rounded-[4px] px-2.5 py-1.5 text-[11.5px]"
                  style={{ border: "1px dashed color-mix(in oklab, var(--sueno) 35%, transparent)",
                           color: "var(--texto-3)" }}>
              y {ideas.length - visibles.length} más
            </span>
          ) : null}
        </div>
        <p className="rotulo mt-4" style={{ color: "var(--sueno)" }}>leerlas →</p>
      </div>
    </Link>
  );
}

/** Lo que se va a ejecutar sin que estés delante. */
function Relojes() {
  const tareas = programado();
  const cs = canales();
  if (!tareas.length && !cs.length) return null;
  return (
    <section className="flex flex-col gap-4">
      <Seccion epigrafe="lo que va a correr sin ti" tinte="var(--sueno)"
               meta="launchd y el cron de Hermes">
        {tareas.length} {tareas.length === 1 ? "tarea agendada" : "tareas agendadas"}
      </Seccion>
      <Carta className="overflow-hidden">
        {tareas.map((t) => (
          <div key={t.id} className="flex flex-wrap items-center gap-x-4 gap-y-1.5 border-b px-4 py-3 last:border-0">
            <span className="h-1.5 w-1.5 shrink-0 rounded-full"
                  style={{ background: t.activo ? "var(--sueno)" : "var(--texto-3)" }} />
            <span className="dato min-w-0 flex-1 truncate text-[12.5px]">{t.nombre}</span>
            <Insignia tono="sueno">{t.motor}</Insignia>
            <span className="dato w-[190px]" style={{ color: "var(--texto-3)" }}>
              {t.cuando ?? <SinDato motivo="la tarea no declara calendario ni intervalo legibles" />}
            </span>
            <span className="w-[70px] text-right">
              {t.activo
                ? <Pastilla tono="ahorro">activa</Pastilla>
                : <Pastilla tono="neutro">parada</Pastilla>}
            </span>
          </div>
        ))}
      </Carta>
      {cs.length ? (
        <p className="text-[11.5px] leading-relaxed" style={{ color: "var(--texto-3)" }}>
          Tus asistentes te escuchan por{" "}
          {cs.map((c) => `${c.canal} (${c.sesiones})`).join(" · ")}.
        </p>
      ) : null}
    </section>
  );
}

/** La salud de las fuentes, con su motivo cuando lo hay. */
function Estado() {
  const s = salud();
  return (
    <Carta className="overflow-hidden">
      <p className="rotulo border-b px-4 py-2.5">de dónde sale cada cosa</p>
      {s.map((f) => (
        <div key={f.fuente} className="flex flex-wrap items-baseline gap-x-4 gap-y-1 border-b px-4 py-2.5 last:border-0">
          <span className="late mt-1" style={{ color: f.error ? "var(--alerta)" : "var(--ahorro)" }}><i /></span>
          <span className="w-[110px] text-[12.5px]">{NOMBRE_FUENTE[f.fuente] ?? f.fuente}</span>
          <span className="dato w-[70px]" style={{ color: "var(--texto-3)" }}>{f.ms} ms</span>
          <span className="dato w-[90px]" style={{ color: "var(--texto-3)" }}>{num(f.filas)} filas</span>
          <span className="dato w-[80px]" style={{ color: "var(--texto-3)" }}>{hace(f.ultima_intento)}</span>
          {f.error || f.nota ? (
            <span className="min-w-0 flex-1 text-[11.5px] leading-snug"
                  style={{ color: f.error ? "var(--gasto)" : "var(--texto-3)" }}>
              {f.error || f.nota}
            </span>
          ) : null}
        </div>
      ))}
    </Carta>
  );
}

function SinBase() {
  return (
    <div className="flex min-h-dvh items-center justify-center p-8">
      <Carta className="max-w-[520px] p-6">
        <Seccion epigrafe="sin índice">El índice está vacío</Seccion>
        <p className="mt-3 text-[13.5px] leading-relaxed" style={{ color: "var(--texto-2)" }}>
          El lector todavía no ha hecho su primera pasada. Arráncalo y esta página se llena sola.
        </p>
        <pre className="dato mt-4 overflow-x-auto rounded-[4px] p-3"
             style={{ background: "var(--carta-alta)", color: "var(--texto-2)" }}>
{`make demo          # datos sintéticos
python3 lector/lector.py --bucle   # o tus datos`}
        </pre>
      </Carta>
    </div>
  );
}
