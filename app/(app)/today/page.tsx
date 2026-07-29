import { createSupabaseServerClient } from "@/lib/supabase/server";
import { localDateKey } from "@/lib/date/local";
import { DecisionDay } from "@/components/DecisionDay";

export default async function TodayPage() {
  const supabase = await createSupabaseServerClient();
  const date = localDateKey();

  // The (app) layout already redirects unauthenticated users away, so a
  // missing user/client here would only happen in a race — render an empty
  // shell rather than throwing.
  if (!supabase) {
    return <main className="mx-auto max-w-xl px-4 py-8">Configuração em falta.</main>;
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return <main className="mx-auto max-w-xl px-4 py-8">Sessão expirada.</main>;
  }

  const [{ data: checkIn }, { data: decisions }] = await Promise.all([
    supabase
      .from("daily_check_ins")
      .select("id")
      .eq("user_id", user.id)
      .eq("date", date)
      .maybeSingle(),
    supabase
      .from("decisions")
      .select("*")
      .eq("user_id", user.id)
      .eq("date", date)
      .order("domain", { ascending: true }),
  ]);

  return (
    <main className="mx-auto max-w-xl space-y-6 px-4 py-8">
      <header>
        <p className="text-sm uppercase tracking-wide text-neutral-400">
          Sou um atleta em reconstrução.
        </p>
        <h1 className="text-2xl font-semibold">Hoje</h1>
      </header>
      <DecisionDay date={date} hasCheckIn={Boolean(checkIn)} initialDecisions={decisions ?? []} />
    </main>
  );
}
