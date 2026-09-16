import { Cabecera } from "@/componentes/Cabecera";
import {
  Rotulo, Seccion, num, Tarjeta, Azulejo, Insignia, Pastilla, Medidor,
  TONO_SECCION,
} from "@/componentes/Piezas";
import { TINTE, marcaDe, type NombreMarca } from "@/componentes/Marcas";
import { Heroe } from "@/componentes/piezas/Heroe";
import { memoriaResumen, memoriaRancia, cadenaMemoria, flancos } from "@/lib/consultas";
import { memoriaRecienteConRuta } from "@/lib/consultas-memoria";
import { Cadena } from "@/componentes/Cadena";
import { Cadena3D } from "@/componentes/Cadena3D";
import { filas } from "@/lib/base";

export const dynamic = "force-dynamic";

const RANCIO = 10;

/** Qué marca viste a cada sistema de memoria. Presentación, no dato:
    claude-mem es de Claude, el vault vive en Obsidian, hermes es Hermes. */
const MARCA_SISTEMA: Record<string, NombreMarca> = {
  "claude-mem": "anthropic", vault: "obsidian", hermes: "hermes",
};
const marcaSistema = (s: string): NombreMarca => MARCA_SISTEMA[s] ?? marcaDe(s);

/** El color de una edad, con la misma escala que la cadena de ADN:
    verde lo tocado hace poco, ámbar lo de más de 10 días, rosa lo congelado. */
function tonoEdad(dias: number): string {
  if (dias > 30) return "var(--alerta)";
  if (dias > RANCIO) return "var(--gasto)";
  return "var(--ahorro)";
}
const edad = (dias: number) => (dias === 0 ? "hoy" : `hace ${dias}d`);

/** De qué rincón sale un archivo, para cuando dos se llaman igual.
    En claude-mem es el proyecto; en el resto, la carpeta de al lado. */
function rincon(ruta: string): string {
  const proyecto = ruta.match(/\.claude\/projects\/([^/]+)\/memory\//)?.[1];
  if (proyecto) return proyecto.replace(/^-Users-[^-]+-/, "");
  return ruta.split("/").at(-2) ?? "";
}

/** Los títulos que aparecen más de una vez en una lista: a esos, y sólo a
    esos, se les enseña el rincón para que no parezcan filas duplicadas. */
function repetidos(lista: { titulo: string }[]): Set<string> {
  const visto = new Set<string>(), rep = new Set<string>();
  for (const { titulo } of lista) (visto.has(titulo) ? rep : visto).add(titulo);
  return rep;
}

export default function Memoria() {
  const resumen = memoriaResumen();
  const rancios = memoriaRancia(20);
  const frescos = memoriaRecienteConRuta(14);
  const cad = cadenaMemoria();
  const fl = flancos();
  const universos = filas<{ nombre: string; descripcion: string; usos: number }>(
    `SELECT nombre, descripcion, usos FROM inventario WHERE clase='universo' ORDER BY usos DESC`);

  const ranciosRepe = repetidos(rancios);
  const frescosRepe = repetidos(frescos);
  const total = resumen.reduce((s, r) => s + r.total, 0);
  const viejos = resumen.reduce((s, r) => s + r.rancios, 0);
  const frescura = total ? Math.round(((total - viejos) / total) * 100) : 0;
  const tonoFrescura = frescura > 70 ? "var(--ahorro)" : frescura > 40 ? "var(--gasto)" : "var(--alerta)";
  const TONO = TONO_SECCION.memoria;

  return (
    <>
      <Cabecera ruta="memoria" />
      <div className="flex flex-col gap-8 px-6 py-7">

        <Heroe tinte={TONO} semilla={23}>
          <div className="flex flex-col gap-3 px-7 py-8">
            <div className="flex flex-wrap items-center gap-2.5">
              <Insignia color={TONO}>memoria · adn del sistema</Insignia>
              <span className="rotulo">{resumen.length} sistemas indexados</span>
            </div>
            <h1 className="titular max-w-[680px]">
              <b>{num(total)}</b> <span>archivos indexados</span>
            </h1>
            <p className="max-w-[640px] text-[13px] leading-relaxed" style={{ color: "var(--texto-2)" }}>
              Cada par de bases es un archivo, ordenados por frescura: lo que tocaste hoy a la
              izquierda, lo que lleva meses congelado a la derecha. Donde la cadena deja de ser
              verde y se vuelve ámbar es justo donde la IA empieza a trabajar con contexto
              caducado.
            </p>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <Pastilla tono="ahorro">{num(cad.length - viejos)} frescos</Pastilla>
              <Pastilla tono={viejos ? "gasto" : "ahorro"}>{num(viejos)} rancios</Pastilla>
              <Insignia tono="alerta" title="los días del archivo que más tiempo lleva sin tocarse">
                el más congelado · {cad.at(-1)?.dias ?? 0} d
              </Insignia>
            </div>
          </div>
        </Heroe>

        <Cadena bases={cad} />

        <Seccion epigrafe="frescura por sistema" tinte={TONO}>
          Qué sabe de ti, y cuánto de eso está caducado
        </Seccion>

        <div className="grid gap-4 lg:grid-cols-[1fr_2fr]">
          <Tarjeta tinte={tonoFrescura} className="flex flex-col p-5">
            <div className="flex items-center gap-5">
              <Medidor parte={frescura / 100} etiqueta="frescos" color={tonoFrescura} tamano={92} />
              <div>
                <p className="rotulo">frescura de la memoria</p>
                <p className="mt-1.5 text-[13px] leading-snug" style={{ color: "var(--texto)" }}>
                  {num(total - viejos)} de {num(total)} archivos
                </p>
                <p className="mt-0.5 text-[11.5px]" style={{ color: "var(--texto-3)" }}>
                  tocados en los últimos {RANCIO} días
                </p>
              </div>
            </div>
            <p className="mt-4 border-t pt-3 text-[11.5px] leading-relaxed" style={{ color: "var(--texto-3)" }}>
              Una memoria vieja no es neutral: es contexto equivocado que se cuela en
              cada sesión nueva y que el modelo se cree.
            </p>
          </Tarjeta>

          <div className="grid gap-3 sm:grid-cols-2">
            {resumen.map((r, i) => {
              const marca = marcaSistema(r.sistema);
              const parte = r.total ? (r.total - r.rancios) / r.total : 0;
              const ancha = i === resumen.length - 1 && resumen.length % 2 === 1;
              return (
                <Tarjeta key={r.sistema} tinte={TINTE[marca]}
                         className={`p-4${ancha ? " sm:col-span-2" : ""}`}>
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <Azulejo marca={marca} tamano={34} />
                      <div className="min-w-0">
                        <p className="truncate text-[13px] font-medium">{r.sistema}</p>
                        <p className="rotulo mt-0.5">{num(r.total)} archivos</p>
                      </div>
                    </div>
                    {r.rancios
                      ? <Insignia tono="gasto">{num(r.rancios)} rancios</Insignia>
                      : <Pastilla tono="ahorro">al día</Pastilla>}
                  </div>
                  <span className="barra mt-3.5 block">
                    <i style={{ width: `${Math.max(1.5, parte * 100)}%`,
                                background: r.rancios ? "var(--gasto)" : "var(--ahorro)" }} />
                  </span>
                  <p className="mt-1.5 text-[11.5px]"
                     style={{ color: r.rancios ? "var(--gasto)" : "var(--ahorro)" }}>
                    {r.rancios
                      ? `${num(r.rancios)} sin tocar en ${RANCIO}+ días`
                      : "todos frescos"}
                  </p>
                </Tarjeta>
              );
            })}
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <section className="flex flex-col gap-3">
            <Seccion epigrafe="lo que ya no se parece a ti" tinte="var(--alerta)"
                     meta={`${rancios.length} archivos · el más viejo primero`}>
              Lo más rancio
            </Seccion>
            <Tarjeta className="overflow-hidden">
              {rancios.map((m) => (
                <div key={m.ruta}
                     className="flex items-center gap-3 border-b px-4 py-2.5 transition-colors last:border-0 hover:bg-white/[.025]">
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full"
                        style={{ background: tonoEdad(m.dias_sin_tocar) }} aria-hidden="true" />
                  <span className="flex min-w-0 flex-1 items-baseline gap-2">
                    <span className="min-w-0 truncate text-[12.5px]" title={m.ruta}>{m.titulo}</span>
                    {ranciosRepe.has(m.titulo) ? (
                      <span className="dato max-w-[150px] shrink-0 truncate text-[10.5px]"
                            style={{ color: "var(--texto-3)" }} title={m.ruta}>
                        {rincon(m.ruta)}
                      </span>
                    ) : null}
                  </span>
                  <Insignia color={TINTE[marcaSistema(m.sistema)]}>{m.sistema}</Insignia>
                  <span className="dato w-[64px] text-right" style={{ color: tonoEdad(m.dias_sin_tocar) }}>
                    {edad(m.dias_sin_tocar)}
                  </span>
                </div>
              ))}
            </Tarjeta>
          </section>

          <section className="flex flex-col gap-3">
            <Seccion epigrafe="recién escrito" tinte={TONO}
                     meta={`${frescos.length} archivos · lo de hoy primero`}>
              Lo último que tocaste
            </Seccion>
            <Tarjeta className="overflow-hidden">
              {frescos.map((m) => (
                <div key={m.ruta}
                     className="flex items-center gap-3 border-b px-4 py-2.5 transition-colors last:border-0 hover:bg-white/[.025]">
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full"
                        style={{ background: "var(--ahorro)" }} aria-hidden="true" />
                  <span className="flex min-w-0 flex-1 items-baseline gap-2">
                    <span className="min-w-0 truncate text-[12.5px]" title={m.ruta}>{m.titulo}</span>
                    {frescosRepe.has(m.titulo) ? (
                      <span className="dato max-w-[150px] shrink-0 truncate text-[10.5px]"
                            style={{ color: "var(--texto-3)" }} title={m.ruta}>
                        {rincon(m.ruta)}
                      </span>
                    ) : null}
                  </span>
                  <Insignia color={TINTE[marcaSistema(m.sistema)]}>{m.sistema}</Insignia>
                  <span className="dato w-[64px] text-right" style={{ color: "var(--ahorro)" }}>
                    {edad(m.dias_sin_tocar)}
                  </span>
                </div>
              ))}
            </Tarjeta>
          </section>
        </div>

        <section className="flex flex-col gap-3">
          <Seccion epigrafe="la misma cadena, en tres dimensiones" tinte={TONO}
                   meta="arrastra para girar"
                   nota={<>De frente, cuarenta archivos se solapan. Girándola se separan, y se ve
                          la densidad real. A los lados van las otras dos hebras de tu sistema:{" "}
                          {fl.skills.length} skills y {fl.agentes.length} agentes, encendidos los
                          que se han usado alguna vez.</>}>
            La misma cadena, de pie
          </Seccion>
          <Cadena3D bases={cad}
                    izq={{ titulo: `${fl.skills.length} skills`, puntos: fl.skills }}
                    der={{ titulo: `${fl.agentes.length} agentes`, puntos: fl.agentes }} />
        </section>

        <section className="flex flex-col gap-3">
          <Seccion epigrafe="multiverso" tinte={TINTE.multiverso}
                   meta={`${universos.length} universos`}>
            El mapa de universos
          </Seccion>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {universos.map((u) => (
              <Tarjeta key={u.nombre} tinte={TINTE.multiverso} className="p-4">
                <div className="flex items-center gap-3">
                  <Azulejo marca="multiverso" tamano={30} />
                  <p className="min-w-0 flex-1 truncate text-[13px] font-medium">{u.nombre}</p>
                  <span className="cifra text-[15px]" style={{ color: TINTE.multiverso }}>{num(u.usos)}</span>
                </div>
                <p className="rotulo mt-2">nodos</p>
                <p className="mt-1.5 line-clamp-3 text-[11.5px] leading-snug" style={{ color: "var(--texto-3)" }}>
                  {u.descripcion}
                </p>
              </Tarjeta>
            ))}
          </div>
          <p className="text-[11.5px] leading-relaxed" style={{ color: "var(--texto-3)" }}>
            Adaptador opcional (MOTOR_MULTIVERSO): lee el manifiesto de un índice ya generado,
            no recalcula nada. Sin la variable, esta sección se queda vacía.
          </p>
        </section>
      </div>
    </>
  );
}
