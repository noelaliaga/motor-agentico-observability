import type { ReactNode } from "react";
import { Insignia } from "../Piezas";
import { Heroe } from "./Heroe";

/**
 * El héroe de las páginas de catálogo (skills, inventario, actividad).
 *
 * Composición fija sobre el Heroe genérico: epígrafe pequeño con la insignia
 * del color de sección, titular con la cifra en blanco y el resto en gris, y
 * un párrafo de dos líneas que dice qué es esta pantalla. Es la jerarquía
 * tranquila de la referencia — nada grita, todo va en orden de lectura.
 */
export function HeroeCatalogo({
  tinte, semilla, insignia, meta, cifra, resto, children, extra,
}: {
  tinte: string; semilla: number; insignia: ReactNode; meta?: ReactNode;
  cifra: ReactNode; resto: string; children?: ReactNode; extra?: ReactNode;
}) {
  return (
    <Heroe tinte={tinte} semilla={semilla} estrellas={90}>
      <div className="flex flex-col gap-3 px-7 py-8">
        <div className="flex flex-wrap items-center gap-2.5">
          <Insignia color={tinte}>{insignia}</Insignia>
          {meta ? <span className="rotulo">{meta}</span> : null}
        </div>
        <h1 className="titular max-w-[680px]">
          <b>{cifra}</b> <span>{resto}</span>
        </h1>
        {children ? (
          <p className="max-w-[580px] text-[13px] leading-relaxed" style={{ color: "var(--texto-2)" }}>
            {children}
          </p>
        ) : null}
        {extra ? <div className="mt-1 flex flex-wrap items-center gap-2">{extra}</div> : null}
      </div>
    </Heroe>
  );
}
