"use client";

// Slide-over detail panel opened by CalendarPanel's eventClick - covers the
// spec's "event detail drawer on click" acceptance criterion. Google events
// are read-only info; Rebuild decision events reuse the same accept/
// complete/skip actions as DecisionEngineCard (PATCHing /api/decisions/:id)
// so the two surfaces (calendar + right-panel list) never fall out of sync.

import { useState } from "react";
import { Check, Pencil, X } from "lucide-react";
import type { DecisionRow } from "@/components/DecisionEngineCard";
import { DOMAIN_BADGE_CLASS, DOMAIN_ICON } from "@/lib/decision-engine/domain-style";
import { DOMAIN_LABEL } from "@/lib/decision-engine/labels";
import type { CalendarClickPayload } from "@/components/CalendarPanel";

const TIME_FMT = new Intl.DateTimeFormat("pt-PT", { hour: "2-digit", minute: "2-digit" });

function formatRange(start: string, end: string, allDay: boolean): string {
  if (allDay) return "Dia todo";
  return `${TIME_FMT.format(new Date(start))} – ${TIME_FMT.format(new Date(end))}`;
}

export function EventDetailDrawer({
  payload,
  onClose,
  onDecisionUpdate,
}: {
  payload: CalendarClickPayload;
  onClose: () => void;
  onDecisionUpdate: (id: string, updated: DecisionRow) => void;
}) {
  const [busy, setBusy] = useState(false);

  async function patch(decision: DecisionRow, body: Record<string, unknown>) {
    setBusy(true);
    try {
      const response = await fetch(`/api/decisions/${decision.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (response.ok) {
        const { decision: updated } = await response.json();
        onDecisionUpdate(decision.id, updated);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-30 flex justify-end bg-black/40" onClick={onClose}>
      <div
        className="surface-card m-3 flex w-full max-w-sm flex-col overflow-hidden md:m-4"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-3">
          <span className="text-sm font-medium text-neutral-100">
            {payload.kind === "google" ? "Evento" : "Decisão Rebuild"}
          </span>
          <button
            aria-label="Fechar"
            onClick={onClose}
            className="rounded-lg p-1 text-neutral-500 transition hover:bg-white/[0.06] hover:text-neutral-200"
          >
            <X size={16} />
          </button>
        </div>

        {payload.kind === "google" ? (
          <div className="space-y-2 p-4">
            <p className="font-medium text-neutral-50">{payload.event.title}</p>
            <p className="text-sm text-neutral-400">
              {formatRange(payload.event.start, payload.event.end, payload.event.isAllDay)}
            </p>
          </div>
        ) : (
          <DecisionDetail decision={payload.decision} busy={busy} onPatch={patch} />
        )}
      </div>
    </div>
  );
}

function DecisionDetail({
  decision,
  busy,
  onPatch,
}: {
  decision: DecisionRow;
  busy: boolean;
  onPatch: (decision: DecisionRow, body: Record<string, unknown>) => Promise<void>;
}) {
  const Icon = DOMAIN_ICON[decision.domain];
  const isPending = decision.status === "proposed" || decision.status === "accepted" || decision.status === "edited";

  return (
    <div className="space-y-3 p-4">
      <div className="flex items-start gap-3">
        <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${DOMAIN_BADGE_CLASS[decision.domain]}`}>
          <Icon size={17} />
        </span>
        <div className="min-w-0">
          <span className="text-xs font-medium uppercase tracking-wide text-neutral-500">
            {DOMAIN_LABEL[decision.domain]}
          </span>
          <p className="font-medium leading-snug text-neutral-50">{decision.title}</p>
        </div>
      </div>
      <p className="text-sm text-neutral-400">{decision.reason}</p>
      <p className="text-sm text-neutral-200">{decision.recommended_action}</p>

      {isPending && (
        <div className="flex flex-wrap gap-2 pt-1">
          {decision.status === "proposed" && (
            <button disabled={busy} className="btn-secondary" onClick={() => onPatch(decision, { status: "accepted" })}>
              Aceitar
            </button>
          )}
          <button disabled={busy} className="btn-primary" onClick={() => onPatch(decision, { status: "completed" })}>
            <Check size={15} />
            Feito
          </button>
          <button
            disabled={busy}
            className="btn-ghost"
            onClick={() => onPatch(decision, { status: "skipped" })}
          >
            Não deu
          </button>
        </div>
      )}
      {!isPending && (
        <p className="flex items-center gap-1.5 pt-1 text-sm text-neutral-400">
          <Pencil size={13} />
          Estado: {decision.status === "completed" ? "Concluído" : "Não feito"}
        </p>
      )}
    </div>
  );
}
