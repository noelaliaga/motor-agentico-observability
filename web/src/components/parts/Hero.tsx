import type { ReactNode, CSSProperties } from "react";
import { Panel } from "../Parts";
import { Constellation } from "../Constellation";

/**
 * The section hero: the card that presides over a screen, with the star field
 * behind it and the corner brackets tinted in the section's colour.
 *
 * It lives in its own file because Parts.tsx belongs to another agent; when
 * the system settles, it can move there. It is a pure server component: the
 * Constellation is deterministic SVG and the rest is layout.
 *
 * `tint` tints three things and only three: the haze of the sky, the card's
 * border and the corner brackets (redefining --amber ONLY inside this card).
 * The text inside is still the house's.
 */
export function Hero({
  tint, seed = 7, stars = 110, className = "", children,
}: {
  tint: string; seed?: number; stars?: number;
  className?: string; children: ReactNode;
}) {
  return (
    <div style={{ "--amber": tint } as CSSProperties}>
      <Panel frame tint={tint} className={`relative overflow-hidden ${className}`}>
        <Constellation seed={seed} tint={tint} stars={stars} />
        <div className="relative">{children}</div>
      </Panel>
    </div>
  );
}
