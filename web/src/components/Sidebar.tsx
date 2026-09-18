"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BRANDS } from "./Brands";
import { SECTION_TONE } from "./Parts";

/* The sidebar. It follows the pattern of the screenshots: two groups, and the
   connected tools as cards of their own at the bottom, not as one more list
   entry, because they are not sections: they are machines.

   The active entry is painted with the tint of ITS section, not with the
   fixed cyan from before. That way the sidebar works as the legend of the
   colour code without spending a line explaining it: you go into Memory and
   the pill is green, the same green as the hero you are looking at. The
   order of the list is that of the SECTION_TONE families (cyan, amber, blue,
   aquamarine, green, violet), so going down the sidebar walks the scale. */

const OPERATION = [
  { href: "/", text: "Home", icon: "home", tone: SECTION_TONE.home },
  { href: "/connections", text: "Connections", icon: "plug", tone: SECTION_TONE.connections },
  { href: "/money", text: "Money", icon: "bolt", tone: SECTION_TONE.money },
  { href: "/tools", text: "Tools", icon: "blocks", tone: SECTION_TONE.tools },
  { href: "/activity", text: "Activity", icon: "pulse", tone: SECTION_TONE.activity },
  { href: "/skills", text: "Skills", icon: "spark", tone: SECTION_TONE.skills },
  { href: "/inventory", text: "Inventory", icon: "blocks", tone: SECTION_TONE.inventory },
  { href: "/memory", text: "Memory", icon: "brain", tone: SECTION_TONE.memory },
  { href: "/review", text: "Nightly review", icon: "moon", tone: SECTION_TONE.review },
] as const;

const ICONS: Record<string, React.ReactNode> = {
  home:   <path d="M2.5 7 8 2.5 13.5 7v6.5a1 1 0 0 1-1 1h-9a1 1 0 0 1-1-1V7Z" />,
  bolt:   <path d="M9 1.5 3.5 9H7l-.5 5.5L12.5 7H9l.5-5.5Z" />,
  pulse:  <path d="M1.5 8h3l2-5 3 10 2-5h3" />,
  blocks: <path d="M2.5 2.5h4.2v4.2H2.5zM9.3 2.5h4.2v4.2H9.3zM2.5 9.3h4.2v4.2H2.5zM9.3 9.3h4.2v4.2H9.3z" />,
  brain:  <path d="M6 2.5a2.2 2.2 0 0 0-2.2 2.2A2 2 0 0 0 2.5 6.6c0 .9.6 1.7 1.4 2a2 2 0 0 0 1.9 2.6c.2 1.3 1.1 2.3 2.2 2.3M10 2.5a2.2 2.2 0 0 1 2.2 2.2 2 2 0 0 1 1.3 1.9c0 .9-.6 1.7-1.4 2a2 2 0 0 1-1.9 2.6c-.2 1.3-1.1 2.3-2.2 2.3" />,
  moon:   <path d="M13 9.6A5.6 5.6 0 0 1 6.4 3 5.8 5.8 0 1 0 13 9.6Z" />,
  spark:  <path d="M8 1.6 9.6 6l4.4 1.6L9.6 9.2 8 13.6 6.4 9.2 2 7.6 6.4 6 8 1.6Z" />,
  plug:   <path d="M6 1.8v3.4M10 1.8v3.4M3.6 5.2h8.8v2.6a4.4 4.4 0 0 1-8.8 0V5.2ZM8 12.2v2" />,
};

function Ico({ n }: { n: string }) {
  return (
    <svg viewBox="0 0 16 16" width="15" height="15" fill="none" stroke="currentColor"
         strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {ICONS[n]}
    </svg>
  );
}

export function Sidebar({ machines }: { machines: { id: string; name: string; ok: boolean }[] }) {
  const path = usePathname();
  return (
    <nav className="fixed inset-y-0 left-0 z-20 hidden w-[236px] flex-col border-r md:flex"
         style={{ background: "var(--floor)" }} aria-label="Sections">
      <Link href="/" className="flex items-center gap-2.5 px-5 py-5">
        <Emblem />
        <span>
          <span className="block text-[14px] font-semibold tracking-tight">Motor Agéntico</span>
          <span className="label block">local · read-only</span>
        </span>
      </Link>

      <div className="flex-1 overflow-y-auto px-3">
        <p className="label px-2 pb-2 pt-3">// operation</p>
        <ul className="flex flex-col gap-0.5">
          {OPERATION.map((e) => {
            const active = e.href === "/" ? path === "/" : path.startsWith(e.href);
            return (
              <li key={e.href}>
                <Link href={e.href} aria-current={active ? "page" : undefined}
                      className="relative flex items-center gap-2.5 rounded-[4px] px-2.5 py-2 text-[13px] transition-colors"
                      style={active
                        ? { background: e.tone, color: "#080C10", fontWeight: 600 }
                        : { color: "var(--text-2)" }}>
                  <Ico n={e.icon} />
                  {e.text}
                </Link>
              </li>
            );
          })}
        </ul>

        {/* The two assistants have a board of their own: they are not a status
            line, they are machines with their life inside. They carry their brand. */}
        <p className="label px-2 pb-2 pt-6">// assistants</p>
        <div className="flex flex-col gap-2">
          {/* Every brand keeps ITS colour. The one-accent rule governs the
              interface, not other people's logos: painting Hermes cyan would
              invent an identity it does not have. */}
          <Assistant href="/machines/hermes" active={path.startsWith("/machines/hermes")}
                     tone="#F5B301"
                     ok={machines.find((m) => m.id === "hermes")?.ok}>
            <span style={{ color: "#F5B301" }}><BRANDS.hermes size={26} /></span>
            <span className="datum text-[12.5px] font-bold tracking-[.14em]"
                  style={{ color: "#F5B301", textShadow: "0 0 14px rgb(245 179 1 / .5)" }}>
              HERMES
            </span>
          </Assistant>
          <Assistant href="/machines/openclaw" active={path.startsWith("/machines/openclaw")}
                     tone="#FB7185"
                     ok={machines.find((m) => m.id === "openclaw")?.ok}>
            <span className="text-[18px] font-bold tracking-tight"
                  style={{
                    background: "linear-gradient(90deg,#FB7185,#F472B6)",
                    WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
                  }}>
              OpenClaw
            </span>
          </Assistant>
        </div>

        <p className="label px-2 pb-2 pt-6">// sources</p>
        <div className="flex flex-col gap-1">
          {machines.filter((m) => !["hermes", "openclaw"].includes(m.id)).map((m) => (
            <div key={m.id} className="flex items-center gap-2.5 px-2.5 py-1.5">
              <span className="beat" style={{ color: m.ok ? "var(--saving)" : "var(--text-3)" }}><i /></span>
              <span className="flex-1 truncate text-[12px]" style={{ color: "var(--text-2)" }}>{m.name}</span>
              <span className="label">{m.ok ? "ok" : "off"}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="border-t px-5 py-3.5">
        <p className="label leading-relaxed">
          the reader sends nothing out<br />the review with an LLM does: see /review
        </p>
      </div>
    </nav>
  );
}

/**
 * A machine with a board of its own. The brand leads; the dot says whether it breathes.
 *
 * `tone` is THAT brand's colour: the active one fills with it, just like the
 * section entry fills with its own. Before, the only sign of being inside
 * Hermes was a cyan border one shade lighter: invisible next to the filled
 * pill of the nine sections, so on /machines/… the sidebar seemed to have no
 * active item at all.
 */
function Assistant({
  href, active, ok, tone, children,
}: {
  href: string; active: boolean; ok?: boolean; tone: string;
  children: React.ReactNode;
}) {
  return (
    <Link href={href} aria-current={active ? "page" : undefined}
          className="relative flex h-[58px] items-center justify-center gap-2.5 rounded-[6px] transition-colors"
          style={{
            background: active
              ? `color-mix(in oklab, ${tone} 14%, var(--card))`
              : "var(--card)",
            border: `1px solid ${active
              ? `color-mix(in oklab, ${tone} 52%, transparent)`
              : "var(--border)"}`,
            boxShadow: active
              ? `0 12px 38px -22px color-mix(in oklab, ${tone} 70%, transparent)`
              : undefined,
          }}>
      {children}
      <span className="beat absolute right-2.5 top-2.5"
            style={{ color: ok ? "var(--saving)" : "var(--text-3)" }}><i /></span>
    </Link>
  );
}

/** The emblem: a square gear. */
function Emblem() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
      <path d="M12 3.2 20.5 7.6v8.8L12 20.8 3.5 16.4V7.6L12 3.2Z" fill="none"
            stroke="var(--amber)" strokeWidth="1.2" opacity=".6" />
      <circle cx="12" cy="12" r="3.4" fill="none" stroke="var(--amber)" strokeWidth="1.4" />
      <circle cx="12" cy="12" r="1.1" fill="var(--amber)" />
    </svg>
  );
}
