import { describe, expect, it } from "vitest";
import { localDateKey, localTimeHHMM } from "./local";

describe("localDateKey", () => {
  it("formats using local calendar fields", () => {
    const date = new Date(2026, 6, 28); // July 28 2026, local time
    expect(localDateKey(date)).toBe("2026-07-28");
  });

  it("pads single-digit months and days", () => {
    const date = new Date(2026, 0, 5);
    expect(localDateKey(date)).toBe("2026-01-05");
  });
});

describe("localTimeHHMM", () => {
  it("formats using local hours and minutes", () => {
    const date = new Date(2026, 6, 28, 9, 5);
    expect(localTimeHHMM(date)).toBe("09:05");
  });

  it("pads midnight correctly", () => {
    const date = new Date(2026, 6, 28, 0, 0);
    expect(localTimeHHMM(date)).toBe("00:00");
  });
});
