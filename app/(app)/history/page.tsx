import { createSupabaseServerClient } from "@/lib/supabase/server";
import { localDateKey } from "@/lib/date/local";
import { DOMAIN_LABEL, STATUS_LABEL } from "@/lib/decision-engine/labels";
import type { Database } from "@/lib/supabase/database.types";

type DecisionRow = Database["public"]["Tables"]["decisions"]["Row"];

// How many past days of history to load per visit. A "Simple list" per
// docs/05_MVP_SPEC.md — no pagination yet, just a sane cap.
const MAX_DECISIONS = 90;

function formatTime(iso: string | null): string | null {
  if (!iso) return null;
  return iso.slice(11, 16);
}

function formatDateHeading(dateKey: string): string {
  const [year, month, day] = dateKey.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return date.toLocaleDateString("pt-PT", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

function groupByDate(decisions: DecisionRow[]): [string, DecisionRow[]][] {
  const groups = new Map<string, DecisionRow[]>();
  for (const decision of decisions) {
    const existing = groups.get(decision.date);
    if (existing) {
      existing.push(decision);
    } else {
      groups.set(decision.date, [decision]);
    }
  }
  return Array.from(groups.entries());
}

export default async function HistoryPage() {
  const supabase = await createSupabaseServerClient();

  if (!supabase) {
    return (
      <main className="mx-auto max-w-3xl space-y-4 px-4 py-8">
        <p className="text-sm uppercase tracking-wide text-neutral-500">Decisões</p>
        <h1 className="text-2xl font-semibold">Histórico</h1>
        <div className="rounded-xl border border-neutral-800 p-5 text-sm text-neutral-400">
          Configuração em falta.
        </div>
      </main>
    );
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <main className="mx-auto max-w-3xl space-y-4 px-4 py-8">
        <p className="text-sm uppercase tracking-wide text-neutral-500">Decisões</p>
        <h1 className="text-2xl font-semibold">Histórico</h1>
        <div className="rounded-xl border border-neutral-800 p-5 text-sm text-neutral-400">
          Sessão expirada.
        </div>
      </main>
    );
  }

  const today = localDateKey();

  const { data: decisions } = await supabase
    .from("decisions")
    .select("*")
    .eq("user_id", user.id)
    .lt("date", today)
    .order("date", { ascending: false })
    .order("domain", { ascending: true })
    .limit(MAX_DECISIONS);

  const decisionIds = (decisions ?? []).map((decision) => decision.id);
  const { data: feedbackRows } = decisionIds.length
    ? await supabase
        .from("decision_feedback")
        .select("decision_id, feedback")
        .eq("user_id", user.id)
        .in("decision_id", decisionIds)
    : { data: [] };

  const feedbackByDecisionId = new Map(
    (feedbackRows ?? [])
      .filter((row) => row.feedback)
      .map((row) => [row.decision_id, row.feedback as string])
  );

  const groups = groupByDate(decisions ?? []);

  return (
    <main className="mx-auto max-w-3xl space-y-6 px-4 py-8">
      <div>
        <p className="text-sm uppercase tracking-wide text-neutral-500">Decisões</p>
        <h1 className="text-2xl font-semibold">Histórico</h1>
      </div>

      {groups.length === 0 ? (
        <div className="rounded-xl border border-neutral-800 p-5 text-sm text-neutral-400">
          Ainda não há decisões de dias anteriores. Volta aqui depois de completares o teu
          primeiro dia em /today.
        </div>
      ) : (
        <div className="space-y-6">
          {groups.map(([date, dayDecisions]) => (
            <section key={date} className="space-y-2">
              <h2 className="text-sm font-medium capitalize text-neutral-300">
                {formatDateHeading(date)}
              </h2>
              <div className="space-y-2">
                {dayDecisions.map((decision) => {
                  const start = formatTime(decision.recommended_start);
                  const end = formatTime(decision.recommended_end);
                  const feedback = feedbackByDecisionId.get(decision.id);
                  return (
                    <div
                      key={decision.id}
                      className="rounded-lg border border-neutral-800 p-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-xs uppercase tracking-wide text-neutral-500">
                            {DOMAIN_LABEL[decision.domain]}
                            {start && ` · ${start}${end ? `–${end}` : ""}`}
                          </p>
                          <p className="font-medium">{decision.title}</p>
                          <p className="text-sm text-neutral-400">{decision.reason}</p>
                        </div>
                        <span className="shrink-0 text-sm text-neutral-400">
                          {STATUS_LABEL[decision.status]}
                        </span>
                      </div>
                      {decision.status === "skipped" && decision.skipped_reason && (
                        <p className="mt-2 text-sm text-neutral-400">
                          Motivo: {decision.skipped_reason}
                        </p>
                      )}
                      {feedback && (
                        <p className="mt-2 text-sm text-neutral-400">Feedback: {feedback}</p>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}
    </main>
  );
}
