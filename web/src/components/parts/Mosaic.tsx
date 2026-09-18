/**
 * The disproportion mosaic.
 *
 * One square per unit: the lit ones carry the colour passed in, the rest
 * stay in the shade. It tells with its body what a figure alone does not:
 * 16 out of 274 READS differently when you see the 258 dark squares.
 * Server-safe: they are spans, no canvas or state.
 *
 * `cap` cuts the drawing if the total ever shoots up: a mosaic of five
 * thousand cells no longer tells anything, it only weighs.
 */
export function Mosaic({
  total, lit, color = "var(--amber)", caption, cap = 800,
}: {
  total: number; lit: number; color?: string; caption?: string; cap?: number;
}) {
  const n = Math.max(0, Math.min(total, cap));
  const v = Math.max(0, Math.min(lit, n));
  return (
    <div
      role="img"
      aria-label={caption ?? `${lit} lit out of ${total}`}
      className="flex flex-wrap content-start items-end"
      style={{ gap: 3 }}
    >
      {Array.from({ length: n }, (_, i) => (
        <span
          key={i}
          aria-hidden="true"
          style={{
            width: 8, height: 8, borderRadius: 2,
            background: i < v ? color : "rgb(255 255 255 / .06)",
            boxShadow: i < v ? `0 0 7px color-mix(in oklab, ${color} 45%, transparent)` : undefined,
          }}
        />
      ))}
      {total > n ? (
        <span className="label ml-1.5">+{(total - n).toLocaleString("en-US")} more</span>
      ) : null}
    </div>
  );
}
