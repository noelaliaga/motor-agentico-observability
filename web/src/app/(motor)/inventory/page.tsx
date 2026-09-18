import { Header } from "@/components/Header";
import {
  Section, Panel, Gauge, Capsule, Badge, num, ago, SECTION_TONE,
} from "@/components/Parts";
import { CatalogHero } from "@/components/parts/CatalogHero";
import { ScopeBadge, scopeTone } from "@/components/parts/Scope";
import { Collapsible } from "@/components/parts/Collapsible";
import { inventory, inventorySummary, mostInvoked } from "@/lib/queries";

/** Many descriptions come from the database with a "- " in front: out. */
function clean(text: string): string {
  return text.replace(/^[\s·–—-]+/, "");
}

export const dynamic = "force-dynamic";

const KINDS = [
  { kind: "agent",  title: "Agents",  foot: "global ones from Claude Code and from OpenClaw" },
  { kind: "skill",  title: "Skills",  foot: "global ones and Hermes'" },
  { kind: "mcp",    title: "MCP",     foot: "servers declared in your .mcp.json files" },
  { kind: "plugin", title: "Plugins", foot: "from Claude Code" },
];

export default function Inventory() {
  const summary = inventorySummary().filter((r) => r.kind !== "universe");
  const invoked = mostInvoked("skill", 12);
  const totalPieces = summary.reduce((s, r) => s + r.total, 0);
  const totalUsed = summary.reduce((s, r) => s + r.used, 0);
  const TONE = SECTION_TONE.inventory;

  return (
    <>
      <Header path="inventory" />
      <div className="flex flex-col gap-9 px-6 py-7 pb-14">

        <CatalogHero
          tint={TONE} seed={33} badge="inventory"
          meta="agents · skills · mcp · plugins"
          figure={num(totalPieces)}
          rest="pieces declared on this machine"
          extra={
            <>
              <Capsule color={TONE}>{num(totalUsed)} in use</Capsule>
              <Badge tone="neutral">{num(totalPieces - totalUsed)} dormant</Badge>
            </>
          }
        >
          Everything you have declared on your machines, and how much of it really
          works. Usage is not declared: it is crossed against the real invocations in
          your transcripts.
        </CatalogHero>

        {/* ── the uncomfortable figure, one per kind ───────────────────── */}
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {KINDS.map((c) => {
            const r = summary.find((x) => x.kind === c.kind);
            if (!r) return null;
            const dormant = r.total - r.used;
            return (
              <Panel key={c.kind} className="flex items-center gap-4 p-5">
                <Gauge part={r.total ? r.used / r.total : null}
                       caption="in use" color={TONE} size={72} />
                <div className="min-w-0">
                  <p className="label">{c.title}</p>
                  <p className="figure mt-1 text-[27px]" style={{ color: "var(--text)" }}>
                    {num(r.total)}
                  </p>
                  <p className="mt-0.5 text-[11.5px]" style={{ color: "var(--text-3)" }}>
                    {num(r.used)} in use
                    {dormant > 0 ? (
                      <span style={{ color: "var(--spend)" }}> · {num(dormant)} dormant</span>
                    ) : null}
                  </p>
                </div>
              </Panel>
            );
          })}
        </div>

        {/* ── what does get fired ──────────────────────────────────────── */}
        <section className="flex flex-col gap-3">
          <Section eyebrow="what is really invoked" tint={TONE}
                   meta="counted in transcripts">
            The skills you fire most
          </Section>
          <Panel className="overflow-x-auto">
            <table className="w-full min-w-[520px]">
              <thead>
                <tr className="border-b">
                  <th scope="col" className="label px-4 py-2.5 text-left font-normal">skill</th>
                  <th scope="col" className="label px-4 py-2.5 text-left font-normal">last used</th>
                  <th scope="col" className="label px-4 py-2.5 text-right font-normal">uses</th>
                </tr>
              </thead>
              <tbody>
                {invoked.length ? invoked.map((s) => (
                  <tr key={s.name} className="border-b last:border-0">
                    <td className="max-w-[380px] truncate px-4 py-2.5 text-[13px]"
                        style={{ color: "var(--text)" }}>{s.name}</td>
                    <td className="datum px-4 py-2.5" style={{ color: "var(--text-3)" }}>{ago(s.last)}</td>
                    <td className="figure px-4 py-2.5 text-right text-[14px]" style={{ color: TONE }}>
                      {num(s.n)}
                    </td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={3} className="px-4 py-6 text-[12.5px]" style={{ color: "var(--text-3)" }}>
                      No invocation has been recorded yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </Panel>
        </section>

        {/* ── the catalogue, kind by kind ──────────────────────────────── */}
        {KINDS.map((c) => {
          const items = inventory(c.kind);
          if (!items.length) return null;
          const used = items.filter((i) => i.uses > 0);
          const dormant = items.filter((i) => !i.uses);
          return (
            <section key={c.kind} className="flex flex-col gap-3">
              <Section tint={TONE} eyebrow={c.foot}
                       meta={
                         <span className="label">
                           <span style={{ color: TONE }}>{used.length} in use</span>
                           {" · "}{dormant.length} dormant
                         </span>
                       }>
                {c.title}
              </Section>
              {(() => {
                const card = (i: (typeof items)[number]) => (
                  <Panel key={c.kind + i.name + i.scope} className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <span className="h-1.5 w-1.5 shrink-0 rounded-full"
                            style={{ background: i.uses ? scopeTone(i.scope) : "rgb(255 255 255 / .14)" }} />
                      <span className="min-w-0 flex-1 truncate text-[13px]"
                            style={{ color: i.uses ? "var(--text)" : "var(--text-2)" }}>{i.name}</span>
                      <ScopeBadge scope={i.scope} />
                      <span className="datum w-[46px] shrink-0 text-right"
                            style={{ color: i.uses ? scopeTone(i.scope) : "var(--text-3)" }}>
                        {i.uses || "—"}
                      </span>
                    </div>
                    {i.description ? (
                      <p className="mt-1 line-clamp-2 pl-[18px] text-[11.5px] leading-snug"
                         style={{ color: "var(--text-3)" }}>{clean(i.description)}</p>
                    ) : null}
                  </Panel>
                );
                return (
                  <>
                    {used.length ? (
                      <div className="grid gap-2 lg:grid-cols-2">{used.map(card)}</div>
                    ) : null}
                    {dormant.length ? (
                      <Collapsible
                        closed={`see the ${num(dormant.length)} dormant`}
                        open={`fold the ${num(dormant.length)} dormant`}
                      >
                        <div className="grid gap-2 lg:grid-cols-2">{dormant.map(card)}</div>
                      </Collapsible>
                    ) : null}
                  </>
                );
              })()}
            </section>
          );
        })}

        <p className="max-w-[720px] text-[11.5px] leading-relaxed" style={{ color: "var(--text-3)" }}>
          Usage is not declared: it is crossed. It comes from counting the{" "}
          <span className="datum">tool_use</span> blocks in your transcripts and the{" "}
          <span className="datum">use_count</span> Hermes stores. An agent without
          invocations shows as zero even if it is perfectly written.
        </p>
      </div>
    </>
  );
}
