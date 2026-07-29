import { describe, expect, it } from "vitest";
import { localDayRangeUtc, zonedWallTimeToUtc } from "./timezone";

describe("zonedWallTimeToUtc", () => {
  it("converts Lisbon summer time (UTC+1, DST) correctly", () => {
    // 2026-07-29 is within EU DST (ends last Sunday of October), so
    // Europe/Lisbon is WEST = UTC+1.
    const utc = zonedWallTimeToUtc("2026-07-29", "00:00:00", "Europe/Lisbon");
    expect(utc.toISOString()).toBe("2026-07-28T23:00:00.000Z");
  });

  it("converts UTC timezone as a no-op", () => {
    const utc = zonedWallTimeToUtc("2026-07-29", "12:30:00", "UTC");
    expect(utc.toISOString()).toBe("2026-07-29T12:30:00.000Z");
  });

  it("converts a timezone west of UTC", () => {
    // America/New_York is UTC-4 in July (EDT).
    const utc = zonedWallTimeToUtc("2026-07-29", "09:00:00", "America/New_York");
    expect(utc.toISOString()).toBe("2026-07-29T13:00:00.000Z");
  });
});

describe("localDayRangeUtc", () => {
  it("spans a full local calendar day in Lisbon", () => {
    const { timeMin, timeMax } = localDayRangeUtc("2026-07-29", "Europe/Lisbon");
    expect(timeMin).toBe("2026-07-28T23:00:00.000Z");
    expect(timeMax).toBe("2026-07-29T22:59:59.000Z");
  });
});
