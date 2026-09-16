import type { ReactNode, CSSProperties } from "react";
import Link from "next/link";

/**
 * La tarjeta-enlace de un selector.
 *
 * Es la Tarjeta con `href`, pero para el caso concreto de "elige una de N":
 * la elegida se llena del tinte de su marca (carta-sel) y además lo declara
 * con `aria-current="page"`, para que el estado fuerte no sea sólo visual.
 * Vive aquí y no en Piezas.tsx porque ese archivo es de otro agente.
 *
 * Server-safe: sin hooks. El hover y la pisada los pone el CSS de la casa.
 */
export function TarjetaEnlace({
  href, tinte, seleccionada = false, className = "", children,
}: {
  href: string; tinte?: string; seleccionada?: boolean;
  className?: string; children: ReactNode;
}) {
  const clases = [
    "carta", "carta-pulsable", "block",
    seleccionada ? "carta-sel" : tinte ? "carta-tinte" : "",
    className,
  ].filter(Boolean).join(" ");
  return (
    <Link
      href={href} scroll={false}
      aria-current={seleccionada ? "page" : undefined}
      className={clases}
      style={tinte ? ({ "--tinte": tinte } as CSSProperties) : undefined}
    >
      {children}
    </Link>
  );
}
