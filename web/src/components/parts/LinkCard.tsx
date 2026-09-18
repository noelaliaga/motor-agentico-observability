import type { ReactNode, CSSProperties } from "react";
import Link from "next/link";

/**
 * A selector's link card.
 *
 * It is the Panel with `href`, but for the specific case of "pick one of N":
 * the chosen one fills with its brand's tint (card-selected) and also declares
 * it with `aria-current="page"`, so the strong state is not only visual.
 * It lives here and not in Parts.tsx because that file belongs to another agent.
 *
 * Server-safe: no hooks. Hover and press come from the house CSS.
 */
export function LinkCard({
  href, tint, selected = false, className = "", children,
}: {
  href: string; tint?: string; selected?: boolean;
  className?: string; children: ReactNode;
}) {
  const classes = [
    "card", "card-pressable", "block",
    selected ? "card-selected" : tint ? "card-tint" : "",
    className,
  ].filter(Boolean).join(" ");
  return (
    <Link
      href={href} scroll={false}
      aria-current={selected ? "page" : undefined}
      className={classes}
      style={tint ? ({ "--tint": tint } as CSSProperties) : undefined}
    >
      {children}
    </Link>
  );
}
