import type { CheckIn, DayType } from "./types";

const DAY_TYPES: DayType[] = ["remote", "office", "weekend", "recovery"];

// Guards against a check-in shape saved by an earlier version of the app
// (e.g. the pre-dayType `isRecoveryDay` schema) surviving in localStorage.
export function isValidCheckIn(value: unknown): value is CheckIn {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<CheckIn>;
  return (
    typeof candidate.date === "string" &&
    typeof candidate.sleepHours === "number" &&
    typeof candidate.energy === "number" &&
    typeof candidate.stress === "number" &&
    typeof candidate.dayType === "string" &&
    DAY_TYPES.includes(candidate.dayType as DayType)
  );
}
