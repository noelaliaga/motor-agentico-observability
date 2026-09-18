import type { ReactNode } from "react";

/**
 * Each screen's headline.
 *
 * The figure in big white; the rest of the sentence in grey. It is the
 * pattern that makes a screen understood before it is read: first you see the
 * number, then what it is. Below, a paragraph that explains where it comes
 * from, because a dashboard that does not say its provenance is a dashboard
 * you have to trust blindly.
 */
export function Headline({
  brand, figure, rest, children,
}: { brand: string; figure: ReactNode; rest: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col gap-3">
      <p className="label flex items-center gap-2">
        <span className="h-1.5 w-1.5 rounded-full" style={{ background: "var(--amber)" }} />
        {brand}
      </p>
      <h1 className="headline"><b>{figure}</b> <span>{rest}</span></h1>
      {children ? (
        <p className="max-w-[640px] text-[13px] leading-relaxed" style={{ color: "var(--text-2)" }}>
          {children}
        </p>
      ) : null}
    </div>
  );
}

/** The strip of figures with thin separators. Four figures, one glance. */
export function Strip({
  items,
}: { items: { label: string; value: ReactNode; tone?: string }[] }) {
  return (
    <div className="strip" style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0,1fr))` }}>
      {items.map((d) => (
        <div key={d.label}>
          <p className="label">{d.label}</p>
          <p className="figure mt-1.5 text-[26px]" style={{ color: d.tone ?? "var(--text)" }}>{d.value}</p>
        </div>
      ))}
    </div>
  );
}
