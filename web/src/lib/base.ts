import "server-only";
import { join } from "node:path";

/**
 * `node:sqlite` se pide a Node en tiempo de ejecución, no se importa.
 *
 * El import normal lo empaqueta Turbopack, y en el chunk de render de
 * servidor acaba llamando a `require` — que no existe en ese contexto. El
 * resultado era un 500 en TODAS las páginas cuyo mensaje no mencionaba
 * SQLite: «Failed to load external module». `process.getBuiltinModule` existe
 * justo para esto: devuelve el módulo nativo sin pasar por el empaquetador.
 */
type Fila = Record<string, unknown>;
interface Sentencia { all(...a: unknown[]): Fila[]; get(...a: unknown[]): Fila | undefined }
interface Base { prepare(sql: string): Sentencia }

function sqlite(): { DatabaseSync: new (r: string, o?: { readOnly?: boolean }) => Base } {
  const m = (process as unknown as {
    getBuiltinModule?: (n: string) => unknown;
  }).getBuiltinModule?.("node:sqlite");
  if (!m) throw new Error("Este Node no trae node:sqlite. Hace falta Node 22.5 o superior.");
  return m as { DatabaseSync: new (r: string, o?: { readOnly?: boolean }) => Base };
}

/* ─────────────────────────────────────────────────────────────────────────
   La base, SIEMPRE en solo lectura.

   No es una promesa que se pueda olvidar en una revisión: `readOnly: true`
   hace que SQLite rechace cualquier escritura a nivel de conexión. Aunque
   alguien escribiera un INSERT en esta app, no llegaría a la base.

   `node:sqlite` es nativo en Node 22+. Cero dependencias.
   ───────────────────────────────────────────────────────────────────────── */

// Sin MOTOR_BASE, la base por defecto del lector: `data/motor.sqlite` en la raíz
// del repo (la web corre desde `web/`). Nunca una ruta de una máquina concreta.
const RUTA = process.env.MOTOR_BASE || join(process.cwd(), "..", "data", "motor.sqlite");

let db: Base | null = null;

function abrir(): Base {
  if (db) return db;
  const { DatabaseSync } = sqlite();
  db = new DatabaseSync(RUTA, { readOnly: true });
  return db;
}

export function filas<T = Record<string, unknown>>(sql: string, ...args: unknown[]): T[] {
  try {
    // `node:sqlite` devuelve objetos con PROTOTIPO NULO. Se ven como objetos
    // normales y funcionan igual… hasta que uno viaja a un componente de
    // cliente: React se niega a serializarlos y la página entera devuelve un
    // 500 cuyo mensaje no menciona SQLite por ningún lado. El spread los
    // convierte en objetos de verdad y el problema desaparece de raíz.
    const crudas = abrir().prepare(sql).all(...args) as Fila[];
    return crudas.map((r) => ({ ...r })) as T[];
  } catch (e) {
    // Una consulta que falla deja su sección vacía y con el motivo escrito.
    // Nunca tumba la página entera. Una escritura también cae aquí: la
    // conexión es readOnly y SQLite la rechaza.
    console.warn("[motor:sql]", (e as Error).message);
    return [];
  }
}

export function fila<T = Record<string, unknown>>(sql: string, ...args: unknown[]): T | null {
  return (filas<T>(sql, ...args)[0] as T) ?? null;
}

export function existe(): boolean {
  try { abrir().prepare("SELECT 1 FROM uso LIMIT 1").get(); return true; }
  catch { return false; }
}

/**
 * El dinero, en un solo sitio.
 *
 * El JOIN por fechas es lo que impide que un cambio de tarifa envenene el
 * pasado: cada turno se valora con el precio que estaba vigente ESE día. Y el
 * LEFT JOIN es deliberado — un modelo sin tarifa conocida NO suma cero: suma
 * `null`, y se cuenta aparte en `sin_tarifa` para poder decirlo en pantalla.
 */
export const COSTE = `
  (u.t_entrada   * t.usd_entrada
 + u.t_salida    * t.usd_salida
 + u.t_cache_lee * t.usd_entrada * t.mult_cache_lee
 + u.t_cache_5m  * t.usd_entrada * t.mult_cache_5m
 + u.t_cache_1h  * t.usd_entrada * t.mult_cache_1h) / 1000000.0`;

export const TARIFA_JOIN = `
  LEFT JOIN tarifas t
    ON t.modelo = (CASE WHEN u.velocidad='fast' THEN u.modelo || '  ⚡' ELSE u.modelo END)
   AND date(u.ts) >= date(t.desde)
   AND (t.hasta IS NULL OR date(u.ts) <= date(t.hasta))`;
