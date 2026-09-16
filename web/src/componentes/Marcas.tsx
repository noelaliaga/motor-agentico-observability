/**
 * Los logotipos de cada proveedor.
 *
 * Iconos SIMPLIFICADOS dibujados a mano en el mismo grosor de trazo que el
 * resto de la interfaz, para identificar de qué herramienta sale cada dato
 * (uso nominativo). No son los logotipos oficiales: las marcas pertenecen a
 * sus dueños. Heredan `currentColor` y siguen el estado.
 */
type P = { size?: number; className?: string };
const caja = (s = 20, c?: string) => ({
  viewBox: "0 0 24 24", width: s, height: s, className: c, "aria-hidden": true as const,
});

/** Anthropic · un destello genérico de ocho puntas (no el logotipo oficial). */
function Anthropic({ size, className }: P) {
  return (
    <svg {...caja(size, className)} fill="none" stroke="currentColor" strokeWidth="1.6"
         strokeLinecap="round">
      <path d="M12 3v18M3 12h18M5.6 5.6l12.8 12.8M18.4 5.6 5.6 18.4" />
    </svg>
  );
}
/** OpenAI: el nudo hexagonal, simplificado a un trazo. */
function OpenAI({ size, className }: P) {
  return (
    <svg {...caja(size, className)} fill="none" stroke="currentColor" strokeWidth="1.4"
         strokeLinejoin="round">
      <path d="M12 3.2 19.6 7.6v8.8L12 20.8 4.4 16.4V7.6L12 3.2Z" />
      <path d="M12 7.4v9.2M8.2 9.5v5M15.8 9.5v5" opacity=".55" />
    </svg>
  );
}
/** Ollama: la llama, de perfil. */
function Ollama({ size, className }: P) {
  return (
    <svg {...caja(size, className)} fill="none" stroke="currentColor" strokeWidth="1.4"
         strokeLinecap="round">
      <path d="M7.5 10c0-3 1-5.5 2-5.5s1.4 1.6 1.4 3.4M16.5 10c0-3-1-5.5-2-5.5s-1.4 1.6-1.4 3.4" />
      <path d="M5.8 13.5C5.8 10.7 8.6 9 12 9s6.2 1.7 6.2 4.5c0 2-.7 3.2-.7 4.4 0 .9.5 1.4.5 1.4H6c0-.6.5-.9.5-1.7 0-1.2-.7-2.3-.7-4.1Z" />
      <path d="M10 13.6h.01M14 13.6h.01" strokeWidth="2" />
    </svg>
  );
}
/** Hermes · el caduceo, su propio símbolo. */
function Hermes({ size, className }: P) {
  return (
    <svg {...caja(size, className)} fill="none" stroke="currentColor" strokeWidth="1.4"
         strokeLinecap="round" strokeLinejoin="round">
      <path d="M7 14.5a5 5 0 0 1 10 0v1.8a2.2 2.2 0 0 1-2.2 2.2H9.2A2.2 2.2 0 0 1 7 16.3v-1.8Z" />
      <path d="M7.2 12.2 3 9.6l4.6-.5M16.8 12.2 21 9.6l-4.6-.5" />
      <path d="M12 9.5V6" />
    </svg>
  );
}
/** OpenClaw: la garra. */
function OpenClaw({ size, className }: P) {
  return (
    <svg {...caja(size, className)} fill="none" stroke="currentColor" strokeWidth="1.4"
         strokeLinecap="round">
      <path d="M6 4.5v7M9.7 3.6v8M14.3 3.6v8M18 4.5v7" />
      <path d="M5.2 11c0 4.4 3 8.5 6.8 8.5s6.8-4.1 6.8-8.5" />
    </svg>
  );
}
/** GoHighLevel. */
function GHL({ size, className }: P) {
  return (
    <svg {...caja(size, className)} fill="none" stroke="currentColor" strokeWidth="1.5"
         strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2.8 20.5 7v10L12 21.2 3.5 17V7L12 2.8Z" />
      <path d="M8.5 14.5 12 8.6l3.5 5.9h-7Z" />
    </svg>
  );
}
/** Supabase. */
function Supabase({ size, className }: P) {
  return (
    <svg {...caja(size, className)} fill="currentColor">
      <path d="M13.2 2.2 4.4 12.9c-.5.6-.1 1.5.7 1.5h5.4v7.4c0 1 1.2 1.4 1.8.7l8.8-10.7c.5-.6.1-1.5-.7-1.5h-5.4V2.9c0-1-1.2-1.4-1.8-.7Z" />
    </svg>
  );
}


/** Google · la G de cuatro colores, en un solo trazo para heredar el color. */
function Google({ size, className }: P) {
  return (
    <svg {...caja(size, className)} fill="currentColor">
      <path d="M12 10.2v3.9h5.5a4.7 4.7 0 0 1-2 3.1l3.2 2.5c1.9-1.7 3-4.3 3-7.4 0-.7-.1-1.4-.2-2H12Z" opacity=".9" />
      <path d="M5.3 14.3 4.6 14.8l-2.5 2A10 10 0 0 0 12 22c2.7 0 5-.9 6.7-2.4l-3.2-2.5c-.9.6-2 1-3.5 1a6 6 0 0 1-5.7-4.1Z" opacity=".65" />
      <path d="M2.1 7.2A10 10 0 0 0 2.1 16.8l3.2-2.5a6 6 0 0 1 0-3.8L2.1 7.2Z" opacity=".45" />
      <path d="M12 5.9c1.5 0 2.9.5 4 1.5l3-3A10 10 0 0 0 2.1 7.2l3.2 2.5A6 6 0 0 1 12 5.9Z" opacity=".8" />
    </svg>
  );
}
/** Notion · la N dentro del marco. */
function Notion({ size, className }: P) {
  return (
    <svg {...caja(size, className)} fill="none" stroke="currentColor" strokeWidth="1.4"
         strokeLinejoin="round">
      <rect x="3" y="3.4" width="18" height="17.2" rx="2" />
      <path d="M8.4 16.6V8l7.2 8.6V8" strokeWidth="1.6" />
    </svg>
  );
}
/** Canva · la circunferencia con la C. */
function Canva({ size, className }: P) {
  return (
    <svg {...caja(size, className)} fill="none" stroke="currentColor" strokeWidth="1.5"
         strokeLinecap="round">
      <circle cx="12" cy="12" r="9.2" />
      <path d="M14.9 9.4a3.2 3.2 0 0 0-4.6.5c-1.3 1.7-1.2 4 .2 4.9 1.1.7 2.6.2 3.4-.9" />
    </svg>
  );
}
/** Gamma · la gamma griega. */
function Gamma({ size, className }: P) {
  return (
    <svg {...caja(size, className)} fill="none" stroke="currentColor" strokeWidth="1.5"
         strokeLinecap="round" strokeLinejoin="round">
      <path d="M6.5 5.5h11l-5.5 7v6" />
    </svg>
  );
}
/** Motion · el disco en movimiento. */
function Motion({ size, className }: P) {
  return (
    <svg {...caja(size, className)} fill="none" stroke="currentColor" strokeWidth="1.5">
      <circle cx="12" cy="12" r="8.8" />
      <path d="M12 3.2a8.8 8.8 0 0 1 0 17.6" strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  );
}
/** Windsor.ai · la uve de los datos que confluyen. */
function Windsor({ size, className }: P) {
  return (
    <svg {...caja(size, className)} fill="none" stroke="currentColor" strokeWidth="1.5"
         strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 5.5 8 18l4-8.5 4 8.5 5-12.5" />
    </svg>
  );
}
/** Obsidian · la gema. */
function Obsidian({ size, className }: P) {
  return (
    <svg {...caja(size, className)} fill="none" stroke="currentColor" strokeWidth="1.4"
         strokeLinejoin="round">
      <path d="M12 2.5 19 8.2 16.4 20 7.6 21 4.2 9.6 12 2.5Z" />
      <path d="M12 2.5 9.6 11l6.8 9M9.6 11 4.2 9.6M9.6 11l6.8-2.8" opacity=".5" />
    </svg>
  );
}
/** Gmail · el sobre con la M. Se separa de Google porque su rojo es su firma. */
function Gmail({ size, className }: P) {
  return (
    <svg {...caja(size, className)} fill="none" stroke="currentColor" strokeWidth="1.4"
         strokeLinecap="round" strokeLinejoin="round">
      <path d="M3.2 19V7l8.8 6.4L20.8 7v12" />
      <path d="M3.2 19h3.6v-6.6M20.8 19h-3.6v-6.6" opacity=".55" />
    </svg>
  );
}
/** Figma · la silueta de las cinco piezas, en un solo color con opacidades. */
function Figma({ size, className }: P) {
  return (
    <svg {...caja(size, className)} fill="currentColor">
      <path d="M8.7 2.6h3.3v6.2H8.7a3.1 3.1 0 1 1 0-6.2Z" opacity=".85" />
      <path d="M12 2.6h3.3a3.1 3.1 0 1 1 0 6.2H12V2.6Z" opacity=".6" />
      <path d="M8.7 8.9h3.3v6.2H8.7a3.1 3.1 0 1 1 0-6.2Z" opacity=".95" />
      <circle cx="15.3" cy="12" r="3.1" opacity=".72" />
      <path d="M8.7 15.2h3.3v3.1a3.1 3.1 0 1 1-3.3-3.1Z" opacity=".7" />
    </svg>
  );
}
/** Telegram · el avión de papel. */
function Telegram({ size, className }: P) {
  return (
    <svg {...caja(size, className)} fill="none" stroke="currentColor" strokeWidth="1.4"
         strokeLinecap="round" strokeLinejoin="round">
      <path d="M21.3 3.9 3 11c-.7.3-.66 1.3.07 1.5l4.8 1.5 1.9 5.1c.26.7 1.17.8 1.6.2l2.5-3.4 4.6 3.3c.58.4 1.4.07 1.55-.63L21.3 3.9Z" />
      <path d="M7.9 14 21.3 3.9 10.6 14.7" opacity=".45" />
    </svg>
  );
}
/** MULTIVERSO · los tres planos orbitando el mismo centro. */
function Multiverso({ size, className }: P) {
  return (
    <svg {...caja(size, className)} fill="none" stroke="currentColor" strokeWidth="1.2">
      <ellipse cx="12" cy="12" rx="9" ry="3.4" />
      <ellipse cx="12" cy="12" rx="9" ry="3.4" transform="rotate(60 12 12)" />
      <ellipse cx="12" cy="12" rx="9" ry="3.4" transform="rotate(-60 12 12)" />
      <circle cx="12" cy="12" r="1.3" fill="currentColor" stroke="none" />
    </svg>
  );
}
/** n8n · cuatro nodos y sus aristas. */
function N8n({ size, className }: P) {
  return (
    <svg {...caja(size, className)} fill="none" stroke="currentColor" strokeWidth="1.4"
         strokeLinecap="round">
      <circle cx="4.6" cy="12" r="2" /><circle cx="12" cy="6.8" r="2" />
      <circle cx="12" cy="17.2" r="2" /><circle cx="19.4" cy="12" r="2" />
      <path d="M6.4 10.9 10.2 7.9M6.4 13.1l3.8 3M13.8 7.9l3.8 3M13.8 16.1l3.8-3" opacity=".7" />
    </svg>
  );
}
/** Playwright · la máscara de teatro. */
function Playwright({ size, className }: P) {
  return (
    <svg {...caja(size, className)} fill="none" stroke="currentColor" strokeWidth="1.4"
         strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 5.9c2.3 1 4.6 1.3 7 1.1 2.4.2 4.7-.1 7-1.1.3 7.2-2.6 12.7-7 12.7S4.7 13.1 5 5.9Z" />
      <path d="M8.7 10.3h.01M15.3 10.3h.01" strokeWidth="2" />
      <path d="M9.4 13.5c1.7 1.3 3.5 1.3 5.2 0" />
    </svg>
  );
}
/** Resend · la R en su caja. */
function Resend({ size, className }: P) {
  return (
    <svg {...caja(size, className)} fill="none" stroke="currentColor" strokeWidth="1.5"
         strokeLinecap="round" strokeLinejoin="round">
      <rect x="3.2" y="3.2" width="17.6" height="17.6" rx="4.2" />
      <path d="M9.3 16.6V7.8h3.2a2.8 2.8 0 0 1 0 5.6H9.3m4.2 0 3.2 3.2" />
    </svg>
  );
}
/** Airtable · las tres caras de la mesa. */
function Airtable({ size, className }: P) {
  return (
    <svg {...caja(size, className)} fill="currentColor">
      <path d="M11.2 3.3 3.5 6.4c-.5.2-.5.8 0 1l7.7 3.1c.5.2 1.1.2 1.6 0l7.7-3.1c.5-.2.5-.8 0-1l-7.7-3.1a2.2 2.2 0 0 0-1.6 0Z" opacity=".95" />
      <path d="M12.9 12.3v7.4c0 .5.5.9 1 .7l7-3.3c.4-.2.6-.5.6-.9V9.3c0-.5-.5-.9-1-.7l-7 2.9a1 1 0 0 0-.6.8Z" opacity=".6" />
      <path d="M11.1 12.3v7.4c0 .5-.5.9-1 .7l-7-3.3a1 1 0 0 1-.6-.9V9.3c0-.5.5-.9 1-.7l7 2.9c.4.2.6.5.6.8Z" opacity=".8" />
    </svg>
  );
}
/** Un enchufe genérico, para lo que no tiene marca propia. */
function Enchufe({ size, className }: P) {
  return (
    <svg {...caja(size, className)} fill="none" stroke="currentColor" strokeWidth="1.5"
         strokeLinecap="round" strokeLinejoin="round">
      <path d="M8.5 2.8v4.4M15.5 2.8v4.4M5.4 7.2h13.2v3.9a6.6 6.6 0 0 1-13.2 0V7.2ZM12 17.7V21.2" />
    </svg>
  );
}

export const MARCAS = {
  anthropic: Anthropic, openai: OpenAI, ollama: Ollama,
  hermes: Hermes, openclaw: OpenClaw, ghl: GHL, supabase: Supabase,
  google: Google, gmail: Gmail, notion: Notion, canva: Canva, gamma: Gamma,
  motion: Motion, windsor: Windsor, obsidian: Obsidian, figma: Figma,
  telegram: Telegram, multiverso: Multiverso, n8n: N8n, playwright: Playwright,
  resend: Resend, airtable: Airtable, enchufe: Enchufe,
} as const;

export type NombreMarca = keyof typeof MARCAS;

/** Qué marca le toca a cada modelo o fuente. Una sola tabla, un solo sitio. */
export function marcaDe(x: string): NombreMarca {
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
  return "enchufe";
}

/* ── El tinte de cada marca ──────────────────────────────────────────────
   Una marca se reconoce por su color antes que por su dibujo. El tinte se
   usa en dos sitios y sólo en dos: el color del logo dentro de un Azulejo,
   y el degradado sutilísimo del fondo de una Tarjeta con `tinte`. Nunca
   para texto largo — a ese tamaño el contraste no está garantizado.

   La regla de "un solo acento" manda sobre LA INTERFAZ, no sobre los
   logotipos ajenos: pintar a Claude de cian sería inventarle una identidad
   que no tiene. Las marcas monocromas (Notion, Resend, Ollama) llevan
   hueso, no color falso. */
export const TINTE: Record<NombreMarca, string> = {
  anthropic:  "#D97757",  // el coral cálido de Claude
  openai:     "#10A37F",  // el verde de OpenAI · Codex · ChatGPT
  ollama:     "#CBD5E1",  // marca monocroma: hueso
  hermes:     "#F5B301",  // el dorado que ya usa en la barra
  openclaw:   "#FB7185",  // el rosa del degradado de su wordmark
  ghl:        "#188BF6",
  supabase:   "#3ECF8E",
  google:     "#4285F4",
  gmail:      "#EA4335",
  notion:     "#D8D6CF",  // marca monocroma: hueso
  canva:      "#00C4CC",
  gamma:      "#8B5CF6",
  motion:     "#F97316",
  windsor:    "#2E90FA",
  obsidian:   "#8B7EF8",  // el violeta de la gema
  figma:      "#A259FF",
  telegram:   "#2AABEE",
  multiverso: "#22D3EE",  // adaptador opcional: el acento de la interfaz
  n8n:        "#EA4B71",
  playwright: "#45BA4B",
  resend:     "#E7E9EC",  // marca monocroma: hueso
  airtable:   "#FCB400",
  enchufe:    "#93A3B0",  // lo sin marca va en gris, no en un color inventado
};

/** El tinte de un nombre libre: `tinteDe("Claude Opus 4.8")` → coral. */
export function tinteDe(x: string): string {
  return TINTE[marcaDe(x)];
}

/** El nombre bonito de cada fuente. */
export const NOMBRE_FUENTE: Record<string, string> = {
  claude_code: "Claude Code", codex: "Codex", hermes: "Hermes",
  openclaw: "OpenClaw", openrouter: "OpenRouter",
  inventario: "Inventario", multiverso: "MULTIVERSO", memoria: "Memoria",
};
