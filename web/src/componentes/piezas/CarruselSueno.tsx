"use client";

/**
 * El carrusel de hallazgos del sueño.
 *
 * Un hallazgo por pantalla, entero: emblema de su categoría a la izquierda,
 * gancho, titular, cuerpo, la evidencia que lo sostiene y — si lo trae — el
 * prompt corregido con su botón de copiar. Flechas, puntos y «Saltar».
 *
 * «Saltar» sólo AVANZA. La base es de sólo lectura por contrato, así que aquí
 * no hay un descartar que persista: prometer un descarte que se olvida al
 * recargar sería mentir, y en esta casa no se miente.
 *
 * Es el único trozo cliente de la página: navegación, teclado y portapapeles.
 */

import { useRef, useState, type KeyboardEvent } from "react";
import { Tarjeta, Insignia } from "@/componentes/Piezas";
import { COLOR_CATEGORIA } from "@/componentes/Helice";
import { EmblemaSueno } from "./EmblemaSueno";

/** «2026-08-23» → «23 ago» — la fecha completa queda en el title. */
function fechaCorta(iso: string): string {
  const f = new Date(iso + "T00:00:00Z");
  if (Number.isNaN(f.getTime())) return iso;
  return new Intl.DateTimeFormat("es-ES", {
    day: "numeric", month: "short", timeZone: "UTC",
  }).format(f);
}

export type HallazgoSueno = {
  id: number;
  fecha: string;
  categoria: string;
  titulo: string;
  cuerpo: string;
  evidencia: string[];
  accion: string | null;
  estado: string;
  gancho: string | null;
};

export function CarruselSueno({ ideas }: { ideas: HallazgoSueno[] }) {
  const [indice, setIndice] = useState(0);
  const total = ideas.length;
  const ir = (i: number) => setIndice(((i % total) + total) % total);

  const teclas = (e: KeyboardEvent) => {
    if (e.target !== e.currentTarget) return;
    if (e.key === "ArrowRight") { e.preventDefault(); ir(indice + 1); }
    if (e.key === "ArrowLeft") { e.preventDefault(); ir(indice - 1); }
  };

  const s = ideas[indice];
  const color = COLOR_CATEGORIA[s.categoria] ?? "var(--sueno)";

  return (
    <section
      role="group" aria-roledescription="carrusel" aria-label="hallazgos del sueño"
      tabIndex={0} onKeyDown={teclas} className="outline-offset-4"
    >
      <Tarjeta tinte={color} marco className="relative overflow-hidden">

        {/* ── el hallazgo ─────────────────────────────────────────────── */}
        <div key={s.id}
             className="sueno-anima grid gap-7 p-6 md:min-h-[400px] md:grid-cols-[236px_minmax(0,1fr)] md:p-8">

          {/* el emblema y la firma del hallazgo */}
          <div className="flex flex-row items-center gap-5 md:flex-col md:items-start md:justify-between">
            <EmblemaSueno categoria={s.categoria} color={color} tamano={212}
                          className="shrink-0 max-md:!h-[108px] max-md:!w-[108px]" />
            <div>
              <p className="rotulo">hallazgo nocturno</p>
              {s.gancho ? (
                <p className="mt-1 text-[13.5px] font-medium" style={{ color: "var(--texto)" }}>
                  {s.gancho}
                </p>
              ) : null}
            </div>
          </div>

          {/* el contenido */}
          <div className="flex min-w-0 flex-col">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
              <Insignia color={color}>{s.categoria}</Insignia>
              <span className="cifra text-[11px]" style={{ color: "var(--texto-3)" }}>
                {indice + 1} / {total}
              </span>
              {/* `resuelta` la marca el sueño cuando la condición deja de cumplirse; no
                  significa que alguien aplicara la sugerencia. Se dice tal cual. */}
              {s.estado === "resuelta" ? <Insignia tono="neutro" title="la condición que la disparó ya no se cumple; no implica que se aplicara">ya no se cumple</Insignia> : null}
              <span className="dato ml-auto" title={s.fecha}
                    style={{ color: "var(--texto-3)" }}>{fechaCorta(s.fecha)}</span>
            </div>

            {s.gancho ? (
              <p className="rotulo mt-5" style={{ color, letterSpacing: ".2em" }}>
                {s.gancho}
              </p>
            ) : null}

            <h2 className="mt-2 max-w-[640px] text-[21px] font-medium leading-snug tracking-tight">
              {s.titulo}
            </h2>

            <p className="mt-3 max-w-[640px] text-[13.5px] leading-relaxed"
               style={{ color: "var(--texto-2)" }}>
              {s.cuerpo}
            </p>

            {/* la evidencia: por qué te lo sugerimos */}
            <div className="mt-5 rounded-[4px] border-l-2 py-1 pl-4"
                 style={{ borderColor: `color-mix(in oklab, ${color} 55%, transparent)` }}>
              <p className="rotulo">por qué te lo sugerimos</p>
              {s.evidencia.length ? (
                <ul className="mt-2 flex flex-col gap-1.5">
                  {s.evidencia.map((e) => (
                    <li key={e} className="flex gap-2.5 text-[12.5px] leading-relaxed"
                        style={{ color: "var(--texto-2)" }}>
                      <span aria-hidden="true" className="mt-[7px] h-1 w-1 shrink-0 rounded-full"
                            style={{ background: color }} />
                      {e}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-[12.5px] italic" style={{ color: "var(--texto-3)" }}>
                  sin evidencia guardada
                </p>
              )}
            </div>

            {/* el prompt corregido, si lo hay: se copia de verdad */}
            {s.accion ? (
              <div className="mt-5 rounded-[4px] border"
                   style={{ background: "var(--carta-alta)" }}>
                <div className="flex items-center justify-between gap-3 border-b px-3 py-2">
                  <p className="rotulo">prompt corregido · listo para usar</p>
                  <BotonCopiar texto={s.accion} />
                </div>
                <pre className="dato overflow-x-auto whitespace-pre-wrap p-3 leading-relaxed"
                     style={{ color: "var(--texto-2)" }}>{s.accion}</pre>
              </div>
            ) : null}
          </div>
        </div>

        {/* ── la botonera ─────────────────────────────────────────────── */}
        <div className="flex items-center gap-4 border-t px-6 py-3.5 md:px-8">
          <div className="flex items-center gap-1.5">
            <Flecha rumbo="atras" onClick={() => ir(indice - 1)} />
            <Flecha rumbo="delante" onClick={() => ir(indice + 1)} />
          </div>

          <div className="flex items-center gap-[7px]" role="tablist" aria-label="ir a un hallazgo">
            {ideas.map((x, i) => (
              <button key={x.id} type="button" onClick={() => ir(i)}
                      role="tab" aria-selected={i === indice}
                      aria-label={`hallazgo ${i + 1} de ${total}`}
                      className="flex items-center justify-center p-[5px]">
                <span aria-hidden="true"
                      className="block motion-safe:transition-all motion-safe:duration-200"
                      style={{
                        width: i === indice ? 18 : 6, height: 6, borderRadius: 999,
                        background: i === indice
                          ? color
                          : "color-mix(in oklab, var(--texto-3) 45%, transparent)",
                      }} />
              </button>
            ))}
          </div>

          <button type="button" onClick={() => ir(indice + 1)}
                  title="pasa al siguiente — no borra nada: la base es de sólo lectura"
                  className="rotulo ml-auto flex items-center gap-2 rounded-[3px] border px-3 py-2 motion-safe:transition-colors hover:border-[var(--borde-vivo)] hover:text-[var(--texto-2)]">
            <svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor"
                 strokeWidth="1.4" strokeLinecap="round" aria-hidden="true">
              <circle cx="8" cy="8" r="6.4" />
              <path d="M6 6l4 4M10 6l-4 4" />
            </svg>
            saltar
          </button>
        </div>
      </Tarjeta>

      <style>{`
        @keyframes sueno-entra {
          from { opacity: 0; transform: translateY(7px); }
          to   { opacity: 1; transform: none; }
        }
        .sueno-anima { animation: sueno-entra .22s cubic-bezier(0.23, 1, 0.32, 1) both; }
        @media (prefers-reduced-motion: reduce) { .sueno-anima { animation: none; } }
      `}</style>
    </section>
  );
}

function Flecha({ rumbo, onClick }: { rumbo: "atras" | "delante"; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick}
            aria-label={rumbo === "atras" ? "hallazgo anterior" : "hallazgo siguiente"}
            className="flex h-9 w-9 items-center justify-center rounded-[4px] border motion-safe:transition-colors hover:border-[var(--borde-vivo)]"
            style={{ color: "var(--texto-2)" }}>
      <svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor"
           strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        {rumbo === "atras" ? <path d="M10 3 5 8l5 5" /> : <path d="m6 3 5 5-5 5" />}
      </svg>
    </button>
  );
}

/** Copiar con confirmación visible. Si el portapapeles falla, se dice. */
function BotonCopiar({ texto }: { texto: string }) {
  const [estado, setEstado] = useState<"quieto" | "hecho" | "fallo">("quieto");
  const reloj = useRef<ReturnType<typeof setTimeout> | null>(null);

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(texto);
      setEstado("hecho");
    } catch {
      setEstado("fallo");
    }
    if (reloj.current) clearTimeout(reloj.current);
    reloj.current = setTimeout(() => setEstado("quieto"), 1800);
  };

  return (
    <button type="button" onClick={copiar} aria-live="polite"
            className="rotulo flex items-center gap-1.5 rounded-[3px] border px-2.5 py-1.5 motion-safe:transition-colors hover:border-[var(--borde-vivo)]"
            style={estado === "hecho" ? { color: "var(--ahorro)", borderColor: "color-mix(in oklab, var(--ahorro) 45%, transparent)" }
                 : estado === "fallo" ? { color: "var(--alerta)" } : undefined}>
      {estado === "hecho" ? (
        <svg viewBox="0 0 16 16" width="11" height="11" fill="none" stroke="currentColor"
             strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="m3 8.5 3.2 3.2L13 4.9" />
        </svg>
      ) : (
        <svg viewBox="0 0 16 16" width="11" height="11" fill="none" stroke="currentColor"
             strokeWidth="1.3" strokeLinejoin="round" aria-hidden="true">
          <rect x="5.5" y="5.5" width="8" height="8" rx="1.4" />
          <path d="M10.5 5.5v-2a1 1 0 0 0-1-1h-6a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2" />
        </svg>
      )}
      {estado === "hecho" ? "copiado" : estado === "fallo" ? "no se pudo copiar" : "copiar"}
    </button>
  );
}
