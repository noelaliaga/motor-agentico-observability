"use client";
import { useId, useState, type ReactNode } from "react";

/**
 * Las pestañas de un panel: «SUSCRIPCIONES | TOKENS · EQUIV. API».
 *
 * Es la única pieza de la portada que necesita estado, así que vive sola en
 * su archivo con "use client". Los paneles llegan ya renderizados desde el
 * servidor: aquí sólo se decide cuál se ve. Los ocultos se quedan montados
 * con `hidden` — cambiar de pestaña no vuelve a pedir nada.
 *
 * Accesible de serie: tablist/tab/tabpanel enlazados por id, flechas para
 * moverse entre pestañas y el foco visible que ya pinta globals.css.
 */
export function Pestanas({
  etiqueta, pestanas, derecha, inicial = 0,
}: {
  etiqueta: string;
  pestanas: { titulo: string; nota?: string; panel: ReactNode }[];
  derecha?: ReactNode;
  /** Qué pestaña abre por defecto. */
  inicial?: number;
}) {
  const [activa, setActiva] = useState(inicial);
  const base = useId();

  function alTeclado(e: React.KeyboardEvent) {
    const paso = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
    if (!paso) return;
    e.preventDefault();
    const sig = (activa + paso + pestanas.length) % pestanas.length;
    setActiva(sig);
    document.getElementById(`${base}-tab-${sig}`)?.focus();
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <div role="tablist" aria-label={etiqueta} onKeyDown={alTeclado}
             className="inline-flex gap-1 rounded-[5px] border p-1"
             style={{ background: "var(--carta)" }}>
          {pestanas.map((p, i) => {
            const viva = i === activa;
            return (
              <button
                key={p.titulo}
                id={`${base}-tab-${i}`}
                role="tab"
                aria-selected={viva}
                aria-controls={`${base}-panel-${i}`}
                tabIndex={viva ? 0 : -1}
                onClick={() => setActiva(i)}
                className="cursor-pointer rounded-[3px] px-3 py-2 font-mono text-[10px] uppercase tracking-[.14em] transition-colors duration-150"
                style={{
                  color: viva ? "var(--texto)" : "var(--texto-3)",
                  background: viva
                    ? "color-mix(in oklab, var(--ambar) 13%, var(--carta-alta))"
                    : "transparent",
                  border: viva
                    ? "1px solid color-mix(in oklab, var(--ambar) 30%, transparent)"
                    : "1px solid transparent",
                }}
              >
                {p.titulo}
                {p.nota ? (
                  <span className="ml-1.5" style={{ color: viva ? "var(--ambar)" : "var(--texto-3)" }}>
                    {p.nota}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
        {derecha ? <div className="ml-auto">{derecha}</div> : null}
      </div>
      {pestanas.map((p, i) => (
        <div key={p.titulo} id={`${base}-panel-${i}`} role="tabpanel"
             aria-labelledby={`${base}-tab-${i}`} hidden={i !== activa} className="mt-4">
          {p.panel}
        </div>
      ))}
    </div>
  );
}
