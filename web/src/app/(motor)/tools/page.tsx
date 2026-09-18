import { Header } from "@/components/Header";
import { Strip } from "@/components/Headline";
import {
  Card, Label, Section, Bar, Gauge, LimitBar, Tile, Badge, Capsule,
  NoData, usd, num, tok, SECTION_TONE,
} from "@/components/Parts";
import { Hero } from "@/components/parts/Hero";
import { LinkCard } from "@/components/parts/LinkCard";
import { TINT, type BrandName } from "@/components/Brands";
import {
  TOOLS, toolSummary, modelsOf, daysOf, usageWindows, realOpenRouter,
} from "@/lib/tools";
import { subscriptions } from "@/lib/queries";

export const dynamic = "force-dynamic";

const TONE = SECTION_TONE.tools;

/**
 * The time axis without tricks: daysOf() only returns days WITH rows, so a
 * month with gaps was silently compressed and the bars sat together as if the
 * usage had been continuous. Here the whole range is filled in: the database
 * records every turn, so the absence of rows on a day IS a real zero, not a
 * made-up figure. Those days are drawn as a neutral gap ("no usage"), not as
 * a measured bar.
 */
function dayRange(days: { day: string; usd: number; turns: number }[]) {
  if (!days.length) return [];
  const byDay = new Map(days.map((d) => [d.day, d]));
  const end = new Date(days[days.length - 1].day + "T00:00:00Z").getTime();
  const range: { day: string; usd: number; turns: number; noUsage: boolean }[] = [];
  for (let t = new Date(days[0].day + "T00:00:00Z").getTime(); t <= end; t += 86400000) {
    const key = new Date(t).toISOString().slice(0, 10);
    const d = byDay.get(key);
    range.push(d ? { ...d, noUsage: false } : { day: key, usd: 0, turns: 0, noUsage: true });
  }
  return range;
}

export default async function Tools({
  searchParams,
}: { searchParams: Promise<{ h?: string }> }) {
  const sp = await searchParams;
  const sel = TOOLS.find((x) => x.id === sp.h) ?? TOOLS[0];
  const selTint = TINT[sel.brand as BrandName];

  const res = toolSummary(sel.source);
  const models = sel.source ? modelsOf(sel.source) : [];
  const days = sel.source ? daysOf(sel.source) : [];
  const real = realOpenRouter();
  const subs = subscriptions();

  const measured = TOOLS.filter((h) => h.knows !== "no spend").length;
  const blind = TOOLS.length - measured;

  const range = dayRange(days);
  const maxDay = Math.max(...days.map((d) => d.usd), 0.01);
  const totalUsd = res?.usd ?? 0;

  return (
    <>
      <Header path="tools" />
      <div className="flex flex-col gap-9 px-6 py-7">

        <Hero tint={TONE} seed={31}>
          <div className="flex flex-col gap-3 px-7 py-8">
            <div className="flex flex-wrap items-center gap-2.5">
              <Badge color={TONE}>tools · the machines</Badge>
              <span className="label">what runs in this house</span>
            </div>
            <h1 className="headline max-w-[680px]">
              <b>{TOOLS.length}</b> <span>connected machines</span>
            </h1>
            <p className="max-w-[640px] text-[13px] leading-relaxed" style={{ color: "var(--text-2)" }}>
              Pick one and you will see what it spends, with which models and how much it has used in
              this window. The ones that do not record their consumption say so out loud: "no data" is
              a fact; a zero would be a lie.
            </p>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <Capsule tone="saving">{measured} with measured spend</Capsule>
              <Capsule tone="spend">{blind} without a counter of their own</Capsule>
            </div>
          </div>
        </Hero>

        {/* ── the selector: the chosen one fills with its brand's colour ── */}
        <div className="grid gap-2.5 sm:grid-cols-3 xl:grid-cols-5">
          {TOOLS.map((h) => {
            const active = h.id === sel.id;
            const r = toolSummary(h.source);
            return (
              <LinkCard key={h.id} href={`/tools?h=${h.id}`}
                        selected={active} tint={TINT[h.brand as BrandName]}
                        className="px-4 py-3.5">
                <div className="flex items-center gap-2.5">
                  <Tile brand={h.brand as BrandName} size={32} />
                  <span className="min-w-0 flex-1 truncate text-[13px] font-medium"
                        style={{ color: active ? "var(--text)" : "var(--text-2)" }}>
                    {h.name}
                  </span>
                </div>
                <p className="figure mt-3 text-[19px]"
                   style={{ color: h.knows === "no spend" ? "var(--text-3)" : "var(--text)" }}>
                  {h.knows === "no spend"
                    ? <NoData reason={h.why ?? undefined} />
                    : usd(r?.usd ?? 0)}
                </p>
                <p className="label mt-1">{h.provider}</p>
              </LinkCard>
            );
          })}
        </div>

        {/* ── the chosen one ──────────────────────────────────────────── */}
        <section className="flex flex-col gap-4">
          <Section eyebrow="the chosen machine" tint={selTint}
                   meta={<Badge color={selTint}>{sel.billing}</Badge>}>
            {sel.name}
          </Section>

          {sel.knows === "no spend" ? (
            <Card className="p-6">
              <div className="flex flex-wrap items-start gap-5">
                {/* The machine is alive: what is missing is its counter, not it.
                    The tile keeps its colour; the figure states the gap. */}
                <Tile brand={sel.brand as BrandName} size={52} />
                <div className="min-w-[260px] flex-1">
                  <p className="figure text-[27px]"><NoData reason="it does not record its consumption" /></p>
                  <p className="mt-2.5 max-w-[680px] text-[13px] leading-relaxed"
                     style={{ color: "var(--text-2)" }}>
                    {sel.why}
                  </p>
                  {["hermes", "openclaw"].includes(sel.id) ? (
                    <p className="mt-4 border-t pt-3.5 text-[12.5px] leading-relaxed"
                       style={{ color: "var(--text-3)" }}>
                      What is counted is its real money:{" "}
                      <b style={{ color: "var(--alert)" }}>{usd(real)}</b> billed on
                      OpenRouter, which covers Hermes and OpenClaw together. Separating them requires
                      a <i>management key</i>.
                    </p>
                  ) : null}
                </div>
              </div>
            </Card>
          ) : (
            <>
              <Strip items={[
                { label: "api equivalent", value: usd(totalUsd), tone: "var(--spend)" },
                { label: "turns", value: num(res?.turns ?? 0) },
                { label: "sessions", value: num(res?.sessions ?? 0) },
                {
                  label: "since",
                  // The date is a single word: split over two lines ("2026-/07-18")
                  // it stops being a date. One point smaller and it does not break.
                  value: <span className="whitespace-nowrap text-[21px]">{res?.first_day ?? "—"}</span>,
                  tone: "var(--text-2)",
                },
              ]} />

              <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
                {/* flex-col + flex-1: the sibling card ("by model") sets the
                    row height, and before the chart stayed at its fixed 7rem
                    with a third of the card empty underneath. */}
                <Card dotGrid className="flex flex-col p-5">
                  <Label>by day</Label>
                  <div role="img"
                       aria-label={`Spend per day from ${range[0]?.day} to ${range.at(-1)?.day}: ${usd(totalUsd)} in total`}
                       className="mt-4 flex min-h-28 flex-1 items-end gap-[3px]">
                    {range.map((d) =>
                      d.noUsage ? (
                        /* A day without a single row: a real zero. It is drawn
                           as a neutral gap, not as a measured bar in the spend
                           colour: the difference between "did not use" and
                           "spent little" has to show. */
                        <span key={d.day} className="flex-1 rounded-t-[2px]"
                              title={`${d.day} · no usage`}
                              style={{ height: 2, background: "rgb(255 255 255 / .09)" }} />
                      ) : (
                        <span key={d.day} className="flex-1 rounded-t-[2px]"
                              title={`${d.day} · ${usd(d.usd)} · ${d.turns} turns`}
                              style={{
                                height: `${Math.max(2, (d.usd / maxDay) * 100)}%`,
                                background: d.usd > maxDay * 0.6 ? selTint
                                          : `color-mix(in oklab, ${selTint} 45%, transparent)`,
                              }} />
                      ))}
                  </div>
                  <p className="label mt-2">{range[0]?.day} → {range.at(-1)?.day}</p>
                </Card>

                <Card className="p-5">
                  <Label>by model</Label>
                  <div className="mt-3.5 flex flex-col gap-3">
                    {models.map((m) => {
                      const unpriced = m.unpriced > 0 && !m.usd;
                      return (
                        <div key={m.model}>
                          <div className="flex items-baseline justify-between gap-3">
                            <span className="min-w-0 flex-1 truncate text-[12.5px]">{m.model}</span>
                            <span className="figure text-[13px]"
                                  style={{ color: unpriced ? "var(--text-3)" : "var(--text)" }}>
                              {unpriced ? "no price" : usd(m.usd)}
                            </span>
                          </div>
                          <Bar part={totalUsd ? (m.usd ?? 0) / totalUsd : 0} color={selTint} />
                          <p className="label mt-1">{num(m.turns)} turns · {tok(m.output)} output</p>
                        </div>
                      );
                    })}
                  </div>
                </Card>
              </div>
            </>
          )}
        </section>

        {/* ── limits and windows ──────────────────────────────────────── */}
        <section className="flex flex-col gap-4">
          <Section eyebrow="live usage" tint={TONE}
                   meta={<Capsule color={TONE} beat>live</Capsule>}>
            The plan's limits and windows
          </Section>

          <Card className="overflow-hidden">
            {TOOLS.filter((h) => h.source).map((h) => {
              const tint = TINT[h.brand as BrandName];
              const sub = subs.find((s) => s.covers.includes(h.source!));
              // Hermes and OpenClaw write NOTHING to the usage table: their
              // COUNT(*) gives zero because there are no rows, not because
              // they were not used. That zero dressed up as a measurement is
              // exactly what this dashboard swears not to show, so their row
              // says "no data", with the reason.
              const blindOne = h.knows === "no spend";
              const w = blindOne ? null : usageWindows(h.source!);
              const reason = blindOne ? (h.why ?? "it does not record its consumption") : undefined;
              // The historical hourly peak is the only REAL reference there is
              // to give context: how much you have got to use, not how much
              // you are allowed. The plan's ceiling is not published locally.
              const ref = Math.max((w?.peak ?? 0) * 5, 1);
              const part = w?.five ? Math.min(1, w.five.turns / ref) : null;
              return (
                <div key={h.id}
                     className="flex flex-wrap items-center gap-x-7 gap-y-4 border-b px-5 py-5 last:border-0">
                  {/* The reason for the percentage, where you look, not only in
                      the footnote: it is measured against your historical
                      peak, which is the only real reference that exists. */}
                  <span className="shrink-0"
                        title={blindOne
                          ? reason
                          : `turns in the last 5 h against your historical peak: ${num(w?.peak ?? 0)} turns/hour × 5`}>
                    <Gauge part={part} caption="5h" color={tint} />
                  </span>
                  <div className="flex w-[190px] items-center gap-3">
                    <Tile brand={h.brand as BrandName} size={34} />
                    <div className="min-w-0">
                      <p className="truncate text-[14px]">{h.name}</p>
                      <p className="label mt-1 truncate">{sub?.name ?? h.billing}</p>
                    </div>
                  </div>
                  <div className="flex min-w-[260px] flex-1 flex-col gap-3">
                    <LimitBar label="last 5 hours" used={w ? w.five?.turns ?? 0 : null}
                              ceiling={null} color={tint} reason={reason} />
                    <LimitBar label="last 7 days" used={w ? w.week?.turns ?? 0 : null}
                              ceiling={null} color={tint} reason={reason} />
                  </div>
                  <div className="text-right">
                    <p className="label">tokens · 7 days</p>
                    <p className="figure mt-1 text-[17px]">
                      {w ? tok(w.week?.tokens ?? 0) : <NoData reason={reason} />}
                    </p>
                  </div>
                </div>
              );
            })}
          </Card>

          <p className="max-w-[760px] text-[11.5px] leading-relaxed" style={{ color: "var(--text-3)" }}>
            The percentages measure your consumption against <b>your own historical peak</b>, not against the
            plan's quota: neither Anthropic nor OpenAI publish your limit from the machine. Drawing
            a "25 / 900" would require me to make up the 900, so the ceiling box says what there
            is: that it is not known.
          </p>
        </section>
      </div>
    </>
  );
}
