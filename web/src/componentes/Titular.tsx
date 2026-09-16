import type { ReactNode } from "react";

/**
 * El titular de cada pantalla.
 *
 * La cifra en blanco y grande; el resto de la frase, en gris. Es el patrón que
 * hace que una pantalla se entienda antes de leerla: primero ves el número,
 * después qué es. Debajo, un párrafo que explica de dónde sale — porque un
 * panel que no dice su procedencia es un panel en el que hay que confiar a
 * ciegas.
 */
export function Titular({
  marca, cifra, resto, children,
}: { marca: string; cifra: ReactNode; resto: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col gap-3">
      <p className="rotulo flex items-center gap-2">
        <span className="h-1.5 w-1.5 rounded-full" style={{ background: "var(--ambar)" }} />
        {marca}
      </p>
      <h1 className="titular"><b>{cifra}</b> <span>{resto}</span></h1>
      {children ? (
        <p className="max-w-[640px] text-[13px] leading-relaxed" style={{ color: "var(--texto-2)" }}>
          {children}
        </p>
      ) : null}
    </div>
  );
}

/** La tira de cifras con separadores finos. Cuatro datos, un vistazo. */
export function Tira({
  datos,
}: { datos: { rotulo: string; valor: ReactNode; tono?: string }[] }) {
  return (
    <div className="tira" style={{ gridTemplateColumns: `repeat(${datos.length}, minmax(0,1fr))` }}>
      {datos.map((d) => (
        <div key={d.rotulo}>
          <p className="rotulo">{d.rotulo}</p>
          <p className="cifra mt-1.5 text-[26px]" style={{ color: d.tono ?? "var(--texto)" }}>{d.valor}</p>
        </div>
      ))}
    </div>
  );
}
