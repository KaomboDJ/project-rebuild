import { describe, expect, it } from "vitest";
import { buildBriefingSummary, detectFreeWindowDrift } from "./drift";
import type { FreeWindow } from "./types";

function window(overrides: Partial<FreeWindow> = {}): FreeWindow {
  return { start: "2026-07-30T09:00:00", end: "2026-07-30T12:00:00", durationMinutes: 180, ...overrides };
}

describe("detectFreeWindowDrift", () => {
  it("reports no drift when the free-window shape is unchanged", () => {
    const previous = [window()];
    const current = [window()];
    expect(detectFreeWindowDrift(previous, current).changed).toBe(false);
  });

  it("reports drift when the number of free windows changes", () => {
    const previous = [window()];
    const current = [window(), window({ start: "2026-07-30T14:00:00", end: "2026-07-30T15:00:00", durationMinutes: 60 })];
    expect(detectFreeWindowDrift(previous, current).changed).toBe(true);
  });

  it("reports drift when total free minutes shift beyond the tolerance", () => {
    const previous = [window({ durationMinutes: 180 })];
    const current = [window({ durationMinutes: 100 })];
    expect(detectFreeWindowDrift(previous, current, 15).changed).toBe(true);
  });

  it("does not report drift for a small change within tolerance", () => {
    const previous = [window({ durationMinutes: 180 })];
    const current = [window({ durationMinutes: 175 })];
    expect(detectFreeWindowDrift(previous, current, 15).changed).toBe(false);
  });

  it("treats an empty-to-empty comparison as no drift", () => {
    expect(detectFreeWindowDrift([], []).changed).toBe(false);
  });
});

describe("buildBriefingSummary", () => {
  it("mentions the event count and free time", () => {
    const summary = buildBriefingSummary({
      eventCount: 3,
      freeWindows: [window({ durationMinutes: 90 })],
      decisionsGenerated: true,
    });
    expect(summary).toContain("3 evento(s)");
    expect(summary).toContain("1h30");
  });

  it("notes when decisions have not been generated yet", () => {
    const summary = buildBriefingSummary({ eventCount: 0, freeWindows: [], decisionsGenerated: false });
    expect(summary).toContain("Ainda sem decisões geradas hoje.");
  });

  it("includes a stale note when drift changed is true", () => {
    const summary = buildBriefingSummary({
      eventCount: 1,
      freeWindows: [window()],
      decisionsGenerated: true,
      drift: { changed: true, previousTotalMinutes: 100, currentTotalMinutes: 50, previousWindowCount: 1, currentWindowCount: 1 },
    });
    expect(summary).toContain("A agenda mudou");
  });

  it("omits the stale note when drift changed is false", () => {
    const summary = buildBriefingSummary({
      eventCount: 1,
      freeWindows: [window()],
      decisionsGenerated: true,
      drift: { changed: false, previousTotalMinutes: 100, currentTotalMinutes: 100, previousWindowCount: 1, currentWindowCount: 1 },
    });
    expect(summary).not.toContain("A agenda mudou");
  });
});
