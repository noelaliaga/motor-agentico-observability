import type { ReactNode } from "react";
import { Badge } from "../Parts";
import { Hero } from "./Hero";

/**
 * The hero of the catalogue pages (skills, inventory, activity).
 *
 * A fixed composition over the generic Hero: a small eyebrow with the badge
 * in the section colour, a headline with the figure in white and the rest in
 * grey, and a two-line paragraph saying what this screen is. It is the calm
 * hierarchy of the reference: nothing shouts, everything goes in reading order.
 */
export function CatalogHero({
  tint, seed, badge, meta, figure, rest, children, extra,
}: {
  tint: string; seed: number; badge: ReactNode; meta?: ReactNode;
  figure: ReactNode; rest: string; children?: ReactNode; extra?: ReactNode;
}) {
  return (
    <Hero tint={tint} seed={seed} stars={90}>
      <div className="flex flex-col gap-3 px-7 py-8">
        <div className="flex flex-wrap items-center gap-2.5">
          <Badge color={tint}>{badge}</Badge>
          {meta ? <span className="label">{meta}</span> : null}
        </div>
        <h1 className="headline max-w-[680px]">
          <b>{figure}</b> <span>{rest}</span>
        </h1>
        {children ? (
          <p className="max-w-[580px] text-[13px] leading-relaxed" style={{ color: "var(--text-2)" }}>
            {children}
          </p>
        ) : null}
        {extra ? <div className="mt-1 flex flex-wrap items-center gap-2">{extra}</div> : null}
      </div>
    </Hero>
  );
}
