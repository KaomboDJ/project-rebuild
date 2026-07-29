// docs/06_DECISION_ENGINE.md#selectorts
//
// selectThree picks exactly three (or fewer, if the candidate pool genuinely
// doesn't have three) scored candidates, enforcing:
//   - no two selected decisions overlap in time or conflict with a calendar event
//   - the three don't all address the same domain, unless too few domains
//     have eligible candidates
//   - the three represent the highest-value opportunities, not just the
//     first three generated

import type { CalendarEvent, DailyContext, ScoredCandidate } from "./types";

function toMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + (m || 0);
}

function overlaps(aStart: number, aEnd: number, bStart: number, bEnd: number): boolean {
  return aStart < bEnd && bStart < aEnd;
}

function candidateWindow(candidate: ScoredCandidate): { start: number; end: number } | null {
  if (!candidate.recommendedStart || !candidate.recommendedEnd) return null;
  return {
    start: toMinutes(candidate.recommendedStart.slice(11, 16)),
    end: toMinutes(candidate.recommendedEnd.slice(11, 16)),
  };
}

function conflictsWithCalendar(candidate: ScoredCandidate, events: CalendarEvent[]): boolean {
  const window = candidateWindow(candidate);
  if (!window) return false;
  return events.some((event) => {
    if (event.isAllDay) return false;
    const eventStart = toMinutes(event.start.slice(11, 16));
    const eventEnd = toMinutes(event.end.slice(11, 16));
    return overlaps(window.start, window.end, eventStart, eventEnd);
  });
}

function conflictsWithSelected(candidate: ScoredCandidate, selected: ScoredCandidate[]): boolean {
  const window = candidateWindow(candidate);
  if (!window) return false;
  return selected.some((other) => {
    const otherWindow = candidateWindow(other);
    if (!otherWindow) return false;
    return overlaps(window.start, window.end, otherWindow.start, otherWindow.end);
  });
}

export function selectThree(scored: ScoredCandidate[], context: DailyContext): ScoredCandidate[] {
  const eligible = scored
    .filter((candidate) => !conflictsWithCalendar(candidate, context.calendarEvents))
    .sort((a, b) => b.score - a.score);

  const selected: ScoredCandidate[] = [];

  // Pass 1: prefer domain diversity — skip a candidate whose domain is
  // already represented among the selections so far.
  for (const candidate of eligible) {
    if (selected.length === 3) break;
    if (conflictsWithSelected(candidate, selected)) continue;
    if (selected.some((s) => s.domain === candidate.domain)) continue;
    selected.push(candidate);
  }

  // Pass 2: too few domains had eligible candidates — allow repeats to still
  // reach three, highest score first, still respecting time conflicts.
  if (selected.length < 3) {
    for (const candidate of eligible) {
      if (selected.length === 3) break;
      if (selected.includes(candidate)) continue;
      if (conflictsWithSelected(candidate, selected)) continue;
      selected.push(candidate);
    }
  }

  return selected;
}
