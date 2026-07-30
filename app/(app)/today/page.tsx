import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getFounderNow } from "@/lib/date/founder-now";
import { DecisionDay } from "@/components/DecisionDay";

export default async function TodayPage() {
  const supabase = await createSupabaseServerClient();

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

  // The founder's local "today", not the server's (UTC on Vercel) - keeps
  // /today, /history, and decision generation agreeing on the same date
  // near midnight (see lib/date/founder-now.ts).
  const { date } = await getFounderNow(supabase, user.id);

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

  // Pre-existing "Útil / Não útil" feedback, if the founder already gave it
  // earlier today (e.g. before a page reload) - keeps the buttons reflecting
  // the saved state instead of resetting to unselected.
  const decisionIds = (decisions ?? []).map((decision) => decision.id);
  const { data: feedbackRows } = decisionIds.length
    ? await supabase
        .from("decision_feedback")
        .select("decision_id, useful")
        .eq("user_id", user.id)
        .in("decision_id", decisionIds)
    : { data: [] };
  const feedbackByDecisionId = Object.fromEntries(
    (feedbackRows ?? [])
      .filter((row) => row.useful !== null)
      .map((row) => [row.decision_id, row.useful as boolean])
  );

  return (
    <main className="mx-auto max-w-xl space-y-6 px-4 py-8">
      <header>
        <p className="text-sm uppercase tracking-wide text-neutral-400">
          Sou um atleta em reconstrução.
        </p>
        <h1 className="text-2xl font-semibold">Hoje</h1>
      </header>
      <DecisionDay
        date={date}
        hasCheckIn={Boolean(checkIn)}
        initialDecisions={decisions ?? []}
        initialFeedback={feedbackByDecisionId}
      />
    </main>
  );
}
