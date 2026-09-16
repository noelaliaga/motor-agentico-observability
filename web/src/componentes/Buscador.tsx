"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

/* ─────────────────────────────────────────────────────────────────────────
   El buscador de ⌘K.

   Todo lo buscable viaja ya en el HTML: skills, agentes, conexiones, modelos
   y secciones. No hay petición ninguna al teclear — con unos cientos de
   entradas, filtrar en memoria es instantáneo y además funciona igual de bien
   con el lector parado.
   ───────────────────────────────────────────────────────────────────────── */

export type Entrada = { titulo: string; grupo: string; href: string; nota?: string };

function sinTildes(s: string) {
  return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

export function Buscador({ entradas }: { entradas: Entrada[] }) {
  const [abierto, setAbierto] = useState(false);
  const [q, setQ] = useState("");
  const [i, setI] = useState(0);
  const caja = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const res = useMemo(() => {
    const t = sinTildes(q.trim());
    if (!t) return entradas.slice(0, 8);
    return entradas
      .map((e) => {
        const h = sinTildes(e.titulo);
        // Lo que empieza por lo que escribes va antes que lo que sólo lo
        // contiene: es lo que hace que teclear tres letras acierte.
        const p = h.startsWith(t) ? 0 : h.includes(t) ? 1 : sinTildes(e.grupo).includes(t) ? 2 : 9;
        return { e, p };
      })
      .filter((x) => x.p < 9)
      .sort((a, b) => a.p - b.p)
      .slice(0, 10)
      .map((x) => x.e);
  }, [q, entradas]);

  useEffect(() => {
    const tecla = (ev: KeyboardEvent) => {
      if ((ev.metaKey || ev.ctrlKey) && ev.key.toLowerCase() === "k") {
        ev.preventDefault();
        setAbierto((v) => !v);
        setQ(""); setI(0);
      }
      if (ev.key === "Escape") setAbierto(false);
    };
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  }, []);

  useEffect(() => { if (abierto) caja.current?.focus(); }, [abierto]);

  if (!abierto) {
    return (
      <button onClick={() => setAbierto(true)}
              className="rotulo flex items-center gap-2 rounded-[4px] px-3 py-1.5"
              style={{ background: "var(--carta)", border: "1px solid var(--borde)" }}>
        buscar skills, conexiones, modelos…
        <span className="dato rounded-[3px] px-1.5 py-0.5 text-[10px]"
              style={{ background: "var(--carta-alta)" }}>⌘K</span>
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center px-4 pt-[14vh]"
         style={{ background: "rgb(2 4 6 / .74)", backdropFilter: "blur(3px)" }}
         onClick={() => setAbierto(false)}>
      <div className="w-full max-w-[620px] overflow-hidden rounded-[8px]"
           style={{ background: "var(--carta)", border: "1px solid var(--borde-vivo)" }}
           onClick={(e) => e.stopPropagation()}>
        <input ref={caja} value={q}
               onChange={(e) => { setQ(e.target.value); setI(0); }}
               onKeyDown={(e) => {
                 if (e.key === "ArrowDown") { e.preventDefault(); setI((v) => Math.min(v + 1, res.length - 1)); }
                 if (e.key === "ArrowUp") { e.preventDefault(); setI((v) => Math.max(v - 1, 0)); }
                 if (e.key === "Enter" && res[i]) { setAbierto(false); router.push(res[i].href); }
               }}
               placeholder="skills, agentes, conexiones, modelos…"
               className="w-full bg-transparent px-5 py-4 text-[15px] outline-none"
               style={{ color: "var(--texto)", borderBottom: "1px solid var(--borde)" }} />
        <div className="max-h-[46vh] overflow-y-auto">
          {res.length === 0 ? (
            <p className="px-5 py-6 text-[13px]" style={{ color: "var(--texto-3)" }}>
              Nada con ese nombre.
            </p>
          ) : res.map((e, k) => (
            <button key={e.href + e.titulo} onMouseEnter={() => setI(k)}
                    onClick={() => { setAbierto(false); router.push(e.href); }}
                    className="flex w-full items-baseline gap-3 px-5 py-2.5 text-left"
                    style={{ background: k === i ? "var(--carta-alta)" : "transparent" }}>
              <span className="min-w-0 flex-1 truncate text-[13px]">{e.titulo}</span>
              {e.nota ? <span className="dato text-[11px]" style={{ color: "var(--ambar)" }}>{e.nota}</span> : null}
              <span className="rotulo">{e.grupo}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
