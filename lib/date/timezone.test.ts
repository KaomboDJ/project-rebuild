import { describe, expect, it } from "vitest";
import { instantToLocalParts, instantToLocalWallClockIso, localDayRangeUtc, nowInTimeZone, zonedWallTimeToUtc } from "./timezone";

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

describe("instantToLocalParts / instantToLocalWallClockIso", () => {
  it("is the exact inverse of zonedWallTimeToUtc for Lisbon summer time", () => {
    const instant = zonedWallTimeToUtc("2026-07-29", "14:30:00", "Europe/Lisbon");
    expect(instantToLocalParts(instant, "Europe/Lisbon")).toEqual({
      dateKey: "2026-07-29",
      time: "14:30:00",
    });
    expect(instantToLocalWallClockIso(instant, "Europe/Lisbon")).toBe("2026-07-29T14:30:00");
  });

  it("rolls the date over correctly when the UTC instant crosses midnight in the target zone", () => {
    // 23:30 UTC on the 29th is already 00:30 on the 30th in Lisbon (UTC+1 in July).
    const instant = new Date("2026-07-29T23:30:00.000Z");
    expect(instantToLocalWallClockIso(instant, "Europe/Lisbon")).toBe("2026-07-30T00:30:00");
  });

  it("handles a timezone west of UTC", () => {
    const instant = new Date("2026-07-29T13:00:00.000Z");
    expect(instantToLocalWallClockIso(instant, "America/New_York")).toBe("2026-07-29T09:00:00");
  });
});

describe("nowInTimeZone", () => {
  it("matches instantToLocalParts for an explicit reference instant", () => {
    const reference = new Date("2026-07-29T14:30:00.000Z");
    expect(nowInTimeZone("Europe/Lisbon", reference)).toEqual({ dateKey: "2026-07-29", time: "15:30:00" });
  });
});
