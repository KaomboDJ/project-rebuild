import { computeDecisionScore } from "@/lib/decision-engine/scorer";
import type { DecisionRow } from "./DecisionEngineCard";

export function DecisionEngineScoreView({ decisions }: { decisions: DecisionRow[] }) {
  const xp = computeDecisionScore(decisions);
  const completed = decisions.filter((d) => d.status === "completed").length;

  return (
    <div className="flex items-center justify-between rounded-lg border border-neutral-800 p-4">
      <div>
        <p className="text-sm text-neutral-400">Decision XP hoje</p>
        <p className="text-2xl font-semibold">{xp}</p>
      </div>
      <p className="text-sm text-neutral-400">
        {completed}/{decisions.length || 3} concluídas
      </p>
    </div>
  );
}
