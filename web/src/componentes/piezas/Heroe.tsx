import type { ReactNode, CSSProperties } from "react";
import { Tarjeta } from "../Piezas";
import { Constelacion } from "../Constelacion";

/**
 * El héroe de sección: la tarjeta que preside una pantalla, con el campo de
 * estrellas detrás y los corchetes de esquina teñidos del color de la sección.
 *
 * Vive en su propio archivo porque Piezas.tsx es de otro agente; cuando el
 * sistema se asiente, puede mudarse allí. Es un componente de servidor puro:
 * la Constelación es SVG determinista y el resto es maquetación.
 *
 * `tinte` tiñe tres cosas y sólo tres: la bruma del cielo, el borde de la
 * tarjeta y los corchetes de las esquinas (redefiniendo --ambar SOLO dentro
 * de esta tarjeta). El texto de dentro sigue siendo el de la casa.
 */
export function Heroe({
  tinte, semilla = 7, estrellas = 110, className = "", children,
}: {
  tinte: string; semilla?: number; estrellas?: number;
  className?: string; children: ReactNode;
}) {
  return (
    <div style={{ "--ambar": tinte } as CSSProperties}>
      <Tarjeta marco tinte={tinte} className={`relative overflow-hidden ${className}`}>
        <Constelacion semilla={semilla} tinte={tinte} estrellas={estrellas} />
        <div className="relative">{children}</div>
      </Tarjeta>
    </div>
  );
}
