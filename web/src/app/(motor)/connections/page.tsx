import { Header } from "@/components/Header";
import {
  Panel, Section, Tile, Badge, Capsule, num, ago, SECTION_TONE,
} from "@/components/Parts";
import { Hero } from "@/components/parts/Hero";
import { TINT, brandOf, type BrandName } from "@/components/Brands";
import { connections, type Connection } from "@/lib/queries";

export const dynamic = "force-dynamic";

/* Each route has its category colour: the header badge and nothing else.
   Each card's tint is ITS brand's, not the route's. */
const ROUTES = [
  {
    via: "connector", title: "Claude connectors", color: "var(--amber)",
    foot: "The ones you plugged in from your account; they travel with you to any session.",
  },
  {
    via: "mcp", title: "MCP servers", color: "#38BDF8",
    foot: "Declared in ~/.claude.json and in the .mcp.json files listed in MOTOR_MCP_JSON.",
  },
];

const connectionBrand = (c: Connection): BrandName =>
  brandOf(`${c.name} ${c.brand ?? ""}`);

const statusTone = (status: string): string =>
  status === "not configured" ? "var(--spend)" : "var(--saving)";

export default function Connections() {
  const all = connections();
  const used = all.filter((c) => c.uses > 0);
  const loose = all.filter((c) => c.status === "not configured");
  const routes = new Set(all.map((c) => c.via)).size;

  return (
    <>
      <Header path="connections" />
      <div className="flex flex-col gap-9 px-6 py-7">

        {/* seed 11 ran a constellation through the middle of the headline;
            53 leaves the lines in the sky on the right. */}
        <Hero tint={SECTION_TONE.connections} seed={53}>
          <div className="flex flex-col gap-3 px-7 py-8">
            <div className="flex flex-wrap items-center gap-2.5">
              <Badge color={SECTION_TONE.connections}>connections · the stack</Badge>
              <span className="label">{routes} ways in</span>
            </div>
            <h1 className="headline max-w-[680px]">
              <b>{all.length}</b> <span>things plugged into the stack</span>
            </h1>
            <p className="max-w-[640px] text-[13px] leading-relaxed" style={{ color: "var(--text-2)" }}>
              Every DECLARED connection the motor has found on this machine (Claude connectors
              and MCP servers), crossed with how many times it was really invoked. Declared
              does not mean it answers: the motor reads configuration, it does not test functions.
              The more that are active, the more context the review has to tell you something useful.
            </p>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <Capsule tone="saving">{num(used.length)} really used</Capsule>
              <Capsule tone={loose.length ? "spend" : "neutral"}>
                {num(loose.length)} not configured
              </Capsule>
            </div>
          </div>
        </Hero>

        {ROUTES.map((v) => {
          const group = all.filter((c) => c.via === v.via);
          if (!group.length) return null;
          return (
            <section key={v.via} className="flex flex-col gap-3">
              <Section badge={<Badge color={v.color}>{v.via}</Badge>}
                       tint={v.color} note={v.foot}
                       meta={`${group.length} on this route`}>
                {v.title}
              </Section>
              <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
                {group.map((c) =>
                  v.via === "disk"
                    ? <DiskCard key={c.id} c={c} />
                    : <ConnectionCard key={c.id} c={c} />)}
              </div>
            </section>
          );
        })}

        {/* The security note goes on screen, not only in the code. */}
        <p className="max-w-[760px] text-[11.5px] leading-relaxed" style={{ color: "var(--text-3)" }}>
          The motor opens no <span className="datum">.env</span> file. From an MCP server it stores
          the executable (without arguments) or the URL without its query and with the
          token-looking segments masked, and <b>how many</b> environment variables it uses: neither
          their names nor their values appear on any screen. A dashboard that can leak a service key
          by accident is not a dashboard: it is an incident waiting to happen.
        </p>
      </div>
    </>
  );
}

/* The connectors' tagline repeats nine times; the section's foot already says
   it once. Repeating it on every card is noise, not information. It must
   match the text the reader stores (reader/sources/connections.py). */
const TAGLINE = "connected at some point from your Claude account";

function ConnectionCard({ c }: { c: Connection }) {
  const brand = connectionBrand(c);
  const live = c.status !== "not configured";
  const detail = c.detail && c.detail !== TAGLINE ? c.detail : null;
  return (
    <Panel tint={live ? TINT[brand] : undefined} className="p-4">
      <div className="flex items-center gap-3">
        <Tile brand={brand} live={live} size={38} />
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <p className="min-w-0 flex-1 truncate text-[13.5px] font-medium"
               style={{ color: live ? "var(--text)" : "var(--text-3)" }}>{c.name}</p>
            {c.uses ? (
              <span className="figure text-[12px]" style={{ color: "var(--amber)" }}
                    title={`${num(c.uses)} recorded uses`}>{num(c.uses)}</span>
            ) : null}
          </div>
          {/* No truncate: at 900px wide "not used yet" ended up as
              "NOT USED Y…" on half the screen. Let it wrap to two lines:
              the dot stays aligned with the first. */}
          <p className="label mt-1.5 flex items-start gap-1.5" style={{ color: statusTone(c.status) }}>
            <span className="mt-[3px] h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: "currentColor" }} />
            <span className="min-w-0">
              {c.status}
              {c.last_used ? <span style={{ color: "var(--text-3)" }}> · last used {ago(c.last_used)}</span>
               : live && !c.uses ? <span style={{ color: "var(--text-3)" }}> · not used yet</span>
               : null}
            </span>
          </p>
        </div>
      </div>
      {detail ? (
        <p className="mt-2.5 truncate border-t pt-2.5 text-[11.5px]"
           style={{ color: "var(--text-3)" }} title={detail}>
          {detail}
        </p>
      ) : null}
    </Panel>
  );
}

/**
 * The on-disk route deserves its own card: here the figure that matters is
 * the SIZE of the context: how many notes, how many universes. The detail
 * arrives from the reader as text ("3706 notes in /path"); if its shape ever
 * changes, it is shown as is instead of breaking or making things up.
 */
function DiskCard({ c }: { c: Connection }) {
  const brand = connectionBrand(c);
  const open = c.status === "open";
  const tint = TINT[brand];

  const notes = /^(\d+) notes in (.+)$/.exec(c.detail ?? "");
  const universes = /^(\d+) indexed universes(?: · (.+))?$/.exec(c.detail ?? "");
  const figure = notes?.[1] ?? universes?.[1] ?? null;
  const unit = notes ? "notes" : universes ? "indexed universes" : null;
  const rest = notes?.[2] ?? universes?.[2] ?? null;

  // "Obsidian · My vault" repeats what the label underneath already says:
  // the card shows the proper name and the label says which app it is.
  const name = c.name.replace(/^Obsidian · /, "");

  return (
    <Panel tint={tint} selected={open} className="p-4">
      <div className="flex items-start gap-3">
        <Tile brand={brand} size={44} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13.5px] font-medium" style={{ color: "var(--text)" }}>
            {name}
          </p>
          <p className="label mt-1">{brand === "obsidian" ? "obsidian vault" : "house index"}</p>
        </div>
        <span className="shrink-0">
          {open
            ? <Capsule color={tint} beat>open now</Capsule>
            : <Capsule tone="saving">{c.status}</Capsule>}
        </span>
      </div>
      <div className="mt-4 flex items-baseline gap-2">
        {figure ? (
          <>
            <span className="figure text-[27px]" style={{ color: "var(--text)" }}>{num(+figure)}</span>
            <span className="label">{unit}</span>
          </>
        ) : (
          <span className="text-[12.5px]" style={{ color: "var(--text-2)" }}>{c.detail ?? "—"}</span>
        )}
      </div>
      {rest ? (
        <p className="mt-1.5 truncate text-[11px]" style={{ color: "var(--text-3)" }} title={rest}>
          {rest}
        </p>
      ) : null}
    </Panel>
  );
}
