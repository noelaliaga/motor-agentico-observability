import type { ReactNode } from "react";

/**
 * Un pliegue nativo (<details>) para los catálogos largos.
 *
 * Doscientas filas grises seguidas no son información: son textura. Lo que
 * trabaja se ve siempre; lo dormido queda a un clic, con la cuenta delante
 * para que el dato no se esconda. Sin JS, sin "use client": el navegador
 * ya sabe plegar.
 */
export function Plegable({
  cerrado, abierto, children,
}: { cerrado: ReactNode; abierto: ReactNode; children: ReactNode }) {
  return (
    <details className="group">
      <summary
        className="inline-flex cursor-pointer select-none list-none items-center gap-2 rounded-[4px] border px-3 py-1.5 text-[12px] transition-colors hover:bg-[rgb(255_255_255_/_0.03)] motion-reduce:transition-none [&::-webkit-details-marker]:hidden"
        style={{ color: "var(--texto-2)", borderColor: "var(--borde)" }}
      >
        <svg
          width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true"
          className="transition-transform group-open:rotate-90 motion-reduce:transition-none"
        >
          <path d="M3 1.5 6.5 5 3 8.5" stroke="currentColor" strokeWidth="1.4"
                strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span className="group-open:hidden">{cerrado}</span>
        <span className="hidden group-open:inline">{abierto}</span>
      </summary>
      <div className="mt-2.5">{children}</div>
    </details>
  );
}
