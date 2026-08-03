import { describe, expect, it } from "vitest";
import { computeIdentityProgression } from "./progression";

describe("computeIdentityProgression", () => {
  it("never penalizes skipped decisions", () => {
    const result = computeIdentityProgression([{ status: "skipped", impact: "high", date: "2026-08-01" }]);
    expect(result.xp).toBe(0);
    expect(result.current.id).toBe("restart");
  });

  it("requires both XP and distinct active days", () => {
    const decisions = Array.from({ length: 7 }, (_, index) => ({
      status: "completed" as const,
      impact: "high" as const,
      date: `2026-08-${String(index + 1).padStart(2, "0")}`,
    }));
    expect(computeIdentityProgression(decisions).current.id).toBe("momentum");
  });

  it("does not turn acceptance into a fake active day", () => {
    const result = computeIdentityProgression(Array.from({ length: 60 }, () => ({ status: "accepted" as const, impact: "high" as const, date: "2026-08-01" })));
    expect(result.xp).toBe(120);
    expect(result.activeDays).toBe(0);
    expect(result.current.id).toBe("restart");
  });
});
