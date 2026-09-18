import { Header } from "@/components/Header";
import {
  Section, Empty, num, ago, Panel, Tile, Badge, Capsule, NoData,
} from "@/components/Parts";
import { TINT, brandOf } from "@/components/Brands";
import { Hero } from "@/components/parts/Hero";
import { machine, clawAgents } from "@/lib/machines";

export const dynamic = "force-dynamic";

const PINK = TINT.openclaw;

/** An OpenClaw agent's configuration, if its description is the JSON from
    openclaw.json. Nothing is estimated: either the JSON parses, or it is shown raw. */
function configOf(desc: string | null): { primary?: string; fallbacks?: string[] } | null {
  if (!desc) return null;
  try {
    const j: unknown = JSON.parse(desc);
    if (j && typeof j === "object" && ("primary" in j || "fallbacks" in j)) {
      return j as { primary?: string; fallbacks?: string[] };
    }
  } catch { /* it was not JSON: it is shown as is */ }
  return null;
}

export default function OpenClaw() {
  const m = machine("openclaw");
  const agents = clawAgents();

  return (
    <>
      <Header path="machines/openclaw" />
      <div className="flex flex-col gap-8 px-6 py-7">

        {/* ── the machine's dashboard: a header with its brand ────────── */}
        <Hero tint={PINK} seed={47}>
          <div className="flex flex-wrap items-start justify-between gap-6 px-7 py-8">
            <div className="flex min-w-0 flex-col gap-3">
              <div className="flex flex-wrap items-center gap-2.5">
                <Badge color={PINK}>autonomous agent</Badge>
                <span className="label">read-only · openclaw.json</span>
              </div>
              <h1 className="headline">
                <b style={{ color: PINK, textShadow: "0 0 26px rgb(251 113 133 / .3)" }}>OpenClaw</b>
              </h1>
              <p className="max-w-[560px] text-[13px] leading-relaxed" style={{ color: "var(--text-2)" }}>
                An autonomous agent with its own agents and models. From it, the motor can only read its
                configuration: its logs do not store consumption.
              </p>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                {m?.alive ? (
                  <Capsule color={PINK} beat>config read</Capsule>
                ) : m?.error && m.lastOk ? (
                  <Capsule tone="alert">reader failing</Capsule>
                ) : (
                  <Capsule tone="neutral">config not read</Capsule>
                )}
                {m?.error && m.lastOk ? (
                  <Badge tone="neutral" title="what you see below comes from that pass">
                    last good read {ago(m.lastOk)}
                  </Badge>
                ) : null}
                <Badge tone="neutral">
                  {agents.length} {agents.length === 1 ? "declared agent" : "declared agents"}
                </Badge>
              </div>
            </div>

            <span className="tile shrink-0"
                  style={{ width: 84, height: 84, borderRadius: 20,
                           ["--tint" as string]: PINK, color: PINK }}>
              <OpenClawLogo size={44} />
            </span>
          </div>
        </Hero>

        {/* ── the four status cards ───────────────────────────────────── */}
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Panel tint={PINK} className="p-4">
            <p className="label">agents</p>
            <p className="figure mt-2 text-[24px]">{num(agents.length)}</p>
            <p className="label mt-1">declared in openclaw.json</p>
            <p className="mt-2.5 border-t pt-2 text-[11.5px]" style={{ color: "var(--text-3)" }}>
              it is the only thing the motor can read from it
            </p>
          </Panel>

          <Panel className="p-4">
            <p className="label">own spend</p>
            <p className="figure mt-2 text-[24px]">
              <NoData reason="Its logs store neither the model, nor the tokens, nor the cost per call." />
            </p>
            <p className="label mt-1">it does not record it</p>
            <p className="mt-2.5 border-t pt-2 text-[11.5px]" style={{ color: "var(--text-3)" }}>
              its real money is inside the OpenRouter total
            </p>
          </Panel>

          <Panel className="p-4">
            <p className="label">last good read</p>
            <p className="figure mt-2 text-[24px]">{ago(m?.error ? m?.lastOk : m?.last)}</p>
            <p className="label mt-1">
              {!m ? "no record"
                : m.error ? `the attempt ${ago(m.last)} failed`
                : `${m.ms} ms · ${num(m.rows)} rows`}
            </p>
            <p className="mt-2.5 border-t pt-2 text-[11.5px]" style={{ color: "var(--text-3)" }}>
              the reader comes by here on every cycle
            </p>
          </Panel>

          <Panel tint={m?.error ? "var(--alert)" : undefined} className="p-4">
            <p className="label">reader status</p>
            <div className="mt-2.5">
              <Capsule tone={m?.alive ? "saving" : m?.error ? "alert" : "neutral"}>
                {m?.alive ? "read" : m?.error ? "with an error" : "not read"}
              </Capsule>
            </div>
            {m?.error ? (
              <p className="datum mt-3 break-words border-t pt-2 text-[11px] leading-relaxed"
                 style={{ color: "var(--alert)" }}>
                {m.error}
              </p>
            ) : (
              <p className="mt-3 border-t pt-2 text-[11.5px]" style={{ color: "var(--text-3)" }}>
                the last pass ended without errors
              </p>
            )}
          </Panel>
        </div>

        <Panel className="p-5">
          <Section eyebrow="the reader's limit" tint="var(--alert)">
            What this motor CANNOT know about OpenClaw
          </Section>
          <p className="mt-2.5 max-w-[720px] text-[13px] leading-relaxed" style={{ color: "var(--text-2)" }}>
            Its logs (<span className="datum">~/.openclaw/logs</span>) store neither the model,
            nor the tokens, nor the cost per call. There is nothing to read, so no spend figure
            shows up here: this paragraph does.
          </p>
          <p className="mt-3 text-[12px] leading-relaxed" style={{ color: "var(--text-3)" }}>
            What is counted is its real money, mixed with Hermes' in the OpenRouter
            total. Separating them requires a <i>management key</i>.
          </p>
        </Panel>

        <section className="flex flex-col gap-3">
          <Section eyebrow="the fallback chain" tint="var(--alert)"
                   meta={m?.error && m.lastOk
                     ? `from openclaw.json · read ${ago(m.lastOk)}`
                     : "from openclaw.json, as is"}>
            Its agents
          </Section>
          {agents.length ? (
            <div className="flex flex-col gap-4">
              {agents.map((a) => {
                // openclaw.json keeps the model chain wherever it lands:
                // sometimes in the description, sometimes in the model column.
                const conf = configOf(a.description) ?? configOf(a.model);
                const plainModel = a.model && !configOf(a.model) ? a.model : null;
                const plainDesc = a.description && !configOf(a.description) ? a.description : null;
                return (
                  <Panel key={a.name} tint={PINK} className="p-5">
                    <div className="flex flex-wrap items-center gap-3">
                      <p className="text-[14px] font-medium">{a.name}</p>
                      <Badge color={PINK}>agent</Badge>
                      {plainModel ? <span className="datum" style={{ color: "var(--text-3)" }}>{plainModel}</span> : null}
                    </div>

                    {conf ? (
                      <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                        {conf.primary ? (
                          <Panel tint={TINT[brandOf(conf.primary)]} selected
                                 className="flex items-center gap-3 px-3.5 py-3">
                            <Tile brand={brandOf(conf.primary)} size={32} />
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-[12.5px] font-medium"
                                    title={conf.primary}>{conf.primary.split("/").at(-1)}</span>
                              <span className="datum block truncate" style={{ color: "var(--text-3)" }}>
                                {conf.primary}
                              </span>
                            </span>
                            <Badge color={PINK}>primary</Badge>
                          </Panel>
                        ) : null}
                        {(conf.fallbacks ?? []).map((f, i) => (
                          <Panel key={f} tint={TINT[brandOf(f)]}
                                 className="flex items-center gap-3 px-3.5 py-3">
                            <Tile brand={brandOf(f)} size={32} />
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-[12.5px] font-medium"
                                    title={f}>{f.split("/").at(-1)}</span>
                              <span className="datum block truncate" style={{ color: "var(--text-3)" }}>{f}</span>
                            </span>
                            <Badge tone="neutral">fallback {i + 1}</Badge>
                          </Panel>
                        ))}
                      </div>
                    ) : null}
                    {plainDesc ? (
                      <p className="datum mt-3 leading-relaxed" style={{ color: "var(--text-2)" }}>
                        {plainDesc}
                      </p>
                    ) : null}

                    {conf ? (
                      <p className="mt-3 text-[11.5px] leading-relaxed" style={{ color: "var(--text-3)" }}>
                        The fallback chain is literal: if the primary fails, OpenClaw drops
                        to the next one. It is not a preference of the motor: it is its configuration.
                      </p>
                    ) : null}
                  </Panel>
                );
              })}
            </div>
          ) : (
            <Panel>
              <Empty what="There are no agents declared in openclaw.json."
                     why="Either they have not been configured yet, or the file has a different shape than expected." />
            </Panel>
          )}
        </section>

        {m?.note ? (
          <p className="text-[11.5px] leading-relaxed" style={{ color: "var(--text-3)" }}>{m.note}</p>
        ) : null}
      </div>
    </>
  );
}

/** The claw, big for the hero. The same stroke as BRANDS.openclaw. */
function OpenClawLogo({ size = 30 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor"
         strokeWidth="1.4" strokeLinecap="round" aria-hidden="true">
      <path d="M6 4.5v7M9.7 3.6v8M14.3 3.6v8M18 4.5v7" />
      <path d="M5.2 11c0 4.4 3 8.5 6.8 8.5s6.8-4.1 6.8-8.5" />
    </svg>
  );
}
