import { Insignia } from "../Piezas";

/**
 * El color de cada ámbito del inventario.
 *
 * Un ámbito se repite en cientos de filas; su insignia lleva el borde de su
 * color para que el ojo agrupe sin leer. Son tonos ya presentes en la
 * interfaz (el dorado es el de Hermes): nada de paleta nueva.
 */
export const TONO_AMBITO: Record<string, string> = {
  proyecto: "#38BDF8",
  global: "#93A3B0",
  hermes: "#F5B301",
  openclaw: "#FB7185",
  multiverso: "#5EEAD4",
};

export const NOMBRE_AMBITO: Record<string, string> = {
  proyecto: "Proyecto", global: "Global", hermes: "Hermes",
  openclaw: "OpenClaw", multiverso: "Multiverso",
};

export function tonoAmbito(ambito: string): string {
  return TONO_AMBITO[ambito] ?? "var(--texto-3)";
}

/** La insignia de categoría con el borde de su color, como en la referencia. */
export function InsigniaAmbito({ ambito }: { ambito: string }) {
  return <Insignia color={tonoAmbito(ambito)}>{NOMBRE_AMBITO[ambito] ?? ambito}</Insignia>;
}
