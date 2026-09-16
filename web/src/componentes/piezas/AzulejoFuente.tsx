import type { CSSProperties, ReactNode } from "react";
import { Azulejo } from "@/componentes/Piezas";
import { marcaDe, tinteDe } from "@/componentes/Marcas";

/**
 * El azulejo de una FUENTE del sueño.
 *
 * Las fuentes con marca real (Claude Code, Codex, Hermes, OpenClaw,
 * MULTIVERSO) llevan su logo y su tinte de Marcas.tsx, como en toda la casa.
 * Las fuentes internas del motor (memoria, inventario, cron, conexiones) no
 * tienen marca ajena: llevan un glifo propio en el trazo de la casa y el
 * color de SU sección (TONO_SECCION), que es su identidad real — inventarles
 * un logotipo de fantasía sería mentir igual que inventar un dato.
 */

const caja = {
  viewBox: "0 0 24 24", fill: "none" as const, stroke: "currentColor",
  strokeWidth: 1.4, strokeLinecap: "round" as const, strokeLinejoin: "round" as const,
  "aria-hidden": true as const,
};

/** Glifos y tintes de las fuentes sin marca ajena. */
const PROPIAS: Record<string, { tinte: string; glifo: ReactNode }> = {
  memoria: {
    tinte: "var(--ahorro)", // el verde de la sección Memoria
    glifo: (<>
      <rect x="5" y="5" width="14" height="14" rx="2.4" />
      <path d="M9 2.8v2.2M15 2.8v2.2M9 19v2.2M15 19v2.2M2.8 9h2.2M2.8 15h2.2M19 9h2.2M19 15h2.2" opacity=".55" />
      <circle cx="12" cy="12" r="2.6" />
    </>),
  },
  inventario: {
    tinte: "#5EEAD4", // el turquesa de la sección Inventario
    glifo: (<>
      <rect x="3.5" y="3.5" width="7.4" height="7.4" rx="1.4" />
      <rect x="13.1" y="3.5" width="7.4" height="7.4" rx="1.4" opacity=".55" />
      <rect x="3.5" y="13.1" width="7.4" height="7.4" rx="1.4" opacity=".55" />
      <rect x="13.1" y="13.1" width="7.4" height="7.4" rx="1.4" />
    </>),
  },
  cron: {
    tinte: "#38BDF8", // el azul de Actividad: lo programado en el tiempo
    glifo: (<>
      <circle cx="12" cy="12" r="8.6" />
      <path d="M12 7v5.4l3.4 2" />
    </>),
  },
  conexiones: {
    tinte: "var(--ambar)", // el ámbar de la sección Conexiones
    glifo: (<>
      <path d="M8.5 2.8v4.4M15.5 2.8v4.4M5.4 7.2h13.2v3.9a6.6 6.6 0 0 1-13.2 0V7.2ZM12 17.7V21.2" />
    </>),
  },
  openrouter: {
    tinte: "#CBD5E1", // OpenRouter es marca monocroma: hueso, no color falso
    glifo: (<>
      <path d="M3 8.2h4.2c2.4 0 3.6 3.8 6 3.8" opacity=".55" />
      <path d="M3 15.8h4.2c2.4 0 3.6-3.8 6-3.8h5" />
      <path d="M13.2 8.2H18.2" />
      <path d="m16.2 5.6 3.2 2.6-3.2 2.6M16.2 13.2l3.2 2.6-3.2 2.6" />
    </>),
  },
};

/** El tinte de una fuente — para el degradado de su Tarjeta. */
export function tinteFuente(fuente: string): string {
  return PROPIAS[fuente]?.tinte ?? tinteDe(fuente);
}

export function AzulejoFuente({
  fuente, tamano = 34, vivo = true,
}: { fuente: string; tamano?: number; vivo?: boolean }) {
  const propia = PROPIAS[fuente];
  if (!propia) {
    return <Azulejo marca={marcaDe(fuente)} tamano={tamano} vivo={vivo} />;
  }
  return (
    <span
      className="azulejo"
      data-vivo={vivo ? "si" : "no"}
      style={{
        width: tamano, height: tamano, borderRadius: Math.round(tamano * 0.24),
        "--tinte": propia.tinte,
        color: vivo ? propia.tinte : "var(--texto-3)",
      } as CSSProperties}
    >
      <svg {...caja} width={Math.round(tamano * 0.52)} height={Math.round(tamano * 0.52)}>
        {propia.glifo}
      </svg>
    </span>
  );
}
