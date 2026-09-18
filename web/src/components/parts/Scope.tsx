import { Badge } from "../Parts";

/**
 * The colour of each inventory scope.
 *
 * A scope repeats across hundreds of rows; its badge carries a border in its
 * colour so the eye groups without reading. They are tones already present in
 * the interface (the gold is Hermes'): no new palette.
 */
export const SCOPE_TONE: Record<string, string> = {
  project: "#38BDF8",
  global: "#93A3B0",
  hermes: "#F5B301",
  openclaw: "#FB7185",
  multiverso: "#5EEAD4",
};

export const SCOPE_NAME: Record<string, string> = {
  project: "Project", global: "Global", hermes: "Hermes",
  openclaw: "OpenClaw", multiverso: "Multiverso",
};

export function scopeTone(scope: string): string {
  return SCOPE_TONE[scope] ?? "var(--text-3)";
}

/** The category badge with the border in its colour, as in the reference. */
export function ScopeBadge({ scope }: { scope: string }) {
  return <Badge color={scopeTone(scope)}>{SCOPE_NAME[scope] ?? scope}</Badge>;
}
