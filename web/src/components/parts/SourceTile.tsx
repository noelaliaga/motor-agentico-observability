import type { CSSProperties, ReactNode } from "react";
import { Tile } from "@/components/Parts";
import { brandOf, tintOf } from "@/components/Brands";

/**
 * The tile of one of the review's SOURCES.
 *
 * The sources with a real brand (Claude Code, Codex, Hermes, OpenClaw,
 * MULTIVERSO) carry their logo and tint from Brands.tsx, as everywhere in the
 * house. The motor's internal sources (memory, inventory, cron, connections)
 * have no outside brand: they carry a glyph of their own in the house stroke
 * and the colour of THEIR section (SECTION_TONE), which is their real
 * identity: making up a fantasy logo for them would be lying just like
 * making up a figure.
 */

const box = {
  viewBox: "0 0 24 24", fill: "none" as const, stroke: "currentColor",
  strokeWidth: 1.4, strokeLinecap: "round" as const, strokeLinejoin: "round" as const,
  "aria-hidden": true as const,
};

/** Glyphs and tints of the sources without an outside brand. */
const OWN: Record<string, { tint: string; glyph: ReactNode }> = {
  memory: {
    tint: "var(--saving)", // the green of the Memory section
    glyph: (<>
      <rect x="5" y="5" width="14" height="14" rx="2.4" />
      <path d="M9 2.8v2.2M15 2.8v2.2M9 19v2.2M15 19v2.2M2.8 9h2.2M2.8 15h2.2M19 9h2.2M19 15h2.2" opacity=".55" />
      <circle cx="12" cy="12" r="2.6" />
    </>),
  },
  inventory: {
    tint: "#5EEAD4", // the turquoise of the Inventory section
    glyph: (<>
      <rect x="3.5" y="3.5" width="7.4" height="7.4" rx="1.4" />
      <rect x="13.1" y="3.5" width="7.4" height="7.4" rx="1.4" opacity=".55" />
      <rect x="3.5" y="13.1" width="7.4" height="7.4" rx="1.4" opacity=".55" />
      <rect x="13.1" y="13.1" width="7.4" height="7.4" rx="1.4" />
    </>),
  },
  cron: {
    tint: "#38BDF8", // the blue of Activity: what is scheduled in time
    glyph: (<>
      <circle cx="12" cy="12" r="8.6" />
      <path d="M12 7v5.4l3.4 2" />
    </>),
  },
  connections: {
    tint: "var(--amber)", // the amber of the Connections section
    glyph: (<>
      <path d="M8.5 2.8v4.4M15.5 2.8v4.4M5.4 7.2h13.2v3.9a6.6 6.6 0 0 1-13.2 0V7.2ZM12 17.7V21.2" />
    </>),
  },
  openrouter: {
    tint: "#CBD5E1", // OpenRouter is a monochrome brand: bone, not a fake colour
    glyph: (<>
      <path d="M3 8.2h4.2c2.4 0 3.6 3.8 6 3.8" opacity=".55" />
      <path d="M3 15.8h4.2c2.4 0 3.6-3.8 6-3.8h5" />
      <path d="M13.2 8.2H18.2" />
      <path d="m16.2 5.6 3.2 2.6-3.2 2.6M16.2 13.2l3.2 2.6-3.2 2.6" />
    </>),
  },
};

/** A source's tint, for the gradient of its Panel. */
export function sourceTint(source: string): string {
  return OWN[source]?.tint ?? tintOf(source);
}

export function SourceTile({
  source, size = 34, live = true,
}: { source: string; size?: number; live?: boolean }) {
  const own = OWN[source];
  if (!own) {
    return <Tile brand={brandOf(source)} size={size} live={live} />;
  }
  return (
    <span
      className="tile"
      data-live={live ? "yes" : "no"}
      style={{
        width: size, height: size, borderRadius: Math.round(size * 0.24),
        "--tint": own.tint,
        color: live ? own.tint : "var(--text-3)",
      } as CSSProperties}
    >
      <svg {...box} width={Math.round(size * 0.52)} height={Math.round(size * 0.52)}>
        {own.glyph}
      </svg>
    </span>
  );
}
