import "server-only";
import { filas } from "./base";

/**
 * Como `memoriaReciente` de la casa, pero con la ruta del archivo.
 * Hace falta porque hay títulos repetidos de verdad en la base (el mismo
 * `MEMORY.md` vive en varios proyectos de claude-mem): sin la ruta no hay
 * ni clave estable para React ni forma de distinguirlos en pantalla.
 */
export function memoriaRecienteConRuta(limite = 14) {
  return filas<{ titulo: string; sistema: string; dias_sin_tocar: number; ruta: string }>(`
    SELECT titulo, sistema, dias_sin_tocar, ruta FROM memoria
     WHERE dias_sin_tocar IS NOT NULL ORDER BY dias_sin_tocar ASC LIMIT ?`, limite);
}
