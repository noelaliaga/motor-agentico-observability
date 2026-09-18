import { Sidebar } from "@/components/Sidebar";
import { health } from "@/lib/queries";
import { SOURCE_NAME } from "@/components/Brands";

export const dynamic = "force-dynamic";

const MACHINES = ["claude_code", "codex", "hermes", "openclaw", "openrouter"];

export default function MotorLayout({ children }: { children: React.ReactNode }) {
  const s = health();
  const machines = MACHINES.map((id) => {
    const f = s.find((x) => x.source === id);
    return {
      id,
      name: SOURCE_NAME[id] ?? id,
      // Alive = the last pass ended without an error. A source not knowing its
      // spend (Hermes, OpenClaw) does NOT make it down: they are two different
      // facts and mixing them up painted grey things that work.
      ok: Boolean(f?.last_ok) && !f?.error,
    };
  });
  return (
    <div className="min-h-dvh">
      <Sidebar machines={machines} />
      <main className="md:pl-[236px]">{children}</main>
    </div>
  );
}
