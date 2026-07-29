"use client";

import { useState } from "react";
import type { Database } from "@/lib/supabase/database.types";

export type DecisionRow = Database["public"]["Tables"]["decisions"]["Row"];

const DOMAIN_LABEL: Record<DecisionRow["domain"], string> = {
  training: "Treino",
  nutrition: "Nutrição",
  sleep: "Sono",
  recovery: "Recuperação",
  planning: "Planeamento",
};

const IMPACT_XP: Record<DecisionRow["impact"], number> = { high: 15, medium: 10, low: 5 };

function formatTime(iso: string | null): string | null {
  if (!iso) return null;
  return iso.slice(11, 16);
}

export function DecisionEngineCard({
  decision,
  onUpdate,
}: {
  decision: DecisionRow;
  onUpdate: (id: string, updated: DecisionRow) => void;
}) {
  const [showSkip, setShowSkip] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [skipReason, setSkipReason] = useState("");
  const [editedAction, setEditedAction] = useState(decision.recommended_action);
  const [busy, setBusy] = useState(false);

  async function patch(body: Record<string, unknown>) {
    setBusy(true);
    try {
      const response = await fetch(`/api/decisions/${decision.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (response.ok) {
        const { decision: updated } = await response.json();
        onUpdate(decision.id, updated);
      }
    } finally {
      setBusy(false);
    }
  }

  const start = formatTime(decision.recommended_start);
  const end = formatTime(decision.recommended_end);
  const isPending = decision.status === "proposed" || decision.status === "accepted" || decision.status === "edited";

  return (
    <div className="rounded-lg border border-neutral-800 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-neutral-500">
            {DOMAIN_LABEL[decision.domain]}
            {start && ` · ${start}${end ? `–${end}` : ""}`}
          </p>
          <p className="font-medium">{decision.title}</p>
          <p className="text-sm text-neutral-400">{decision.reason}</p>
          <p className="mt-1 text-sm">{decision.recommended_action}</p>
        </div>
        <span className="shrink-0 text-sm text-neutral-400">+{IMPACT_XP[decision.impact]}</span>
      </div>

      {isPending && !showSkip && !showEdit && (
        <div className="mt-3 flex flex-wrap gap-2">
          {decision.status === "proposed" && (
            <button
              disabled={busy}
              className="rounded-md border border-neutral-700 px-3 py-1.5 text-sm hover:bg-neutral-800 disabled:opacity-50"
              onClick={() => patch({ status: "accepted" })}
            >
              Aceitar
            </button>
          )}
          <button
            disabled={busy}
            className="rounded-md bg-emerald-600 px-3 py-1.5 text-sm text-white hover:bg-emerald-500 disabled:opacity-50"
            onClick={() => patch({ status: "completed" })}
          >
            Feito
          </button>
          <button
            disabled={busy}
            className="rounded-md border border-neutral-700 px-3 py-1.5 text-sm hover:bg-neutral-800 disabled:opacity-50"
            onClick={() => setShowEdit(true)}
          >
            Editar
          </button>
          <button
            disabled={busy}
            className="rounded-md border border-neutral-700 px-3 py-1.5 text-sm hover:bg-neutral-800 disabled:opacity-50"
            onClick={() => setShowSkip(true)}
          >
            Não deu
          </button>
        </div>
      )}

      {!isPending && (
        <p className="mt-3 text-sm text-neutral-400">
          {decision.status === "completed"
            ? "Concluído"
            : `Não feito${decision.skipped_reason ? `: ${decision.skipped_reason}` : ""}`}
        </p>
      )}

      {showEdit && (
        <div className="mt-3 space-y-2">
          <textarea
            className="w-full rounded-md border border-neutral-700 bg-neutral-900 px-2 py-1 text-sm"
            rows={2}
            value={editedAction}
            onChange={(event) => setEditedAction(event.target.value)}
          />
          <div className="flex gap-2">
            <button
              disabled={busy}
              className="rounded-md bg-emerald-600 px-3 py-1.5 text-sm text-white hover:bg-emerald-500 disabled:opacity-50"
              onClick={async () => {
                await patch({ status: "edited", recommendedAction: editedAction });
                setShowEdit(false);
              }}
            >
              Guardar
            </button>
            <button
              className="rounded-md border border-neutral-700 px-3 py-1.5 text-sm hover:bg-neutral-800"
              onClick={() => setShowEdit(false)}
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {showSkip && (
        <div className="mt-3 space-y-2">
          <input
            className="w-full rounded-md border border-neutral-700 bg-neutral-900 px-2 py-1 text-sm"
            placeholder="O que bloqueou? (sono, reuniões, comida, família...)"
            value={skipReason}
            onChange={(event) => setSkipReason(event.target.value)}
          />
          <button
            disabled={busy}
            className="rounded-md border border-neutral-700 px-3 py-1.5 text-sm hover:bg-neutral-800 disabled:opacity-50"
            onClick={async () => {
              await patch({ status: "skipped", skippedReason: skipReason || undefined });
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
