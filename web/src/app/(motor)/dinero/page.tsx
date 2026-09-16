import { Cabecera } from "@/componentes/Cabecera";
import { Carta, Seccion, Cifra, Barra, usd, tok, num } from "@/componentes/Piezas";
import { MARCAS, marcaDe, NOMBRE_FUENTE } from "@/componentes/Marcas";
import {
  porModelo, totalUsd, porDia, porProyecto, porFuente,
  cacheResumen, sinCache, suscripciones, gastoReal, rango, type Ventana,
} from "@/lib/consultas";
import { filas } from "@/lib/base";
import Link from "next/link";

export const dynamic = "force-dynamic";

const VENTANAS: { v: Ventana; t: string }[] = [
  { v: 1, t: "hoy" }, { v: 7, t: "7 días" }, { v: 28, t: "28 días" }, { v: 3650, t: "todo" },
];

export default async function Dinero({
  searchParams,
}: { searchParams: Promise<{ v?: string }> }) {
  const sp = await searchParams;
  const V = (Number(sp.v) || 28) as Ventana;

  const total = totalUsd(V);
  const modelos = porModelo(V).filter((m) => m.turnos > 0);
  const dias = porDia(V);
  const proyectos = porProyecto(V);
  const fuentes = porFuente(V);
  const cache = cacheResumen(V);
  const bruto = sinCache(V);
  const subs = suscripciones();
  const real = gastoReal();
  const r = rango();

  const cuotaMes = subs.reduce((s, x) => s + x.usd_mes, 0);
  const diasDato = Math.min(V, r?.dias || V);
  const cuota = (cuotaMes * diasDato) / 30.44;
  const roi = cuota > 0 ? total / cuota : null;
  const maxDia = Math.max(...dias.map((d) => d.usd), 0.01);
  const maxProy = Math.max(...proyectos.map((p) => p.usd), 0.01);

  // Las tarifas con las que se ha valorado todo, para poder auditarlas.
  const tarifas = filas<{
    modelo: string; desde: string; hasta: string | null;
    usd_entrada: number; usd_salida: number; procedencia: string; consultado_en: string;
  }>(`SELECT * FROM tarifas WHERE modelo IN (SELECT DISTINCT modelo FROM uso)
         OR modelo LIKE '%⚡' ORDER BY usd_salida DESC, modelo`);

  return (
    <>
      <Cabecera ruta="dinero" />
      <div className="flex flex-col gap-8 px-6 py-7">

        <div className="flex flex-wrap items-center justify-between gap-4">
          <Seccion epigrafe="lo que llevas gastado" tinte="var(--gasto)">El odómetro</Seccion>
          <div className="flex gap-1">
            {VENTANAS.map((w) => (
              <Link key={w.v} href={`/dinero?v=${w.v}`}
                    className="rotulo rounded-[3px] px-2.5 py-1.5 transition-colors"
                    style={w.v === V
                      ? { background: "var(--gasto)", color: "#100C02" }
                      : { background: "var(--carta)", border: "1px solid var(--borde)" }}>
                {w.t}
              </Link>
            ))}
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-4">
          <Carta className="p-5"><Cifra rotulo="equivalente en api" valor={usd(total)} tono="gasto" tamano={32}
                 nota={`${diasDato} días · ${num(modelos.reduce((s, m) => s + m.turnos, 0))} turnos`} /></Carta>
          <Carta className="p-5"><Cifra rotulo="lo que pagas" valor={usd(cuota)} tamano={32}
                 nota={`${usd(cuotaMes, 0)}/mes prorrateado a la ventana`} /></Carta>
          <Carta className="p-5"><Cifra rotulo="roi" tono="ahorro" tamano={32}
                 valor={roi ? `×${roi.toLocaleString("es-ES", { maximumFractionDigits: 1 })}` : "—"}
                 nota="lo que sacas por cada euro de cuota" /></Carta>
          <Carta className="p-5"><Cifra rotulo="dinero real" valor={usd(real.reduce((s, x) => Math.max(s, x.usd), 0))}
                 tono="alerta" tamano={32} nota="OpenRouter · facturado de verdad" /></Carta>
        </div>

        {/* ── por día ────────────────────────────────────────────────── */}
        <section className="flex flex-col gap-3">
          <Seccion epigrafe="el gasto, día a día" tinte="var(--gasto)">Por día</Seccion>
          <Carta marco rejilla className="p-5">
            <div className="flex h-40 items-end gap-[3px]">
              {dias.map((d) => (
                <span key={d.dia} className="flex-1 rounded-t-[2px]" title={`${d.dia} · ${usd(d.usd)} · ${d.turnos} turnos`}
                      style={{
                        height: `${Math.max(2, (d.usd / maxDia) * 100)}%`,
                        background: d.usd > maxDia * 0.6 ? "var(--gasto)"
                                  : d.usd > maxDia * 0.25 ? "color-mix(in oklab, var(--gasto) 65%, transparent)"
                                  : "color-mix(in oklab, var(--gasto) 32%, transparent)",
                      }} />
              ))}
            </div>
            <div className="mt-3 flex justify-between">
              <span className="rotulo">{dias[0]?.dia}</span>
              <span className="rotulo">pasa el ratón por encima de cada barra</span>
              <span className="rotulo">{dias.at(-1)?.dia}</span>
            </div>
          </Carta>
        </section>

        {/* ── por modelo ─────────────────────────────────────────────── */}
        <section className="flex flex-col gap-3">
          <Seccion epigrafe="quién se lleva el dinero" tinte="var(--gasto)">Por modelo</Seccion>
          <Carta className="overflow-hidden">
            {modelos.map((m) => {
              const Marca = MARCAS[marcaDe(m.modelo)];
              const parte = total ? (m.usd ?? 0) / total : 0;
              const sinTarifa = m.sin_tarifa > 0 && !m.usd;
              return (
                <div key={m.modelo + m.velocidad} className="flex flex-wrap items-center gap-x-5 gap-y-2 border-b px-4 py-3 last:border-0">
                  <span style={{ color: "var(--texto-2)" }}><Marca size={17} /></span>
                  <span className="w-[180px] text-[13px]">{m.modelo}</span>
                  {m.velocidad === "fast" ? <span className="rotulo" style={{ color: "var(--gasto)" }}>rápido ·2×</span> : null}
                  <span className="dato w-[92px]" style={{ color: "var(--texto-3)" }}>{num(m.turnos)} turnos</span>
                  <span className="dato w-[92px]" style={{ color: "var(--texto-3)" }}>{tok(m.salida)} salida</span>
                  <span className="dato w-[100px]" style={{ color: "var(--texto-3)" }}>{tok(m.cache_lee)} caché</span>
                  <span className="min-w-[120px] flex-1"><Barra parte={parte} /></span>
                  <span className="cifra w-[110px] text-right text-[16px]"
                        style={{ color: sinTarifa ? "var(--texto-3)" : "var(--texto)" }}>
                    {sinTarifa ? "sin tarifa" : usd(m.usd)}
                  </span>
                </div>
              );
            })}
          </Carta>
        </section>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* ── por proyecto ─────────────────────────────────────────── */}
          <section className="flex flex-col gap-3">
            <Seccion epigrafe="en qué se ha ido" tinte="var(--gasto)">Por proyecto</Seccion>
            <Carta className="overflow-hidden">
              {proyectos.map((p) => (
                <div key={p.proyecto} className="border-b px-4 py-3 last:border-0">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="truncate text-[13px]">{p.proyecto}</span>
                    <span className="cifra text-[14px]">{usd(p.usd)}</span>
                  </div>
                  <Barra parte={p.usd / maxProy} />
                  <p className="rotulo mt-1.5">{num(p.turnos)} turnos · {p.sesiones} sesiones</p>
                </div>
              ))}
            </Carta>
          </section>

          {/* ── la caché ─────────────────────────────────────────────── */}
          <section className="flex flex-col gap-3">
            <Seccion epigrafe="lo que no has pagado dos veces" tinte="var(--gasto)">Lo que hace la caché</Seccion>
            <Carta className="p-5">
              <Cifra rotulo="ahorrado" valor={usd(bruto - total)} tono="ahorro" tamano={30}
                     nota={`sin caché, lo mismo habría costado ${usd(bruto)}`} />
              <Barra parte={bruto ? (bruto - total) / bruto : 0} color="var(--ahorro)" />
              <div className="mt-5 flex flex-col gap-2.5 border-t pt-4">
                {[
                  ["leída · se paga a 0,1×", cache?.lee, "var(--ahorro)"],
                  ["escrita 5 min · 1,25×", cache?.w5m, "var(--texto-2)"],
                  ["escrita 1 hora · 2×", cache?.w1h, "var(--gasto)"],
                  ["entrada sin cachear · 1×", cache?.entrada, "var(--texto-2)"],
                  ["salida", cache?.salida, "var(--texto-2)"],
                ].map(([r, v, c]) => (
                  <div key={String(r)} className="flex items-baseline justify-between gap-3">
                    <span className="text-[12px]" style={{ color: "var(--texto-2)" }}>{String(r)}</span>
                    <span className="dato" style={{ color: String(c) }}>{tok(Number(v))}</span>
                  </div>
                ))}
              </div>
            </Carta>
          </section>
        </div>

        {/* ── por fuente ─────────────────────────────────────────────── */}
        <section className="flex flex-col gap-3">
          <Seccion epigrafe="reparto por máquina" tinte="var(--gasto)">Por herramienta</Seccion>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {fuentes.map((f) => (
              <Carta key={f.fuente} className="p-4">
                <p className="text-[13px]">{NOMBRE_FUENTE[f.fuente] ?? f.fuente}</p>
                <p className="cifra mt-2 text-[22px]">{usd(f.usd)}</p>
                <p className="rotulo mt-1">{num(f.turnos)} turnos</p>
              </Carta>
            ))}
            <Carta className="p-4">
              <p className="text-[13px]">Hermes · OpenClaw</p>
              <p className="cifra mt-2 text-[22px]" style={{ color: "var(--texto-3)" }}>sin dato</p>
              <p className="mt-1 text-[10.5px] leading-snug" style={{ color: "var(--texto-3)" }}>
                no registran tokens. Su gasto está dentro del total real de OpenRouter
              </p>
            </Carta>
          </div>
        </section>

        {/* ── las tarifas, auditables ────────────────────────────────── */}
        <section className="flex flex-col gap-3">
          <Seccion epigrafe="las tarifas, a la vista" tinte="var(--gasto)">Con qué precios se ha calculado</Seccion>
          <Carta className="overflow-x-auto">
            <table className="w-full min-w-[720px]">
              <thead>
                <tr className="border-b">
                  {["modelo", "vigencia", "entrada $/M", "salida $/M", "de dónde sale"].map((h) => (
                    <th key={h} className="rotulo px-4 py-2.5 text-left font-normal">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {tarifas.map((t) => (
                  <tr key={t.modelo + t.desde} className="border-b last:border-0">
                    <td className="px-4 py-2 text-[12.5px]">{t.modelo}</td>
                    <td className="dato px-4 py-2" style={{ color: "var(--texto-3)" }}>
                      {t.desde} → {t.hasta ?? "vigente"}
                    </td>
                    <td className="dato px-4 py-2">{t.usd_entrada}</td>
                    <td className="dato px-4 py-2">{t.usd_salida}</td>
                    <td className="px-4 py-2 text-[11px]" style={{ color: "var(--texto-3)" }}>
                      {t.procedencia} · {t.consultado_en}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Carta>
          <p className="text-[11.5px] leading-relaxed" style={{ color: "var(--texto-3)" }}>
            Los tokens se guardan crudos y el dinero se calcula al leer contra esta tabla.
            Por eso el precio de lanzamiento de Sonnet 5 puede caducar el 31 de agosto sin
            que se estropee ni una cifra de julio.
          </p>
        </section>
      </div>
    </>
  );
}
