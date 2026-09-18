/**
 * Each provider's logo.
 *
 * SIMPLIFIED icons drawn by hand with the same stroke width as the rest of
 * the interface, to identify which tool each figure comes from (nominative
 * use). They are not the official logos: the trademarks belong to their
 * owners. They inherit `currentColor` and follow the state.
 */
type P = { size?: number; className?: string };
const box = (s = 20, c?: string) => ({
  viewBox: "0 0 24 24", width: s, height: s, className: c, "aria-hidden": true as const,
});

/** Anthropic · a generic eight-point burst (not the official logo). */
function Anthropic({ size, className }: P) {
  return (
    <svg {...box(size, className)} fill="none" stroke="currentColor" strokeWidth="1.6"
         strokeLinecap="round">
      <path d="M12 3v18M3 12h18M5.6 5.6l12.8 12.8M18.4 5.6 5.6 18.4" />
    </svg>
  );
}
/** OpenAI: the hexagonal knot, simplified to one stroke. */
function OpenAI({ size, className }: P) {
  return (
    <svg {...box(size, className)} fill="none" stroke="currentColor" strokeWidth="1.4"
         strokeLinejoin="round">
      <path d="M12 3.2 19.6 7.6v8.8L12 20.8 4.4 16.4V7.6L12 3.2Z" />
      <path d="M12 7.4v9.2M8.2 9.5v5M15.8 9.5v5" opacity=".55" />
    </svg>
  );
}
/** Ollama: the llama, in profile. */
function Ollama({ size, className }: P) {
  return (
    <svg {...box(size, className)} fill="none" stroke="currentColor" strokeWidth="1.4"
         strokeLinecap="round">
      <path d="M7.5 10c0-3 1-5.5 2-5.5s1.4 1.6 1.4 3.4M16.5 10c0-3-1-5.5-2-5.5s-1.4 1.6-1.4 3.4" />
      <path d="M5.8 13.5C5.8 10.7 8.6 9 12 9s6.2 1.7 6.2 4.5c0 2-.7 3.2-.7 4.4 0 .9.5 1.4.5 1.4H6c0-.6.5-.9.5-1.7 0-1.2-.7-2.3-.7-4.1Z" />
      <path d="M10 13.6h.01M14 13.6h.01" strokeWidth="2" />
    </svg>
  );
}
/** Hermes · the caduceus, its own symbol. */
function Hermes({ size, className }: P) {
  return (
    <svg {...box(size, className)} fill="none" stroke="currentColor" strokeWidth="1.4"
         strokeLinecap="round" strokeLinejoin="round">
      <path d="M7 14.5a5 5 0 0 1 10 0v1.8a2.2 2.2 0 0 1-2.2 2.2H9.2A2.2 2.2 0 0 1 7 16.3v-1.8Z" />
      <path d="M7.2 12.2 3 9.6l4.6-.5M16.8 12.2 21 9.6l-4.6-.5" />
      <path d="M12 9.5V6" />
    </svg>
  );
}
/** OpenClaw: the claw. */
function OpenClaw({ size, className }: P) {
  return (
    <svg {...box(size, className)} fill="none" stroke="currentColor" strokeWidth="1.4"
         strokeLinecap="round">
      <path d="M6 4.5v7M9.7 3.6v8M14.3 3.6v8M18 4.5v7" />
      <path d="M5.2 11c0 4.4 3 8.5 6.8 8.5s6.8-4.1 6.8-8.5" />
    </svg>
  );
}
/** GoHighLevel. */
function GHL({ size, className }: P) {
  return (
    <svg {...box(size, className)} fill="none" stroke="currentColor" strokeWidth="1.5"
         strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2.8 20.5 7v10L12 21.2 3.5 17V7L12 2.8Z" />
      <path d="M8.5 14.5 12 8.6l3.5 5.9h-7Z" />
    </svg>
  );
}
/** Supabase. */
function Supabase({ size, className }: P) {
  return (
    <svg {...box(size, className)} fill="currentColor">
      <path d="M13.2 2.2 4.4 12.9c-.5.6-.1 1.5.7 1.5h5.4v7.4c0 1 1.2 1.4 1.8.7l8.8-10.7c.5-.6.1-1.5-.7-1.5h-5.4V2.9c0-1-1.2-1.4-1.8-.7Z" />
    </svg>
  );
}


/** Google · the four-colour G, in a single stroke to inherit the colour. */
function Google({ size, className }: P) {
  return (
    <svg {...box(size, className)} fill="currentColor">
      <path d="M12 10.2v3.9h5.5a4.7 4.7 0 0 1-2 3.1l3.2 2.5c1.9-1.7 3-4.3 3-7.4 0-.7-.1-1.4-.2-2H12Z" opacity=".9" />
      <path d="M5.3 14.3 4.6 14.8l-2.5 2A10 10 0 0 0 12 22c2.7 0 5-.9 6.7-2.4l-3.2-2.5c-.9.6-2 1-3.5 1a6 6 0 0 1-5.7-4.1Z" opacity=".65" />
      <path d="M2.1 7.2A10 10 0 0 0 2.1 16.8l3.2-2.5a6 6 0 0 1 0-3.8L2.1 7.2Z" opacity=".45" />
      <path d="M12 5.9c1.5 0 2.9.5 4 1.5l3-3A10 10 0 0 0 2.1 7.2l3.2 2.5A6 6 0 0 1 12 5.9Z" opacity=".8" />
    </svg>
  );
}
/** Notion · the N inside the frame. */
function Notion({ size, className }: P) {
  return (
    <svg {...box(size, className)} fill="none" stroke="currentColor" strokeWidth="1.4"
         strokeLinejoin="round">
      <rect x="3" y="3.4" width="18" height="17.2" rx="2" />
      <path d="M8.4 16.6V8l7.2 8.6V8" strokeWidth="1.6" />
    </svg>
  );
}
/** Canva · the circle with the C. */
function Canva({ size, className }: P) {
  return (
    <svg {...box(size, className)} fill="none" stroke="currentColor" strokeWidth="1.5"
         strokeLinecap="round">
      <circle cx="12" cy="12" r="9.2" />
      <path d="M14.9 9.4a3.2 3.2 0 0 0-4.6.5c-1.3 1.7-1.2 4 .2 4.9 1.1.7 2.6.2 3.4-.9" />
    </svg>
  );
}
/** Gamma · the Greek gamma. */
function Gamma({ size, className }: P) {
  return (
    <svg {...box(size, className)} fill="none" stroke="currentColor" strokeWidth="1.5"
         strokeLinecap="round" strokeLinejoin="round">
      <path d="M6.5 5.5h11l-5.5 7v6" />
    </svg>
  );
}
/** Motion · the disc in motion. */
function Motion({ size, className }: P) {
  return (
    <svg {...box(size, className)} fill="none" stroke="currentColor" strokeWidth="1.5">
      <circle cx="12" cy="12" r="8.8" />
      <path d="M12 3.2a8.8 8.8 0 0 1 0 17.6" strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  );
}
/** Windsor.ai · the V of converging data. */
function Windsor({ size, className }: P) {
  return (
    <svg {...box(size, className)} fill="none" stroke="currentColor" strokeWidth="1.5"
         strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 5.5 8 18l4-8.5 4 8.5 5-12.5" />
    </svg>
  );
}
/** Obsidian · the gem. */
function Obsidian({ size, className }: P) {
  return (
    <svg {...box(size, className)} fill="none" stroke="currentColor" strokeWidth="1.4"
         strokeLinejoin="round">
      <path d="M12 2.5 19 8.2 16.4 20 7.6 21 4.2 9.6 12 2.5Z" />
      <path d="M12 2.5 9.6 11l6.8 9M9.6 11 4.2 9.6M9.6 11l6.8-2.8" opacity=".5" />
    </svg>
  );
}
/** Gmail · the envelope with the M. Kept apart from Google because its red is its signature. */
function Gmail({ size, className }: P) {
  return (
    <svg {...box(size, className)} fill="none" stroke="currentColor" strokeWidth="1.4"
         strokeLinecap="round" strokeLinejoin="round">
      <path d="M3.2 19V7l8.8 6.4L20.8 7v12" />
      <path d="M3.2 19h3.6v-6.6M20.8 19h-3.6v-6.6" opacity=".55" />
    </svg>
  );
}
/** Figma · the silhouette of the five pieces, in one colour with opacities. */
function Figma({ size, className }: P) {
  return (
    <svg {...box(size, className)} fill="currentColor">
      <path d="M8.7 2.6h3.3v6.2H8.7a3.1 3.1 0 1 1 0-6.2Z" opacity=".85" />
      <path d="M12 2.6h3.3a3.1 3.1 0 1 1 0 6.2H12V2.6Z" opacity=".6" />
      <path d="M8.7 8.9h3.3v6.2H8.7a3.1 3.1 0 1 1 0-6.2Z" opacity=".95" />
      <circle cx="15.3" cy="12" r="3.1" opacity=".72" />
      <path d="M8.7 15.2h3.3v3.1a3.1 3.1 0 1 1-3.3-3.1Z" opacity=".7" />
    </svg>
  );
}
/** Telegram · the paper plane. */
function Telegram({ size, className }: P) {
  return (
    <svg {...box(size, className)} fill="none" stroke="currentColor" strokeWidth="1.4"
         strokeLinecap="round" strokeLinejoin="round">
      <path d="M21.3 3.9 3 11c-.7.3-.66 1.3.07 1.5l4.8 1.5 1.9 5.1c.26.7 1.17.8 1.6.2l2.5-3.4 4.6 3.3c.58.4 1.4.07 1.55-.63L21.3 3.9Z" />
      <path d="M7.9 14 21.3 3.9 10.6 14.7" opacity=".45" />
    </svg>
  );
}
/** MULTIVERSO · the three planes orbiting the same centre. */
function Multiverso({ size, className }: P) {
  return (
    <svg {...box(size, className)} fill="none" stroke="currentColor" strokeWidth="1.2">
      <ellipse cx="12" cy="12" rx="9" ry="3.4" />
      <ellipse cx="12" cy="12" rx="9" ry="3.4" transform="rotate(60 12 12)" />
      <ellipse cx="12" cy="12" rx="9" ry="3.4" transform="rotate(-60 12 12)" />
      <circle cx="12" cy="12" r="1.3" fill="currentColor" stroke="none" />
    </svg>
  );
}
/** n8n · four nodes and their edges. */
function N8n({ size, className }: P) {
  return (
    <svg {...box(size, className)} fill="none" stroke="currentColor" strokeWidth="1.4"
         strokeLinecap="round">
      <circle cx="4.6" cy="12" r="2" /><circle cx="12" cy="6.8" r="2" />
      <circle cx="12" cy="17.2" r="2" /><circle cx="19.4" cy="12" r="2" />
      <path d="M6.4 10.9 10.2 7.9M6.4 13.1l3.8 3M13.8 7.9l3.8 3M13.8 16.1l3.8-3" opacity=".7" />
    </svg>
  );
}
/** Playwright · the theatre mask. */
function Playwright({ size, className }: P) {
  return (
    <svg {...box(size, className)} fill="none" stroke="currentColor" strokeWidth="1.4"
         strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 5.9c2.3 1 4.6 1.3 7 1.1 2.4.2 4.7-.1 7-1.1.3 7.2-2.6 12.7-7 12.7S4.7 13.1 5 5.9Z" />
      <path d="M8.7 10.3h.01M15.3 10.3h.01" strokeWidth="2" />
      <path d="M9.4 13.5c1.7 1.3 3.5 1.3 5.2 0" />
    </svg>
  );
}
/** Resend · the R in its box. */
function Resend({ size, className }: P) {
  return (
    <svg {...box(size, className)} fill="none" stroke="currentColor" strokeWidth="1.5"
         strokeLinecap="round" strokeLinejoin="round">
      <rect x="3.2" y="3.2" width="17.6" height="17.6" rx="4.2" />
      <path d="M9.3 16.6V7.8h3.2a2.8 2.8 0 0 1 0 5.6H9.3m4.2 0 3.2 3.2" />
    </svg>
  );
}
/** Airtable · the three faces of the table. */
function Airtable({ size, className }: P) {
  return (
    <svg {...box(size, className)} fill="currentColor">
      <path d="M11.2 3.3 3.5 6.4c-.5.2-.5.8 0 1l7.7 3.1c.5.2 1.1.2 1.6 0l7.7-3.1c.5-.2.5-.8 0-1l-7.7-3.1a2.2 2.2 0 0 0-1.6 0Z" opacity=".95" />
      <path d="M12.9 12.3v7.4c0 .5.5.9 1 .7l7-3.3c.4-.2.6-.5.6-.9V9.3c0-.5-.5-.9-1-.7l-7 2.9a1 1 0 0 0-.6.8Z" opacity=".6" />
      <path d="M11.1 12.3v7.4c0 .5-.5.9-1 .7l-7-3.3a1 1 0 0 1-.6-.9V9.3c0-.5.5-.9 1-.7l7 2.9c.4.2.6.5.6.8Z" opacity=".8" />
    </svg>
  );
}
/** A generic plug, for whatever has no brand of its own. */
function Plug({ size, className }: P) {
  return (
    <svg {...box(size, className)} fill="none" stroke="currentColor" strokeWidth="1.5"
         strokeLinecap="round" strokeLinejoin="round">
      <path d="M8.5 2.8v4.4M15.5 2.8v4.4M5.4 7.2h13.2v3.9a6.6 6.6 0 0 1-13.2 0V7.2ZM12 17.7V21.2" />
    </svg>
  );
}

export const BRANDS = {
  anthropic: Anthropic, openai: OpenAI, ollama: Ollama,
  hermes: Hermes, openclaw: OpenClaw, ghl: GHL, supabase: Supabase,
  google: Google, gmail: Gmail, notion: Notion, canva: Canva, gamma: Gamma,
  motion: Motion, windsor: Windsor, obsidian: Obsidian, figma: Figma,
  telegram: Telegram, multiverso: Multiverso, n8n: N8n, playwright: Playwright,
  resend: Resend, airtable: Airtable, plug: Plug,
} as const;

export type BrandName = keyof typeof BRANDS;

/** Which brand goes with each model or source. One table, one place. */
export function brandOf(x: string): BrandName {
  const s = x.toLowerCase();
  if (s.includes("claude") || s.includes("fable") || s.includes("mythos")) return "anthropic";
  if (s.includes("gpt") || s.includes("codex") || s.includes("openai")) return "openai";
  if (s.includes("hermes")) return "hermes";
  if (s.includes("claw")) return "openclaw";
  if (s.includes("qwen") || s.includes("gemma") || s.includes("ollama") || s.includes("llama")) return "ollama";
  if (s.includes("ghl") || s.includes("highlevel")) return "ghl";
  if (s.includes("supabase")) return "supabase";
  if (s.includes("gmail")) return "gmail";
  if (s.includes("google") || s.includes("drive") || s.includes("calendar")) return "google";
  if (s.includes("figma")) return "figma";
  if (s.includes("telegram")) return "telegram";
  if (s.includes("multiverso")) return "multiverso";
  if (s.includes("n8n")) return "n8n";
  if (s.includes("playwright")) return "playwright";
  if (s.includes("resend")) return "resend";
  if (s.includes("airtable")) return "airtable";
  if (s.includes("notion")) return "notion";
  if (s.includes("canva")) return "canva";
  if (s.includes("gamma")) return "gamma";
  if (s.includes("motion")) return "motion";
  if (s.includes("windsor")) return "windsor";
  if (s.includes("obsidian")) return "obsidian";
  return "plug";
}

/* ── Each brand's tint ───────────────────────────────────────────────────
   A brand is recognised by its colour before its drawing. The tint is used
   in two places and only two: the colour of the logo inside a Tile, and the
   very subtle background gradient of a Panel with `tint`. Never for long
   text: at that size the contrast is not guaranteed.

   The "one single accent" rule governs THE INTERFACE, not other people's
   logos: painting Claude cyan would invent an identity it does not have.
   Monochrome brands (Notion, Resend, Ollama) get bone, not a fake colour. */
export const TINT: Record<BrandName, string> = {
  anthropic:  "#D97757",  // Claude's warm coral
  openai:     "#10A37F",  // the green of OpenAI · Codex · ChatGPT
  ollama:     "#CBD5E1",  // monochrome brand: bone
  hermes:     "#F5B301",  // the gold it already uses in the sidebar
  openclaw:   "#FB7185",  // the pink of its wordmark gradient
  ghl:        "#188BF6",
  supabase:   "#3ECF8E",
  google:     "#4285F4",
  gmail:      "#EA4335",
  notion:     "#D8D6CF",  // monochrome brand: bone
  canva:      "#00C4CC",
  gamma:      "#8B5CF6",
  motion:     "#F97316",
  windsor:    "#2E90FA",
  obsidian:   "#8B7EF8",  // the violet of the gem
  figma:      "#A259FF",
  telegram:   "#2AABEE",
  multiverso: "#22D3EE",  // optional adapter: the interface accent
  n8n:        "#EA4B71",
  playwright: "#45BA4B",
  resend:     "#E7E9EC",  // monochrome brand: bone
  airtable:   "#FCB400",
  plug:       "#93A3B0",  // unbranded things go grey, not in a made-up colour
};

/** The tint of a free-form name: `tintOf("Claude Opus 4.8")` → coral. */
export function tintOf(x: string): string {
  return TINT[brandOf(x)];
}

/** Each source's display name. */
export const SOURCE_NAME: Record<string, string> = {
  claude_code: "Claude Code", codex: "Codex", hermes: "Hermes",
  openclaw: "OpenClaw", openrouter: "OpenRouter",
  inventory: "Inventory", multiverso: "MULTIVERSO", memory: "Memory",
};
