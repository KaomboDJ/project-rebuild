import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getFounderNow } from "@/lib/date/founder-now";
import { CalendarWorkspace } from "@/components/CalendarWorkspace";
import { getCalendarEventsForDate, listConnections } from "@/lib/google/calendar";
import { computeFreeWindows, DEFAULT_PROFILE } from "@/lib/decision-engine/context-builder";

const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export default async function TodayPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
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

  // The calendar canvas may be navigated to a different date via the
  // sidebar's mini-calendar (?date=YYYY-MM-DD) - decisions themselves stay
  // pinned to the founder's real "today" above, only CalendarPanel's
  // initial view moves.
  const dateParam = (await searchParams).date;
  const initialCalendarDate = dateParam && DATE_KEY_PATTERN.test(dateParam) ? dateParam : date;

  const [{ data: checkIn }, { data: decisions }, { data: profileRow }] = await Promise.all([
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
    supabase.from("profiles").select("timezone").eq("user_id", user.id).maybeSingle(),
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

  // Free windows can only be computed server-side (computeFreeWindows is
  // marked server-only), so this runs once here for the founder's real
  // "today" and is handed to the client as plain data - see
  // CalendarPanel.tsx's `freeWindowsDate` prop for how it's only overlaid
  // when that exact day is on screen.
  const timezone = profileRow?.timezone || DEFAULT_PROFILE.timezone;
  const todaysCalendarEvents = await getCalendarEventsForDate(user.id, date, timezone);
  const freeWindows = computeFreeWindows(todaysCalendarEvents, date, timezone, 15);
  // Milestone 11A: the account picker on "Adicionar ao calendário" only
  // needs to appear once the founder has more than one connected account -
  // fetched once here and handed down rather than each DecisionEngineCard
  // fetching its own copy.
  const connections = await listConnections(user.id);

  return (
    <CalendarWorkspace
      date={date}
      initialCalendarDate={initialCalendarDate}
      hasCheckIn={Boolean(checkIn)}
      initialDecisions={decisions ?? []}
      initialFeedback={feedbackByDecisionId}
      freeWindowsDate={date}
      freeWindows={freeWindows}
      connections={connections}
    />
  );
}
