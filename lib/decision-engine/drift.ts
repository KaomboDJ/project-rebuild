// Milestone 13 — Automation and continuous synchronization: calendar-drift
// detection. Pure and synchronous, same discipline as computeFreeWindows in
// context-builder.ts, so it's directly unit-testable without a database or
// a real Google Calendar connection.
//
// Deliberate simplification (documented, not silently dropped — see
// docs/14_AUTOMATION.md): this compares aggregate free-window shape rather
// than re-running each of today's three decisions against the new calendar
// state individually. A full per-decision "does this recommendation still
// fit" recomputation would require re-deriving requiresFreeWindow/
// minWindowMinutes from the persisted decisions table, which doesn't store
// those rule-internal fields. The aggregate heuristic below is coarser but
// safe: it only ever asks the founder to consider regenerating (never
// silently replaces anything), matching the product principle "recommend,
// then confirm".

import type { FreeWindow } from "./types";

export interface FreeWindowDriftResult {
  changed: boolean;
  previousTotalMinutes: number;
  currentTotalMinutes: number;
  previousWindowCount: number;
  currentWindowCount: number;
}

/**
 * True when today's free-window shape has drifted enough from what was
 * true at the last decision generation to be worth flagging — either the
 * number of distinct free windows changed (a meeting was added/cancelled)
 * or the total free minutes moved by more than `toleranceMinutes` (a
 * meeting was rescheduled/resized). A small tolerance avoids flagging
 * noise from sub-minute rounding or a single very short new event.
 */
export function detectFreeWindowDrift(
  previous: FreeWindow[],
  current: FreeWindow[],
  toleranceMinutes = 15
): FreeWindowDriftResult {
  const previousTotalMinutes = previous.reduce((sum, w) => sum + w.durationMinutes, 0);
  const currentTotalMinutes = current.reduce((sum, w) => sum + w.durationMinutes, 0);

  const changed =
    previous.length !== current.length || Math.abs(previousTotalMinutes - currentTotalMinutes) > toleranceMinutes;

  return {
    changed,
    previousTotalMinutes,
    currentTotalMinutes,
    previousWindowCount: previous.length,
    currentWindowCount: current.length,
  };
}

/** Short Portuguese summary line surfaced in daily_briefings.summary and
 * the /today stale banner (components/CalendarWorkspace.tsx). */
export function buildBriefingSummary(params: {
  eventCount: number;
  freeWindows: FreeWindow[];
  decisionsGenerated: boolean;
  drift?: FreeWindowDriftResult;
}): string {
  const { eventCount, freeWindows, decisionsGenerated, drift } = params;
  const totalFreeMinutes = freeWindows.reduce((sum, w) => sum + w.durationMinutes, 0);
  const hours = Math.floor(totalFreeMinutes / 60);
  const minutes = totalFreeMinutes % 60;
  const freeLabel = hours > 0 ? `${hours}h${minutes.toString().padStart(2, "0")}` : `${minutes}min`;

  const base = `Hoje: ${eventCount} evento(s) no calendário, ${freeLabel} livres em ${freeWindows.length} janela(s).`;
  const generated = decisionsGenerated ? " Decisões de hoje já preparadas." : " Ainda sem decisões geradas hoje.";
  const staleNote = drift?.changed
    ? " A agenda mudou desde a última vez — as decisões de hoje podem já não refletir a agenda atual."
    : "";

  return `${base}${generated}${staleNote}`;
}
