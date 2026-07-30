// Pure timezone conversion helpers, needed only for Milestone 3 (Google
// Calendar API's events.list requires timeMin/timeMax as RFC3339 instants,
// not "local wall-clock" strings). Deliberately separate from
// lib/date/local.ts, which reports the *server's* local time (fine for
// "what day is the cron running" but wrong for "what is 00:00 in the
// founder's timezone").
//
// No date library dependency: uses the standard trick of formatting the same
// instant in both the target timezone and UTC, and using the difference as
// the offset. Not exact across a DST transition instant itself, which is an
// acceptable trade-off for computing a day's [start, end) range.

/** Converts a wall-clock instant in `timeZone` to the equivalent UTC Date. */
export function zonedWallTimeToUtc(dateKey: string, timeHHMMSS: string, timeZone: string): Date {
  const asUtc = new Date(`${dateKey}T${timeHHMMSS}Z`);

  const tzString = asUtc.toLocaleString("en-US", { timeZone });
  const utcString = asUtc.toLocaleString("en-US", { timeZone: "UTC" });

  const offsetMs = new Date(utcString).getTime() - new Date(tzString).getTime();
  return new Date(asUtc.getTime() + offsetMs);
}

/**
 * The [start, end) UTC instants covering a full local calendar day
 * (`dateKey`, "YYYY-MM-DD") in `timeZone`, as ISO strings suitable for
 * Google Calendar's timeMin/timeMax.
 */
export function localDayRangeUtc(dateKey: string, timeZone: string): { timeMin: string; timeMax: string } {
  return localRangeUtc(dateKey, dateKey, timeZone);
}

/**
 * Same as localDayRangeUtc but spans from the start of `startDateKey` to the
 * end of `endDateKey` (inclusive) - used for the /calendar week/month views
 * (see lib/date/ranges.ts for computing those date keys).
 */
export function localRangeUtc(
  startDateKey: string,
  endDateKey: string,
  timeZone: string
): { timeMin: string; timeMax: string } {
  const start = zonedWallTimeToUtc(startDateKey, "00:00:00", timeZone);
  const end = zonedWallTimeToUtc(endDateKey, "23:59:59", timeZone);
  return { timeMin: start.toISOString(), timeMax: end.toISOString() };
}

const WALL_CLOCK_FORMATTER_CACHE = new Map<string, Intl.DateTimeFormat>();

function wallClockFormatter(timeZone: string): Intl.DateTimeFormat {
  let formatter = WALL_CLOCK_FORMATTER_CACHE.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
    WALL_CLOCK_FORMATTER_CACHE.set(timeZone, formatter);
  }
  return formatter;
}

/**
 * The inverse of zonedWallTimeToUtc: given a real instant, returns the
 * wall-clock date/time an observer in `timeZone` would see, as separate
 * "YYYY-MM-DD" / "HH:MM:SS" parts. Uses Intl.DateTimeFormat.formatToParts
 * directly (no offset-diffing) since we're reading the calendar/clock, not
 * solving for an offset.
 */
export function instantToLocalParts(instant: Date, timeZone: string): { dateKey: string; time: string } {
  const parts = wallClockFormatter(timeZone).formatToParts(instant);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "00";
  // hour12: false formats midnight as "24" per the Intl spec - normalize to "00".
  const hour = get("hour") === "24" ? "00" : get("hour");
  return {
    dateKey: `${get("year")}-${get("month")}-${get("day")}`,
    time: `${hour}:${get("minute")}:${get("second")}`,
  };
}

/**
 * Same as instantToLocalParts but combined into the app's "naive local
 * wall-clock" convention (see lib/decision-engine/types.ts) - a plain
 * "YYYY-MM-DDTHH:MM:SS" string with no UTC offset, because every consumer
 * (rules.ts, DecisionEngineCard, etc.) treats the whole app as running in
 * a single implicit timezone: the founder's.
 */
export function instantToLocalWallClockIso(instant: Date, timeZone: string): string {
  const { dateKey, time } = instantToLocalParts(instant, timeZone);
  return `${dateKey}T${time}`;
}

/** "Right now", as the founder's timezone would show it - the timezone-aware
 * replacement for `new Date()` + lib/date/local.ts (server-local, wrong). */
export function nowInTimeZone(
  timeZone: string,
  referenceInstant: Date = new Date()
): { dateKey: string; time: string } {
  return instantToLocalParts(referenceInstant, timeZone);
}
