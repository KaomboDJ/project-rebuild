import { describe, expect, it } from "vitest";
import { getMonthRange, getWeekRange } from "./ranges";

describe("getWeekRange", () => {
  it("returns Monday-Sunday for a Thursday", () => {
    // 2026-07-30 is a Thursday.
    expect(getWeekRange("2026-07-30")).toEqual({ start: "2026-07-27", end: "2026-08-02" });
  });

  it("returns the same week when given the Monday itself", () => {
    expect(getWeekRange("2026-07-27")).toEqual({ start: "2026-07-27", end: "2026-08-02" });
  });

  it("returns the same week when given the Sunday itself", () => {
    expect(getWeekRange("2026-08-02")).toEqual({ start: "2026-07-27", end: "2026-08-02" });
  });
});

describe("getMonthRange", () => {
  it("returns the full calendar month", () => {
    expect(getMonthRange("2026-07-15")).toEqual({ start: "2026-07-01", end: "2026-07-31" });
  });

  it("handles a 30-day month", () => {
    expect(getMonthRange("2026-11-03")).toEqual({ start: "2026-11-01", end: "2026-11-30" });
  });

  it("handles a year rollover", () => {
    expect(getMonthRange("2026-12-25")).toEqual({ start: "2026-12-01", end: "2026-12-31" });
  });
});
