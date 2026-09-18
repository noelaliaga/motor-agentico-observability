import { Header } from "@/components/Header";
import {
  Section, Panel, Gauge, Capsule, Badge, Bar, num, ago, SECTION_TONE,
} from "@/components/Parts";
import { CatalogHero } from "@/components/parts/CatalogHero";
import { Mosaic } from "@/components/parts/Mosaic";
import { Collapsible } from "@/components/parts/Collapsible";
import { ScopeBadge, scopeTone } from "@/components/parts/Scope";
import { skills, skillsByScope, mostInvoked } from "@/lib/queries";

export const dynamic = "force-dynamic";

const SCOPE = {
  global: "global", project: "project", hermes: "Hermes",
} as Record<string, string>;

export default function Skills() {
  const all = skills();
  const byScope = skillsByScope();
  const top = mostInvoked("skill", 10);
  const used = all.filter((s) => s.uses > 0);
  const neverUsed = all.length - used.length;
  const maxTop = Math.max(...top.map((t) => t.n), 1);
  const TONE = SECTION_TONE.skills;

  return (
    <>
      <Header path="skills" />
      <div className="flex flex-col gap-9 px-6 py-7 pb-14">

        <CatalogHero
          tint={TONE} seed={21} badge="skills"
          meta={`${byScope.length} scopes · usage counted in transcripts`}
          figure={num(used.length)}
          rest={`of ${num(all.length)} skills have been used at some point`}
          extra={
            <>
              <Capsule color={TONE}>{num(used.length)} active</Capsule>
              <Badge tone="neutral">{num(neverUsed)} never used</Badge>
            </>
          }
        >
          What you have packaged and ready to invoke. The number that matters is not
          how many there are: it is how many have ever worked; the rest are hours of
          packaging that do not pay off yet.
        </CatalogHero>

        {/* ── the disproportion, told with its body ───────────────────── */}
        <section className="flex flex-col gap-3">
          <Section eyebrow="packaged versus used" tint={TONE}
                   note="Each square is an installed skill; lit, one that has actually been invoked."
                   meta={`${used.length} of ${all.length}`}>
            The disproportion
          </Section>
          <Panel dotGrid className="grid items-center gap-7 p-6 lg:grid-cols-[auto_1fr]">
            <Gauge
              part={all.length ? used.length / all.length : null}
              caption="used" color={TONE} size={104}
            />
            <div className="min-w-0">
              <Mosaic
                total={all.length} lit={used.length} color={TONE}
                caption={`${used.length} skills used out of ${all.length} installed`}
              />
              <p className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-[11.5px]"
                 style={{ color: "var(--text-3)" }}>
                <span className="inline-flex items-center gap-2">
                  <span className="h-2 w-2 rounded-[2px]" style={{ background: TONE }} />
                  used at some point
                </span>
                <span className="inline-flex items-center gap-2">
                  <span className="h-2 w-2 rounded-[2px]" style={{ background: "rgb(255 255 255 / .06)" }} />
                  installed and in the dark
                </span>
              </p>
            </div>
          </Panel>
        </section>

        {/* ── the ones that do work ───────────────────────────────────── */}
        <section className="flex flex-col gap-3">
          <Section eyebrow="the ones that do work" tint={TONE}
                   meta="real invocations, not declared ones">
            The ones you fire most
          </Section>
          <div className="grid gap-2 md:grid-cols-2">
            {top.map((s, i) => (
              <Panel key={s.name} tint={i === 0 ? TONE : undefined} selected={i === 0}
                     className="flex items-center gap-3.5 px-4 py-3">
                <span className="figure w-6 shrink-0 text-[12px]" style={{ color: "var(--text-3)" }}>
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px]" style={{ color: "var(--text)" }}>
                    {s.name}
                  </span>
                  <span className="label">last used {ago(s.last)}</span>
                </span>
                <span className="hidden w-[84px] shrink-0 sm:block">
                  <Bar part={s.n / maxTop} color={TONE} />
                </span>
                <span className="figure w-[52px] shrink-0 text-right text-[16px]" style={{ color: TONE }}>
                  {num(s.n)}
                </span>
              </Panel>
            ))}
          </div>
        </section>

        {/* ── the catalogue, by scope ─────────────────────────────────── */}
        {byScope.map((a) => {
          const group = all.filter((s) => s.scope === a.scope);
          const alive = group.filter((s) => s.uses > 0);
          const dormant = group.filter((s) => !s.uses);
          const tone = scopeTone(a.scope);
          const row = (s: (typeof group)[number]) => (
            <div key={s.scope + s.name}
                 className="flex items-baseline gap-2.5 rounded-[4px] px-3 py-2"
                 style={{ background: s.uses ? "var(--card)" : "transparent",
                          border: `1px solid ${s.uses ? "var(--border)" : "transparent"}` }}>
              <span className="h-1.5 w-1.5 shrink-0 rounded-full"
                    style={{ background: s.uses ? tone : "rgb(255 255 255 / .14)" }} />
              <span className="min-w-0 flex-1 truncate text-[12.5px]"
                    style={{ color: s.uses ? "var(--text)" : "var(--text-3)" }}>{s.name}</span>
              <span className="datum text-[11px]"
                    style={{ color: s.uses ? tone : "var(--text-3)" }}>
                {s.uses || "—"}
              </span>
            </div>
          );
          return (
            <section key={a.scope} className="flex flex-col gap-3">
              <Section badge={<ScopeBadge scope={a.scope} />} tint={tone}
                       meta={<p className="label">
                         <span style={{ color: tone }}>{a.used}</span> of {a.total} used
                       </p>}>
                {SCOPE[a.scope] ?? a.scope} skills
              </Section>
              <Bar part={a.total ? a.used / a.total : 0} color={tone} />
              {alive.length ? (
                <div className="grid gap-1.5 md:grid-cols-2 xl:grid-cols-3">
                  {alive.map(row)}
                </div>
              ) : null}
              {dormant.length ? (
                <Collapsible
                  closed={`see the ${num(dormant.length)} never used`}
                  open={`fold the ${num(dormant.length)} never used`}
                >
                  <div className="grid gap-1.5 md:grid-cols-2 xl:grid-cols-3">
                    {dormant.map(row)}
                  </div>
                </Collapsible>
              ) : null}
            </section>
          );
        })}

        <p className="max-w-[720px] text-[11.5px] leading-relaxed" style={{ color: "var(--text-3)" }}>
          Usage comes from counting the real invocations in your transcripts and the{" "}
          <span className="datum">use_count</span> Hermes stores. A perfectly written skill
          that was never invoked shows as zero, because zero is what it is yielding.
        </p>
      </div>
    </>
  );
}
