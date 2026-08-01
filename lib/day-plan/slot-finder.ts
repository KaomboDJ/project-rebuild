import type { CalendarEvent, FreeWindow } from "@/lib/decision-engine/types";

export interface SlotCandidate {
  start: string;
  end: string;
  durationMinutes: number;
  distanceFromPreferredMinutes: number;
}

export interface FindCandidateSlotsParams {
  date: string;
  freeWindows: FreeWindow[];
  durationMinutes: number;
  preferredStartTime: string;
  now?: string;
  maxResults?: number;
  earliestStartTime?: string;
  latestEndTime?: string;
}

function toMinutes(hhmm: string): number {
  const [hours, minutes] = hhmm.split(":").map(Number);
  return hours * 60 + (minutes || 0);
}

function toHHMM(minutes: number): string {
  const clamped = ((minutes % 1440) + 1440) % 1440;
  return `${String(Math.floor(clamped / 60)).padStart(2, "0")}:${String(clamped % 60).padStart(2, "0")}`;
}

function wallClockOf(naiveIso: string): string {
  return naiveIso.slice(11, 16);
}

export function findCandidateSlots(params: FindCandidateSlotsParams): SlotCandidate[] {
  const {
    date,
    freeWindows,
    durationMinutes,
    preferredStartTime,
    now,
    maxResults = 3,
    earliestStartTime,
    latestEndTime,
  } = params;
  const preferredMinutes = toMinutes(preferredStartTime);
  const nowMinutes = now && now.slice(0, 10) === date ? toMinutes(wallClockOf(now)) : null;
  const earliestMinutes = earliestStartTime ? toMinutes(earliestStartTime) : null;
  const latestEndMinutes = latestEndTime ? toMinutes(latestEndTime) : null;
  const candidates: SlotCandidate[] = [];

  for (const window of freeWindows) {
    let usableStart = toMinutes(wallClockOf(window.start));
    let usableEnd = toMinutes(wallClockOf(window.end));
    if (nowMinutes !== null) usableStart = Math.max(usableStart, nowMinutes);
    if (earliestMinutes !== null) usableStart = Math.max(usableStart, earliestMinutes);
    if (latestEndMinutes !== null) usableEnd = Math.min(usableEnd, latestEndMinutes);
    if (usableEnd - usableStart < durationMinutes) continue;

    const latestPossibleStart = usableEnd - durationMinutes;
    const preferredClamped = Math.min(Math.max(preferredMinutes, usableStart), latestPossibleStart);
    for (const start of new Set([preferredClamped, usableStart])) {
      const end = start + durationMinutes;
      candidates.push({
        start: `${date}T${toHHMM(start)}:00`,
        end: `${date}T${toHHMM(end)}:00`,
        durationMinutes,
        distanceFromPreferredMinutes: Math.abs(start - preferredMinutes),
      });
    }
  }

  candidates.sort((a, b) => a.distanceFromPreferredMinutes - b.distanceFromPreferredMinutes);
  const seen = new Set<string>();
  return candidates.filter((candidate) => {
    if (seen.has(candidate.start)) return false;
    seen.add(candidate.start);
    return true;
  }).slice(0, maxResults);
}

export function overlapsFixedEvent(start: string, end: string, events: CalendarEvent[]): boolean {
  const startMinutes = toMinutes(wallClockOf(start));
  const endMinutes = toMinutes(wallClockOf(end));
  const date = start.slice(0, 10);
  return events.some((event) => {
    if (event.isAllDay) return false;
    if (event.start.slice(0, 10) !== date && event.end.slice(0, 10) !== date) return false;
    const eventStart = event.start.slice(0, 10) === date ? toMinutes(wallClockOf(event.start)) : 0;
    const eventEnd = event.end.slice(0, 10) === date ? toMinutes(wallClockOf(event.end)) : 1440;
    return startMinutes < eventEnd && eventStart < endMinutes;
  });
}
