"use client";

import { Check, Loader2, X } from "lucide-react";
import type { ToolCall } from "@/lib/coach/types";

/**
 * Renders one proposed pantry/shopping action (Part 3) with explicit
 * Confirmar/Recusar controls. This is the only UI surface that can trigger
 * a mutation the Coach suggested - nothing here executes anything itself,
 * it just calls the onConfirm/onDecline callback, which POSTs to
 * /api/coach/tools/confirm.
 */
export function ToolCallCard({
  toolCall,
  onConfirm,
  onDecline,
}: {
  toolCall: ToolCall;
  onConfirm: () => void;
  onDecline: () => void;
}) {
  if (toolCall.status === "executed") {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-300">
        <Check size={13} />
        {toolCall.summary} — feito.
      </div>
    );
  }

  if (toolCall.status === "declined") {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2 text-xs text-neutral-400">
        <X size={13} />
        {toolCall.summary} — recusado.
      </div>
    );
  }

  if (toolCall.status === "failed") {
    return (
      <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-300">
        Falhou: {toolCall.summary}. {toolCall.error}
      </div>
    );
  }

  if (toolCall.status === "confirmed") {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2 text-xs text-neutral-400">
        <Loader2 size={13} className="animate-spin" />
        {toolCall.summary}...
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-amber-500/25 bg-amber-500/[0.06] px-3 py-2.5">
      <p className="text-xs font-medium text-amber-200">{toolCall.summary}</p>
      <div className="mt-2 flex gap-2">
        <button onClick={onConfirm} className="btn-primary px-3 py-1.5 text-xs">
          Confirmar
        </button>
        <button onClick={onDecline} className="btn-secondary px-3 py-1.5 text-xs">
          Recusar
        </button>
      </div>
    </div>
  );
}
