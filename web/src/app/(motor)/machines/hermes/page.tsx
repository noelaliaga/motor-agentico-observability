import { Header } from "@/components/Header";
import {
  Section, Empty, num, ago, Panel, Tile, Badge, Capsule, NoData,
} from "@/components/Parts";
import { BRANDS, TINT, brandOf } from "@/components/Brands";
import { Hero } from "@/components/parts/Hero";
import { machine, hermesSessions, hermesByChannel, hermesByModel, hermesSkills } from "@/lib/machines";
import { memorySummary } from "@/lib/queries";

export const dynamic = "force-dynamic";

const GOLD = TINT.hermes;

/** Hermes stores start/end as epoch seconds (text), not as ISO: the house
    `ago()` does not understand them, so here they are translated first. */
function agoEpoch(t: string | null | undefined): string {
  const n = t ? parseFloat(t) : NaN;
  if (!Number.isFinite(n) || n <= 0) return "—";
  const s = Math.max(0, Date.now() / 1000 - n);
  if (s < 60) return `${Math.floor(s)}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export default function Hermes() {
  const m = machine("hermes");
  const sessions = hermesSessions();
  const channels = hermesByChannel();
  const models = hermesByModel();
  const skills = hermesSkills();
  const messages = sessions.reduce((s, x) => s + x.messages, 0);
  const used = skills.filter((s) => s.uses > 0);
  const memory = memorySummary().find((r) => r.system === "hermes") ?? null;
  const mostMessages = Math.max(...models.map((x) => x.messages), 1);
  const main = models[0] ?? null;
  const lastEnd = sessions.find((s) => s.ended)?.ended ?? null;

  return (
    <>
      <Header path="machines/hermes" />
      <div className="flex flex-col gap-8 px-6 py-7">

        {/* ── the agent's dashboard: a header with its brand ──────────── */}
        <Hero tint={GOLD} seed={31}>
          <div className="flex flex-wrap items-start justify-between gap-6 px-7 py-8">
            <div className="flex min-w-0 flex-col gap-3">
              <div className="flex flex-wrap items-center gap-2.5">
                <Badge color={GOLD}>autonomous assistant</Badge>
                <span className="label">hermes agent · nous research · mit</span>
              </div>
              <h1 className="headline">
                <b style={{ color: GOLD, textShadow: "0 0 26px rgb(245 179 1 / .35)" }}>Hermes</b>
              </h1>
              <p className="max-w-[560px] text-[13px] leading-relaxed" style={{ color: "var(--text-2)" }}>
                An autonomous agent that answers through several channels. The motor reads its database
                read-only: it knows who it talked to, through which channel and with which model, but
                not how much it spent, because Hermes does not write it down.
              </p>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <Capsule color={GOLD} beat={Boolean(m?.alive)}>
                  {m?.alive ? "database read" : "database not read"}
                </Capsule>
                {channels.map((c) => (
                  <Badge key={c.channel}
                         color={c.channel === "telegram" ? TINT.telegram : undefined}
                         title={`${c.sessions} sessions · ${num(c.messages)} messages`}>
                    {c.channel}
                  </Badge>
                ))}
              </div>
            </div>

            <span className="tile shrink-0"
                  style={{ width: 84, height: 84, borderRadius: 20, ["--tint" as string]: GOLD }}>
              <span style={{ color: GOLD }}><BRANDS.hermes size={44} /></span>
            </span>
          </div>
        </Hero>

        {/* ── the agent's four status cards ───────────────────────────── */}
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Panel tint={GOLD} className="p-4">
            <p className="label">agent</p>
            <p className="figure mt-2 text-[24px]"><NoData reason="Hermes does not write its version to state.db; there is no number to show." /></p>
            <p className="label mt-1">version</p>
            <p className="mt-2.5 border-t pt-2 text-[11.5px]" style={{ color: "var(--text-3)" }}>
              last read {ago(m?.last)}{m ? ` · ${m.ms} ms` : ""}
            </p>
          </Panel>

          <Panel tint={main ? TINT[brandOf(main.model)] : undefined} className="p-4">
            <p className="label">most used model</p>
            {main ? (
              <>
                <div className="mt-2 flex items-center gap-2.5">
                  <Tile brand={brandOf(main.model)} size={30} />
                  <p className="min-w-0 truncate text-[13px] font-medium" title={main.model}>
                    {main.model.split("/").at(-1)}
                  </p>
                </div>
                <p className="mt-2.5 border-t pt-2 text-[11.5px]" style={{ color: "var(--text-3)" }}>
                  {num(main.messages)} messages · {main.sessions} sessions
                </p>
              </>
            ) : (
              <p className="figure mt-2 text-[24px]"><NoData reason="No session carries a model." /></p>
            )}
          </Panel>

          <Panel className="p-4">
            <p className="label">memory</p>
            {memory ? (
              <>
                <p className="figure mt-2 text-[24px]">{num(memory.total)}</p>
                <p className="label mt-1">files in ~/.hermes/memories</p>
                <p className="mt-2.5 border-t pt-2 text-[11.5px]"
                   style={{ color: memory.stale ? "var(--spend)" : "var(--saving)" }}>
                  {memory.stale ? `${memory.stale} untouched for 10+ days` : "all fresh"}
                </p>
              </>
            ) : (
              <p className="figure mt-2 text-[24px]"><NoData reason="The memory index has no files from the hermes system." /></p>
            )}
          </Panel>

          <Panel className="p-4">
            <p className="label">sessions</p>
            <p className="figure mt-2 text-[24px]">{num(sessions.length)}</p>
            <p className="label mt-1">{num(messages)} messages in total</p>
            <p className="mt-2.5 border-t pt-2 text-[11.5px]" style={{ color: "var(--text-3)" }}>
              the last one ended {agoEpoch(lastEnd)}
            </p>
          </Panel>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <section className="flex flex-col gap-3">
            <Section eyebrow="input channels" tint={GOLD}
                     meta={`${channels.length} channels`}>
              Where you talk to it
            </Section>
            <Panel className="overflow-hidden">
              {channels.map((c) => (
                <div key={c.channel} className="flex items-center gap-3.5 border-b px-4 py-3 last:border-0">
                  <Tile brand={brandOf(c.channel)} size={30}
                        live={c.channel === "telegram"} />
                  <span className="flex-1 text-[13px]">{c.channel}</span>
                  <span className="datum" style={{ color: "var(--text-3)" }}>{c.sessions} sessions</span>
                  <span className="figure w-[70px] text-right" style={{ color: GOLD }}>{num(c.messages)}</span>
                </div>
              ))}
            </Panel>

            {/* The honest gap, right next to the data that does exist. */}
            <Panel className="p-5">
              <Section eyebrow="the gap, with its reason" tint={GOLD}>
                Why there is no money here
              </Section>
              <p className="mt-2.5 text-[13px] leading-relaxed" style={{ color: "var(--text-2)" }}>
                Hermes' <span className="datum">messages</span> table has a{" "}
                <span className="datum">token_count</span> column and it is <b>zero in all {num(messages)} rows</b>.
                It is not that it spent little: it does not record it. Estimating it from the length of the text
                would be making it up, so it shows as empty.
              </p>
              <p className="mt-3 text-[12px] leading-relaxed" style={{ color: "var(--text-3)" }}>
                Its real spend is counted: it is inside the OpenRouter total, together with
                OpenClaw's. Separating them requires an OpenRouter <i>management key</i>.
              </p>
            </Panel>
          </section>

          <section className="flex flex-col gap-3">
            <Section eyebrow="what it has called" tint={GOLD}
                     meta={`${models.length} models`}>
              With which models
            </Section>
            <Panel className="overflow-hidden">
              {models.map((x) => (
                <div key={x.model} className="border-b px-4 py-2.5 last:border-0">
                  <div className="flex items-center gap-3">
                    <Tile brand={brandOf(x.model)} size={26} />
                    <span className="min-w-0 flex-1 truncate text-[12.5px]" title={x.model}>{x.model}</span>
                    <span className="datum" style={{ color: "var(--text-3)" }}>{x.sessions} sess.</span>
                    <span className="figure w-[56px] text-right">{num(x.messages)}</span>
                  </div>
                  <span className="ratio-bar mt-2 block">
                    <i style={{ width: `${Math.max(1.5, (x.messages / mostMessages) * 100)}%`,
                                background: TINT[brandOf(x.model)] }} />
                  </span>
                </div>
              ))}
            </Panel>
          </section>
        </div>

        <section className="flex flex-col gap-3">
          <Section eyebrow="its own catalogue" tint={GOLD}
                   meta={<span className="label">
                     <span style={{ color: GOLD }}>{used.length} used</span>
                     {" · "}{skills.length - used.length} dormant
                   </span>}>
            Its skills
          </Section>
          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
            {used.map((s) => (
              <Panel key={s.name} tint={GOLD}
                     className="flex items-center gap-3 px-3.5 py-2.5">
                <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: GOLD }} />
                <span className="min-w-0 flex-1 truncate text-[12.5px]">{s.name}</span>
                <Badge color={GOLD} title={s.last_used ? `last used ${ago(s.last_used)}` : undefined}>
                  {s.uses} {s.uses === 1 ? "use" : "uses"}
                </Badge>
              </Panel>
            ))}
          </div>
          {skills.length > used.length ? (
            <Panel className="p-4">
              <p className="label">
                {skills.length - used.length} dormant · installed and without a single recorded use
              </p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {skills.filter((s) => !s.uses).map((s) => (
                  <Badge key={s.name} tone="neutral">{s.name}</Badge>
                ))}
              </div>
            </Panel>
          ) : null}
          <p className="text-[11.5px] leading-relaxed" style={{ color: "var(--text-3)" }}>
            It comes from <span className="datum">~/.hermes/skills/.usage.json</span>, which Hermes
            keeps with only the number of uses and the last time of each one.
          </p>
        </section>

        <section className="flex flex-col gap-3">
          <Section eyebrow="one row per session" tint={GOLD}
                   meta={`${sessions.length} sessions`}>
            Its conversations
          </Section>
          <Panel className="overflow-x-auto">
            {sessions.length ? (
              <table className="w-full min-w-[720px]">
                <thead>
                  <tr className="border-b">
                    {["session", "channel", "model", "messages", "last"].map((h) => (
                      <th key={h} className="label px-4 py-2.5 text-left font-normal">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sessions.map((s) => (
                    <tr key={s.id} className="border-b transition-colors last:border-0 hover:bg-white/[.025]">
                      <td className="px-4 py-2.5">
                        <span className="datum" style={{ color: GOLD }}>{s.id.slice(0, 8)}</span>
                        {s.title ? (
                          <span className="ml-3 text-[12px]" style={{ color: "var(--text-2)" }}>{s.title}</span>
                        ) : null}
                      </td>
                      <td className="px-4 py-2.5">
                        {s.channel
                          ? <Badge color={s.channel === "telegram" ? TINT.telegram : undefined}>{s.channel}</Badge>
                          : <span className="datum" style={{ color: "var(--text-3)" }}>—</span>}
                      </td>
                      <td className="datum px-4 py-2.5" style={{ color: "var(--text-3)" }}>{s.model ?? "—"}</td>
                      <td className="datum px-4 py-2.5">{s.messages}</td>
                      <td className="datum px-4 py-2.5" style={{ color: "var(--text-3)" }}>{agoEpoch(s.ended)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <Empty what="Hermes has not returned any session."
                     why="Either its database is empty, or the motor cannot find it in ~/.hermes/state.db." />
            )}
          </Panel>
        </section>

        {m ? (
          <p className="label">
            last read {ago(m.last)} · {m.ms} ms · {num(m.rows)} rows
          </p>
        ) : null}
      </div>
    </>
  );
}
