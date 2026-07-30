import Link from "next/link";
import { CalendarCheck2, LogOut, Mail } from "lucide-react";
import { signOut } from "@/app/auth/actions";
import { disconnectGoogleCalendar } from "./actions";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isCalendarConnected } from "@/lib/google/calendar";
import { isGoogleCalendarConfigured } from "@/lib/google/oauth";

const CALENDAR_STATUS_MESSAGE: Record<string, string> = {
  connected: "Google Calendar ligado.",
  disconnected: "Google Calendar desligado.",
  denied: "Autorização cancelada — o calendário não foi ligado.",
  error: "Não foi possível ligar o Google Calendar. Tenta novamente.",
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
  const calendarConnected = user && calendarConfigured ? await isCalendarConnected(user.id) : false;
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
        ) : calendarConnected ? (
          <div className="mt-3 space-y-3">
            <p className="text-sm text-neutral-400">
              O motor de decisões já tem em conta os teus compromissos de hoje.{" "}
              <Link href="/calendar" className="text-emerald-400 hover:underline">
                Ver calendário
              </Link>
              .
            </p>
            <form action={disconnectGoogleCalendar}>
              <button type="submit" className="btn-secondary">
                Desligar calendário
              </button>
            </form>
          </div>
        ) : (
          <div className="mt-3 space-y-3">
            <p className="text-sm text-neutral-400">
              Liga o teu Google Calendar para as decisões terem em conta os espaços livres na tua
              agenda.
            </p>
            <a href="/api/google/connect" className="btn-primary inline-flex">
              Ligar Google Calendar
            </a>
          </div>
        )}
      </section>
    </main>
  );
}
