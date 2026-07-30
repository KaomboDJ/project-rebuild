"use client";

import { useState } from "react";
import type { Database } from "@/lib/supabase/database.types";
import { DOMAIN_LABEL } from "@/lib/decision-engine/labels";

export type DecisionRow = Database["public"]["Tables"]["decisions"]["Row"];

const IMPACT_XP: Record<DecisionRow["impact"], number> = { high: 15, medium: 10, low: 5 };

function formatTime(iso: string | null): string | null {
  if (!iso) return null;
  return iso.slice(11, 16);
}

export function DecisionEngineCard({
  decision,
  onUpdate,
  initialFeedback = null,
}: {
  decision: DecisionRow;
  onUpdate: (id: string, updated: DecisionRow) => void;
  initialFeedback?: boolean | null;
}) {
  const [showSkip, setShowSkip] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [skipReason, setSkipReason] = useState("");
  const [editedAction, setEditedAction] = useState(decision.recommended_action);
  const [busy, setBusy] = useState(false);
  const [calendarError, setCalendarError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<boolean | null>(initialFeedback);
  const [feedbackBusy, setFeedbackBusy] = useState(false);

  async function sendFeedback(useful: boolean) {
    setFeedbackBusy(true);
    try {
      const response = await fetch(`/api/decisions/${decision.id}/feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ useful }),
      });
      if (response.ok) setFeedback(useful);
    } finally {
      setFeedbackBusy(false);
    }
  }

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

  async function addToCalendar() {
    setBusy(true);
    setCalendarError(null);
    try {
      const response = await fetch("/api/calendar/create-intervention", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decisionId: decision.id }),
      });
      if (response.ok) {
        const { calendarEventId } = await response.json();
        onUpdate(decision.id, { ...decision, calendar_event_id: calendarEventId });
      } else if (response.status === 409) {
        setCalendarError("Liga o Google Calendar em Definições primeiro.");
      } else {
        setCalendarError("Não foi possível adicionar ao calendário.");
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
          {start &&
            (decision.status === "accepted" || decision.status === "edited") &&
            !decision.calendar_event_id && (
              <button
                disabled={busy}
                className="rounded-md border border-neutral-700 px-3 py-1.5 text-sm hover:bg-neutral-800 disabled:opacity-50"
                onClick={addToCalendar}
              >
                Adicionar ao calendário
              </button>
            )}
        </div>
      )}
      {decision.calendar_event_id && (
        <p className="mt-2 text-xs text-neutral-500">No teu Google Calendar.</p>
      )}
      {calendarError && <p className="mt-2 text-xs text-red-400">{calendarError}</p>}

      {!isPending && (
        <>
          <p className="mt-3 text-sm text-neutral-400">
            {decision.status === "completed"
              ? "Concluído"
              : `Não feito${decision.skipped_reason ? `: ${decision.skipped_reason}` : ""}`}
          </p>
          <div className="mt-2 flex items-center gap-2">
            <span className="text-xs text-neutral-500">Esta decisão foi útil?</span>
            <button
              disabled={feedbackBusy}
              aria-pressed={feedback === true}
              className={`rounded-md border px-2.5 py-1 text-xs disabled:opacity-50 ${
                feedback === true
                  ? "border-emerald-600 bg-emerald-600/20 text-emerald-400"
                  : "border-neutral-700 text-neutral-300 hover:bg-neutral-800"
              }`}
              onClick={() => sendFeedback(true)}
            >
              Útil
            </button>
            <button
              disabled={feedbackBusy}
              aria-pressed={feedback === false}
              className={`rounded-md border px-2.5 py-1 text-xs disabled:opacity-50 ${
                feedback === false
                  ? "border-red-600 bg-red-600/20 text-red-400"
                  : "border-neutral-700 text-neutral-300 hover:bg-neutral-800"
              }`}
              onClick={() => sendFeedback(false)}
            >
              Não útil
            </button>
          </div>
        </>
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
