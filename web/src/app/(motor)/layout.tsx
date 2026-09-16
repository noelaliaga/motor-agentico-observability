import { Barra } from "@/componentes/Barra";
import { salud } from "@/lib/consultas";
import { NOMBRE_FUENTE } from "@/componentes/Marcas";

export const dynamic = "force-dynamic";

const MAQUINAS = ["claude_code", "codex", "hermes", "openclaw", "openrouter"];

export default function MotorLayout({ children }: { children: React.ReactNode }) {
  const s = salud();
  const maquinas = MAQUINAS.map((id) => {
    const f = s.find((x) => x.fuente === id);
    return {
      id,
      nombre: NOMBRE_FUENTE[id] ?? id,
      // Viva = la última pasada terminó sin error. Que una fuente no sepa su
      // gasto (Hermes, OpenClaw) NO la hace estar caída: son dos hechos
      // distintos y mezclarlos pintaba de gris cosas que funcionan.
      ok: Boolean(f?.ultima_ok) && !f?.error,
    };
  });
  return (
    <div className="min-h-dvh">
      <Barra maquinas={maquinas} />
      <main className="md:pl-[236px]">{children}</main>
    </div>
  );
}
