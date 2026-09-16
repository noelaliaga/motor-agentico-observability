import "server-only";
import { filas, fila, COSTE, TARIFA_JOIN } from "./base";

/* Las lecturas del motor. Todas de solo lectura, todas con su vacío honesto. */

export type Ventana = 1 | 7 | 28 | 3650;

function desde(dias: Ventana): string {
  return `-${dias} days`;
}

/* ── el dinero ─────────────────────────────────────────────────────────── */

export type PorModelo = {
  modelo: string; velocidad: string | null; turnos: number;
  salida: number; cache_lee: number; usd: number | null; sin_tarifa: number;
};

export function porModelo(dias: Ventana): PorModelo[] {
  return filas<PorModelo>(`
    SELECT u.modelo, u.velocidad, COUNT(*) turnos,
           SUM(u.t_salida) salida, SUM(u.t_cache_lee) cache_lee,
           SUM(${COSTE}) usd,
           SUM(CASE WHEN t.usd_entrada IS NULL THEN 1 ELSE 0 END) sin_tarifa
      FROM uso u ${TARIFA_JOIN}
     WHERE datetime(u.ts) >= datetime('now', ?)
     GROUP BY u.modelo, u.velocidad
     ORDER BY usd DESC NULLS LAST`, desde(dias));
}

export function totalUsd(dias: Ventana): number {
  return fila<{ v: number }>(`
    SELECT COALESCE(SUM(${COSTE}),0) v FROM uso u ${TARIFA_JOIN}
     WHERE datetime(u.ts) >= datetime('now', ?)`, desde(dias))?.v ?? 0;
}

export function porDia(dias: Ventana) {
  return filas<{ dia: string; usd: number; turnos: number }>(`
    SELECT date(u.ts) dia, COALESCE(SUM(${COSTE}),0) usd, COUNT(*) turnos
      FROM uso u ${TARIFA_JOIN}
     WHERE datetime(u.ts) >= datetime('now', ?)
     GROUP BY dia ORDER BY dia`, desde(dias));
}

export function porProyecto(dias: Ventana) {
  return filas<{ proyecto: string; usd: number; turnos: number; sesiones: number }>(`
    SELECT COALESCE(u.proyecto,'(sin proyecto)') proyecto,
           COALESCE(SUM(${COSTE}),0) usd, COUNT(*) turnos,
           COUNT(DISTINCT u.sesion) sesiones
      FROM uso u ${TARIFA_JOIN}
     WHERE datetime(u.ts) >= datetime('now', ?)
     GROUP BY proyecto ORDER BY usd DESC LIMIT 12`, desde(dias));
}

export function porFuente(dias: Ventana) {
  return filas<{ fuente: string; usd: number; turnos: number }>(`
    SELECT u.fuente, COALESCE(SUM(${COSTE}),0) usd, COUNT(*) turnos
      FROM uso u ${TARIFA_JOIN}
     WHERE datetime(u.ts) >= datetime('now', ?)
     GROUP BY u.fuente ORDER BY usd DESC`, desde(dias));
}

export function cacheResumen(dias: Ventana) {
  return fila<{ lee: number; w5m: number; w1h: number; entrada: number; salida: number }>(`
    SELECT COALESCE(SUM(t_cache_lee),0) lee, COALESCE(SUM(t_cache_5m),0) w5m,
           COALESCE(SUM(t_cache_1h),0) w1h, COALESCE(SUM(t_entrada),0) entrada,
           COALESCE(SUM(t_salida),0) salida
      FROM uso WHERE datetime(ts) >= datetime('now', ?)`, desde(dias));
}

/** Lo que costaría si NO hubiera caché: todo a precio de entrada llena. */
export function sinCache(dias: Ventana): number {
  return fila<{ v: number }>(`
    SELECT COALESCE(SUM(
      ((u.t_entrada + u.t_cache_lee + u.t_cache_5m + u.t_cache_1h) * t.usd_entrada
       + u.t_salida * t.usd_salida) / 1000000.0), 0) v
      FROM uso u ${TARIFA_JOIN}
     WHERE datetime(u.ts) >= datetime('now', ?)`, desde(dias))?.v ?? 0;
}

export function suscripciones() {
  return filas<{ nombre: string; usd_mes: number; cubre: string; nota: string }>(
    `SELECT * FROM suscripciones ORDER BY usd_mes DESC`);
}

export function gastoReal() {
  return filas<{ proveedor: string; ts: string; usd: number; detalle: string }>(
    `SELECT * FROM gasto_real ORDER BY ts DESC LIMIT 40`);
}

/* ── actividad ─────────────────────────────────────────────────────────── */

/** Qué herramientas y qué skill se usaron en cada sesión, para los chips. */
export function herramientasDeSesion(sesiones: string[]) {
  if (!sesiones.length) return new Map<string, { clase: string; nombre: string; n: number }[]>();
  const hueco = sesiones.map(() => "?").join(",");
  const rs = filas<{ sesion: string; clase: string; nombre: string; n: number }>(`
    SELECT sesion, clase, nombre, COUNT(*) n FROM invocaciones
     WHERE sesion IN (${hueco}) AND clase IN ('herramienta','skill','agente','mcp')
     GROUP BY sesion, clase, nombre ORDER BY n DESC`, ...sesiones);
  const m = new Map<string, { clase: string; nombre: string; n: number }[]>();
  for (const r of rs) {
    const l = m.get(r.sesion) ?? [];
    l.push({ clase: r.clase, nombre: r.nombre, n: r.n });
    m.set(r.sesion, l);
  }
  return m;
}

export function sesionesCaras(dias: Ventana, limite = 30) {
  return filas<{
    id: string; fuente: string; proyecto: string | null; titulo: string | null;
    inicio: string; fin: string; turnos: number; usd: number; modelos: string;
  }>(`
    SELECT u.sesion id, MAX(u.fuente) fuente, MAX(u.proyecto) proyecto,
           (SELECT substr(p.texto,1,180) FROM prompts p WHERE p.sesion=u.sesion ORDER BY p.ts LIMIT 1) titulo,
           MIN(u.ts) inicio, MAX(u.ts) fin, COUNT(*) turnos,
           COALESCE(SUM(${COSTE}),0) usd,
           GROUP_CONCAT(DISTINCT u.modelo) modelos
      FROM uso u ${TARIFA_JOIN}
     WHERE datetime(u.ts) >= datetime('now', ?) AND u.sesion IS NOT NULL
     GROUP BY u.sesion ORDER BY usd DESC LIMIT ?`, desde(dias), limite);
}

export function ultimosPrompts(limite = 40) {
  return filas<{ ts: string; texto: string; sesion: string; fuente: string; proyecto: string | null }>(`
    SELECT p.ts, p.texto, p.sesion, p.fuente,
           (SELECT MAX(u.proyecto) FROM uso u WHERE u.sesion = p.sesion) proyecto
      FROM prompts p ORDER BY p.ts DESC LIMIT ?`, limite);
}

/* ── inventario ────────────────────────────────────────────────────────── */

export function inventario(clase: string) {
  return filas<{
    nombre: string; ambito: string; descripcion: string | null;
    modelo: string | null; usos: number; ultimo_uso: string | null; ruta: string | null;
  }>(`SELECT nombre, ambito, descripcion, modelo, usos, ultimo_uso, ruta
        FROM inventario WHERE clase = ? ORDER BY usos DESC, nombre`, clase);
}

export function resumenInventario() {
  return filas<{ clase: string; total: number; usados: number }>(`
    SELECT clase, COUNT(*) total, SUM(CASE WHEN usos>0 THEN 1 ELSE 0 END) usados
      FROM inventario GROUP BY clase ORDER BY total DESC`);
}

export function masInvocado(clase: string, limite = 12) {
  return filas<{ nombre: string; n: number; ultimo: string }>(`
    SELECT nombre, COUNT(*) n, MAX(ts) ultimo FROM invocaciones
     WHERE clase = ? GROUP BY nombre ORDER BY n DESC LIMIT ?`, clase, limite);
}

/* ── memoria ───────────────────────────────────────────────────────────── */

export function memoriaResumen() {
  return filas<{ sistema: string; total: number; rancios: number; mediana: number }>(`
    SELECT sistema, COUNT(*) total,
           SUM(CASE WHEN dias_sin_tocar > 10 THEN 1 ELSE 0 END) rancios,
           AVG(dias_sin_tocar) mediana
      FROM memoria WHERE dias_sin_tocar IS NOT NULL GROUP BY sistema ORDER BY total DESC`);
}

export function memoriaRancia(limite = 24) {
  return filas<{ titulo: string; sistema: string; dias_sin_tocar: number; ruta: string }>(`
    SELECT titulo, sistema, dias_sin_tocar, ruta FROM memoria
     WHERE dias_sin_tocar IS NOT NULL ORDER BY dias_sin_tocar DESC LIMIT ?`, limite);
}

export function memoriaReciente(limite = 14) {
  return filas<{ titulo: string; sistema: string; dias_sin_tocar: number }>(`
    SELECT titulo, sistema, dias_sin_tocar FROM memoria
     WHERE dias_sin_tocar IS NOT NULL ORDER BY dias_sin_tocar ASC LIMIT ?`, limite);
}

/* ── salud del propio motor ────────────────────────────────────────────── */

export function salud() {
  return filas<{
    fuente: string; ultima_ok: string | null; ultima_intento: string | null;
    ms: number; filas: number; error: string | null; nota: string | null;
  }>(`SELECT * FROM salud ORDER BY fuente`);
}

export function frescura() {
  return fila<{ segundos: number }>(`
    SELECT CAST((julianday('now') - julianday(MAX(ultima_intento))) * 86400 AS INTEGER) segundos
      FROM salud`)?.segundos ?? 999999;
}

export function rango() {
  return fila<{ desde: string; hasta: string; dias: number }>(`
    SELECT MIN(date(ts)) desde, MAX(date(ts)) hasta,
           CAST(julianday(MAX(ts)) - julianday(MIN(ts)) AS INTEGER) + 1 dias FROM uso`);
}

/* ── el sueño ──────────────────────────────────────────────────────────── */

export function sueno() {
  return filas<{
    id: number; fecha: string; categoria: string; titulo: string;
    cuerpo: string; evidencia: string | null; accion: string | null; estado: string;
    gancho: string | null; origen: string | null; huella: string;
  }>(`SELECT * FROM sueno WHERE estado <> 'descartada' ORDER BY fecha DESC, id DESC LIMIT 12`);
}

/* ── lo que va a correr solo ───────────────────────────────────────────── */

export function programado() {
  return filas<{
    id: string; motor: string; nombre: string;
    cuando: string | null; siguiente: string | null; activo: number; detalle: string | null;
  }>(`SELECT * FROM programado ORDER BY activo DESC, motor, nombre`);
}

/** Los canales por los que te pueden alcanzar tus asistentes. */
export function canales() {
  return filas<{ canal: string; sesiones: number; ultima: string | null }>(`
    SELECT canal, COUNT(*) sesiones, MAX(fin) ultima FROM sesiones
     WHERE canal IS NOT NULL GROUP BY canal ORDER BY sesiones DESC`);
}

/** Las notas del sueño de la última noche, para la portada. */
export function suenoUltimo() {
  const f = fila<{ fecha: string }>(`SELECT MAX(fecha) fecha FROM sueno WHERE estado='nueva'`);
  if (!f?.fecha) return { fecha: null, ideas: [] as ReturnType<typeof sueno> };
  return {
    fecha: f.fecha,
    ideas: filas<{ id: number; categoria: string; titulo: string; cuerpo: string; gancho: string | null }>(
      `SELECT id, categoria, titulo, cuerpo, gancho FROM sueno
        WHERE estado='nueva' AND fecha=? ORDER BY id`, f.fecha),
  };
}

/* ── el plan y sus paredes ─────────────────────────────────────────────── */

/** Lo que tienes contratado, tal y como lo apunta el propio Claude Code. */
export function plan() {
  const f = filas<{ clave: string; valor: string | null }>(`SELECT clave, valor FROM plan`);
  const d = Object.fromEntries(f.map((r) => [r.clave, r.valor]));
  return {
    nombre: d.plan ?? null,
    detalle: d.plan_detalle ?? null,
    tipo: d.tipo_cuenta ?? null,
    desde: d.desde ?? null,
    extraActivado: d.extra_activado === "1",
    extraMotivo: d.extra_motivo ?? null,
  };
}

/**
 * Cada vez que la API te frenó, agrupada por pared.
 *
 * Un mismo tope congela a la vez la sesión principal y a todos sus agentes:
 * siete registros para una sola pared. Contarlos por separado haría creer que
 * topaste siete veces, así que se agrupan por ventana y se dice a cuántas
 * sesiones alcanzó.
 */
export function topes(limite = 8) {
  return filas<{
    ventana: string | null; desde: string; reset_ts: string | null; sesiones: number;
    extra_motivo: string | null;
  }>(`
    SELECT ventana, MIN(ts) desde, reset_ts, COUNT(DISTINCT sesion) sesiones,
           MAX(extra_motivo) extra_motivo
      FROM topes GROUP BY ventana, reset_ts
     ORDER BY desde DESC LIMIT ?`, limite);
}

/* ── lo que tienes enchufado ───────────────────────────────────────────── */

export type Conexion = {
  id: string; nombre: string; via: string; marca: string | null;
  detalle: string | null; estado: string; origen: string | null;
  usos: number; ultimo_uso: string | null;
};

export function conexiones() {
  return filas<Conexion>(`
    SELECT * FROM conexiones
     ORDER BY CASE via WHEN 'conector' THEN 0 WHEN 'mcp' THEN 1 ELSE 2 END,
              usos DESC, nombre`);
}

/* ── el grafo de memoria ───────────────────────────────────────────────── */

/** Los archivos como pares de bases, del más fresco al más congelado. */
export function cadenaMemoria() {
  return filas<{
    ruta: string; titulo: string; sistema: string; tipo: string; dias: number; grado: number;
  }>(`
    SELECT m.ruta, COALESCE(m.titulo, m.ruta) titulo, m.sistema,
           COALESCE(m.tipo,'archivo') tipo,
           COALESCE(m.dias_sin_tocar, 999) dias,
           (SELECT COUNT(*) FROM enlaces e WHERE e.origen = m.ruta OR e.destino = m.ruta) grado
      FROM memoria m WHERE m.dias_sin_tocar IS NOT NULL
     ORDER BY m.dias_sin_tocar ASC, m.ruta`);
}

export function grafoMemoria() {
  const nodos = filas<{
    ruta: string; titulo: string; sistema: string; tipo: string;
    dias: number; grado: number;
  }>(`
    SELECT m.ruta, COALESCE(m.titulo, m.ruta) titulo, m.sistema,
           COALESCE(m.tipo,'archivo') tipo,
           COALESCE(m.dias_sin_tocar, 999) dias,
           (SELECT COUNT(*) FROM enlaces e WHERE e.origen = m.ruta OR e.destino = m.ruta) grado
      FROM memoria m WHERE m.dias_sin_tocar IS NOT NULL
     ORDER BY grado DESC, m.ruta`);
  const pos = new Map(nodos.map((n, i) => [n.ruta, i]));
  const aristas = filas<{ origen: string; destino: string }>(`SELECT * FROM enlaces`)
    .map((a) => ({ o: pos.get(a.origen) ?? -1, d: pos.get(a.destino) ?? -1 }))
    .filter((a) => a.o >= 0 && a.d >= 0 && a.o !== a.d);
  const faltantes = Number(
    fila<{ valor: string }>(`SELECT valor FROM state_motor WHERE clave='enlaces_faltantes'`)?.valor ?? 0);
  return { nodos, aristas, faltantes };
}

/* ── skills, con su propia vida ────────────────────────────────────────── */

export function skills() {
  return filas<{
    nombre: string; ambito: string; descripcion: string | null;
    usos: number; ultimo_uso: string | null; modificado: string | null;
  }>(`SELECT nombre, ambito, descripcion, usos, ultimo_uso, modificado
        FROM inventario WHERE clase='skill' ORDER BY usos DESC, nombre`);
}

export function skillsPorAmbito() {
  return filas<{ ambito: string; total: number; usadas: number }>(`
    SELECT ambito, COUNT(*) total, SUM(CASE WHEN usos>0 THEN 1 ELSE 0 END) usadas
      FROM inventario WHERE clase='skill' GROUP BY ambito ORDER BY total DESC`);
}

/** La racha: cuántos días seguidos, contando hacia atrás desde hoy, hubo uso. */
export function racha() {
  const dias = new Set(filas<{ d: string }>(
    `SELECT DISTINCT date(ts) d FROM uso ORDER BY d DESC`).map((x) => x.d));
  let n = 0;
  const hoy = new Date();
  for (;;) {
    const clave = hoy.toISOString().slice(0, 10);
    if (!dias.has(clave)) {
      // Hoy todavía puede estar vacío a primera hora: sólo se corta la racha
      // si tampoco hubo nada ayer.
      if (n === 0) { hoy.setDate(hoy.getDate() - 1); continue; }
      break;
    }
    n += 1;
    hoy.setDate(hoy.getDate() - 1);
    if (n > 400) break;
  }
  return { dias: n, total: dias.size };
}

/* ── cómo ahorrar ──────────────────────────────────────────────────────────
   Movimientos concretos con su ahorro CALCULADO, no estimado a ojo. Cada uno
   dice la cuenta que hay detrás: sin eso sería un consejo de folleto.        */

export type Movimiento = {
  titulo: string; porque: string; ahorro: number | null; unidad: string;
};

export function comoAhorrar(dias: Ventana): Movimiento[] {
  const out: Movimiento[] = [];

  // 1 · turnos cortos en un modelo caro → el mismo trabajo en Haiku
  const cortos = fila<{ n: number; salida: number; entrada: number; cache: number }>(`
    SELECT COUNT(*) n, COALESCE(SUM(t_salida),0) salida,
           COALESCE(SUM(t_entrada),0) entrada, COALESCE(SUM(t_cache_lee),0) cache
      FROM uso
     WHERE datetime(ts) >= datetime('now', ?)
       AND modelo IN ('claude-opus-5','claude-fable-5','claude-opus-4-8')
       AND t_salida < 350`, `-${dias} days`);
  if (cortos && cortos.n > 100) {
    // Haiku 4.5: $1 entrada / $5 salida. La caché leída se paga a 0,1×.
    const enHaiku = (cortos.entrada * 1 + cortos.salida * 5 + cortos.cache * 0.1) / 1e6;
    const ahora = (cortos.entrada * 5 + cortos.salida * 25 + cortos.cache * 0.5) / 1e6;
    out.push({
      titulo: "Manda las lecturas simples a Haiku",
      porque: `${cortos.n.toLocaleString("es-ES")} turnos devolvieron menos de 350 tokens. ` +
              `A tarifa de Haiku 4.5 los mismos tokens costarían ${enHaiku.toFixed(2)} $ en vez de ${ahora.toFixed(2)} $.`,
      ahorro: ahora - enHaiku, unidad: "dólares en la ventana",
    });
  }

  // 2 · caché de una hora donde bastaría la de cinco minutos
  const c1h = fila<{ t: number }>(`
    SELECT COALESCE(SUM(t_cache_1h),0) t FROM uso
     WHERE datetime(ts) >= datetime('now', ?)`, `-${dias} days`);
  if (c1h && c1h.t > 5_000_000) {
    // 2× contra 1,25× de la entrada; a $5/M eso son 3,75 $ por millón.
    out.push({
      titulo: "Revisa la caché de una hora",
      porque: `${(c1h.t / 1e6).toFixed(0)} millones de tokens se escribieron con TTL de una hora, ` +
              `que cuesta 2× la entrada. Con cinco minutos serían 1,25×.`,
      ahorro: (c1h.t * 5 * 0.75) / 1e6, unidad: "dólares si todo cupiera en 5 min",
    });
  }

  // 3 · el proyecto que se lleva el dinero
  const top = filas<{ proyecto: string; usd: number }>(`
    SELECT COALESCE(u.proyecto,'(sin proyecto)') proyecto, COALESCE(SUM(${COSTE}),0) usd
      FROM uso u ${TARIFA_JOIN}
     WHERE datetime(u.ts) >= datetime('now', ?)
     GROUP BY proyecto ORDER BY usd DESC LIMIT 2`, `-${dias} days`);
  if (top.length === 2 && top[0].usd > top[1].usd * 3) {
    out.push({
      titulo: `Casi todo se va en «${top[0].proyecto}»`,
      porque: `${top[0].usd.toFixed(2)} $ contra ${top[1].usd.toFixed(2)} $ del siguiente. ` +
              `Si ese proyecto no es la prioridad de la semana, el reparto no cuadra con el plan.`,
      ahorro: null, unidad: "",
    });
  }

  // 4 · skills sin estrenar: no ahorra dinero, ahorra tiempo
  const sk = fila<{ total: number; usadas: number }>(`
    SELECT COUNT(*) total, SUM(CASE WHEN usos>0 THEN 1 ELSE 0 END) usadas
      FROM inventario WHERE clase='skill'`);
  if (sk && sk.total - sk.usadas > 50) {
    out.push({
      titulo: "Empaqueta lo que repites en una skill",
      porque: `Tienes ${sk.total} skills y usas ${sk.usadas}. Reutilizar una sesión con contexto ` +
              `ya cargado cuesta menos que volver a explicárselo todo cada vez.`,
      ahorro: null, unidad: "",
    });
  }
  return out;
}

/** Las dos hebras que flanquean la memoria: lo que sabes hacer y quién lo hace. */
export function flancos() {
  const skills = filas<{ nombre: string; usos: number }>(
    `SELECT nombre, usos FROM inventario WHERE clase='skill' ORDER BY usos DESC, nombre`);
  const agentes = filas<{ nombre: string; usos: number }>(
    `SELECT nombre, usos FROM inventario WHERE clase='agente' ORDER BY usos DESC, nombre`);
  return { skills, agentes };
}
