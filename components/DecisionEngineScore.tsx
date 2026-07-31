import { Flame } from "lucide-react";
import { computeDecisionScore } from "@/lib/decision-engine/scorer";
import type { DecisionRow } from "./DecisionEngineCard";
import { HelpTip } from "@/components/ui/HelpTip";

export function DecisionEngineScoreView({ decisions }: { decisions: DecisionRow[] }) {
  const xp = computeDecisionScore(decisions);
  const completed = decisions.filter((d) => d.status === "completed").length;
  const total = decisions.length || 3;
  const pct = Math.min(100, Math.round((completed / total) * 100));

  return (
    <div className="surface-card p-4 md:p-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-400">
            <Flame size={18} />
          </span>
          <div>
            <p className="flex items-center gap-1 text-xs uppercase tracking-wide text-neutral-500">
              Decision XP hoje
              <HelpTip heading="Decision XP">
                Pontos por decisões concluídas hoje (mais para as de maior impacto), mais um pequeno bónus por
                aceitar ou editar em vez de ignorar. Não é uma meta a perseguir — só um resumo rápido de como o
                dia está a correr.
              </HelpTip>
            </p>
            <p className="text-2xl font-semibold tracking-tight">{xp}</p>
          </div>
        </div>
        <p className="text-sm font-medium text-neutral-400">
          {completed}/{total} concluídas
        </p>
      </div>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
        <div
          className="h-full rounded-full bg-emerald-500 transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
