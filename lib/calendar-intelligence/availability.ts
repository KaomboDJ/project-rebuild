// Deterministic availability/conflict engine for Unified Calendar
// Intelligence. Pure functions only, no fetch/Supabase/AI calls — per the
// founder's brief: "Prefer deterministic scheduling logic. AI may explain or
// rank valid alternatives, but must not invent free time that the
// deterministic availability engine says is occupied." Everything here is
// the thing an AI provider is not allowed to override.

import { zonedWallTimeToUtc } from "@/lib/date/timezone";
import type { CalendarSource, NormalizedCalendarEvent } from "./types";

export interface Interval {
  /** epoch ms, inclusive */
  start: number;
  /** epoch ms, exclusive */
  end: number;
}

/**
 * Filters normalized events down to the ones that should count as
 * "occupied" for scheduling purposes, respecting each source's
 * selectedForContext flag (founder's brief: "Do not assume every calendar
 * within a connected account should affect the Decision Engine") and each
 * event's own free/busy transparency.
 *
 * - "free" events never block (a transparent/"show as free" event, e.g. an
 *   all-day holiday marker — founder's brief: "must not mark every all-day
 *   event as a full-day blocker without considering transparency/free
 *   status").
 * - "tentative" and "out_of_office" both count as occupied. They are kept
 *   distinguishable in the NormalizedCalendarEvent itself for the UI/Coach
 *   to explain ("tentative meeting" vs "away"), but a deterministic
 *   scheduling engine that treated a tentative meeting as guaranteed-free
 *   would be exactly the kind of silent overreach the founder's brief
 *   prohibits ("must never silently reschedule").
 * - "busy" always blocks.
 */
export function eventsToBusyIntervals(
  events: NormalizedCalendarEvent[],
  sources: CalendarSource[]
): Interval[] {
  const contextSourceIds = new Set(
    sources.filter((s) => s.selectedForContext).map((s) => s.id)
  );

  return events
    .filter((event) => contextSourceIds.has(event.sourceId))
    .filter((event) => event.availability !== "free")
    .map((event) => ({
      start: new Date(event.start).getTime(),
      end: new Date(event.end).getTime(),
    }))
    .filter((interval) => Number.isFinite(interval.start) && Number.isFinite(interval.end) && interval.end > interval.start);
}

/** Merges overlapping and touching intervals into the minimal equivalent set, sorted ascending. */
export function mergeIntervals(intervals: Interval[]): Interval[] {
  if (intervals.length === 0) return [];

  const sorted = [...intervals].sort((a, b) => a.start - b.start);
  const merged: Interval[] = [{ ...sorted[0] }];

  for (const current of sorted.slice(1)) {
    const last = merged[merged.length - 1];
    if (current.start <= last.end) {
      last.end = Math.max(last.end, current.end);
    } else {
      merged.push({ ...current });
    }
  }

  return merged;
}

export interface FreeWindow {
  start: number;
  end: number;
  durationMinutes: number;
}

/**
 * Computes realistic free windows within [rangeStart, rangeEnd), given
 * already-merged busy intervals, a buffer applied on both sides of every
 * busy interval (founder's brief: "avoid recommending a workout that ends
 * exactly when another event begins"), and a minimum window length to
 * report (windows shorter than this are pure scheduling noise, e.g. a
 * 4-minute gap between back-to-back meetings).
 */
export function computeFreeWindows(
  busyIntervals: Interval[],
  rangeStart: number,
  rangeEnd: number,
  options: { bufferMinutes?: number; minWindowMinutes?: number } = {}
): FreeWindow[] {
  const bufferMs = (options.bufferMinutes ?? 0) * 60_000;
  const minWindowMs = (options.minWindowMinutes ?? 0) * 60_000;

  const merged = mergeIntervals(busyIntervals)
    .map((interval) => ({ start: interval.start - bufferMs, end: interval.end + bufferMs }))
    // Re-merge: two busy intervals that weren't touching before buffering
    // can become touching/overlapping once each grows by the buffer.
    .sort((a, b) => a.start - b.start);
  const bufferedMerged = mergeIntervals(merged);

  const windows: FreeWindow[] = [];
  let cursor = rangeStart;

  for (const busy of bufferedMerged) {
    const windowStart = cursor;
    const windowEnd = Math.min(busy.start, rangeEnd);
    if (windowEnd - windowStart >= minWindowMs && windowEnd > windowStart) {
      windows.push({ start: windowStart, end: windowEnd, durationMinutes: (windowEnd - windowStart) / 60_000 });
    }
    cursor = Math.max(cursor, busy.end);
    if (cursor >= rangeEnd) break;
  }

  if (cursor < rangeEnd) {
    const durationMinutes = (rangeEnd - cursor) / 60_000;
    if (durationMinutes * 60_000 >= minWindowMs) {
      windows.push({ start: cursor, end: rangeEnd, durationMinutes });
    }
  }

  return windows;
}

/** Working-hours + protected-family-time boundary for a single day, all as
 * epoch ms in the founder's timezone, ready to intersect with free windows. */
export function dayBoundaryToInterval(
  dateKey: string,
  startTime: string,
  endTime: string,
  timeZone: string
): Interval {
  return {
    start: zonedWallTimeToUtc(dateKey, `${startTime}:00`, timeZone).getTime(),
    end: zonedWallTimeToUtc(dateKey, `${endTime}:00`, timeZone).getTime(),
  };
}

/** Intersects a set of free windows with an allowed boundary (working hours,
 * protected family time, etc.) — windows entirely outside the boundary are
 * dropped, partially-overlapping windows are clipped. */
export function intersectWindowsWithBoundary(windows: FreeWindow[], boundary: Interval): FreeWindow[] {
  const result: FreeWindow[] = [];
  for (const window of windows) {
    const start = Math.max(window.start, boundary.start);
    const end = Math.min(window.end, boundary.end);
    if (end > start) {
      result.push({ start, end, durationMinutes: (end - start) / 60_000 });
    }
  }
  return result;
}

/** True if [candidateStart, candidateEnd) overlaps any busy interval — the
 * single source of truth the Decision Engine must consult before ever
 * describing a time as free. */
export function hasConflict(candidateStart: number, candidateEnd: number, busyIntervals: Interval[]): boolean {
  return mergeIntervals(busyIntervals).some(
    (busy) => candidateStart < busy.end && candidateEnd > busy.start
  );
}

export interface AlternativeSlotCandidate {
  start: number;
  end: number;
}

export interface RankedAlternative extends AlternativeSlotCandidate {
  /** Minutes from the originally-preferred start time — used as the primary ranking signal (closer is better) before other weighting is applied by the caller (lib/decision-engine). */
  minutesFromPreferred: number;
}

/**
 * Finds every slot of `durationMinutes` that fits inside the given free
 * windows, ranked by proximity to `preferredStartMs`. Pure candidate
 * generation — domain-specific ranking (working-hours preference, remote/
 * office day, family protection, sleep/energy state; see the founder's
 * brief) is layered on top by the Decision Engine, which has access to that
 * context and shouldn't be duplicated in this provider-agnostic module.
 */
export function findAlternativeSlots(
  freeWindows: FreeWindow[],
  durationMinutes: number,
  preferredStartMs: number
): RankedAlternative[] {
  const durationMs = durationMinutes * 60_000;
  const candidates: RankedAlternative[] = [];

  for (const window of freeWindows) {
    if (window.end - window.start < durationMs) continue;

    // The window itself is always a candidate (starting at the window's
    // start), plus — if the preferred time falls inside this window — the
    // preferred time itself, so "keep as close to what was planned as
    // possible" is representable even when the exact original slot is
    // free.
    const slotStarts = new Set<number>([window.start]);
    if (preferredStartMs >= window.start && preferredStartMs + durationMs <= window.end) {
      slotStarts.add(preferredStartMs);
    }
    // The latest possible start in this window, so a same-window slot that
    // ends right at the window's end (e.g. right before the next
    // engagement) is also representable — some callers prefer "as late as
    // possible before the next thing" (e.g. squeezing prep in right before
    // a meeting).
    slotStarts.add(window.end - durationMs);

    for (const start of slotStarts) {
      const end = start + durationMs;
      candidates.push({ start, end, minutesFromPreferred: Math.abs(start - preferredStartMs) / 60_000 });
    }
  }

  return candidates.sort((a, b) => a.minutesFromPreferred - b.minutesFromPreferred);
}
