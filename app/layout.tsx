import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "Project Rebuild",
  description: "Sou um atleta em reconstrução.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt">
      <body className="min-h-screen bg-neutral-950 text-neutral-100" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
