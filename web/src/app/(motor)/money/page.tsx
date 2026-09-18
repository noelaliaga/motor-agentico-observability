import { Header } from "@/components/Header";
import { Card, Section, Figure, Bar, usd, tok, num } from "@/components/Parts";
import { BRANDS, brandOf, SOURCE_NAME } from "@/components/Brands";
import {
  byModel, totalUsd, byDay, byProject, bySource,
  cacheSummary, withoutCache, subscriptions, realSpend, range, type WindowDays,
} from "@/lib/queries";
import { rows } from "@/lib/db";
import Link from "next/link";

export const dynamic = "force-dynamic";

const WINDOWS: { v: WindowDays; t: string }[] = [
  { v: 1, t: "today" }, { v: 7, t: "7 days" }, { v: 28, t: "28 days" }, { v: 3650, t: "all" },
];

export default async function Money({
  searchParams,
}: { searchParams: Promise<{ v?: string }> }) {
  const sp = await searchParams;
  const V = (Number(sp.v) || 28) as WindowDays;

  const total = totalUsd(V);
  const models = byModel(V).filter((m) => m.turns > 0);
  const days = byDay(V);
  const projects = byProject(V);
  const sources = bySource(V);
  const cache = cacheSummary(V);
  const gross = withoutCache(V);
  const subs = subscriptions();
  const real = realSpend();
  const r = range();

  const feeMonth = subs.reduce((s, x) => s + x.usd_month, 0);
  const dataDays = Math.min(V, r?.days || V);
  const fee = (feeMonth * dataDays) / 30.44;
  const roi = fee > 0 ? total / fee : null;
  const maxDay = Math.max(...days.map((d) => d.usd), 0.01);
  const maxProj = Math.max(...projects.map((p) => p.usd), 0.01);

  // The prices everything was valued with, so they can be audited.
  const prices = rows<{
    model: string; valid_from: string; valid_to: string | null;
    usd_input: number; usd_output: number; provenance: string; checked_on: string;
  }>(`SELECT * FROM pricing WHERE model IN (SELECT DISTINCT model FROM usage)
         OR model LIKE '%⚡' ORDER BY usd_output DESC, model`);

  return (
    <>
      <Header path="money" />
      <div className="flex flex-col gap-8 px-6 py-7">

        <div className="flex flex-wrap items-center justify-between gap-4">
          <Section eyebrow="what you have spent so far" tint="var(--spend)">The odometer</Section>
          <div className="flex gap-1">
            {WINDOWS.map((w) => (
              <Link key={w.v} href={`/money?v=${w.v}`}
                    className="label rounded-[3px] px-2.5 py-1.5 transition-colors"
                    style={w.v === V
                      ? { background: "var(--spend)", color: "#100C02" }
                      : { background: "var(--card)", border: "1px solid var(--border)" }}>
                {w.t}
              </Link>
            ))}
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-4">
          <Card className="p-5"><Figure label="api equivalent" value={usd(total)} tone="spend" size={32}
                 note={`${dataDays} days · ${num(models.reduce((s, m) => s + m.turns, 0))} turns`} /></Card>
          <Card className="p-5"><Figure label="what you pay" value={usd(fee)} size={32}
                 note={`${usd(feeMonth, 0)}/month prorated to the window`} /></Card>
          <Card className="p-5"><Figure label="roi" tone="saving" size={32}
                 value={roi ? `×${roi.toLocaleString("en-US", { maximumFractionDigits: 1 })}` : "—"}
                 note="what you get for every dollar of fee" /></Card>
          <Card className="p-5"><Figure label="real money" value={usd(real.reduce((s, x) => Math.max(s, x.usd), 0))}
                 tone="alert" size={32} note="OpenRouter · really billed" /></Card>
        </div>

        {/* ── by day ─────────────────────────────────────────────────── */}
        <section className="flex flex-col gap-3">
          <Section eyebrow="the spend, day by day" tint="var(--spend)">By day</Section>
          <Card frame dotGrid className="p-5">
            <div className="flex h-40 items-end gap-[3px]">
              {days.map((d) => (
                <span key={d.day} className="flex-1 rounded-t-[2px]" title={`${d.day} · ${usd(d.usd)} · ${d.turns} turns`}
                      style={{
                        height: `${Math.max(2, (d.usd / maxDay) * 100)}%`,
                        background: d.usd > maxDay * 0.6 ? "var(--spend)"
                                  : d.usd > maxDay * 0.25 ? "color-mix(in oklab, var(--spend) 65%, transparent)"
                                  : "color-mix(in oklab, var(--spend) 32%, transparent)",
                      }} />
              ))}
            </div>
            <div className="mt-3 flex justify-between">
              <span className="label">{days[0]?.day}</span>
              <span className="label">hover over each bar</span>
              <span className="label">{days.at(-1)?.day}</span>
            </div>
          </Card>
        </section>

        {/* ── by model ───────────────────────────────────────────────── */}
        <section className="flex flex-col gap-3">
          <Section eyebrow="who takes the money" tint="var(--spend)">By model</Section>
          <Card className="overflow-hidden">
            {models.map((m) => {
              const Brand = BRANDS[brandOf(m.model)];
              const part = total ? (m.usd ?? 0) / total : 0;
              const unpriced = m.unpriced > 0 && !m.usd;
              return (
                <div key={m.model + m.speed} className="flex flex-wrap items-center gap-x-5 gap-y-2 border-b px-4 py-3 last:border-0">
                  <span style={{ color: "var(--text-2)" }}><Brand size={17} /></span>
                  <span className="w-[180px] text-[13px]">{m.model}</span>
                  {m.speed === "fast" ? <span className="label" style={{ color: "var(--spend)" }}>fast ·2×</span> : null}
                  <span className="datum w-[92px]" style={{ color: "var(--text-3)" }}>{num(m.turns)} turns</span>
                  <span className="datum w-[92px]" style={{ color: "var(--text-3)" }}>{tok(m.output)} output</span>
                  <span className="datum w-[100px]" style={{ color: "var(--text-3)" }}>{tok(m.cache_read)} cache</span>
                  <span className="min-w-[120px] flex-1"><Bar part={part} /></span>
                  <span className="figure w-[110px] text-right text-[16px]"
                        style={{ color: unpriced ? "var(--text-3)" : "var(--text)" }}>
                    {unpriced ? "no price" : usd(m.usd)}
                  </span>
                </div>
              );
            })}
          </Card>
        </section>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* ── by project ───────────────────────────────────────────── */}
          <section className="flex flex-col gap-3">
            <Section eyebrow="where it went" tint="var(--spend)">By project</Section>
            <Card className="overflow-hidden">
              {projects.map((p) => (
                <div key={p.project} className="border-b px-4 py-3 last:border-0">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="truncate text-[13px]">{p.project}</span>
                    <span className="figure text-[14px]">{usd(p.usd)}</span>
                  </div>
                  <Bar part={p.usd / maxProj} />
                  <p className="label mt-1.5">{num(p.turns)} turns · {p.sessions} sessions</p>
                </div>
              ))}
            </Card>
          </section>

          {/* ── the cache ────────────────────────────────────────────── */}
          <section className="flex flex-col gap-3">
            <Section eyebrow="what you have not paid twice" tint="var(--spend)">What the cache does</Section>
            <Card className="p-5">
              <Figure label="saved" value={usd(gross - total)} tone="saving" size={30}
                      note={`without the cache, the same would have cost ${usd(gross)}`} />
              <Bar part={gross ? (gross - total) / gross : 0} color="var(--saving)" />
              <div className="mt-5 flex flex-col gap-2.5 border-t pt-4">
                {[
                  ["read · paid at 0.1×", cache?.read, "var(--saving)"],
                  ["written 5 min · 1.25×", cache?.w5m, "var(--text-2)"],
                  ["written 1 hour · 2×", cache?.w1h, "var(--spend)"],
                  ["uncached input · 1×", cache?.input, "var(--text-2)"],
                  ["output", cache?.output, "var(--text-2)"],
                ].map(([r, v, c]) => (
                  <div key={String(r)} className="flex items-baseline justify-between gap-3">
                    <span className="text-[12px]" style={{ color: "var(--text-2)" }}>{String(r)}</span>
                    <span className="datum" style={{ color: String(c) }}>{tok(Number(v))}</span>
                  </div>
                ))}
              </div>
            </Card>
          </section>
        </div>

        {/* ── by source ──────────────────────────────────────────────── */}
        <section className="flex flex-col gap-3">
          <Section eyebrow="split by machine" tint="var(--spend)">By tool</Section>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {sources.map((f) => (
              <Card key={f.source} className="p-4">
                <p className="text-[13px]">{SOURCE_NAME[f.source] ?? f.source}</p>
                <p className="figure mt-2 text-[22px]">{usd(f.usd)}</p>
                <p className="label mt-1">{num(f.turns)} turns</p>
              </Card>
            ))}
            <Card className="p-4">
              <p className="text-[13px]">Hermes · OpenClaw</p>
              <p className="figure mt-2 text-[22px]" style={{ color: "var(--text-3)" }}>no data</p>
              <p className="mt-1 text-[10.5px] leading-snug" style={{ color: "var(--text-3)" }}>
                they do not record tokens. Their spend is inside OpenRouter's real total
              </p>
            </Card>
          </div>
        </section>

        {/* ── the prices, auditable ──────────────────────────────────── */}
        <section className="flex flex-col gap-3">
          <Section eyebrow="the prices, in plain sight" tint="var(--spend)">Which prices it was computed with</Section>
          <Card className="overflow-x-auto">
            <table className="w-full min-w-[720px]">
              <thead>
                <tr className="border-b">
                  {["model", "validity", "input $/M", "output $/M", "where it comes from"].map((h) => (
                    <th key={h} className="label px-4 py-2.5 text-left font-normal">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {prices.map((t) => (
                  <tr key={t.model + t.valid_from} className="border-b last:border-0">
                    <td className="px-4 py-2 text-[12.5px]">{t.model}</td>
                    <td className="datum px-4 py-2" style={{ color: "var(--text-3)" }}>
                      {t.valid_from} → {t.valid_to ?? "in force"}
                    </td>
                    <td className="datum px-4 py-2">{t.usd_input}</td>
                    <td className="datum px-4 py-2">{t.usd_output}</td>
                    <td className="px-4 py-2 text-[11px]" style={{ color: "var(--text-3)" }}>
                      {t.provenance} · {t.checked_on}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
          <p className="text-[11.5px] leading-relaxed" style={{ color: "var(--text-3)" }}>
            Tokens are stored raw and money is computed at read time against this table.
            That is why the Sonnet 5 launch price can expire on 31 August without
            breaking a single July figure.
          </p>
        </section>
      </div>
    </>
  );
}
