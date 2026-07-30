"use client";

import { useState } from "react";
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
    return <p className="text-sm text-neutral-400">A pensar nas tuas três decisões de hoje...</p>;
  }

  if (decisions.length === 0) {
    return (
      <div className="space-y-3">
        {error && <p className="text-sm text-red-400">{error}</p>}
        <button
          className="w-full rounded-md bg-emerald-600 py-2 font-medium text-white hover:bg-emerald-500"
          onClick={regenerate}
        >
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
      <button
        className="w-full rounded-md border border-neutral-700 py-2 text-sm hover:bg-neutral-800"
        onClick={regenerate}
      >
        Regenerar
      </button>
      {error && <p className="text-sm text-red-400">{error}</p>}
    </div>
  );
}
