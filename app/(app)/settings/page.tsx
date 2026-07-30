import Link from "next/link";
import { CalendarCheck2, LogOut, Mail, Star } from "lucide-react";
import { signOut } from "@/app/auth/actions";
import { disconnectGoogleCalendar, setPrimaryGoogleAccount } from "./actions";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { listConnections } from "@/lib/google/calendar";
import { isGoogleCalendarConfigured } from "@/lib/google/oauth";

const CALENDAR_STATUS_MESSAGE: Record<string, string> = {
  connected: "Conta Google adicionada.",
  disconnected: "Conta Google desligada.",
  "primary-updated": "Conta principal atualizada.",
  denied: "Autorização cancelada — a conta não foi ligada.",
  error: "Não foi possível ligar a conta Google. Tenta novamente.",
  "not-configured": "A integração com o Google Calendar ainda não está configurada.",
};

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ calendar?: string }>;
}) {
  const { calendar } = await searchParams;
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = supabase ? await supabase.auth.getUser() : { data: { user: null } };

  const calendarConfigured = isGoogleCalendarConfigured();
  const connections = user && calendarConfigured ? await listConnections(user.id) : [];
  const statusMessage = calendar ? CALENDAR_STATUS_MESSAGE[calendar] : null;

  return (
    <main className="mx-auto max-w-2xl space-y-6 px-4 py-8">
      <div>
        <p className="text-sm uppercase tracking-wide text-neutral-500">Conta</p>
        <h1 className="text-2xl font-semibold tracking-tight">Definições</h1>
      </div>

      <section className="surface-card p-5">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/[0.05] text-neutral-300">
            <Mail size={16} />
          </span>
          <div>
            <h2 className="font-medium">Sessão</h2>
            <p className="text-sm text-neutral-400">{user?.email}</p>
          </div>
        </div>
        <form action={signOut} className="mt-4">
          <button type="submit" className="btn-secondary">
            <LogOut size={14} />
            Terminar sessão
          </button>
        </form>
      </section>

      <section className="surface-card p-5">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-400">
            <CalendarCheck2 size={16} />
          </span>
          <h2 className="font-medium">Google Calendar</h2>
        </div>

        {statusMessage && <p className="mt-2 text-sm text-neutral-400">{statusMessage}</p>}

        {!calendarConfigured ? (
          <p className="mt-3 text-sm text-neutral-400">
            A integração ainda não está configurada neste ambiente.
          </p>
        ) : (
          <div className="mt-3 space-y-3">
            {connections.length > 0 && (
              <>
                <p className="text-sm text-neutral-400">
                  O motor de decisões tem em conta os compromissos de todas as contas ligadas.{" "}
                  <Link href="/calendar" className="text-emerald-400 hover:underline">
                    Ver calendário
                  </Link>
                  .
                </p>
                <ul className="space-y-2">
                  {connections.map((connection) => (
                    <li
                      key={connection.id}
                      className="flex items-center justify-between gap-3 rounded-xl bg-white/[0.03] px-3 py-2.5"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm text-neutral-200">
                          {connection.label || connection.googleAccountEmail || "Conta Google"}
                        </p>
                        {connection.isPrimary && (
                          <p className="flex items-center gap-1 text-xs text-emerald-400">
                            <Star size={11} />
                            Conta principal
                          </p>
                        )}
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        {!connection.isPrimary && (
                          <form action={setPrimaryGoogleAccount.bind(null, connection.id)}>
                            <button type="submit" className="btn-ghost" title="Tornar principal">
                              <Star size={13} />
                              Tornar principal
                            </button>
                          </form>
                        )}
                        <form action={disconnectGoogleCalendar.bind(null, connection.id)}>
                          <button type="submit" className="btn-secondary">
                            Desligar
                          </button>
                        </form>
                      </div>
                    </li>
                  ))}
                </ul>
              </>
            )}

            <p className="text-sm text-neutral-400">
              {connections.length === 0
                ? "Liga o teu Google Calendar para as decisões terem em conta os espaços livres na tua agenda."
                : "Podes ligar outra conta Google (por exemplo, pessoal e trabalho) — os espaços livres/ocupados são calculados juntando todas."}
            </p>
            <a href="/api/google/connect" className="btn-primary inline-flex">
              {connections.length === 0 ? "Ligar Google Calendar" : "Ligar outra conta"}
            </a>
          </div>
        )}
      </section>
    </main>
  );
}
