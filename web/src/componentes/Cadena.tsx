"use client";

import { useMemo, useState } from "react";

/* ─────────────────────────────────────────────────────────────────────────
   La cadena de la memoria.

   Una doble hélice horizontal donde CADA PAR DE BASES ES UN ARCHIVO de tu
   sistema de memoria, ordenados por frescura: lo que tocaste hoy a la
   izquierda, lo que lleva meses congelado a la derecha.

   No es una metáfora bonita puesta encima de los datos — es la lectura. De un
   vistazo ves dónde deja de ser verde tu memoria y empieza a ser ámbar, que es
   justo el punto donde la IA empieza a trabajar con contexto caducado.

   Dibujada entera en SVG y sin simulación: no hay fuerzas, no hay fotogramas,
   no hay nada que pueda volverse inestable. La posición de cada archivo es su
   sitio en la cadena, y no se mueve.
   ───────────────────────────────────────────────────────────────────────── */

export type Base = {
  ruta: string; titulo: string; sistema: string; tipo: string; dias: number; grado: number;
};

const RANCIO = 10;
const mm = (n: number) => Math.round(n * 100) / 100;

/** Verde cuando está fresca, ámbar cuando envejece, roja cuando ya no sirve. */
function tono(dias: number): string {
  if (dias <= 2) return "#34D399";
  if (dias <= RANCIO) return "#22D3EE";
  if (dias <= 30) return "#FBBF24";
  return "#FB7185";
}

export function Cadena({ bases }: { bases: Base[] }) {
  const [sobre, setSobre] = useState<number | null>(null);
  const [sistema, setSistema] = useState<string | null>(null);

  const sistemas = useMemo(
    () => [...new Set(bases.map((b) => b.sistema))].sort(),
    [bases],
  );
  const vis = useMemo(
    () => bases.filter((b) => !sistema || b.sistema === sistema),
    [bases, sistema],
  );

  const ANCHO = 1180, ALTO = 260, MARGEN = 26;
  const cy = ALTO / 2;
  const amp = 74;
  const n = Math.max(1, vis.length);
  const util = ANCHO - MARGEN * 2;
  // Las vueltas se ajustan al número de bases para que la cadena siempre
  // llene el ancho con el mismo ritmo, tenga 12 archivos o 138.
  const VUELTAS = Math.max(3, Math.min(9, Math.round(n / 16)));

  const punto = (i: number, hebra: 0 | 1) => {
    const t = n === 1 ? 0.5 : i / (n - 1);
    const a = t * Math.PI * 2 * VUELTAS + hebra * Math.PI;
    return { x: mm(MARGEN + t * util), y: mm(cy + Math.sin(a) * amp), z: Math.cos(a) };
  };

  const hebra = (h: 0 | 1) => {
    const PASOS = 420;
    return Array.from({ length: PASOS + 1 }, (_, k) => {
      const t = k / PASOS;
      const a = t * Math.PI * 2 * VUELTAS + h * Math.PI;
      return `${k ? "L" : "M"}${mm(MARGEN + t * util)} ${mm(cy + Math.sin(a) * amp)}`;
    }).join(" ");
  };

  const foco = sobre !== null ? vis[sobre] : null;
  const rancios = vis.filter((b) => b.dias > RANCIO).length;

  return (
    <div className="flex flex-col gap-3">
      {/* ── filtro por sistema ─────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2">
        <button onClick={() => { setSistema(null); setSobre(null); }}
                className="pildora" data-activa={sistema === null ? "si" : "no"}>
          <span className="h-2 w-2 rounded-full" style={{ background: "var(--texto-3)" }} />
          todas <span style={{ color: "var(--texto-3)" }}>{bases.length}</span>
        </button>
        {sistemas.map((s) => {
          const cuantos = bases.filter((b) => b.sistema === s).length;
          return (
            <button key={s} onClick={() => { setSistema(s); setSobre(null); }}
                    className="pildora" data-activa={sistema === s ? "si" : "no"}>
              <span className="h-2 w-2 rounded-full" style={{ background: "var(--ambar)" }} />
              {s} <span style={{ color: "var(--texto-3)" }}>{cuantos}</span>
            </button>
          );
        })}
      </div>

      <div className="relative overflow-hidden rounded-[6px]"
           style={{
             background: "radial-gradient(130% 100% at 22% 50%, #08131a 0%, #04070A 68%)",
             border: "1px solid var(--borde)",
           }}>
        <svg viewBox={`0 0 ${ANCHO} ${ALTO}`} className="block w-full"
             style={{ height: 260 }} onMouseLeave={() => setSobre(null)}>
          <defs>
            <filter id="brillo" x="-60%" y="-60%" width="220%" height="220%">
              <feGaussianBlur stdDeviation="3.4" result="b" />
              <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
          </defs>

          {/* la hebra de detrás, apagada */}
          <path d={hebra(1)} fill="none" stroke="#5B7A8C" strokeWidth="1.2" opacity=".3" />

          {/* los travesaños: un archivo cada uno */}
          {vis.map((b, i) => {
            const a = punto(i, 0), z = punto(i, 1);
            const abierto = 1 - Math.abs(a.z);
            const activo = sobre === i;
            return (
              <line key={b.ruta} x1={a.x} y1={a.y} x2={z.x} y2={z.y}
                    stroke={tono(b.dias)} strokeLinecap="round"
                    strokeWidth={activo ? 3 : 1.3}
                    opacity={mm((activo ? 1 : 0.5) * (0.28 + abierto * 0.72))} />
            );
          })}

          {/* la de delante, entera */}
          <path d={hebra(0)} fill="none" stroke="#9FC7D8" strokeWidth="1.7" opacity=".62" />

          {/* los nucleótidos */}
          {vis.map((b, i) => {
            const a = punto(i, 0), z = punto(i, 1);
            const activo = sobre === i;
            const col = tono(b.dias);
            const r = 2.2 + Math.min(3.4, Math.sqrt(b.grado) * 1.15);
            return (
              <g key={b.ruta} onMouseEnter={() => setSobre(i)} style={{ cursor: "crosshair" }}>
                {/* zona de agarre generosa: los travesaños son finos */}
                <rect x={a.x - 5} y={0} width={10} height={ALTO} fill="transparent" />
                <circle cx={a.x} cy={a.y} r={activo ? r + 2.2 : r}
                        fill={col} opacity={activo ? 1 : 0.9}
                        filter={activo || b.grado > 6 ? "url(#brillo)" : undefined} />
                <circle cx={z.x} cy={z.y} r={activo ? r * 0.9 : r * 0.62}
                        fill={col} opacity={activo ? 0.8 : 0.42} />
              </g>
            );
          })}
        </svg>

        {/* el eje: de lo de hoy a lo congelado */}
        <div className="pointer-events-none absolute inset-x-0 bottom-2.5 flex justify-between px-6">
          <span className="rotulo">tocado hoy</span>
          <span className="rotulo" style={{ color: "var(--texto-3)" }}>
            {vis.length} archivos · {rancios} rancios
          </span>
          <span className="rotulo">congelado</span>
        </div>

        {/* la ficha del archivo bajo el cursor */}
        <div className="pointer-events-none absolute left-5 top-4 max-w-[420px]">
          {foco ? (
            <>
              <p className="text-[14px]" style={{ color: tono(foco.dias) }}>{foco.titulo}</p>
              <p className="dato mt-1 text-[11px]" style={{ color: "var(--texto-3)" }}>
                {foco.sistema} · {foco.tipo} · {foco.grado}{" "}
                {foco.grado === 1 ? "enlace" : "enlaces"} ·{" "}
                {foco.dias === 0 ? "tocado hoy"
                  : `hace ${foco.dias} ${foco.dias === 1 ? "día" : "días"}`}
              </p>
            </>
          ) : (
            <p className="rotulo">pasa el cursor por la cadena</p>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
        {[["#34D399", "hoy o ayer"], ["#22D3EE", "esta semana"],
          ["#FBBF24", "más de 10 días"], ["#FB7185", "más de un mes"]].map(([c, t]) => (
          <span key={t} className="rotulo flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full" style={{ background: c }} />{t}
          </span>
        ))}
        <span className="rotulo ml-auto">el grosor del nucleótido es cuántas notas le apuntan</span>
      </div>
    </div>
  );
}
