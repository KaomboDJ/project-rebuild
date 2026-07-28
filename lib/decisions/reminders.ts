import type { DecisionInstance } from "./types";

const DEFAULT_REMINDER_WINDOW_MINUTES = 60;

function toMinutes(hhmm: string): number {
  const [hours, minutes] = hhmm.split(":").map(Number);
  return hours * 60 + minutes;
}

export function isReminderDue(instance: DecisionInstance, nowHHMM: string): boolean {
  if (instance.status !== "pending" || !instance.reminderTime) return false;
  const start = toMinutes(instance.reminderTime);
  const end = start + (instance.reminderWindowMinutes ?? DEFAULT_REMINDER_WINDOW_MINUTES);
  const now = toMinutes(nowHHMM);
  return now >= start && now < end;
}

export function findDueReminder(instances: DecisionInstance[], nowHHMM: string): DecisionInstance | null {
  return instances.find((instance) => isReminderDue(instance, nowHHMM)) ?? null;
}
