import { describe, expect, it } from "vitest";
import {
  dailyBriefingKey,
  decisionReminderKey,
  isReminderDue,
  minutesUntilClock,
  nutritionReminderKey,
} from "./schedule";

describe("notification schedule", () => {
  it("computes signed clock distance across midnight", () => {
    expect(minutesUntilClock("23:50", "00:10")).toBe(20);
    expect(minutesUntilClock("00:10", "23:50")).toBe(-20);
  });

  it("opens a bounded dispatch window before the desired lead time", () => {
    expect(isReminderDue("17:00", "18:00", 60)).toBe(true);
    expect(isReminderDue("17:19", "18:00", 60)).toBe(true);
    expect(isReminderDue("17:20", "18:00", 60)).toBe(false);
    expect(isReminderDue("16:39", "18:00", 60)).toBe(false);
  });

  it("does not dispatch after the target action", () => {
    expect(isReminderDue("18:01", "18:00", 30)).toBe(false);
  });

  it("builds stable idempotency keys", () => {
    expect(decisionReminderKey("d1", "2026-08-12T18:00:00")).toBe(
      "decision-reminder:d1:2026-08-12T18:00:00"
    );
    expect(nutritionReminderKey("m1", "2026-08-12", "20:00:00")).toBe(
      "nutrition-reminder:m1:2026-08-12:20:00"
    );
    expect(dailyBriefingKey("2026-08-12")).toBe("daily-briefing:2026-08-12");
  });
});
