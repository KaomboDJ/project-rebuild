import { describe, expect, it } from "vitest";
import { findDueReminder, isReminderDue } from "./reminders";
import type { DecisionInstance } from "./types";

const base: DecisionInstance = {
  id: "lunchtime-training",
  title: "Treino",
  trigger: "12:00",
  scoreValue: 20,
  priority: 3,
  appliesToStates: ["performer"],
  reminderTime: "11:55",
  reminderWindowMinutes: 65,
  date: "2026-07-28",
  status: "pending",
};

describe("isReminderDue", () => {
  it("is false before the reminder time", () => {
    expect(isReminderDue(base, "11:00")).toBe(false);
  });

  it("is true within the window", () => {
    expect(isReminderDue(base, "12:30")).toBe(true);
  });

  it("is false once the window has closed", () => {
    expect(isReminderDue(base, "13:30")).toBe(false);
  });

  it("is false once the decision is no longer pending", () => {
    expect(isReminderDue({ ...base, status: "completed" }, "12:00")).toBe(false);
  });

  it("is false when there is no reminder configured", () => {
    expect(isReminderDue({ ...base, reminderTime: undefined }, "12:00")).toBe(false);
  });

  it("falls back to a default window when none is configured", () => {
    const noWindow = { ...base, reminderWindowMinutes: undefined };
    expect(isReminderDue(noWindow, "12:30")).toBe(true);
    expect(isReminderDue(noWindow, "13:30")).toBe(false);
  });
});

describe("findDueReminder", () => {
  it("returns the first pending instance whose reminder is due", () => {
    const other: DecisionInstance = { ...base, id: "decide-dinner", reminderTime: undefined };
    expect(findDueReminder([other, base], "12:00")?.id).toBe("lunchtime-training");
  });

  it("returns null when nothing is due", () => {
    expect(findDueReminder([base], "09:00")).toBeNull();
  });
});
