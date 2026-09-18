import { Header } from "@/components/Header";
import { Panel, Section, Badge, Capsule, num, ago } from "@/components/Parts";
import { Hero } from "@/components/parts/Hero";
import { HeaderHelix } from "@/components/Helix";
import { SOURCE_NAME } from "@/components/Brands";
import { ReviewCarousel, type ReviewFinding } from "@/components/parts/ReviewCarousel";
import { SourceTile, sourceTint } from "@/components/parts/SourceTile";
import { reviewNotes, health } from "@/lib/queries";

export const dynamic = "force-dynamic";

/* ─────────────────────────────────────────────────────────────────────────
   The nightly review.

   Every morning it looks at the last 24 hours and proposes improvements. It is
   the only place in the motor where something *thinks*, and even so **it runs
   nothing**: each finding brings the evidence behind it and, when there is
   one, a corrected prompt ready to copy. You decide whether to apply it.

   The screen is a hero with the review's sky and a carousel: ONE finding per
   screen, whole, with its category emblem. The emblem is a seeded sigil: the
   same category always draws the same emblem.

   It is violet because it is the only thing that is not a measured figure,
   and that has to be noticed from a metre away. Inside each card its
   category's colour leads: that is the distinction, not a new theme.
   ───────────────────────────────────────────────────────────────────────── */

function longDate(iso: string): string {
  const f = new Date(iso + "T00:00:00Z");
  if (Number.isNaN(f.getTime())) return iso;
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long", day: "numeric", month: "long", timeZone: "UTC",
  }).format(f);
}

export default function Review() {
  const ideas: ReviewFinding[] = reviewNotes().map((s) => {
    let ev: string[] = [];
    try { ev = JSON.parse(s.evidence || "[]"); } catch { ev = []; }
    return {
      id: s.id, day: s.day, category: s.category, title: s.title,
      body: s.body, evidence: ev, action: s.action || null,
      status: s.status, hook: s.hook || null,
    };
  });

  const fresh = ideas.filter((s) => s.status === "new").length;
  const withPrompt = ideas.filter((s) => s.action).length;
  const latest = ideas[0]?.day ?? null;

  return (
    <>
      <Header path="review" />
      <div className="flex flex-col gap-8 px-6 py-7">

        {/* ── the hero: the review's sky ─────────────────────────────── */}
        <Hero tint="var(--review)" seed={31} stars={150}>
          <div className="pointer-events-none absolute bottom-7 right-9 opacity-60 max-lg:hidden"
               aria-hidden="true">
            <HeaderHelix width={250} />
          </div>
          <div className="relative p-7 pb-8 md:p-10 md:pb-11">
            <div className="flex flex-wrap items-center gap-2.5">
              <Badge color="var(--review)">nightly review</Badge>
              {latest ? <span className="label">{longDate(latest)}</span> : null}
            </div>

            {ideas.length ? (
              <>
                <h1 className="mt-4 max-w-[860px] text-balance text-[30px] font-light leading-[1.12] tracking-tight md:text-[38px]">
                  {fresh > 0 ? (
                    <>The review found{" "}
                      <b className="font-semibold">{fresh} {fresh === 1 ? "idea" : "ideas"}</b>{" "}
                      worth a look.</>
                  ) : (
                    <>No new findings: there are{" "}
                      <b className="font-semibold">{ideas.length}</b> left in the archive.</>
                  )}
                </h1>
                <p className="mt-3 max-w-[560px] text-[13px] leading-relaxed"
                   style={{ color: "var(--text-2)" }}>
                  It suggests, it does not run: each finding comes with the evidence behind
                  it{withPrompt ? <> and {withPrompt} of {ideas.length} bring the corrected
                  prompt, ready to copy</> : null}. The motor never touches your files.
                </p>
              </>
            ) : (
              <>
                <h1 className="mt-4 max-w-[860px] text-balance text-[30px] font-light leading-[1.12] tracking-tight md:text-[38px]">
                  The review is <b className="font-semibold">waiting to wake up</b>.
                </h1>
                <p className="mt-3 max-w-[560px] text-[13px] leading-relaxed"
                   style={{ color: "var(--text-2)" }}>
                  No finding has been stored yet. When the review runs, its
                  ideas will show up here with their evidence and, when there is one, the
                  corrected prompt ready to copy. Below is the real state of each source
                  it will read that night.
                </p>
              </>
            )}

          </div>
        </Hero>

        {/* ── what leaves the machine: said on screen, not only in the code ── */}
        <Panel className="p-4">
          <p className="label" style={{ color: "var(--review)" }}>review privacy</p>
          <p className="mt-1.5 max-w-[860px] text-[12px] leading-relaxed" style={{ color: "var(--text-2)" }}>
            The findings are computed with SQL on this machine. <b>With --dry-run</b> nothing leaves. Without
            --dry-run, the <b>facts</b> of each finding (which can include the start of a prompt, note titles or
            project names) are sent to Anthropic with <span className="datum">claude -p</span> to
            phrase them. Reading your conversations (<span className="datum">MOTOR_REVIEW_READS=1</span>) is
            off by default. The notes saved "without phrasing" come from --dry-run mode.
          </p>
        </Panel>

        {/* ── the findings carousel ──────────────────────────────────── */}
        {ideas.length ? <ReviewCarousel ideas={ideas} /> : null}

        <Sources />
      </div>
    </>
  );
}

/**
 * The review's sources: what it will read tonight, with their REAL state.
 *
 * "Answering" here means exactly this: the reader's last pass ended without
 * an error. It is not a decorative "LIVE": it comes from the `health` table,
 * row by row, with the time of the last good read next to it.
 */
function Sources() {
  const sources = health();
  if (!sources.length) return null;
  const ok = sources.filter((f) => Boolean(f.last_ok) && !f.error).length;
  const withNote = sources.some((f) => f.note && !f.error);

  return (
    <section className="flex flex-col gap-4">
      <Section eyebrow="last night's sources" tint="var(--review)"
               note="The review can only suggest about what it managed to read: a source that is down is a gap in the findings, not one finding less."
               meta={`${ok} of ${sources.length} answering`}>
        What the review reads
      </Section>
      <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
        {sources.map((f) => {
          const live = Boolean(f.last_ok) && !f.error;
          const name = SOURCE_NAME[f.source]
            ?? f.source.charAt(0).toUpperCase() + f.source.slice(1);
          return (
            <Panel key={f.source}
                   tint={live ? sourceTint(f.source) : "var(--alert)"}
                   className="flex items-center gap-3 px-4 py-3">
              <SourceTile source={f.source} size={34} live={live} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-medium">{name}</p>
                <p className="datum mt-0.5 truncate" style={{ color: "var(--text-3)" }}
                   title={f.note ?? undefined}>
                  {f.error
                    ? f.error
                    : <>{num(f.row_count)} {f.row_count === 1 ? "row" : "rows"} · read {ago(f.last_ok)}{f.note ? " · *" : ""}</>}
                </p>
              </div>
              {live
                ? <Capsule tone="saving">ok</Capsule>
                : <Capsule tone="alert">error</Capsule>}
            </Panel>
          );
        })}
      </div>
      {withNote ? (
        <p className="label">* the source answers but with caveats: the detail, on hover</p>
      ) : null}
    </section>
  );
}
