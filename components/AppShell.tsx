import Link from "next/link";
import type { ReactNode } from "react";

const NAV_ITEMS = [
  { href: "/today", label: "Hoje" },
  { href: "/history", label: "Histórico" },
  { href: "/settings", label: "Definições" },
];

export function AppShell({
  children,
  email,
}: {
  children: ReactNode;
  email?: string | null;
}) {
  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100">
      <header className="border-b border-neutral-800">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-4 py-4">
          <Link href="/today" className="font-semibold tracking-tight">
            Rebuild
          </Link>
          <nav aria-label="Navegação principal" className="flex items-center gap-4 text-sm">
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="text-neutral-400 transition hover:text-neutral-100"
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
        {email && (
          <p className="mx-auto max-w-3xl px-4 pb-3 text-xs text-neutral-500">{email}</p>
        )}
      </header>
      {children}
    </div>
  );
}
