import { describe, expect, it } from "vitest";
import { resolveDayType } from "./day-type";

describe("resolveDayType - priority chain (Part 4)", () => {
  it("prefers today's explicit check-in answer over everything else", () => {
    const result = resolveDayType({ checkInDayType: "office", profileDefaultDayType: "home", hasCalendarConnection: true });
    expect(result).toMatchObject({ dayType: "office", source: "check-in", confidence: "high", shouldAsk: false });
  });

  it("falls back to the recurring profile default when there's no check-in answer", () => {
    const result = resolveDayType({ checkInDayType: null, profileDefaultDayType: "home", hasCalendarConnection: false });
    expect(result).toMatchObject({ dayType: "home", source: "profile", confidence: "medium", shouldAsk: false });
  });

  it("treats a 'mixed' profile default as unresolved, not as an answer", () => {
    const result = resolveDayType({ checkInDayType: null, profileDefaultDayType: "mixed", hasCalendarConnection: false });
    expect(result.dayType).toBeNull();
  });

  it("falls back to a low-confidence calendar heuristic when nothing else resolves but a calendar is connected", () => {
    const result = resolveDayType({ checkInDayType: null, profileDefaultDayType: null, hasCalendarConnection: true });
    expect(result).toMatchObject({ dayType: null, source: "calendar-heuristic", confidence: "low", shouldAsk: true });
  });

  it("returns unknown and asks directly when there's no check-in, no profile default, and no calendar", () => {
    const result = resolveDayType({ checkInDayType: null, profileDefaultDayType: null, hasCalendarConnection: false });
    expect(result).toMatchObject({ dayType: null, source: "unknown", confidence: "low", shouldAsk: true });
  });

  it("never sets shouldAsk when a dayType was actually resolved", () => {
    const fromCheckIn = resolveDayType({ checkInDayType: "home", profileDefaultDayType: null, hasCalendarConnection: false });
    const fromProfile = resolveDayType({ checkInDayType: null, profileDefaultDayType: "office", hasCalendarConnection: false });
    expect(fromCheckIn.shouldAsk).toBe(false);
    expect(fromProfile.shouldAsk).toBe(false);
  });
});
