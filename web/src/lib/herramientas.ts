import "server-only";
import { filas, fila, COSTE, TARIFA_JOIN } from "./base";

/* ─────────────────────────────────────────────────────────────────────────
   Las herramientas, una por una.

   Cinco máquinas, cinco realidades distintas: dos saben su gasto al detalle,
   una lo sabe en dinero real, y dos no lo saben. La sección enseña esa
   diferencia en vez de taparla con ceros.
   ───────────────────────────────────────────────────────────────────────── */

export type Herramienta = {
  id: string;
  nombre: string;
  proveedor: string;
  marca: string;
  /** Cómo se paga: cuota plana, por uso, o incluido en otra. */
  pago: string;
  /** Qué puede saber el motor de ella. */
  sabe: "exacto" | "real" | "sin gasto";
  /** Por qué, cuando no lo sabe. */
  porque: string | null;
  fuente: string | null;
};

export const HERRAMIENTAS: Herramienta[] = [
  {
    id: "claude_code", nombre: "Claude Code", proveedor: "Anthropic", marca: "anthropic",
    pago: "suscripción (ver tabla suscripciones)", sabe: "exacto", porque: null, fuente: "claude_code",
  },
  {
    id: "codex", nombre: "Codex", proveedor: "OpenAI", marca: "openai",
    pago: "suscripción (ver tabla suscripciones)", sabe: "exacto", porque: null, fuente: "codex",
  },
  {
    id: "chatgpt", nombre: "ChatGPT Plus", proveedor: "OpenAI", marca: "openai",
    pago: "cuota mensual", sabe: "sin gasto",
    porque: "La suscripción de ChatGPT no expone consumo por API. Lo que sí se mide es " +
            "Codex, que es lo que corre en tu terminal con esa misma cuenta.",
    fuente: null,
  },
  {
    id: "hermes", nombre: "Hermes Agent", proveedor: "Nous Research", marca: "hermes",
    pago: "OpenRouter, por uso", sabe: "sin gasto",
    porque: "Su tabla de mensajes tiene una columna de tokens y está a cero en todas las " +
            "filas. No lo registra, así que aquí no se estima: se deja vacío.",
    fuente: "hermes",
  },
  {
    id: "openclaw", nombre: "OpenClaw", proveedor: "OpenClaw", marca: "openclaw",
    pago: "OpenRouter, por uso", sabe: "sin gasto",
    porque: "Sus registros no guardan ni modelo ni tokens por llamada. No hay nada que leer.",
    fuente: "openclaw",
  },
];

export function resumenHerramienta(fuente: string | null) {
  if (!fuente) return null;
  return fila<{ usd: number; turnos: number; sesiones: number; desde: string; hasta: string }>(`
    SELECT COALESCE(SUM(${COSTE}),0) usd, COUNT(*) turnos,
           COUNT(DISTINCT u.sesion) sesiones, MIN(date(u.ts)) desde, MAX(date(u.ts)) hasta
      FROM uso u ${TARIFA_JOIN} WHERE u.fuente = ?`, fuente);
}

export function modelosDe(fuente: string) {
  return filas<{ modelo: string; turnos: number; salida: number; usd: number | null; sin_tarifa: number }>(`
    SELECT u.modelo, COUNT(*) turnos, SUM(u.t_salida) salida, SUM(${COSTE}) usd,
           SUM(CASE WHEN t.usd_entrada IS NULL THEN 1 ELSE 0 END) sin_tarifa
      FROM uso u ${TARIFA_JOIN} WHERE u.fuente = ?
     GROUP BY u.modelo ORDER BY usd DESC NULLS LAST`, fuente);
}

export function diasDe(fuente: string) {
  return filas<{ dia: string; usd: number; turnos: number }>(`
    SELECT date(u.ts) dia, COALESCE(SUM(${COSTE}),0) usd, COUNT(*) turnos
      FROM uso u ${TARIFA_JOIN} WHERE u.fuente = ?
     GROUP BY dia ORDER BY dia`, fuente);
}

/** El total facturado de verdad, que cubre Hermes y OpenClaw juntos. */
export function realOpenRouter() {
  return fila<{ usd: number }>(
    `SELECT COALESCE(MAX(usd),0) usd FROM gasto_real WHERE proveedor='openrouter'`)?.usd ?? 0;
}


/**
 * Las ventanas de uso: cinco horas y siete días.
 *
 * Lo que SÍ se puede medir es cuánto has usado. Lo que NO se puede es tu
 * techo: ni Anthropic ni OpenAI publican tu cuota desde la máquina. Así que
 * se enseña el consumo y se dice que el límite no está disponible, en vez de
 * dibujar un porcentaje sobre un número inventado.
 */
export function ventanas(fuente: string) {
  const cinco = fila<{ turnos: number; tokens: number }>(`
    SELECT COUNT(*) turnos, COALESCE(SUM(t_salida + t_entrada),0) tokens
      FROM uso WHERE fuente = ? AND datetime(ts) >= datetime('now','-5 hours')`, fuente);
  const semana = fila<{ turnos: number; tokens: number }>(`
    SELECT COUNT(*) turnos, COALESCE(SUM(t_salida + t_entrada),0) tokens
      FROM uso WHERE fuente = ? AND datetime(ts) >= datetime('now','-7 days')`, fuente);
  const pico = fila<{ turnos: number }>(`
    SELECT MAX(n) turnos FROM (
      SELECT COUNT(*) n FROM uso WHERE fuente = ?
       GROUP BY strftime('%Y-%m-%d %H', ts))`, fuente);
  return { cinco, semana, pico: pico?.turnos ?? 0 };
}
