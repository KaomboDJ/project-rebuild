import { CheckCircle2, Circle, ThumbsDown, ThumbsUp, XCircle } from "lucide-react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getFounderNow } from "@/lib/date/founder-now";
import { instantToLocalWallClockIso } from "@/lib/date/timezone";
import { DOMAIN_LABEL, STATUS_LABEL } from "@/lib/decision-engine/labels";
import { DOMAIN_BADGE_CLASS, DOMAIN_ICON } from "@/lib/decision-engine/domain-style";
import type { Database } from "@/lib/supabase/database.types";

type DecisionRow = Database["public"]["Tables"]["decisions"]["Row"];

// How many past days of history to load per visit. A "Simple list" per
// docs/05_MVP_SPEC.md — no pagination yet, just a sane cap.
const MAX_DECISIONS = 90;

const STATUS_ICON: Record<DecisionRow["status"], typeof CheckCircle2> = {
  proposed: Circle,
  accepted: Circle,
  edited: Circle,
  completed: CheckCircle2,
  skipped: XCircle,
};

function formatTime(iso: string | null, timezone: string): string | null {
  if (!iso) return null;
  return instantToLocalWallClockIso(new Date(iso), timezone).slice(11, 16);
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

function EmptyState({ message }: { message: string }) {
  return (
    <main className="mx-auto max-w-3xl space-y-4 px-4 py-8">
      <div>
        <p className="text-sm uppercase tracking-wide text-neutral-400">Decisões</p>
        <h1 className="text-2xl font-semibold tracking-tight">Histórico</h1>
      </div>
      <div className="surface-card p-5 text-sm text-neutral-400">{message}</div>
    </main>
  );
}

export default async function HistoryPage() {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return <EmptyState message="Configuração em falta." />;

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return <EmptyState message="Sessão expirada." />;

  const { date: today, timezone } = await getFounderNow(supabase, user.id);

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
        .select("decision_id, feedback, useful")
        .eq("user_id", user.id)
        .in("decision_id", decisionIds)
    : { data: [] };

  const feedbackByDecisionId = new Map(
    (feedbackRows ?? [])
      .filter((row) => row.feedback)
      .map((row) => [row.decision_id, row.feedback as string])
  );
  const usefulByDecisionId = new Map(
    (feedbackRows ?? [])
      .filter((row) => row.useful !== null)
      .map((row) => [row.decision_id, row.useful as boolean])
  );

  const groups = groupByDate(decisions ?? []);

  if (groups.length === 0) {
    return (
      <EmptyState message="Ainda não há decisões de dias anteriores. Volta aqui depois de completares o teu primeiro dia em /today." />
    );
  }

  return (
    <main className="mx-auto max-w-3xl space-y-8 px-4 py-8">
      <div>
        <p className="text-sm uppercase tracking-wide text-neutral-400">Decisões</p>
        <h1 className="text-2xl font-semibold tracking-tight">Histórico</h1>
      </div>

      <div className="space-y-8">
        {groups.map(([date, dayDecisions]) => (
          <section key={date} className="relative pl-6">
            <div className="absolute bottom-0 left-[7px] top-2 w-px bg-white/[0.06]" />
            <span className="absolute left-0 top-1 h-3.5 w-3.5 rounded-full border-2 border-app bg-emerald-500" />
            <h2 className="mb-3 text-sm font-medium capitalize text-neutral-300">
              {formatDateHeading(date)}
            </h2>
            <div className="space-y-2">
              {dayDecisions.map((decision) => {
                const start = formatTime(decision.recommended_start, timezone);
                const end = formatTime(decision.recommended_end, timezone);
                const feedback = feedbackByDecisionId.get(decision.id);
                const useful = usefulByDecisionId.get(decision.id);
                const DomainIcon = DOMAIN_ICON[decision.domain];
                const StatusIcon = STATUS_ICON[decision.status];

                return (
                  <div key={decision.id} className="surface-card p-4">
                    <div className="flex items-start gap-3">
                      <span
                        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${DOMAIN_BADGE_CLASS[decision.domain]}`}
                      >
                        <DomainIcon size={15} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-3">
                          <p className="text-xs uppercase tracking-wide text-neutral-400">
                            {DOMAIN_LABEL[decision.domain]}
                            {start && ` · ${start}${end ? `–${end}` : ""}`}
                          </p>
                          <span
                            className={`flex shrink-0 items-center gap-1 text-xs font-medium ${
                              decision.status === "completed"
                                ? "text-emerald-400"
                                : decision.status === "skipped"
                                  ? "text-neutral-400"
                                  : "text-neutral-400"
                            }`}
                          >
                            <StatusIcon size={13} />
                            {STATUS_LABEL[decision.status]}
                          </span>
                        </div>
                        <p className="font-medium text-neutral-100">{decision.title}</p>
                        <p className="text-sm text-neutral-400">{decision.reason}</p>
                        {decision.status === "skipped" && decision.skipped_reason && (
                          <p className="mt-1 text-sm text-neutral-400">Motivo: {decision.skipped_reason}</p>
                        )}
                        {useful !== undefined && (
                          <p
                            className={`mt-2 flex items-center gap-1 text-xs ${useful ? "text-emerald-400" : "text-red-400"}`}
                          >
                            {useful ? <ThumbsUp size={12} /> : <ThumbsDown size={12} />}
                            {useful ? "Marcado como útil" : "Marcado como não útil"}
                          </p>
                        )}
                        {feedback && <p className="mt-1 text-sm text-neutral-400">Feedback: {feedback}</p>}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </main>
  );
}
