"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { DailyCheckInForm } from "@/components/DailyCheckInForm";
import { DecisionEngineCard, type DecisionRow } from "@/components/DecisionEngineCard";
import { DecisionEngineScoreView } from "@/components/DecisionEngineScore";

export function DecisionDay({
  date,
  hasCheckIn,
  initialDecisions,
  initialFeedback = {},
}: {
  date: string;
  hasCheckIn: boolean;
  initialDecisions: DecisionRow[];
  initialFeedback?: Record<string, boolean>;
}) {
  const [checkInDone, setCheckInDone] = useState(hasCheckIn);
  const [decisions, setDecisions] = useState<DecisionRow[]>(initialDecisions);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function regenerate() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/decisions/generate", { method: "POST" });
      if (!response.ok) {
        setError("Não foi possível gerar as decisões de hoje.");
        return;
      }
      const { decisions: fresh } = await response.json();
      setDecisions(fresh);
    } finally {
      setLoading(false);
    }
  }

  function handleUpdate(id: string, updated: DecisionRow) {
    setDecisions((current) => current.map((d) => (d.id === id ? updated : d)));
  }

  if (!checkInDone) {
    return (
      <DailyCheckInForm
        date={date}
        onSubmitted={async () => {
          setCheckInDone(true);
          await regenerate();
        }}
      />
    );
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-8 text-sm text-neutral-400">
        <Loader2 size={16} className="animate-spin" />
        A pensar nas tuas três decisões de hoje...
      </div>
    );
  }

  if (decisions.length === 0) {
    return (
      <div className="space-y-3">
        {error && <p className="text-sm text-red-400">{error}</p>}
        <button className="btn-primary w-full py-2.5" onClick={regenerate}>
          Gerar as decisões de hoje
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <DecisionEngineScoreView decisions={decisions} />
      <section className="space-y-3">
        {decisions.map((decision) => (
          <DecisionEngineCard
            key={decision.id}
            decision={decision}
            onUpdate={handleUpdate}
            initialFeedback={initialFeedback[decision.id] ?? null}
          />
        ))}
      </section>
      <button className="btn-secondary w-full py-2.5" onClick={regenerate}>
        Regenerar
      </button>
      {error && <p className="text-sm text-red-400">{error}</p>}
    </div>
  );
}
