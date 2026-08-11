"use client";

import { useState } from "react";
import { CalendarPlus, Check, CheckCircle2, ChevronDown, Clock, Pencil, ThumbsDown, ThumbsUp, XCircle } from "lucide-react";
import type { Database } from "@/lib/supabase/database.types";
import type { ConnectionSummary } from "@/lib/google/calendar";
import { DOMAIN_LABEL } from "@/lib/decision-engine/labels";
import { DOMAIN_BADGE_CLASS, DOMAIN_ICON } from "@/lib/decision-engine/domain-style";
import { instantToLocalWallClockIso } from "@/lib/date/timezone";

// UX Hardening release (docs/17_UX_AUDIT.md, section 4 - recommendation
// transparency / "Why this?"). Every string below is derived directly from
// columns already on the `decisions` row - nothing here is invented or
// re-asks the AI provider for an explanation; if a field is genuinely
// unavailable (no time window, no related pantry item) the panel says so
// plainly rather than guessing.
const SOURCE_LABEL: Record<DecisionRow["source"], string> = {
  rule: "uma regra fixa do motor de decisões",
  ai: "uma reformulação da IA sobre uma regra fixa",
  hybrid: "uma regra fixa, com pequenos ajustes da IA",
};

function confidenceLabel(confidence: number): string {
  if (confidence >= 0.75) return "alta";
  if (confidence >= 0.5) return "média";
  return "baixa (menos histórico para se basear)";
}

export type DecisionRow = Database["public"]["Tables"]["decisions"]["Row"];

interface SlotCandidate {
  start: string;
  end: string;
  durationMinutes: number;
  distanceFromPreferredMinutes: number;
}

const IMPACT_XP: Record<DecisionRow["impact"], number> = { high: 15, medium: 10, low: 5 };

function formatTime(iso: string | null, timezone: string): string | null {
  if (!iso) return null;
  return instantToLocalWallClockIso(new Date(iso), timezone).slice(11, 16);
}

export function DecisionEngineCard({
  decision,
  onUpdate,
  initialFeedback = null,
  connections = [],
  timezone = "UTC",
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
  timezone?: string;
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
  const [slotCandidates, setSlotCandidates] = useState<SlotCandidate[] | null>(null);
  const [slotError, setSlotError] = useState<string | null>(null);
  const writableConnections = connections.filter((connection) => connection.canWrite);

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
        setCalendarError(
          "Ativa ‘Permitir adicionar eventos’ na conta Google em Definições."
        );
      } else {
        setCalendarError("Não foi possível adicionar ao calendário.");
      }
    } finally {
      setBusy(false);
    }
  }

  function handleAddToCalendarClick() {
    if (writableConnections.length > 1) {
      setShowAccountPicker(true);
      return;
    }
    addToCalendar(writableConnections[0]?.id);
  }

  async function loadSlotCandidates() {
    setBusy(true);
    setSlotError(null);
    try {
      const response = await fetch(`/api/decisions/${decision.id}/find-slot`);
      if (response.ok) {
        const { candidates } = await response.json();
        setSlotCandidates(candidates);
        if (candidates.length === 0) setSlotError("Sem janelas livres disponíveis hoje.");
      } else {
        setSlotError("Não foi possível procurar horários.");
      }
    } finally {
      setBusy(false);
    }
  }

  async function confirmSlot(candidate: SlotCandidate) {
    setBusy(true);
    try {
      const response = await fetch(`/api/decisions/${decision.id}/reschedule`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ start: candidate.start, end: candidate.end }),
      });
      if (response.ok) {
        const { decision: updated } = await response.json();
        onUpdate(decision.id, updated);
        setSlotCandidates(null);
      } else if (response.status === 409) {
        setSlotError("Esse horário deixou de estar livre — procura novamente.");
        await loadSlotCandidates();
      } else {
        setSlotError("Não foi possível confirmar o novo horário.");
      }
    } finally {
      setBusy(false);
    }
  }

  const start = formatTime(decision.recommended_start, timezone);
  const end = formatTime(decision.recommended_end, timezone);
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
            <span className="text-xs font-medium uppercase tracking-wide text-neutral-400">
              {DOMAIN_LABEL[decision.domain]}
              {start && ` · ${start}${end ? `–${end}` : ""}`}
              {!start && decision.timing_type === "calendar_slot" && " · Ainda sem horário"}
              {!start && decision.timing_type === "trigger_based" && decision.trigger_label && ` · ${decision.trigger_label}`}
            </span>
            <span className="text-xs font-medium text-neutral-400">+{IMPACT_XP[decision.impact]} XP</span>
          </div>
          <p className="mt-0.5 font-medium leading-snug text-neutral-50">{decision.title}</p>
          <p className="mt-1 text-sm text-neutral-400">{decision.reason}</p>
          <p className="mt-2 text-sm text-neutral-200">{decision.recommended_action}</p>

          <details className="mt-2 text-xs text-neutral-400">
            <summary className="inline-flex cursor-pointer select-none items-center gap-1 text-neutral-400 hover:text-neutral-300">
              <ChevronDown size={12} />
              Porquê esta sugestão?
            </summary>
            <div className="mt-2 space-y-1 rounded-lg bg-white/[0.03] p-3 text-neutral-400">
              <p>
                Baseada em {SOURCE_LABEL[decision.source]}, para a área &quot;{DOMAIN_LABEL[decision.domain]}&quot;.
              </p>
              <p>Confiança do motor de decisões: {confidenceLabel(Number(decision.confidence))}.</p>
              <p>
                {start
                  ? `Encaixada na tua janela livre entre ${start}${end ? ` e ${end}` : ""}, com base no teu calendário de hoje.`
                  : "Sem uma janela de horário específica no teu calendário de hoje."}
              </p>
              {decision.related_pantry_item && (
                <p>Sugestão de refeição com base num item que já tens em casa: {decision.related_pantry_item}.</p>
              )}
              <p>
                Achas que o contexto está errado? Podes editar esta decisão acima, ou corrigir o que o motor
                de decisões sabe sobre ti em Definições → Memória.
              </p>
            </div>
          </details>
        </div>
      </div>

      {isPending && !showSkip && !showEdit && !showAccountPicker && (
        <div className="mt-4 flex flex-wrap gap-2 pl-12">
          {decision.status === "proposed" && (
            <button disabled={busy} className="btn-primary" onClick={() => patch({ status: "accepted" })}>
              Aceitar
            </button>
          )}
          <button
            disabled={busy}
            className={decision.status === "proposed" ? "btn-secondary" : "btn-primary"}
            onClick={() => patch({ status: "completed" })}
          >
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
          {decision.timing_type === "calendar_slot" && !start && (
            <button disabled={busy} className="btn-ghost" onClick={loadSlotCandidates}>
              <Clock size={14} /> Encontrar horário
            </button>
          )}
          {decision.timing_type === "calendar_slot" && start && (
            <button disabled={busy} className="btn-ghost" onClick={loadSlotCandidates}>
              <Clock size={14} /> Alterar horário
            </button>
          )}
        </div>
      )}

      {slotCandidates !== null && (
        <div className="mt-4 space-y-2 pl-12">
          <p className="text-sm text-neutral-400">Horários disponíveis:</p>
          {slotCandidates.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {slotCandidates.map((candidate, index) => (
                <button key={candidate.start} disabled={busy} className="btn-secondary" onClick={() => confirmSlot(candidate)}>
                  {candidate.start.slice(11, 16)}–{candidate.end.slice(11, 16)}{index === 0 && " (melhor opção)"}
                </button>
              ))}
            </div>
          ) : slotError ? <p className="text-xs text-red-400">{slotError}</p> : null}
          {slotError && slotCandidates.length > 0 && <p className="text-xs text-red-400">{slotError}</p>}
          <button className="btn-ghost" onClick={() => setSlotCandidates(null)}>Cancelar</button>
        </div>
      )}

      {showAccountPicker && (
        <div className="mt-4 space-y-2 pl-12">
          <p className="text-sm text-neutral-400">A que conta adicionar este evento?</p>
          <div className="flex flex-wrap gap-2">
            {writableConnections.map((connection) => (
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
        <p className="mt-2 pl-12 text-xs text-neutral-400">No teu Google Calendar.</p>
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
                <XCircle size={15} className="text-neutral-400" />
                Não feito{decision.skipped_reason ? `: ${decision.skipped_reason}` : ""}
              </>
            )}
          </p>
          <div className="mt-2 flex items-center gap-2">
            <span className="text-xs text-neutral-400">Foi útil?</span>
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
