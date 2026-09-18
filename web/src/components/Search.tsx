"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

/* ─────────────────────────────────────────────────────────────────────────
   The ⌘K search.

   Everything searchable already travels in the HTML: skills, agents,
   connections, models and sections. There is no request at all while typing:
   with a few hundred entries, filtering in memory is instant and also works
   just as well with the reader stopped.
   ───────────────────────────────────────────────────────────────────────── */

export type Entry = { title: string; group: string; href: string; note?: string };

function withoutAccents(s: string) {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

export function Search({ entries }: { entries: Entry[] }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [i, setI] = useState(0);
  const box = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const res = useMemo(() => {
    const t = withoutAccents(q.trim());
    if (!t) return entries.slice(0, 8);
    return entries
      .map((e) => {
        const h = withoutAccents(e.title);
        // What starts with what you type goes before what only contains it:
        // that is what makes typing three letters hit the mark.
        const p = h.startsWith(t) ? 0 : h.includes(t) ? 1 : withoutAccents(e.group).includes(t) ? 2 : 9;
        return { e, p };
      })
      .filter((x) => x.p < 9)
      .sort((a, b) => a.p - b.p)
      .slice(0, 10)
      .map((x) => x.e);
  }, [q, entries]);

  useEffect(() => {
    const key = (ev: KeyboardEvent) => {
      if ((ev.metaKey || ev.ctrlKey) && ev.key.toLowerCase() === "k") {
        ev.preventDefault();
        setOpen((v) => !v);
        setQ(""); setI(0);
      }
      if (ev.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, []);

  useEffect(() => { if (open) box.current?.focus(); }, [open]);

  if (!open) {
    return (
      <button onClick={() => setOpen(true)}
              className="label flex items-center gap-2 rounded-[4px] px-3 py-1.5"
              style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
        search skills, connections, models…
        <span className="datum rounded-[3px] px-1.5 py-0.5 text-[10px]"
              style={{ background: "var(--card-high)" }}>⌘K</span>
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center px-4 pt-[14vh]"
         style={{ background: "rgb(2 4 6 / .74)", backdropFilter: "blur(3px)" }}
         onClick={() => setOpen(false)}>
      <div className="w-full max-w-[620px] overflow-hidden rounded-[8px]"
           style={{ background: "var(--card)", border: "1px solid var(--border-live)" }}
           onClick={(e) => e.stopPropagation()}>
        <input ref={box} value={q}
               onChange={(e) => { setQ(e.target.value); setI(0); }}
               onKeyDown={(e) => {
                 if (e.key === "ArrowDown") { e.preventDefault(); setI((v) => Math.min(v + 1, res.length - 1)); }
                 if (e.key === "ArrowUp") { e.preventDefault(); setI((v) => Math.max(v - 1, 0)); }
                 if (e.key === "Enter" && res[i]) { setOpen(false); router.push(res[i].href); }
               }}
               placeholder="skills, agents, connections, models…"
               className="w-full bg-transparent px-5 py-4 text-[15px] outline-none"
               style={{ color: "var(--text)", borderBottom: "1px solid var(--border)" }} />
        <div className="max-h-[46vh] overflow-y-auto">
          {res.length === 0 ? (
            <p className="px-5 py-6 text-[13px]" style={{ color: "var(--text-3)" }}>
              Nothing with that name.
            </p>
          ) : res.map((e, k) => (
            <button key={e.href + e.title} onMouseEnter={() => setI(k)}
                    onClick={() => { setOpen(false); router.push(e.href); }}
                    className="flex w-full items-baseline gap-3 px-5 py-2.5 text-left"
                    style={{ background: k === i ? "var(--card-high)" : "transparent" }}>
              <span className="min-w-0 flex-1 truncate text-[13px]">{e.title}</span>
              {e.note ? <span className="datum text-[11px]" style={{ color: "var(--amber)" }}>{e.note}</span> : null}
              <span className="label">{e.group}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
