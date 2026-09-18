import { Header } from "@/components/Header";
import {
  Section, num, Panel, Tile, Badge, Capsule, Gauge,
  SECTION_TONE,
} from "@/components/Parts";
import { TINT, brandOf, type BrandName } from "@/components/Brands";
import { Hero } from "@/components/parts/Hero";
import { memorySummary, staleMemory, memoryChain, flanks } from "@/lib/queries";
import { recentMemoryWithPath } from "@/lib/memory-queries";
import { Chain } from "@/components/Chain";
import { Chain3D } from "@/components/Chain3D";
import { rows } from "@/lib/db";

export const dynamic = "force-dynamic";

const STALE = 10;

/** Which brand dresses each memory system. Presentation, not data:
    claude-mem is Claude's, the vault lives in Obsidian, hermes is Hermes. */
const SYSTEM_BRAND: Record<string, BrandName> = {
  "claude-mem": "anthropic", vault: "obsidian", hermes: "hermes",
};
const systemBrand = (s: string): BrandName => SYSTEM_BRAND[s] ?? brandOf(s);

/** The colour of an age, with the same scale as the DNA chain:
    green what was touched recently, amber what is over 10 days, pink the frozen. */
function ageTone(days: number): string {
  if (days > 30) return "var(--alert)";
  if (days > STALE) return "var(--spend)";
  return "var(--saving)";
}
const age = (days: number) => (days === 0 ? "today" : `${days}d ago`);

/** Which corner a file comes from, for when two have the same name.
    In claude-mem it is the project; elsewhere, the folder next to it. */
function corner(path: string): string {
  const project = path.match(/\.claude\/projects\/([^/]+)\/memory\//)?.[1];
  if (project) return project.replace(/^-Users-[^-]+-/, "");
  return path.split("/").at(-2) ?? "";
}

/** The titles that appear more than once in a list: those, and only those,
    get their corner shown so they do not look like duplicated rows. */
function repeated(list: { title: string }[]): Set<string> {
  const seen = new Set<string>(), rep = new Set<string>();
  for (const { title } of list) (seen.has(title) ? rep : seen).add(title);
  return rep;
}

export default function Memory() {
  const summary = memorySummary();
  const stale = staleMemory(20);
  const fresh = recentMemoryWithPath(14);
  const chain = memoryChain();
  const fl = flanks();
  const universes = rows<{ name: string; description: string; uses: number }>(
    `SELECT name, description, uses FROM inventory WHERE kind='universe' ORDER BY uses DESC`);

  const staleRep = repeated(stale);
  const freshRep = repeated(fresh);
  const total = summary.reduce((s, r) => s + r.total, 0);
  const old = summary.reduce((s, r) => s + r.stale, 0);
  const freshness = total ? Math.round(((total - old) / total) * 100) : 0;
  const freshnessTone = freshness > 70 ? "var(--saving)" : freshness > 40 ? "var(--spend)" : "var(--alert)";
  const TONE = SECTION_TONE.memory;

  return (
    <>
      <Header path="memory" />
      <div className="flex flex-col gap-8 px-6 py-7">

        <Hero tint={TONE} seed={23}>
          <div className="flex flex-col gap-3 px-7 py-8">
            <div className="flex flex-wrap items-center gap-2.5">
              <Badge color={TONE}>memory · the system's dna</Badge>
              <span className="label">{summary.length} indexed systems</span>
            </div>
            <h1 className="headline max-w-[680px]">
              <b>{num(total)}</b> <span>indexed files</span>
            </h1>
            <p className="max-w-[640px] text-[13px] leading-relaxed" style={{ color: "var(--text-2)" }}>
              Each base pair is a file, sorted by freshness: what you touched today on the
              left, what has been frozen for months on the right. Where the chain stops being
              green and turns amber is exactly where the AI starts working with expired
              context.
            </p>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <Capsule tone="saving">{num(chain.length - old)} fresh</Capsule>
              <Capsule tone={old ? "spend" : "saving"}>{num(old)} stale</Capsule>
              <Badge tone="alert" title="the days of the file that has gone untouched the longest">
                the most frozen · {chain.at(-1)?.days ?? 0} d
              </Badge>
            </div>
          </div>
        </Hero>

        <Chain pairs={chain} />

        <Section eyebrow="freshness by system" tint={TONE}>
          What it knows about you, and how much of it has expired
        </Section>

        <div className="grid gap-4 lg:grid-cols-[1fr_2fr]">
          <Panel tint={freshnessTone} className="flex flex-col p-5">
            <div className="flex items-center gap-5">
              <Gauge part={freshness / 100} caption="fresh" color={freshnessTone} size={92} />
              <div>
                <p className="label">memory freshness</p>
                <p className="mt-1.5 text-[13px] leading-snug" style={{ color: "var(--text)" }}>
                  {num(total - old)} of {num(total)} files
                </p>
                <p className="mt-0.5 text-[11.5px]" style={{ color: "var(--text-3)" }}>
                  touched in the last {STALE} days
                </p>
              </div>
            </div>
            <p className="mt-4 border-t pt-3 text-[11.5px] leading-relaxed" style={{ color: "var(--text-3)" }}>
              An old memory is not neutral: it is wrong context that slips into
              every new session and that the model believes.
            </p>
          </Panel>

          <div className="grid gap-3 sm:grid-cols-2">
            {summary.map((r, i) => {
              const brand = systemBrand(r.system);
              const part = r.total ? (r.total - r.stale) / r.total : 0;
              const wide = i === summary.length - 1 && summary.length % 2 === 1;
              return (
                <Panel key={r.system} tint={TINT[brand]}
                       className={`p-4${wide ? " sm:col-span-2" : ""}`}>
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <Tile brand={brand} size={34} />
                      <div className="min-w-0">
                        <p className="truncate text-[13px] font-medium">{r.system}</p>
                        <p className="label mt-0.5">{num(r.total)} files</p>
                      </div>
                    </div>
                    {r.stale
                      ? <Badge tone="spend">{num(r.stale)} stale</Badge>
                      : <Capsule tone="saving">up to date</Capsule>}
                  </div>
                  <span className="ratio-bar mt-3.5 block">
                    <i style={{ width: `${Math.max(1.5, part * 100)}%`,
                                background: r.stale ? "var(--spend)" : "var(--saving)" }} />
                  </span>
                  <p className="mt-1.5 text-[11.5px]"
                     style={{ color: r.stale ? "var(--spend)" : "var(--saving)" }}>
                    {r.stale
                      ? `${num(r.stale)} untouched for ${STALE}+ days`
                      : "all fresh"}
                  </p>
                </Panel>
              );
            })}
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <section className="flex flex-col gap-3">
            <Section eyebrow="what no longer looks like you" tint="var(--alert)"
                     meta={`${stale.length} files · the oldest first`}>
              The stalest
            </Section>
            <Panel className="overflow-hidden">
              {stale.map((m) => (
                <div key={m.path}
                     className="flex items-center gap-3 border-b px-4 py-2.5 transition-colors last:border-0 hover:bg-white/[.025]">
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full"
                        style={{ background: ageTone(m.days_untouched) }} aria-hidden="true" />
                  <span className="flex min-w-0 flex-1 items-baseline gap-2">
                    <span className="min-w-0 truncate text-[12.5px]" title={m.path}>{m.title}</span>
                    {staleRep.has(m.title) ? (
                      <span className="datum max-w-[150px] shrink-0 truncate text-[10.5px]"
                            style={{ color: "var(--text-3)" }} title={m.path}>
                        {corner(m.path)}
                      </span>
                    ) : null}
                  </span>
                  <Badge color={TINT[systemBrand(m.system)]}>{m.system}</Badge>
                  <span className="datum w-[64px] text-right" style={{ color: ageTone(m.days_untouched) }}>
                    {age(m.days_untouched)}
                  </span>
                </div>
              ))}
            </Panel>
          </section>

          <section className="flex flex-col gap-3">
            <Section eyebrow="freshly written" tint={TONE}
                     meta={`${fresh.length} files · today's first`}>
              The last thing you touched
            </Section>
            <Panel className="overflow-hidden">
              {fresh.map((m) => (
                <div key={m.path}
                     className="flex items-center gap-3 border-b px-4 py-2.5 transition-colors last:border-0 hover:bg-white/[.025]">
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full"
                        style={{ background: "var(--saving)" }} aria-hidden="true" />
                  <span className="flex min-w-0 flex-1 items-baseline gap-2">
                    <span className="min-w-0 truncate text-[12.5px]" title={m.path}>{m.title}</span>
                    {freshRep.has(m.title) ? (
                      <span className="datum max-w-[150px] shrink-0 truncate text-[10.5px]"
                            style={{ color: "var(--text-3)" }} title={m.path}>
                        {corner(m.path)}
                      </span>
                    ) : null}
                  </span>
                  <Badge color={TINT[systemBrand(m.system)]}>{m.system}</Badge>
                  <span className="datum w-[64px] text-right" style={{ color: "var(--saving)" }}>
                    {age(m.days_untouched)}
                  </span>
                </div>
              ))}
            </Panel>
          </section>
        </div>

        <section className="flex flex-col gap-3">
          <Section eyebrow="the same chain, in three dimensions" tint={TONE}
                   meta="drag to rotate"
                   note={<>From the front, forty files overlap. Rotating it separates them, and the
                          real density shows. On the sides go the other two strands of your system:{" "}
                          {fl.skills.length} skills and {fl.agents.length} agents, lit up the ones
                          that have been used at some point.</>}>
            The same chain, standing up
          </Section>
          <Chain3D pairs={chain}
                   left={{ title: `${fl.skills.length} skills`, points: fl.skills }}
                   right={{ title: `${fl.agents.length} agents`, points: fl.agents }} />
        </section>

        <section className="flex flex-col gap-3">
          <Section eyebrow="multiverso" tint={TINT.multiverso}
                   meta={`${universes.length} universes`}>
            The map of universes
          </Section>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {universes.map((u) => (
              <Panel key={u.name} tint={TINT.multiverso} className="p-4">
                <div className="flex items-center gap-3">
                  <Tile brand="multiverso" size={30} />
                  <p className="min-w-0 flex-1 truncate text-[13px] font-medium">{u.name}</p>
                  <span className="figure text-[15px]" style={{ color: TINT.multiverso }}>{num(u.uses)}</span>
                </div>
                <p className="label mt-2">nodes</p>
                <p className="mt-1.5 line-clamp-3 text-[11.5px] leading-snug" style={{ color: "var(--text-3)" }}>
                  {u.description}
                </p>
              </Panel>
            ))}
          </div>
          <p className="text-[11.5px] leading-relaxed" style={{ color: "var(--text-3)" }}>
            Optional adapter (MOTOR_MULTIVERSO): it reads the manifest of an already generated index,
            it recomputes nothing. Without the variable, this section stays empty.
          </p>
        </section>
      </div>
    </>
  );
}
