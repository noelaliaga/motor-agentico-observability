import "server-only";
import { filas, fila } from "./base";

/* Lo que sabe el motor de cada máquina conectada, para su propio tablero. */

export type Maquina = {
  id: string; nombre: string; marca: string;
  vivo: boolean; nota: string | null; error: string | null;
  ms: number; filas: number; ultima: string | null;
  /** La última pasada que terminó bien. Si `vivo` es falso pero esto existe,
      lo que se enseña en pantalla viene de aquí. */
  ultimaOk: string | null;
};

export function maquina(id: string): Maquina | null {
  const s = fila<{
    fuente: string; ultima_ok: string | null; ultima_intento: string | null;
    ms: number; filas: number; error: string | null; nota: string | null;
  }>(`SELECT * FROM salud WHERE fuente = ?`, id);
  if (!s) return null;
  return {
    id, nombre: id, marca: id, vivo: Boolean(s.ultima_ok) && !s.error,
    nota: s.nota, error: s.error, ms: s.ms, filas: s.filas, ultima: s.ultima_intento,
    ultimaOk: s.ultima_ok,
  };
}

/* ── Hermes ────────────────────────────────────────────────────────────── */

export function hermesSesiones() {
  return filas<{
    id: string; canal: string | null; modelo: string | null;
    titulo: string | null; mensajes: number; inicio: string | null; fin: string | null;
  }>(`SELECT id, canal, modelo, titulo, mensajes, inicio, fin
        FROM sesiones WHERE fuente='hermes' ORDER BY fin DESC`);
}

export function hermesPorCanal() {
  return filas<{ canal: string; sesiones: number; mensajes: number }>(`
    SELECT COALESCE(canal,'(sin canal)') canal, COUNT(*) sesiones, SUM(mensajes) mensajes
      FROM sesiones WHERE fuente='hermes' GROUP BY canal ORDER BY mensajes DESC`);
}

export function hermesPorModelo() {
  return filas<{ modelo: string; sesiones: number; mensajes: number }>(`
    SELECT COALESCE(modelo,'(sin modelo)') modelo, COUNT(*) sesiones, SUM(mensajes) mensajes
      FROM sesiones WHERE fuente='hermes' GROUP BY modelo ORDER BY mensajes DESC`);
}

export function hermesSkills() {
  return filas<{ nombre: string; usos: number; ultimo_uso: string | null; ruta: string | null }>(`
    SELECT nombre, usos, ultimo_uso, ruta FROM inventario
     WHERE clase='skill' AND ambito='hermes' ORDER BY usos DESC, nombre`);
}

/* ── OpenClaw ──────────────────────────────────────────────────────────── */

export function clawAgentes() {
  return filas<{ nombre: string; descripcion: string | null; modelo: string | null }>(`
    SELECT nombre, descripcion, modelo FROM inventario
     WHERE clase='agente' AND ambito='openclaw' ORDER BY nombre`);
}

/* ── el stack entero: qué hay enchufado ────────────────────────────────── */

export function stack() {
  return filas<{
    clase: string; nombre: string; ambito: string;
    descripcion: string | null; usos: number;
  }>(`SELECT clase, nombre, ambito, descripcion, usos FROM inventario
       WHERE clase IN ('mcp','plugin','universo') ORDER BY clase, usos DESC`);
}
