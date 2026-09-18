import Link from "next/link";
import type { ReactNode } from "react";
import { Header } from "@/components/Header";
import {
  Card, Panel, Label, Section, Figure, Bar, Tile, Badge, Capsule,
  Gauge, LimitBar, Rail, NoData, usd, tok, num, ago,
} from "@/components/Parts";
import { brandOf, tintOf, SOURCE_NAME } from "@/components/Brands";
import { Constellation } from "@/components/Constellation";
import { Tabs } from "@/components/parts/Tabs";
import {
  byModel, totalUsd, byDay, byProject, subscriptions, realSpend,
  cacheSummary, withoutCache, inventorySummary, memorySummary, health, range,
  expensiveSessions, streak, scheduled, channels, latestReview, waysToSave,
  plan, rateLimits,
} from "@/lib/queries";
import { exists } from "@/lib/db";

export const dynamic = "force-dynamic";

export default function Home() {
  if (!exists()) return <NoDatabase />;

  const V = 28 as const;
  const total = totalUsd(V);
  const models = byModel(V).filter((m) => m.turns > 0);
  const days = byDay(V);
  const subs = subscriptions();
  const real = realSpend();
  const cache = cacheSummary(V);
  const thePlan = plan();
  const walls = rateLimits();
  const gross = withoutCache(V);
  const inv = inventorySummary();
  const mem = memorySummary();
  const r = range();
  const st = streak();
  const pricey = expensiveSessions(V, 5);
  const review = latestReview();

  // The ROI: what it would have cost you through the API against what you pay
  // in fees.
  //
  // The fee is prorated to THE SAME window the spend was measured with. If
  // spend and fee are measured over different windows, the ROI comes out
  // skewed: comparing two different windows is the easiest way for a
  // dashboard to lie without anyone noticing.
  const feeMonth = subs.reduce((s, x) => s + x.usd_month, 0);
  const dataDays = Math.min(V, r?.days || V);
  const fee = (feeMonth * dataDays) / 30.44;
  const roi = fee > 0 ? total / fee : null;
  const cacheSaving = gross - total;
  const realSpent = real.filter((x) => x.provider === "openrouter")
                        .reduce((s, x) => Math.max(s, x.usd), 0);

  // The pulse series: the last 28 days WITH their zeros. A day without rows
  // inside the index range is a day with genuinely no usage: the zero here
  // is a figure, not a gap. Before the first indexed day there is no series.
  const byDate = new Map(days.map((d) => [d.day, d]));
  const series: { day: string; turns: number; usd: number }[] = [];
  for (let i = V - 1; i >= 0; i--) {
    const f = new Date(Date.now() - i * 86400e3).toISOString().slice(0, 10);
    if (r?.first_day && f < r.first_day) continue;
    const d = byDate.get(f);
    series.push({ day: f, turns: d?.turns ?? 0, usd: d?.usd ?? 0 });
  }
  // "Last 7 days" = today and the 6 before. With `today - 7` the filter
  // covered EIGHT dates and the delta compared 8 days against 7: the exact
  // inequality the delta's comment warns about.
  const cut7 = new Date(Date.now() - 6 * 86400e3).toISOString().slice(0, 10);
  const cut14 = new Date(Date.now() - 13 * 86400e3).toISOString().slice(0, 10);
  const days7 = Math.max(1, series.filter((d) => d.day >= cut7).length);
  const turns7 = series.filter((d) => d.day >= cut7).reduce((s, d) => s + d.turns, 0);
  const turnsPrev = series.filter((d) => d.day >= cut14 && d.day < cut7)
                          .reduce((s, d) => s + d.turns, 0);
  // The delta is only shown with a COMPLETE previous week in the index:
  // comparing 7 days against 3 indexed ones would inflate the percentage silently.
  const fullPrevWeek = !!r?.first_day && r.first_day <= cut14;
  const delta = fullPrevWeek && turnsPrev > 0
    ? (turns7 - turnsPrev) / turnsPrev : null;
  const projects7 = byProject(7).length;
  const worstDay = days.reduce((a, b) => (b.usd > (a?.usd ?? 0) ? b : a), days[0]);

  // The cache rate: of everything that went into the context, how much came from the cache.
  const entered = (cache?.read ?? 0) + (cache?.input ?? 0);
  const cacheRate = entered > 0 ? (cache?.read ?? 0) / entered : null;

  // The model that takes the spend, for the share donut.
  const top = models.find((m) => (m.usd ?? 0) > 0) ?? null;
  const topShare = top && total > 0 ? (top.usd ?? 0) / total : null;

  return (
    <>
      <Header path="" />
      <div className="flex flex-col gap-9 px-6 py-7">

        <LastNight />
        <Pulse series={series} turns7={turns7} days7={days7} delta={delta}
               projects7={projects7} streak={st.days} />
        <Attention ideas={review.ideas.length} day={review.day} mem={mem} inv={inv} streak={st.days} />

        {/* ── the money: what you pay and what you get ───────────────── */}
        <section className="flex flex-col gap-5">
          <Section
            eyebrow={`ai spend · last ${dataDays} days`}
            tint="var(--spend)"
            note={<>You are on a subscription, so almost none of this is billed: it is what the
                    metered API would charge for the same tokens. The only money that really goes
                    out is below, in pink.</>}
            meta={roi ? (
              <div className="rounded-[5px] px-4 py-2.5 text-right"
                   style={{ border: "1px solid color-mix(in oklab, var(--saving) 35%, transparent)",
                            background: "color-mix(in oklab, var(--saving) 8%, transparent)" }}>
                <p className="figure text-[26px]" style={{ color: "var(--saving)" }}>
                  ×{roi.toLocaleString("en-US", { maximumFractionDigits: 1 })}
                </p>
                <p className="label mt-0.5">roi of the fee</p>
              </div>
            ) : undefined}
          >
            You pay <b>{usd(fee)}</b> in fees · you get <b>{usd(total)}</b> in tokens
          </Section>

          <Tabs
            label="AI spend" initial={1}
            right={<span className="label">fixed fee · {usd(feeMonth, 0)}/month</span>}
            tabs={[
              {
                title: "subscriptions",
                note: String(subs.length),
                panel: (
                  <div className="grid gap-3 sm:grid-cols-3">
                    {subs.map((s) => {
                      // A note that only repeats the price above adds nothing:
                      // "$100/month" under a "$100 /month" is noise, not data.
                      const usefulNote = s.note &&
                        !(s.usd_month && /month/i.test(s.note) &&
                          s.note.replace(/\D/g, "") === String(s.usd_month));
                      return (
                      <Panel key={s.name} tint={tintOf(s.covers)} className="p-4">
                        <div className="flex items-center gap-3">
                          <Tile brand={brandOf(s.covers)} size={36} />
                          <div className="min-w-0">
                            <p className="truncate text-[13px] font-medium">{s.name}</p>
                            <p className="label mt-0.5">
                              covers {s.covers.split(",").map((c) => SOURCE_NAME[c.trim()] ?? c.trim()).join(" · ")}
                            </p>
                          </div>
                        </div>
                        <p className="figure mt-4 text-[26px]">
                          {s.usd_month ? usd(s.usd_month, 0) : "per use"}
                          {s.usd_month ? (
                            <span className="text-[12px]" style={{ color: "var(--text-3)" }}> /month</span>
                          ) : null}
                        </p>
                        {usefulNote ? (
                          <p className="mt-1.5 text-[10.5px] leading-snug" style={{ color: "var(--text-3)" }}>
                            {s.note}
                          </p>
                        ) : null}
                      </Panel>
                      );
                    })}
                  </div>
                ),
              },
              {
                title: "tokens · api equiv.",
                panel: (
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    {models.map((m, i) => {
                      const part = total ? (m.usd ?? 0) / total : 0;
                      const unpriced = m.unpriced > 0 && !m.usd;
                      const tint = tintOf(m.model);
                      return (
                        <Panel key={m.model + m.speed} tint={tint}
                               selected={i === 0} className="p-4">
                          <div className="flex items-start gap-2.5">
                            <Tile brand={brandOf(m.model)} size={30} />
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-[13px]">{m.model}</p>
                              <p className="label mt-0.5">
                                {m.speed === "fast" ? "fast mode · double price" : `${num(m.turns)} turns`}
                              </p>
                            </div>
                          </div>
                          <p className="figure mt-3 text-[22px]"
                             style={{ color: unpriced ? "var(--text-3)" : "var(--text)" }}>
                            {unpriced ? "no price" : usd(m.usd)}
                          </p>
                          {unpriced ? (
                            <p className="mt-1 text-[10.5px] leading-snug" style={{ color: "var(--text-3)" }}>
                              I do not have its published price, so I do not make up the figure
                            </p>
                          ) : (
                            <>
                              <Bar part={part} color={tint} />
                              <p className="label mt-1.5">
                                {(part * 100).toFixed(0)}% of the total · {tok(m.output)} output
                              </p>
                            </>
                          )}
                        </Panel>
                      );
                    })}
                  </div>
                ),
              },
            ]}
          />

          <div className="strip grid-cols-1 sm:grid-cols-3">
            <div>
              <Figure label="real money that has gone out" value={usd(realSpent)} tone="alert" size={24}
                      note="OpenRouter · the only thing on this dashboard that is billed" />
            </div>
            <div>
              <Figure label="what the cache saved you" value={usd(cacheSaving)} tone="saving" size={24}
                      note={`without the cache it would have cost ${usd(gross)}`} />
            </div>
            <div>
              {worstDay ? (
                <Figure label="the worst day of the window" value={usd(worstDay.usd)} tone="spend" size={24}
                        note={`${worstDay.day} · ${num(worstDay.turns)} turns`} />
              ) : (
                <Figure label="the worst day of the window" value={<NoData reason="no days with spend in the window" />}
                        tone="muted" size={24} />
              )}
            </div>
          </div>
        </section>

        <WaysToSave />

        {/* ── live usage: gauges and limits, without making up ceilings ── */}
        <section className="flex flex-col gap-5">
          <Section
            eyebrow="live usage"
            note={<>What can be measured from this machine, measured; what no provider
                    publishes (your subscription quota) said to your face, not filled in with a zero.</>}
          >
            The plan's limits and windows
          </Section>
          <div className="grid gap-4 lg:grid-cols-3">
            <Panel tint={tintOf("claude")} className="flex gap-5 p-5">
              <div className="flex flex-col items-center gap-3">
                <Tile brand="anthropic" size={38} />
                <Gauge part={null} color={tintOf("claude")} size={72} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-3">
                  <p className="text-[13px] font-medium">{thePlan.name ?? "Claude"}</p>
                  {thePlan.since && <span className="label shrink-0">since {thePlan.since}</span>}
                </div>
                {thePlan.detail && (
                  <p className="mt-0.5 text-[11px]" style={{ color: "var(--text-3)" }}>{thePlan.detail}</p>
                )}
                <div className="mt-3 flex flex-col gap-3">
                  <LimitBar label="5 h limit" used={null} ceiling={null} color={tintOf("claude")}
                            reason="The current window's consumption travels in the API response and is not stored anywhere" />
                  <LimitBar label="weekly window" used={null} ceiling={null} color={tintOf("claude")}
                            reason="The current window's consumption travels in the API response and is not stored anywhere" />
                </div>
                {/* What does get written down: the moment you were stopped. */}
                {walls.length > 0 ? (
                  <div className="mt-3.5 border-t pt-3" style={{ borderColor: "var(--line)" }}>
                    <p className="label">
                      it has stopped you {walls.length === 1 ? "once" : `${walls.length} times`}
                    </p>
                    <p className="mt-1.5 text-[11.5px] leading-relaxed" style={{ color: "var(--text-2)" }}>
                      the last one, {ago(walls[0].since)} in the {walls[0].limit_window ?? "plan window"}
                      {walls[0].sessions > 1 && <>: it froze {walls[0].sessions} sessions at once</>}.
                    </p>
                  </div>
                ) : (
                  <p className="mt-3 text-[10.5px] leading-snug" style={{ color: "var(--text-3)" }}>
                    you have never hit the ceiling
                  </p>
                )}
                {thePlan.extraEnabled && thePlan.extraReason === "out_of_credits" && (
                  <p className="mt-2.5">
                    <Capsule tone="alert">extra usage without credit</Capsule>
                  </p>
                )}
              </div>
            </Panel>

            <Panel className="flex items-center gap-5 p-5">
              <Gauge part={cacheRate} color="var(--saving)" size={88} />
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-medium">Cache hit rate</p>
                <p className="mt-1.5 text-[11.5px] leading-relaxed" style={{ color: "var(--text-2)" }}>
                  {tok(cache?.read)} context tokens were read from the cache, at a tenth of the price.
                </p>
                <p className="label mt-2.5">
                  it saved you <span style={{ color: "var(--saving)" }}>{usd(cacheSaving)}</span> in {dataDays} days
                </p>
              </div>
            </Panel>

            <Panel tint={top ? tintOf(top.model) : undefined} className="flex items-center gap-5 p-5">
              <Gauge part={topShare}
                     color={top ? tintOf(top.model) : "var(--text-3)"} size={88} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2.5">
                  {top ? <Tile brand={brandOf(top.model)} size={26} /> : null}
                  <p className="truncate text-[13px] font-medium">{top ? top.model : "no priced spend"}</p>
                </div>
                {top ? (
                  <>
                    <p className="mt-1.5 text-[11.5px] leading-relaxed" style={{ color: "var(--text-2)" }}>
                      It takes {usd(top.usd)} of the window's {usd(total)} equivalent.
                    </p>
                    <p className="label mt-2.5">{num(top.turns)} turns · {tok(top.output)} output</p>
                  </>
                ) : (
                  <p className="mt-1.5 text-[11.5px]" style={{ color: "var(--text-3)" }}>
                    no model in the window has a published price
                  </p>
                )}
              </div>
            </Panel>
          </div>
          <Status />
        </section>

        {/* ── the other three questions, in short ────────────────────── */}
        <section className="grid gap-4 lg:grid-cols-3">
          <Panel href="/inventory" className="p-5">
            <Label>what you have set up</Label>
            <div className="mt-3.5 flex flex-col gap-2.5">
              {inv.filter((i) => i.kind !== "universe").map((i) => (
                <div key={i.kind} className="flex items-baseline justify-between gap-3">
                  <span className="text-[12.5px]" style={{ color: "var(--text-2)" }}>{i.kind}s</span>
                  <span className="datum">
                    <span style={{ color: i.used ? "var(--amber)" : "var(--text-3)" }}>{i.used}</span>
                    <span style={{ color: "var(--text-3)" }}> / {i.total} used</span>
                  </span>
                </div>
              ))}
            </div>
            <p className="label mt-4" style={{ color: "var(--amber)" }}>see the inventory →</p>
          </Panel>

          <Panel href="/memory" className="p-5">
            <Label>what it knows about you</Label>
            <div className="mt-3.5 flex flex-col gap-2.5">
              {mem.map((m) => (
                <div key={m.system} className="flex items-baseline justify-between gap-3">
                  <span className="text-[12.5px]" style={{ color: "var(--text-2)" }}>{m.system}</span>
                  <span className="datum">
                    <span style={{ color: m.stale ? "var(--spend)" : "var(--saving)" }}>{m.stale}</span>
                    <span style={{ color: "var(--text-3)" }}> / {m.total} stale</span>
                  </span>
                </div>
              ))}
            </div>
            <p className="label mt-4" style={{ color: "var(--amber)" }}>see the memory →</p>
          </Panel>

          <Panel href="/activity" className="p-5">
            <Label>what it has done</Label>
            <div className="mt-3.5 flex flex-col gap-2.5">
              {pricey.slice(0, 4).map((s) => (
                <div key={s.id} className="flex items-baseline justify-between gap-3">
                  <span className="min-w-0 flex-1 truncate text-[12px]" style={{ color: "var(--text-2)" }}>
                    {s.title || s.project || s.id.slice(0, 8)}
                  </span>
                  <span className="datum shrink-0" style={{ color: "var(--spend)" }}>{usd(s.usd)}</span>
                </div>
              ))}
            </div>
            <p className="label mt-4" style={{ color: "var(--amber)" }}>see the activity →</p>
          </Panel>
        </section>

        <Clocks />
      </div>
    </>
  );
}

/**
 * The pulse: the curve of the last 28 days and the big figure with its delta.
 * The delta compares the last 7 days with the 7 before: two EQUAL windows,
 * which is the only comparison that does not lie.
 */
function Pulse({
  series, turns7, days7, delta, projects7, streak,
}: {
  series: { day: string; turns: number; usd: number }[];
  turns7: number; days7: number; delta: number | null;
  projects7: number; streak: number;
}) {
  if (!series.length) return null;
  const WIDTH = 600, HEIGHT = 150, M = 8;
  const max = Math.max(...series.map((d) => d.turns), 1);
  const pts = series.map((d, i) => ({
    x: M + (i * (WIDTH - 2 * M)) / Math.max(1, series.length - 1),
    y: HEIGHT - M - (d.turns / max) * (HEIGHT - 2 * M),
  }));
  const last = pts.at(-1)!;
  return (
    <section className="grid gap-4 lg:grid-cols-[1.65fr_1fr]">
      <Panel frame dotGrid className="flex flex-col p-5">
        <div className="flex items-baseline justify-between gap-4">
          <p className="label">the pulse · turns per day</p>
          <p className="label">{series[0].day} → {series.at(-1)!.day}</p>
        </div>
        <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} preserveAspectRatio="none"
             className="mt-4 h-32 w-full flex-1" aria-hidden="true">
          <defs>
            <linearGradient id="pulse-area" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="var(--amber)" stopOpacity="0.22" />
              <stop offset="1" stopColor="var(--amber)" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d={`${smooth(pts)} L ${last.x.toFixed(1)} ${HEIGHT} L ${pts[0].x.toFixed(1)} ${HEIGHT} Z`}
                fill="url(#pulse-area)" />
          <path d={smooth(pts)} fill="none" stroke="var(--amber)" strokeWidth="2"
                strokeLinecap="round" strokeLinejoin="round"
                vectorEffect="non-scaling-stroke" />
          <circle cx={last.x} cy={last.y} r="3.5" fill="var(--amber)" />
          <circle cx={last.x} cy={last.y} r="7" fill="none" stroke="var(--amber)" opacity="0.35" />
        </svg>
        <p className="label mt-3">
          the best day:{" "}
          <span style={{ color: "var(--text)" }}>
            {num(Math.max(...series.map((d) => d.turns), 0))} turns
          </span>
          {" "}· the zeros are days without usage, not gaps
        </p>
      </Panel>

      <Panel frame dotGrid className="flex flex-col justify-between p-5">
        <div>
          <p className="label flex items-center gap-2">
            <span className="beat" style={{ color: "var(--amber)" }}><i /></span>
            activity
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <p className="figure text-[46px] leading-none">{num(turns7)}</p>
            {delta !== null ? (
              <Badge tone={delta >= 0 ? "saving" : "spend"}
                     title="last 7 days against the 7 before">
                {delta >= 0 ? "↗" : "↘"} {delta >= 0 ? "+" : ""}
                {(delta * 100).toLocaleString("en-US", { maximumFractionDigits: 0 })}%
              </Badge>
            ) : (
              <NoData reason="no complete previous week to compare with" />
            )}
          </div>
          <p className="mt-2 text-[11.5px]" style={{ color: "var(--text-3)" }}>
            turns in the last {days7} {days7 === 1 ? "day" : "days"} · {projects7}{" "}
            {projects7 === 1 ? "project" : "projects"} with activity
          </p>
        </div>
        <div className="mt-5 flex flex-col gap-2.5 border-t pt-3.5">
          <div className="flex items-center justify-between gap-3">
            <span className="text-[12px]" style={{ color: "var(--text-2)" }}>days at zero · {series.length} days</span>
            <span className="datum">
              <span style={{ color: "var(--text)" }}>{num(series.filter((d) => !d.turns).length)}</span>
              <span style={{ color: "var(--text-3)" }}> without usage</span>
            </span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-[12px]" style={{ color: "var(--text-2)" }}>
              daily average · {days7} {days7 === 1 ? "day" : "days"}
            </span>
            <span className="datum">
              <span style={{ color: "var(--text)" }}>{num(Math.round(turns7 / days7))}</span>
              <span style={{ color: "var(--text-3)" }}> turns</span>
            </span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-[12px]" style={{ color: "var(--text-2)" }}>streak</span>
            <span className="datum">
              <span style={{ color: "var(--spend)" }}>▲ </span>
              <span style={{ color: "var(--text)" }}>{streak}</span>
              <span style={{ color: "var(--text-3)" }}> days in a row</span>
            </span>
          </div>
        </div>
      </Panel>
    </section>
  );
}

/** Catmull-Rom curve → cubics: the line goes through every point without spikes. */
function smooth(pts: { x: number; y: number }[]): string {
  if (pts.length < 2) return "";
  let d = `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)], p1 = pts[i];
    const p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
    d += ` C ${(p1.x + (p2.x - p0.x) / 6).toFixed(1)} ${(p1.y + (p2.y - p0.y) / 6).toFixed(1)},`
       + ` ${(p2.x - (p3.x - p1.x) / 6).toFixed(1)} ${(p2.y - (p3.y - p1.y) / 6).toFixed(1)},`
       + ` ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
  }
  return d;
}

/**
 * Attention now: the rail of what asks for a click today. At most three
 * things, all coming from the database: if a front is clean, its card does not show.
 */
function Attention({
  ideas, day, mem, inv, streak: days,
}: {
  ideas: number; day: string | null;
  mem: { system: string; total: number; stale: number }[];
  inv: { kind: string; total: number; used: number }[];
  streak: number;
}) {
  const icon = (d: string) => (
    <svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor"
         strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d} />
    </svg>
  );
  const actions: { title: string; note: string; href: string; tone: string; icon: ReactNode }[] = [];

  if (ideas > 0) {
    actions.push({
      title: `${ideas} ${ideas === 1 ? "unread idea from the review" : "unread ideas from the review"}`,
      note: `review of ${day} · decide which ones become action`,
      href: "/review", tone: "var(--review)",
      icon: icon("M13.5 9.5A5.5 5.5 0 1 1 6.5 2.5a4.5 4.5 0 0 0 7 7Z"),
    });
  }
  const stale = mem.reduce((s, m) => s + m.stale, 0);
  const worstSystem = [...mem].sort((a, b) => b.stale - a.stale)[0];
  if (stale > 0) {
    actions.push({
      title: `${stale} memories have not been touched in over 10 days`,
      note: worstSystem ? `${worstSystem.system} has ${worstSystem.stale} · prune or update` : "prune or update",
      href: "/memory", tone: "var(--spend)",
      icon: icon("M8 4.5V8l2.5 1.5M14 8A6 6 0 1 1 2 8a6 6 0 0 1 12 0Z"),
    });
  }
  const sk = inv.find((i) => i.kind === "skill");
  if (sk && sk.total - sk.used > 0) {
    actions.push({
      title: `${sk.total - sk.used} skills never used`,
      note: `out of ${sk.total} installed · package what you repeat or prune`,
      href: "/skills", tone: "var(--amber)",
      icon: icon("M8 1.5 9.8 6l4.7.3-3.6 3 1.1 4.6L8 11.4l-4 2.5 1.1-4.6-3.6-3L6.2 6 8 1.5Z"),
    });
  }
  if (actions.length < 3 && days > 1) {
    actions.push({
      title: `${days} days in a row opening the motor`,
      note: "active streak · today's activity already counts",
      href: "/activity", tone: "var(--saving)",
      icon: icon("M1.5 10.5 6 6l3 2.5 5.5-6M10.5 2.5H14.5V6.5"),
    });
  }
  if (!actions.length) return null;
  return (
    <section className="flex flex-col gap-4">
      <Section eyebrow="attention now">What asks for a click today</Section>
      <Rail actions={actions.slice(0, 3)} />
    </section>
  );
}

/**
 * The moves that really move the needle.
 *
 * Each one carries its saving COMPUTED with the real prices and the sum
 * written underneath. Advice without a number is brochure advice: here, either
 * there is a sum, or the saving slot stays empty and only the reason is given.
 */
function WaysToSave() {
  const moves = waysToSave(28);
  if (!moves.length) return null;
  return (
    <section className="flex flex-col gap-4">
      <Section eyebrow="how to spend less" tint="var(--saving)"
               note="Every figure is computed with your tokens and the published prices: when there is no honest sum to do, the gap says so.">
        Highest-impact moves
      </Section>
      <Card className="overflow-hidden">
        {moves.map((m) => (
          <div key={m.title} className="flex flex-wrap items-start gap-4 border-b px-5 py-4 last:border-0">
            <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-[5px]"
                  style={{ background: "color-mix(in oklab, var(--saving) 13%, transparent)",
                           color: "var(--saving)" }}>
              <svg viewBox="0 0 16 16" width="15" height="15" fill="none" stroke="currentColor"
                   strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M2 11.5 6 7l3 2.5L14 4" /><path d="M10.5 4H14v3.5" />
              </svg>
            </span>
            <span className="min-w-0 flex-1">
              <p className="text-[13.5px]">{m.title}</p>
              <p className="mt-1 text-[12px] leading-relaxed" style={{ color: "var(--text-2)" }}>
                {m.why}
              </p>
            </span>
            <span className="w-[140px] shrink-0 text-right">
              {m.saving !== null ? (
                <>
                  <p className="figure text-[17px]" style={{ color: "var(--saving)" }}>{usd(m.saving)}</p>
                  <p className="label mt-0.5">{m.unit}</p>
                </>
              ) : (
                <p className="label">no figure to give</p>
              )}
            </span>
          </div>
        ))}
      </Card>
    </section>
  );
}

/**
 * What the review found last night, at the very top: it is the hook.
 * The sky is painted by Constellation: deterministic, same seed, same sky.
 */
function LastNight() {
  const { day, ideas } = latestReview();
  if (!day || !ideas.length) return null;
  const visible = ideas.slice(0, 6);
  return (
    <Link href="/review" className="card-pressable relative block overflow-hidden rounded-[6px] p-6"
          style={{
            "--tint": "var(--review)",
            border: "1px solid color-mix(in oklab, var(--review) 26%, transparent)",
            background: "linear-gradient(120deg, color-mix(in oklab, var(--review) 11%, var(--card)), var(--card) 62%)",
          } as React.CSSProperties}>
      <Constellation seed={11} tint="var(--review)" />
      <div className="relative">
        <div className="flex flex-wrap items-center gap-3">
          <p className="label flex items-center gap-2" style={{ color: "var(--review)" }}>
            <span className="beat"><i /></span>nightly review · {day}
          </p>
          <Capsule tone="review">{ideas.length} new</Capsule>
        </div>
        <p className="mt-3 text-[26px] font-light tracking-tight">
          Last night I found <b className="font-semibold">{ideas.length}</b>{" "}
          {ideas.length === 1 ? "idea worth a look" : "ideas worth a look"}.
        </p>
        <p className="mt-1.5 max-w-[640px] text-[12px] leading-relaxed" style={{ color: "var(--text-2)" }}>
          Each one comes from your last 24 hours: real sessions, memory and spend.
          Read them and decide which ones become action.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {visible.map((x) => (
            <span key={x.id} className="inline-flex items-center gap-2 rounded-[4px] px-2.5 py-1.5 text-[11.5px]"
                  style={{ background: "color-mix(in oklab, var(--review) 13%, transparent)",
                           color: "var(--text-2)" }}>
              <span className="label" style={{ color: "var(--review)", fontSize: 8.5 }}>{x.category}</span>
              {x.title.length > 64 ? x.title.slice(0, 64) + "…" : x.title}
            </span>
          ))}
          {ideas.length > visible.length ? (
            <span className="rounded-[4px] px-2.5 py-1.5 text-[11.5px]"
                  style={{ border: "1px dashed color-mix(in oklab, var(--review) 35%, transparent)",
                           color: "var(--text-3)" }}>
              and {ideas.length - visible.length} more
            </span>
          ) : null}
        </div>
        <p className="label mt-4" style={{ color: "var(--review)" }}>read them →</p>
      </div>
    </Link>
  );
}

/** What is going to run without you being there. */
function Clocks() {
  const jobs = scheduled();
  const cs = channels();
  if (!jobs.length && !cs.length) return null;
  return (
    <section className="flex flex-col gap-4">
      <Section eyebrow="what will run without you" tint="var(--review)"
               meta="launchd and the Hermes cron">
        {jobs.length} {jobs.length === 1 ? "scheduled job" : "scheduled jobs"}
      </Section>
      <Card className="overflow-hidden">
        {jobs.map((t) => (
          <div key={t.id} className="flex flex-wrap items-center gap-x-4 gap-y-1.5 border-b px-4 py-3 last:border-0">
            <span className="h-1.5 w-1.5 shrink-0 rounded-full"
                  style={{ background: t.active ? "var(--review)" : "var(--text-3)" }} />
            <span className="datum min-w-0 flex-1 truncate text-[12.5px]">{t.name}</span>
            <Badge tone="review">{t.engine}</Badge>
            <span className="datum w-[190px]" style={{ color: "var(--text-3)" }}>
              {t.schedule ?? <NoData reason="the job declares no readable calendar or interval" />}
            </span>
            <span className="w-[70px] text-right">
              {t.active
                ? <Capsule tone="saving">active</Capsule>
                : <Capsule tone="neutral">stopped</Capsule>}
            </span>
          </div>
        ))}
      </Card>
      {cs.length ? (
        <p className="text-[11.5px] leading-relaxed" style={{ color: "var(--text-3)" }}>
          Your assistants listen to you through{" "}
          {cs.map((c) => `${c.channel} (${c.sessions})`).join(" · ")}.
        </p>
      ) : null}
    </section>
  );
}

/** The health of the sources, with its reason when there is one. */
function Status() {
  const s = health();
  return (
    <Card className="overflow-hidden">
      <p className="label border-b px-4 py-2.5">where each thing comes from</p>
      {s.map((f) => (
        <div key={f.source} className="flex flex-wrap items-baseline gap-x-4 gap-y-1 border-b px-4 py-2.5 last:border-0">
          <span className="beat mt-1" style={{ color: f.error ? "var(--alert)" : "var(--saving)" }}><i /></span>
          <span className="w-[110px] text-[12.5px]">{SOURCE_NAME[f.source] ?? f.source}</span>
          <span className="datum w-[70px]" style={{ color: "var(--text-3)" }}>{f.ms} ms</span>
          <span className="datum w-[90px]" style={{ color: "var(--text-3)" }}>{num(f.row_count)} rows</span>
          <span className="datum w-[80px]" style={{ color: "var(--text-3)" }}>{ago(f.last_attempt)}</span>
          {f.error || f.note ? (
            <span className="min-w-0 flex-1 text-[11.5px] leading-snug"
                  style={{ color: f.error ? "var(--spend)" : "var(--text-3)" }}>
              {f.error || f.note}
            </span>
          ) : null}
        </div>
      ))}
    </Card>
  );
}

function NoDatabase() {
  return (
    <div className="flex min-h-dvh items-center justify-center p-8">
      <Card className="max-w-[520px] p-6">
        <Section eyebrow="no index">The index is empty</Section>
        <p className="mt-3 text-[13.5px] leading-relaxed" style={{ color: "var(--text-2)" }}>
          The reader has not made its first pass yet. Start it and this page fills itself.
        </p>
        <pre className="datum mt-4 overflow-x-auto rounded-[4px] p-3"
             style={{ background: "var(--card-high)", color: "var(--text-2)" }}>
{`make demo          # synthetic data
python3 reader/reader.py --loop   # or your data`}
        </pre>
      </Card>
    </div>
  );
}
