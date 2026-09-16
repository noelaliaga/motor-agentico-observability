import "server-only";
import { filas, fila, COSTE, TARIFA_JOIN } from "./base";
import type { Ventana } from "./consultas";

/**
 * Las lecturas propias de la pantalla de actividad.
 *
 * Viven aparte porque consultas.ts es de otro dueño. Dos diferencias de
 * fondo con lo que ya había:
 *
 * - El orden es POR RECIENTE, no por coste. La pregunta de la pantalla es
 *   «qué estabas haciendo», y eso se responde con la última sesión arriba.
 * - El coste NO se coalesce a cero. Una fuente sin tarifa conocida devuelve
 *   `null` y en pantalla se dice «sin dato»; un cero aquí sería un número
 *   que parece medido y no lo es.
 */

function desde(dias: Ventana): string {
  return `-${dias} days`;
}

export function resumenActividad(dias: Ventana) {
  return fila<{ sesiones: number; turnos: number; proyectos: number }>(`
    SELECT COUNT(DISTINCT sesion) sesiones, COUNT(*) turnos,
           COUNT(DISTINCT proyecto) proyectos
      FROM uso
     WHERE datetime(ts) >= datetime('now', ?) AND sesion IS NOT NULL`, desde(dias));
}

export type SesionReciente = {
  id: string; fuente: string; proyecto: string | null; titulo: string | null;
  inicio: string; fin: string; turnos: number;
  usd: number | null; sin_tarifa: number; modelos: string;
};

export function sesionesRecientes(dias: Ventana, limite = 40): SesionReciente[] {
  return filas<SesionReciente>(`
    SELECT u.sesion id, MAX(u.fuente) fuente, MAX(u.proyecto) proyecto,
           (SELECT substr(p.texto,1,180) FROM prompts p WHERE p.sesion=u.sesion ORDER BY p.ts LIMIT 1) titulo,
           MIN(u.ts) inicio, MAX(u.ts) fin, COUNT(*) turnos,
           SUM(${COSTE}) usd,
           SUM(CASE WHEN t.usd_entrada IS NULL THEN 1 ELSE 0 END) sin_tarifa,
           GROUP_CONCAT(DISTINCT u.modelo) modelos
      FROM uso u ${TARIFA_JOIN}
     WHERE datetime(u.ts) >= datetime('now', ?) AND u.sesion IS NOT NULL
     GROUP BY u.sesion ORDER BY MAX(u.ts) DESC LIMIT ?`, desde(dias), limite);
}

export type FuenteHonesta = {
  fuente: string; turnos: number; sesiones: number;
  usd: number | null; sin_tarifa: number;
};

/** El reparto por fuente, sin disfrazar de cero lo que no tiene tarifa. */
export function porFuenteHonesto(dias: Ventana): FuenteHonesta[] {
  return filas<FuenteHonesta>(`
    SELECT u.fuente, COUNT(*) turnos, COUNT(DISTINCT u.sesion) sesiones,
           SUM(${COSTE}) usd,
           SUM(CASE WHEN t.usd_entrada IS NULL THEN 1 ELSE 0 END) sin_tarifa
      FROM uso u ${TARIFA_JOIN}
     WHERE datetime(u.ts) >= datetime('now', ?)
     GROUP BY u.fuente ORDER BY turnos DESC`, desde(dias));
}
