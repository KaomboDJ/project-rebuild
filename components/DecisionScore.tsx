import { computeDecisionScore, maxPossibleScore } from "@/lib/decisions/score";
import type { DecisionInstance } from "@/lib/decisions/types";

export function DecisionScoreView({ instances }: { instances: DecisionInstance[] }) {
  const score = computeDecisionScore(instances);
  const max = maxPossibleScore(instances);

  return (
    <div className="rounded-lg border border-neutral-800 p-4">
      <p className="text-sm text-neutral-400">Decision Score de hoje</p>
      <p className="text-3xl font-semibold">
        {score} <span className="text-base text-neutral-500">/ {max}</span>
      </p>
    </div>
  );
}
