import type { ReactNode, CSSProperties } from "react";
import Link from "next/link";
import { BRANDS, TINT, type BrandName } from "./Brands";

/* The house's parts. If something is used on two screens, it lives here. */

/**
 * A content surface.
 *
 * The corner brackets are NO LONGER the default: repeated on forty cards they
 * stopped being a seal and became texture. Now they have to be asked for,
 * and only the two or three pieces that preside over a screen carry them.
 */
export function Card({
  children, className = "", frame = false, dotGrid = false,
}: { children: ReactNode; className?: string; frame?: boolean; dotGrid?: boolean }) {
  return (
    <div className={`card ${frame ? "card-frame" : ""} ${dotGrid ? "dot-grid" : ""} ${className}`}>
      {frame ? <span className="corner" aria-hidden="true" /> : null}
      {children}
    </div>
  );
}

/**
 * THE section header. Only one, for the ten screens.
 *
 * The dashboard's five areas were redesigned separately and each one invented
 * its own way of titling: a mono label, a `/ Title`, a badge with an h2 next
 * to it, a lower-case title. Four ways of saying the same thing make the
 * dashboard read like four products. Here there is one:
 *
 *     · EYEBROW                               meta on the right
 *     Section title.
 *     The two-line paragraph that says what this is and where it comes from.
 *
 * Everything but the title is optional, but the order never changes. The
 * eyebrow carries the dot in the section's colour: it is what acts as the
 * legend of the colour code without spending a line explaining it.
 */
export function Section({
  children, eyebrow, badge, note, meta, tint = "var(--amber)", level,
}: {
  children: ReactNode;
  eyebrow?: string;
  /** The category badge, when the section IS a category (route, scope). */
  badge?: ReactNode;
  note?: ReactNode;
  meta?: ReactNode;
  tint?: string;
  /** Accepted for compatibility with old calls; it no longer changes anything. */
  level?: 1 | 2;
}) {
  void level;
  return (
    <div>
      {eyebrow ? (
        <p className="label flex items-center gap-2">
          <span className="h-1 w-1 shrink-0 rounded-full" style={{ background: tint }} />
          {eyebrow}
        </p>
      ) : null}
      {/* The figure on the right goes on the TITLE LINE, not at the foot of
          the block. Aligned to the end of the whole block it dropped to the
          height of the paragraph and ended up half a page away from what it
          quantifies. */}
      <div className={`flex flex-wrap items-center justify-between gap-x-6 gap-y-2 ${eyebrow ? "mt-2" : ""}`}>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          {badge}
          <h2 className="text-[19px] font-light tracking-tight" style={{ color: "var(--text)" }}>
            {children}
          </h2>
        </div>
        {meta ? (typeof meta === "string" || typeof meta === "number"
          ? <span className="label">{meta}</span>
          : meta) : null}
      </div>
      {note ? (
        <p className="mt-1.5 max-w-[620px] text-[12px] leading-relaxed" style={{ color: "var(--text-3)" }}>
          {note}
        </p>
      ) : null}
    </div>
  );
}

/**
 * The label INSIDE a card: "by day", "by model", "what it knows about you".
 *
 * It is not a section header and no longer behaves like one. A card that
 * opens with a 19 px title competes with the section that contains it;
 * inside, the right tag is the house's small mono.
 */
export function Label({ children, live }: { children: ReactNode; live?: boolean }) {
  return <p className={`label ${live ? "label-live" : ""}`}>{children}</p>;
}

export function Figure({
  value, label, note, tone = "normal", size = 34,
}: {
  value: ReactNode; label: string; note?: ReactNode;
  tone?: "normal" | "amber" | "spend" | "saving" | "muted" | "alert";
  size?: number;
}) {
  const color = {
    normal: "var(--text)", amber: "var(--amber)", spend: "var(--spend)",
    saving: "var(--saving)", muted: "var(--text-3)", alert: "var(--alert)",
  }[tone];
  return (
    <div>
      <p className="label">{label}</p>
      <p className="figure mt-1.5" style={{ color, fontSize: size }}>{value}</p>
      {note ? <p className="mt-1 text-[11px]" style={{ color: "var(--text-3)" }}>{note}</p> : null}
    </div>
  );
}

/** Proportion bar. It reads at a glance better than a percentage. */
export function Bar({ part, color = "var(--spend)" }: { part: number; color?: string }) {
  return (
    <span className="ratio-bar mt-2 block">
      <i style={{ width: `${Math.max(1.5, Math.min(100, part * 100))}%`, background: color }} />
    </span>
  );
}

/**
 * The honest empty state.
 *
 * A section without data says WHAT is missing and WHY. Never a zero, which
 * would read as "did not spend" when the truth is "I don't know". It is the
 * rule that separates this motor from a pretty dashboard that lies.
 */
export function Empty({ what, why }: { what: string; why: string }) {
  return (
    <div className="px-4 py-6">
      <p className="text-[13px]" style={{ color: "var(--text-2)" }}>{what}</p>
      <p className="mt-1.5 text-[11.5px] leading-relaxed" style={{ color: "var(--text-3)" }}>{why}</p>
    </div>
  );
}

export function usd(n: number | null | undefined, dec = 2): string {
  if (n === null || n === undefined) return "no data";
  return "$" + n.toLocaleString("en-US", { minimumFractionDigits: dec, maximumFractionDigits: dec });
}

export function num(n: number | null | undefined): string {
  if (n === null || n === undefined) return "—";
  return n.toLocaleString("en-US");
}

/** Tokens on a human scale: 1,234,567,890 does not read; 1.23 B does. */
export function tok(n: number | null | undefined): string {
  if (!n) return "0";
  if (n >= 1e9) return (n / 1e9).toLocaleString("en-US", { maximumFractionDigits: 2 }) + " B";
  if (n >= 1e6) return (n / 1e6).toLocaleString("en-US", { maximumFractionDigits: 1 }) + " M";
  if (n >= 1e3) return (n / 1e3).toLocaleString("en-US", { maximumFractionDigits: 0 }) + " K";
  return String(n);
}

export function ago(iso: string | null | undefined): string {
  if (!iso) return "—";
  const t = new Date(iso.endsWith("Z") || iso.includes("+") ? iso : iso + "Z").getTime();
  if (Number.isNaN(t)) return "—";
  const s = Math.max(0, (Date.now() - t) / 1000);
  if (s < 60) return `${Math.floor(s)}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export function duration(a: string, b: string): string {
  const ms = new Date(b + (b.endsWith("Z") ? "" : "Z")).getTime()
           - new Date(a + (a.endsWith("Z") ? "" : "Z")).getTime();
  if (!Number.isFinite(ms) || ms < 0) return "—";
  const m = Math.round(ms / 60000);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ${m % 60}m`;
  return `${Math.floor(h / 24)}d ${h % 24}h`;
}

/**
 * The circular gauge from the screenshots.
 *
 * A ring with the percentage inside. When there is no known ceiling (and with
 * the Claude and ChatGPT subscriptions there is none, because nobody
 * publishes your quota locally) the ring stays open and says "no public
 * ceiling" instead of drawing a made-up percentage over a limit that does not
 * exist.
 */
export function Gauge({
  part, caption, color = "var(--amber)", size = 74,
}: { part: number | null; caption?: string; color?: string; size?: number }) {
  const r = 30;
  const turn = 2 * Math.PI * r;
  const arc = part === null ? 0 : Math.max(0, Math.min(1, part)) * turn;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg viewBox="0 0 80 80" width={size} height={size} aria-hidden="true">
        <circle cx="40" cy="40" r={r} fill="none" strokeWidth="4"
                stroke="rgb(255 255 255 / .07)" />
        {part !== null ? (
          <circle cx="40" cy="40" r={r} fill="none" strokeWidth="4" stroke={color}
                  strokeLinecap="round" strokeDasharray={`${arc} ${turn}`}
                  transform="rotate(-90 40 40)" />
        ) : null}
      </svg>
      <span className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="figure text-[15px]" style={{ color: part === null ? "var(--text-3)" : color }}>
          {part === null ? "—" : `${Math.round(part * 100)}%`}
        </span>
        {caption ? <span className="label mt-0.5 text-[8px]">{caption}</span> : null}
      </span>
    </div>
  );
}

/** A quota bar with its figure: "LIMIT 5H  25 / 900". */
export function Quota({
  label, used, ceiling, color = "var(--amber)",
}: { label: string; used: number; ceiling: number | null; color?: string }) {
  return (
    <div>
      <p className="label">
        {label}{"  "}
        <span className="figure text-[12px]" style={{ color: "var(--text)" }}>{num(used)}</span>
        <span style={{ color: "var(--text-3)" }}> / {ceiling === null ? "no public ceiling" : num(ceiling)}</span>
      </p>
      <span className="ratio-bar mt-1.5 block">
        <i style={{
          width: ceiling ? `${Math.max(1.5, Math.min(100, (used / ceiling) * 100))}%` : "0%",
          background: color,
        }} />
      </span>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   New parts (August 2026). All server-safe: no hooks or state here; hover
   and focus are handled by the CSS in globals.css.
   ═══════════════════════════════════════════════════════════════════════ */

/**
 * The semantic colour of each section. One tint per screen, not a theme: the
 * house accent is still cyan; this only tints the hero, the eyebrow dot and
 * the pieces that preside over that screen.
 *
 * They are not nine loose colours: they are FIVE FAMILIES, and the sections
 * that tell the same story share a tint on purpose.
 *
 *   cyan        the house and its plugs            home · connections
 *   amber       money, and only money              money
 *   blue        the machines and their turns       tools · activity
 *   aquamarine  what you have set up               skills · inventory
 *   green       what the motor knows about you     memory
 *   violet      the only thing that thinks         review
 *
 * `skills` used to be amber, which in this house means money: it read as a
 * third spend screen and dragged the whole of /skills into the gold the
 * reference uses and we do not. Skills is a catalogue of what you have, just
 * like inventory, and now it shows.
 */
export const SECTION_TONE = {
  home: "var(--amber)",
  connections: "var(--amber)",
  money: "var(--spend)",
  tools: "#38BDF8",
  activity: "#38BDF8",
  skills: "#5EEAD4",
  inventory: "#5EEAD4",
  memory: "var(--saving)",
  review: "var(--review)",
} as const;

/**
 * The tile: the rounded square with a brand's logo.
 *
 * The tint comes from TINT (Brands.tsx) and tints two things: the logo and a
 * subtle glow in the background. `live=false` switches it off entirely: an
 * unconfigured connection looks grey, not in its party colour.
 */
export function Tile({
  brand, size = 38, live = true, className = "",
}: { brand: BrandName; size?: number; live?: boolean; className?: string }) {
  const Logo = BRANDS[brand];
  return (
    <span
      className={`tile ${className}`}
      data-live={live ? "yes" : "no"}
      style={{
        width: size, height: size, borderRadius: Math.round(size * 0.24),
        "--tint": TINT[brand],
        color: live ? TINT[brand] : "var(--text-3)",
      } as CSSProperties}
    >
      <Logo size={Math.round(size * 0.52)} />
    </span>
  );
}

const TONES = {
  neutral: "var(--text-3)", live: "var(--amber)", saving: "var(--saving)",
  spend: "var(--spend)", alert: "var(--alert)", review: "var(--review)",
} as const;
export type Tone = keyof typeof TONES;

/**
 * The badge: the rectangular seal like `LAUNCHAGENT` or the category badge
 * with the border in its colour. For classifying, not for states that
 * breathe: that is what the Capsule is for.
 */
export function Badge({
  children, tone = "neutral", color, title,
}: { children: ReactNode; tone?: Tone; color?: string; title?: string }) {
  return (
    <span className="badge" title={title}
          style={{ "--tone": color ?? TONES[tone] } as CSSProperties}>
      {children}
    </span>
  );
}

/**
 * The capsule: the live, round state, like `LIVE` or `ACTIVE`.
 * `beat` adds the breathing dot: only for what is really happening NOW; a
 * capsule that beats in forty places beats in none.
 */
export function Capsule({
  children, tone = "neutral", color, beat = false,
}: { children: ReactNode; tone?: Tone; color?: string; beat?: boolean }) {
  return (
    <span className="capsule" style={{ "--tone": color ?? TONES[tone] } as CSSProperties}>
      {beat
        ? <span className="beat" style={{ color: "currentcolor" }}><i /></span>
        : <span className="h-1.5 w-1.5 rounded-full" style={{ background: "currentcolor" }} />}
      {children}
    </span>
  );
}

/**
 * The card with colour distinctions.
 *
 * A content surface like Card, plus three things Card does not know:
 * - `tint`: a very subtle gradient in a brand's or a section's colour.
 * - `selected`: the strong state; it fills with the tint, like the violet
 *   Obsidian card in the reference. Only one per group.
 * - `href`: the whole card is a link, with hover and press.
 * The brackets (`frame`) are still reserved for the presiding pieces.
 */
export function Panel({
  children, tint, selected = false, frame = false, dotGrid = false,
  href, className = "",
}: {
  children: ReactNode; tint?: string; selected?: boolean; frame?: boolean;
  dotGrid?: boolean; href?: string; className?: string;
}) {
  const classes = [
    "card",
    tint && !selected ? "card-tint" : "",
    selected ? "card-selected" : "",
    frame ? "card-frame" : "",
    dotGrid ? "dot-grid" : "",
    href ? "card-pressable block" : "",
    className,
  ].filter(Boolean).join(" ");
  const style = tint ? ({ "--tint": tint } as CSSProperties) : undefined;
  const inside = (
    <>
      {frame ? <span className="corner" aria-hidden="true" /> : null}
      {children}
    </>
  );
  return href
    ? <Link href={href} className={classes} style={style}>{inside}</Link>
    : <div className={classes} style={style}>{inside}</div>;
}

/**
 * The limit bar: "LIMIT 5H · 25 / 900" with its bar underneath.
 *
 * Three possible truths, three drawings:
 * - usage and ceiling known → bar filled in proportion (and in alert from
 *   92%, which is when it is time to look at it);
 * - ceiling unknown → the bar stays empty and it says "no public ceiling";
 * - usage unknown → NoData, never a zero.
 */
export function LimitBar({
  label, used, ceiling, color = "var(--amber)", reason,
}: {
  label: string; used: number | null; ceiling: number | null;
  color?: string; reason?: string;
}) {
  if (used === null) {
    return (
      <div>
        <p className="label">{label}{"  "}<NoData reason={reason} /></p>
        <span className="ratio-bar mt-1.5 block"><i style={{ width: 0 }} /></span>
      </div>
    );
  }
  const part = ceiling ? used / ceiling : null;
  const barTone = part !== null && part >= 0.92 ? "var(--alert)" : color;
  return (
    <div>
      <p className="label">
        {label}{"  "}
        <span className="figure text-[12px]" style={{ color: "var(--text)" }}>{num(used)}</span>
        <span style={{ color: "var(--text-3)" }}> / {ceiling === null ? "no public ceiling" : num(ceiling)}</span>
      </p>
      <span className="ratio-bar mt-1.5 block">
        <i style={{
          width: part !== null ? `${Math.max(1.5, Math.min(100, part * 100))}%` : "0%",
          background: barTone,
        }} />
      </span>
    </div>
  );
}

/**
 * The rail: the row of action cards with icon, title, note and arrow.
 * It is the reference's "ATTENTION NOW": at most three or four things that
 * ask for a click. If there are more than four, it is not a rail: it is a list.
 */
export function Rail({
  actions,
}: {
  actions: {
    title: string; note?: string; href: string;
    icon?: ReactNode; tone?: string;
  }[];
}) {
  return (
    <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
      {actions.map((a) => (
        <Panel key={a.href + a.title} href={a.href} tint={a.tone}
               className="flex items-center gap-3.5 px-4 py-3.5">
          {a.icon ? (
            <span className="shrink-0" style={{ color: a.tone ?? "var(--text-2)" }}>
              {a.icon}
            </span>
          ) : null}
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[13px] font-medium" style={{ color: "var(--text)" }}>
              {a.title}
            </span>
            {a.note ? (
              <span className="mt-0.5 block truncate text-[11.5px]" style={{ color: "var(--text-3)" }}>
                {a.note}
              </span>
            ) : null}
          </span>
          <svg className="rail-arrow shrink-0" viewBox="0 0 16 16" width="13" height="13"
               fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"
               strokeLinejoin="round" aria-hidden="true"
               style={{ color: "var(--text-3)" }}>
            <path d="M4.5 11.5 11.5 4.5M6 4.5h5.5V10" />
          </svg>
        </Panel>
      ))}
    </div>
  );
}

/**
 * No data, inline.
 *
 * Empty takes up a section; this takes up the gap of ONE figure. Dashed
 * underline and the reason in the title: the lie would be the zero.
 */
export function NoData({ reason }: { reason?: string }) {
  return <span className="no-data" title={reason}>no data</span>;
}
