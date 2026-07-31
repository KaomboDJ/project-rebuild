"use client";

import { useState } from "react";
import type { DecisionInstance } from "@/lib/decisions/types";

export function DecisionCard({
  instance,
  onUpdate,
}: {
  instance: DecisionInstance;
  onUpdate: (id: string, status: DecisionInstance["status"], skipReason?: string) => void;
}) {
  const [showSkip, setShowSkip] = useState(false);
  const [reason, setReason] = useState("");

  return (
    <div className="rounded-lg border border-neutral-800 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-medium">{instance.title}</p>
          <p className="text-sm text-neutral-400">{instance.trigger}</p>
          {instance.fallback && (
            <p className="mt-1 text-xs text-neutral-400">Plano B: {instance.fallback}</p>
          )}
        </div>
        <span className="shrink-0 text-sm text-neutral-400">+{instance.scoreValue}</span>
      </div>

      {instance.status === "pending" && (
        <div className="mt-3 flex gap-2">
          <button
            className="rounded-md bg-emerald-700 px-3 py-1.5 text-sm text-white hover:bg-emerald-800"
            onClick={() => onUpdate(instance.id, "completed")}
          >
            Feito
          </button>
          <button
            className="rounded-md border border-neutral-700 px-3 py-1.5 text-sm hover:bg-neutral-800"
            onClick={() => setShowSkip(true)}
          >
            Não deu
          </button>
        </div>
      )}

      {instance.status !== "pending" && (
        <p className="mt-3 text-sm text-neutral-400">
          {instance.status === "completed"
            ? "Concluído"
            : `Não feito${instance.skipReason ? `: ${instance.skipReason}` : ""}`}
        </p>
      )}

      {showSkip && (
        <div className="mt-3 space-y-2">
          <input
            className="w-full rounded-md border border-neutral-700 bg-neutral-900 px-2 py-1 text-sm"
            placeholder="O que bloqueou? (sono, reuniões, comida, família...)"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
          />
          <button
            className="rounded-md border border-neutral-700 px-3 py-1.5 text-sm hover:bg-neutral-800"
            onClick={() => {
              onUpdate(instance.id, "skipped", reason || undefined);
              setShowSkip(false);
            }}
          >
            Confirmar
          </button>
        </div>
      )}
    </div>
  );
}
