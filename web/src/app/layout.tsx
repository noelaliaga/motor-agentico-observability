import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Motor Agéntico",
  description: "Local, read-only observability of the usage and cost of AI agents.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
