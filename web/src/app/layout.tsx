import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Motor Agéntico",
  description: "Observabilidad local y de solo lectura del uso y el coste de agentes de IA.",
};

export default function RaizLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
