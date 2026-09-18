import { freshness, range, streak, skills, inventory, connections } from "@/lib/queries";
import { Search, type Entry } from "./Search";

/** The name in the header prompt. Configurable, as in the reader. */
const USER = (process.env.MOTOR_USER || "demo").toLowerCase().replace(/[^a-z0-9._-]/g, "");

/** Everything that can be searched, assembled once per render on the server. */
function searchables(): Entry[] {
  const e: Entry[] = [
    { title: "Home", group: "section", href: "/" },
    { title: "Money", group: "section", href: "/money" },
    { title: "Tools", group: "section", href: "/tools" },
    { title: "Connections", group: "section", href: "/connections" },
    { title: "Skills", group: "section", href: "/skills" },
    { title: "Activity", group: "section", href: "/activity" },
    { title: "Inventory", group: "section", href: "/inventory" },
    { title: "Memory", group: "section", href: "/memory" },
    { title: "Nightly review", group: "section", href: "/review" },
    { title: "Hermes", group: "machine", href: "/machines/hermes" },
    { title: "OpenClaw", group: "machine", href: "/machines/openclaw" },
  ];
  for (const s of skills()) {
    e.push({ title: s.name, group: `skill · ${s.scope}`, href: "/skills",
             note: s.uses ? `${s.uses}` : undefined });
  }
  for (const a of inventory("agent")) {
    e.push({ title: a.name, group: `agent · ${a.scope}`, href: "/inventory",
             note: a.uses ? `${a.uses}` : undefined });
  }
  for (const c of connections()) {
    e.push({ title: c.name, group: `connection · ${c.via}`, href: "/connections",
             note: c.uses ? `${c.uses}` : undefined });
  }
  return e;
}

/**
 * The terminal header, and the freshness indicator.
 *
 * The lag between the index and the disk is ALWAYS on screen. It is the
 * antidote to the classic flaw of a dashboard with a database behind it:
 * showing yesterday's numbers as if they were current. An invisible lag is a
 * lie; a written one is a fact.
 */
export function Header({ path }: { path: string }) {
  const s = freshness();
  const r = range();
  const st = streak();
  const stalled = s > 30;
  const text = s > 3600 ? `${Math.floor(s / 3600)} h` : s > 90 ? `${Math.floor(s / 60)} min` : `${s} s`;

  return (
    /* One single row, always, and of fixed height. With `flex-wrap` the header
       measured 52 px on / and on /review but 78 px on the routes with long
       names (/connections, /tools, /machines/…), so each screen's hero started
       at a different height: the most visible seam of the ten when going
       through them in a row. Now what does not fit steps back in reverse order
       of importance (the date range first, the streak after) instead of
       pushing a second line. */
    <header className="sticky top-0 z-10 flex h-[54px] items-center gap-x-5 border-b px-6"
            style={{ background: "color-mix(in oklab, var(--pit) 90%, transparent)", backdropFilter: "blur(14px)" }}>
      <p className="datum shrink-0" style={{ color: "var(--text-3)" }}>
        <span style={{ color: "var(--saving)" }}>{USER}</span>
        <span>@motor</span>
        <span style={{ color: "var(--text-3)" }}> : </span>
        <span className="rounded-[3px] px-1.5 py-0.5"
              style={{ background: "var(--amber)", color: "#100C02" }}>~/{path}</span>
        <span style={{ color: "var(--text-3)" }}> $</span>
      </p>

      <div className="ml-auto flex min-w-0 items-center gap-x-5">
        <Search entries={searchables()} />
        {st.days > 1 ? (
          <p className="label hidden shrink-0 items-center gap-1.5 xl:flex"
             title={`${st.total} days with activity in total`}>
            <span style={{ color: "var(--spend)" }}>▲</span>
            <span style={{ color: "var(--text)" }}>{st.days}</span> days in a row
          </p>
        ) : null}
        {r?.first_day ? (
          <p className="label hidden shrink-0 2xl:block">
            {r.first_day} → {r.last_day} · {r.days} days
          </p>
        ) : null}
        <p className="label flex shrink-0 items-center gap-2"
           style={{ color: stalled ? "var(--alert)" : "var(--text-3)" }}>
          <span className="beat" style={{ color: stalled ? "var(--alert)" : "var(--saving)" }}><i /></span>
          {stalled ? `the reader has been stopped for ${text}` : `index up to date · ${text} ago`}
        </p>
      </div>
    </header>
  );
}
