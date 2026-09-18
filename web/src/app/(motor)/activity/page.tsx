import { Header } from "@/components/Header";
import {
  Section, Panel, Card, Tile, Badge, Capsule, Bar, NoData,
  usd, num, ago, duration, SECTION_TONE,
} from "@/components/Parts";
import { brandOf, tintOf, SOURCE_NAME } from "@/components/Brands";
import { CatalogHero } from "@/components/parts/CatalogHero";
import { ToolIcon, hasIcon } from "@/components/parts/ToolIcon";
import { latestPrompts, mostInvoked, toolsBySession } from "@/lib/queries";
import { activitySummary, recentSessions, honestBySource } from "@/lib/activity-queries";

export const dynamic = "force-dynamic";

const TONE = SECTION_TONE.activity;

/** "1 turn", "85 turns": the plural is not skimped on. */
function n_(n: number, sing: string, plur = sing + "s"): string {
  return `${num(n)} ${n === 1 ? sing : plur}`;
}

/** Did it happen less than ten minutes ago? So that only what is alive beats. */
function recent(iso: string | null | undefined): boolean {
  if (!iso) return false;
  const t = new Date(iso.endsWith("Z") || iso.includes("+") ? iso : iso + "Z").getTime();
  return Number.isFinite(t) && Date.now() - t < 10 * 60 * 1000;
}

/** The icons of what was used in a session. A glance says more than a list. */
function Chips({ items }: { items: { kind: string; name: string; n: number }[] }) {
  const order = ["Bash", "Read", "Edit", "Write", "WebFetch", "WebSearch"];
  const tools = items.filter((x) => x.kind === "tool");
  const mcp = items.filter((x) => x.kind === "mcp");
  const shown = [
    ...order.filter((o) => tools.some((h) => h.name === o)),
    ...tools.filter((h) => !order.includes(h.name)).map((h) => h.name).slice(0, 2),
  ].slice(0, 5);
  if (!shown.length && !mcp.length) return <span style={{ color: "var(--text-3)" }}>—</span>;
  return (
    <span className="flex items-center gap-1">
      {shown.map((v) => (
        <span key={v} title={v} aria-label={v}
              className="flex h-[22px] min-w-[22px] items-center justify-center rounded-[3px] px-1"
              style={{ background: "var(--card-high)", border: "1px solid var(--border)",
                       color: "var(--text-2)" }}>
          {hasIcon(v)
            ? <ToolIcon name={v} />
            : <span className="datum text-[10px]">{v.slice(0, 2)}</span>}
        </span>
      ))}
      {mcp.length ? (
        <span title={mcp.map((m) => m.name).join(", ")}
              className="datum flex h-[22px] items-center rounded-[3px] px-1.5 text-[10px]"
              style={{ background: `color-mix(in oklab, ${TONE} 12%, transparent)`, color: TONE }}>
          mcp {mcp.length}
        </span>
      ) : null}
    </span>
  );
}

/** The machine chip: a small tile with the logo and the name next to it. */
function MachineChip({ source }: { source: string }) {
  return (
    <span className="inline-flex items-center gap-2">
      <Tile brand={brandOf(source)} size={22} />
      <span className="whitespace-nowrap text-[12px]" style={{ color: "var(--text-2)" }}>
        {SOURCE_NAME[source] ?? source}
      </span>
    </span>
  );
}

export default function Activity() {
  const V = 3650 as const;
  const summary = activitySummary(V);
  const sessions = recentSessions(V, 40);
  const used = toolsBySession(sessions.map((s) => s.id));
  const prompts = latestPrompts(18);
  const sources = honestBySource(V);
  const tools = mostInvoked("tool", 10);
  const totalTurns = sources.reduce((s, f) => s + f.turns, 0);

  return (
    <>
      <Header path="activity" />
      <div className="flex flex-col gap-9 px-6 py-7 pb-14">

        <CatalogHero
          tint={TONE} seed={47} badge="activity"
          meta={summary?.projects ? `${num(summary.projects)} projects with activity` : undefined}
          figure={num(summary?.sessions ?? 0)}
          rest={`sessions · ${num(summary?.turns ?? 0)} recorded turns`}
          extra={
            recent(sessions[0]?.ended)
              ? <Capsule color={TONE} beat>working now</Capsule>
              : sessions[0]
                ? <Badge tone="neutral">last session {ago(sessions[0].ended)}</Badge>
                : null
          }
        >
          Every session of your machines and what happened inside: in which project, with which
          skills and tools. This screen's question is what you were doing; the cost goes at the
          end, where it belongs.
        </CatalogHero>

        {/* ── split by machine, with its brand ────────────────────────── */}
        <section className="flex flex-col gap-3">
          <Section eyebrow="split by machine" tint={TONE}
                   meta="turns per source, the whole history">
            Who does the work
          </Section>
          <div className="grid gap-3"
               style={{ gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 250px), 1fr))" }}>
            {sources.map((f) => {
              const brand = brandOf(f.source);
              const tint = tintOf(f.source);
              const part = totalTurns ? f.turns / totalTurns : 0;
              return (
                <Panel key={f.source} tint={tint} className="p-4">
                  <div className="flex items-center gap-3">
                    <Tile brand={brand} size={34} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-medium" style={{ color: "var(--text)" }}>
                        {SOURCE_NAME[f.source] ?? f.source}
                      </p>
                      <p className="label mt-0.5">{Math.round(part * 100)}% of the turns</p>
                    </div>
                  </div>
                  <p className="figure mt-4 text-[26px]" style={{ color: "var(--text)" }}>
                    {num(f.turns)}
                  </p>
                  <p className="label mt-0.5">
                    {f.turns === 1 ? "turn" : "turns"} · {n_(f.sessions, "session")}
                  </p>
                  <p className="label mt-1">
                    {f.usd === null
                      ? <NoData reason="This source does not record tokens with a known price." />
                      : <>{usd(f.usd)} api equiv.</>}
                  </p>
                  <Bar part={part} color={tint} />
                </Panel>
              );
            })}
          </div>
        </section>

        {/* ── the sessions table: the session leads ───────────────────── */}
        <section className="flex flex-col gap-3">
          <Section eyebrow="the log" tint={TONE} meta="the 40 most recent">
            Every session, and what happened inside
          </Section>
          <Card className="overflow-x-auto">
            <table className="w-full min-w-[1020px]">
              <thead>
                <tr className="border-b">
                  {[
                    ["session", "text-left"], ["machine", "text-left"], ["project", "text-left"],
                    ["skill", "text-left"], ["with what", "text-left"], ["when", "text-left"],
                    ["cost", "text-right"],
                  ].map(([h, align]) => (
                    <th key={h} scope="col"
                        className={`label whitespace-nowrap px-3 py-2.5 font-normal ${align}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sessions.map((s) => (
                  <tr key={s.id}
                      className="border-b align-top transition-colors last:border-0 hover:bg-[rgb(255_255_255_/_0.02)]">
                    <td className="px-3 py-3.5">
                      {s.title ? (
                        <p className="max-w-[280px] truncate text-[13px]"
                           style={{ color: "var(--text)" }} title={s.title}>
                          {s.title}
                        </p>
                      ) : (
                        <p className="max-w-[280px] truncate text-[13px] italic"
                           style={{ color: "var(--text-3)" }}>
                          session without a stored prompt
                        </p>
                      )}
                      <p className="datum mt-1" style={{ color: "var(--text-3)" }}>
                        {s.id.slice(0, 8)} · {n_(s.turns, "turn")}
                      </p>
                    </td>
                    <td className="px-3 py-3.5"><MachineChip source={s.source} /></td>
                    <td className="max-w-[130px] truncate px-3 py-3.5 text-[12px]"
                        style={{ color: "var(--text-2)" }}>{s.project ?? "—"}</td>
                    <td className="whitespace-nowrap px-3 py-3.5">
                      {(() => {
                        const sk = (used.get(s.id) ?? []).filter((x) => x.kind === "skill");
                        if (!sk.length) return <span style={{ color: "var(--text-3)" }}>—</span>;
                        const short = sk[0].name.split(":").pop() ?? sk[0].name;
                        const name = short.length > 17 ? short.slice(0, 15) + "…" : short;
                        return (
                          <Badge color={TONE} title={sk.map((x) => x.name).join(", ")}>
                            {name}{sk.length > 1 ? ` +${sk.length - 1}` : ""}
                          </Badge>
                        );
                      })()}
                    </td>
                    <td className="whitespace-nowrap px-3 py-3.5"><Chips items={used.get(s.id) ?? []} /></td>
                    <td className="whitespace-nowrap px-3 py-3.5">
                      <p className="datum" style={{ color: "var(--text-2)" }}>{ago(s.started)}</p>
                      <p className="datum mt-1" style={{ color: "var(--text-3)" }}>{duration(s.started, s.ended)}</p>
                    </td>
                    <td className="datum whitespace-nowrap px-3 py-3.5 text-right"
                        style={{ color: "var(--text-3)" }}>
                      {s.usd === null
                        ? <NoData reason="No turn in this session has a known price." />
                        : <span title={s.unpriced
                            ? `${num(s.unpriced)} turns without a known price: the real equivalent is higher`
                            : "API equivalent of the session's tokens"}>
                            {usd(s.usd)}{s.unpriced ? "+" : ""}
                          </span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </section>

        <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
          {/* ── the timeline: what you asked for ──────────────────────── */}
          <section className="flex flex-col gap-3">
            <Section eyebrow="in order" tint={TONE} meta="the latest prompts">
              Timeline
            </Section>
            <div className="flex flex-col gap-2">
              {prompts.map((p, i) => {
                const live = i === 0 && recent(p.ts);
                return (
                  <Card key={p.ts + i} className="px-4 py-3">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      {live
                        ? <span className="beat" style={{ color: TONE }}><i /></span>
                        : <span className="h-1.5 w-1.5 rounded-full"
                                style={{ background: "rgb(255 255 255 / .18)" }} />}
                      <span className="datum" style={{ color: TONE }}>{p.session?.slice(0, 8)}</span>
                      <span className="label">{SOURCE_NAME[p.source] ?? p.source}</span>
                      {p.project ? <span className="label">{p.project}</span> : null}
                      <span className="label ml-auto">{ago(p.ts)}</span>
                    </div>
                    <p className="mt-1.5 line-clamp-2 text-[12.5px] leading-relaxed"
                       style={{ color: "var(--text-2)" }}>{p.text}</p>
                  </Card>
                );
              })}
            </div>
          </section>

          <section className="flex flex-col gap-3">
            <Section eyebrow="the instruments" tint={TONE}>What it works with</Section>
            <Card className="overflow-hidden">
              {tools.map((h) => (
                <div key={h.name}
                     className="flex items-center justify-between gap-3 border-b px-4 py-2.5 last:border-0">
                  <span className="inline-flex min-w-0 items-center gap-2.5">
                    <span className="shrink-0" style={{ color: "var(--text-3)" }}>
                      {hasIcon(h.name)
                        ? <ToolIcon name={h.name} size={14} />
                        : <span className="datum text-[10px]">{h.name.slice(0, 2)}</span>}
                    </span>
                    <span className="truncate text-[12.5px]" style={{ color: "var(--text)" }}>
                      {h.name}
                    </span>
                  </span>
                  <span className="figure text-[13px]" style={{ color: TONE }}>{num(h.n)}</span>
                </div>
              ))}
            </Card>
            <p className="text-[11.5px] leading-relaxed" style={{ color: "var(--text-3)" }}>
              It comes from the <span className="datum">tool_use</span> blocks in the transcripts:
              it is not what you have installed, it is what has really been run.
            </p>
          </section>
        </div>
      </div>
    </>
  );
}
