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
    <main className="mx-auto max-w-3xl space-y-6 px-4 py-8">
      <div>
        <p className="text-sm uppercase tracking-wide text-neutral-500">Conta</p>
        <h1 className="text-2xl font-semibold">Definições</h1>
      </div>
      <section className="rounded-xl border border-neutral-800 p-5">
        <h2 className="font-medium">Sessão</h2>
        <p className="mt-1 text-sm text-neutral-400">{user?.email}</p>
        <form action={signOut} className="mt-4">
          <button
            type="submit"
            className="rounded-md border border-neutral-700 px-3 py-2 text-sm hover:bg-neutral-900"
          >
            Terminar sessão
          </button>
        </form>
      </section>
      <section className="rounded-xl border border-neutral-800 p-5">
        <h2 className="font-medium">Google Calendar</h2>
        {statusMessage && <p className="mt-1 text-sm text-neutral-400">{statusMessage}</p>}
        {!calendarConfigured ? (
          <p className="mt-3 text-sm text-neutral-400">
            A integração ainda não está configurada neste ambiente.
          </p>
        ) : calendarConnected ? (
          <div className="mt-3 space-y-3">
            <p className="text-sm text-neutral-400">
              O motor de decisões já tem em conta os teus compromissos de hoje.
            </p>
            <form action={disconnectGoogleCalendar}>
              <button
                type="submit"
                className="rounded-md border border-neutral-700 px-3 py-2 text-sm hover:bg-neutral-900"
              >
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
            <a
              href="/api/google/connect"
              className="inline-block rounded-md bg-emerald-600 px-3 py-2 text-sm text-white hover:bg-emerald-500"
            >
              Ligar Google Calendar
            </a>
          </div>
        )}
      </section>
    </main>
  );
}
