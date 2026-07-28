import { describe, expect, it } from "vitest";
import { isValidCheckIn } from "./validate";

describe("isValidCheckIn", () => {
  it("accepts a well-formed check-in", () => {
    expect(
      isValidCheckIn({ date: "2026-07-28", sleepHours: 7, energy: 4, stress: 2, dayType: "remote" })
    ).toBe(true);
  });

  it("rejects a legacy check-in saved before dayType existed", () => {
    expect(
      isValidCheckIn({ date: "2026-07-28", sleepHours: 7, energy: 4, stress: 2, isRecoveryDay: false })
    ).toBe(false);
  });

  it("rejects an invalid dayType value", () => {
    expect(
      isValidCheckIn({ date: "2026-07-28", sleepHours: 7, energy: 4, stress: 2, dayType: "vacation" })
    ).toBe(false);
  });

  it("rejects null, non-object, and missing values", () => {
    expect(isValidCheckIn(null)).toBe(false);
    expect(isValidCheckIn(undefined)).toBe(false);
    expect(isValidCheckIn("nope")).toBe(false);
  });
});
