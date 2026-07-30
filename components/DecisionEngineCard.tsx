"use client";

import { useState } from "react";
import { CalendarPlus, Check, CheckCircle2, Pencil, ThumbsDown, ThumbsUp, XCircle } from "lucide-react";
import type { Database } from "@/lib/supabase/database.types";
import type { ConnectionSummary } from "@/lib/google/calendar";
import { DOMAIN_LABEL } from "@/lib/decision-engine/labels";
import { DOMAIN_BADGE_CLASS, DOMAIN_ICON } from "@/lib/decision-engine/domain-style";

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
  connections = [],
}: {
  decision: DecisionRow;
  onUpdate: (id: string, updated: DecisionRow) => void;
  initialFeedback?: boolean | null;
  /** The founder's connected Google accounts (Milestone 11A). With zero or
   * one, "Adicionar ao calendário" behaves exactly as before (single
   * click, no picker). With two or more, clicking it opens a small picker
   * instead of writing straight to the primary account, since the founder
   * asked to choose per event which connected account gets the new
   * calendar entry. */
  connections?: ConnectionSummary[];
}) {
  const [showSkip, setShowSkip] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [showAccountPicker, setShowAccountPicker] = useState(false);
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

  async function addToCalendar(connectionId?: string) {
    setBusy(true);
    setCalendarError(null);
    try {
      const response = await fetch("/api/calendar/create-intervention", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decisionId: decision.id, connectionId }),
      });
      if (response.ok) {
        const { calendarEventId } = await response.json();
        onUpdate(decision.id, { ...decision, calendar_event_id: calendarEventId });
        setShowAccountPicker(false);
      } else if (response.status === 409) {
        setCalendarError("Liga o Google Calendar em Definições primeiro.");
      } else {
        setCalendarError("Não foi possível adicionar ao calendário.");
      }
    } finally {
      setBusy(false);
    }
  }

  function handleAddToCalendarClick() {
    if (connections.length > 1) {
      setShowAccountPicker(true);
      return;
    }
    addToCalendar();
  }

  const start = formatTime(decision.recommended_start);
  const end = formatTime(decision.recommended_end);
  const isPending = decision.status === "proposed" || decision.status === "accepted" || decision.status === "edited";
  const Icon = DOMAIN_ICON[decision.domain];

  return (
    <div className="surface-card surface-card-hover p-4 md:p-5">
      <div className="flex items-start gap-3">
        <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${DOMAIN_BADGE_CLASS[decision.domain]}`}>
          <Icon size={17} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
            <span className="text-xs font-medium uppercase tracking-wide text-neutral-500">
              {DOMAIN_LABEL[decision.domain]}
              {start && ` · ${start}${end ? `–${end}` : ""}`}
            </span>
            <span className="text-xs font-medium text-neutral-500">+{IMPACT_XP[decision.impact]} XP</span>
          </div>
          <p className="mt-0.5 font-medium leading-snug text-neutral-50">{decision.title}</p>
          <p className="mt-1 text-sm text-neutral-400">{decision.reason}</p>
          <p className="mt-2 text-sm text-neutral-200">{decision.recommended_action}</p>
        </div>
      </div>

      {isPending && !showSkip && !showEdit && !showAccountPicker && (
        <div className="mt-4 flex flex-wrap gap-2 pl-12">
          {decision.status === "proposed" && (
            <button disabled={busy} className="btn-secondary" onClick={() => patch({ status: "accepted" })}>
              Aceitar
            </button>
          )}
          <button disabled={busy} className="btn-primary" onClick={() => patch({ status: "completed" })}>
            <Check size={15} />
            Feito
          </button>
          <button disabled={busy} className="btn-ghost" onClick={() => setShowEdit(true)}>
            <Pencil size={14} />
            Editar
          </button>
          <button disabled={busy} className="btn-ghost" onClick={() => setShowSkip(true)}>
            Não deu
          </button>
          {start &&
            (decision.status === "accepted" || decision.status === "edited") &&
            !decision.calendar_event_id && (
              <button disabled={busy} className="btn-ghost" onClick={handleAddToCalendarClick}>
                <CalendarPlus size={14} />
                Adicionar ao calendário
              </button>
            )}
        </div>
      )}

      {showAccountPicker && (
        <div className="mt-4 space-y-2 pl-12">
          <p className="text-sm text-neutral-400">A que conta adicionar este evento?</p>
          <div className="flex flex-wrap gap-2">
            {connections.map((connection) => (
              <button
                key={connection.id}
                disabled={busy}
                className="btn-secondary"
                onClick={() => addToCalendar(connection.id)}
              >
                {connection.label || connection.googleAccountEmail || "Conta Google"}
                {connection.isPrimary && " (principal)"}
              </button>
            ))}
          </div>
          <button className="btn-ghost" onClick={() => setShowAccountPicker(false)}>
            Cancelar
          </button>
        </div>
      )}

      {decision.calendar_event_id && (
        <p className="mt-2 pl-12 text-xs text-neutral-500">No teu Google Calendar.</p>
      )}
      {calendarError && <p className="mt-2 pl-12 text-xs text-red-400">{calendarError}</p>}

      {!isPending && (
        <div className="mt-4 pl-12">
          <p className="flex items-center gap-1.5 text-sm text-neutral-400">
            {decision.status === "completed" ? (
              <>
                <CheckCircle2 size={15} className="text-emerald-500" />
                Concluído
              </>
            ) : (
              <>
                <XCircle size={15} className="text-neutral-500" />
                Não feito{decision.skipped_reason ? `: ${decision.skipped_reason}` : ""}
              </>
            )}
          </p>
          <div className="mt-2 flex items-center gap-2">
            <span className="text-xs text-neutral-500">Foi útil?</span>
            <button
              disabled={feedbackBusy}
              aria-pressed={feedback === true}
              className={`chip ${feedback === true ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-300" : "chip-inactive"}`}
              onClick={() => sendFeedback(true)}
            >
              <ThumbsUp size={12} />
              Útil
            </button>
            <button
              disabled={feedbackBusy}
              aria-pressed={feedback === false}
              className={`chip ${feedback === false ? "border-red-500/40 bg-red-500/15 text-red-300" : "chip-inactive"}`}
              onClick={() => sendFeedback(false)}
            >
              <ThumbsDown size={12} />
              Não útil
            </button>
          </div>
        </div>
      )}

      {showEdit && (
        <div className="mt-4 space-y-2 pl-12">
          <textarea
            className="field-input"
            rows={2}
            value={editedAction}
            onChange={(event) => setEditedAction(event.target.value)}
          />
          <div className="flex gap-2">
            <button
              disabled={busy}
              className="btn-primary"
              onClick={async () => {
                await patch({ status: "edited", recommendedAction: editedAction });
                setShowEdit(false);
              }}
            >
              Guardar
            </button>
            <button className="btn-ghost" onClick={() => setShowEdit(false)}>
              Cancelar
            </button>
          </div>
        </div>
      )}

      {showSkip && (
        <div className="mt-4 space-y-2 pl-12">
          <input
            className="field-input"
            placeholder="O que bloqueou? (sono, reuniões, comida, família...)"
            value={skipReason}
            onChange={(event) => setSkipReason(event.target.value)}
          />
          <button
            disabled={busy}
            className="btn-secondary"
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
