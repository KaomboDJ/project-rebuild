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
