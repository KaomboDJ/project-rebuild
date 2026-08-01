"use client";

import Link from "next/link";
import { CalendarClock, CheckCircle2, ClipboardList, TriangleAlert } from "lucide-react";

export type PlanBannerState = "not_planned" | "proposed_awaiting_confirmation" | "confirmed" | "confirmed_with_conflict";

export function PlanStatusBanner({
  state,
  planConfirmedAt,
  decisionCount,
  scheduledCount,
}: {
  state: PlanBannerState;
  planConfirmedAt?: string | null;
  decisionCount?: number;
  scheduledCount?: number;
}) {
  if (state === "not_planned") {
    return (
      <div className="surface-card flex items-center justify-between gap-3 p-3">
        <div className="flex items-center gap-2 text-sm text-neutral-300"><ClipboardList size={16} /> O teu dia ainda não foi planeado.</div>
        <Link href="/home" className="btn-secondary shrink-0 px-3 py-1.5 text-xs">Planear no Início</Link>
      </div>
    );
  }
  if (state === "proposed_awaiting_confirmation") {
    return (
      <div className="surface-card flex items-center justify-between gap-3 p-3">
        <div className="flex items-center gap-2 text-sm text-neutral-300"><CalendarClock size={16} className="text-amber-400" /> O plano de hoje está pronto para revisão.</div>
        <Link href="/home" className="btn-primary shrink-0 px-3 py-1.5 text-xs">Rever e confirmar</Link>
      </div>
    );
  }
  if (state === "confirmed_with_conflict") {
    return (
      <div className="surface-card flex items-center justify-between gap-3 border-amber-600/40 p-3 text-amber-200">
        <div className="flex items-center gap-2 text-sm"><TriangleAlert size={16} /> O calendário mudou e uma decisão precisa de atenção.</div>
        <Link href="/home" className="btn-secondary shrink-0 px-3 py-1.5 text-xs">Rever o plano</Link>
      </div>
    );
  }
  return (
    <div className="surface-card flex items-center justify-between gap-3 p-3">
      <div className="flex items-center gap-2 text-sm text-neutral-300">
        <CheckCircle2 size={16} className="text-emerald-500" />
        {planConfirmedAt ? "Plano confirmado" : "Plano em dia"}
        {typeof decisionCount === "number" && <span className="text-neutral-400"> · {decisionCount} decisões{typeof scheduledCount === "number" ? ` · ${scheduledCount} no calendário` : ""}</span>}
      </div>
      <Link href="/home" className="btn-ghost shrink-0 px-3 py-1.5 text-xs">Ver plano completo</Link>
    </div>
  );
}
