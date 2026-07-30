import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isCalendarConnected } from "@/lib/google/calendar";
import { isGoogleCalendarConfigured } from "@/lib/google/oauth";
import { CalendarView } from "@/components/CalendarView";

export default async function CalendarPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = supabase ? await supabase.auth.getUser() : { data: { user: null } };

  const configured = isGoogleCalendarConfigured();
  const connected = user && configured ? await isCalendarConnected(user.id) : false;

  return (
    <main className="mx-auto max-w-3xl space-y-6 px-4 py-8">
      <div>
        <p className="text-sm uppercase tracking-wide text-neutral-500">Google Calendar</p>
        <h1 className="text-2xl font-semibold">Calendário</h1>
      </div>

      {!connected ? (
        <div className="rounded-xl border border-neutral-800 p-5 text-sm text-neutral-400">
          Ainda não ligaste o Google Calendar.{" "}
          <Link href="/settings" className="text-emerald-400 hover:underline">
            Liga-o em Definições
          </Link>{" "}
          para veres aqui os teus compromissos.
        </div>
      ) : (
        <CalendarView />
      )}
    </main>
  );
}
