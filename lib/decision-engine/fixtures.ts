// Synthetic DailyContext fixtures shared by the decision-engine test suite.
// Not a test file itself — imported by rules.test.ts, scorer.test.ts, etc.

import type { DailyContext, UserProfile } from "./types";

export const BASE_PROFILE: UserProfile = {
  userId: "user-1",
  preferredName: "Marco",
  timezone: "Europe/Lisbon",
  currentIdentity: "Ex-atleta com rotina interrompida",
  desiredIdentity: "Atleta em reconstrução",
  primaryObjective: "rebuild-fitness",
  preferredTrainingDays: ["wednesday"],
  preferredTrainingTime: "12:00",
  typicalDinnerTime: "20:00",
  targetSleepTime: "23:00",
  targetWakeTime: "07:00",
  weekendSleepTime: "00:00",
  weekendWakeTime: "08:00",
  windDownMinutes: 45,
  sleepScheduleType: "regular",
  workingHours: { start: "09:00", end: "18:00" },
  currentConstraints: "Sono interrompido, agenda de trabalho exigente, filho pequeno.",
  interventionTone: "direto e prático",
};

// 2026-07-29 is a Wednesday.
export function baseContext(overrides: Partial<DailyContext> = {}): DailyContext {
  return {
    date: "2026-07-29",
    timezone: "Europe/Lisbon",
    now: "2026-07-29T11:30:00",
    profile: BASE_PROFILE,
    calendarEvents: [],
    freeWindows: [],
    recentDecisions: [],
    userCheckIn: undefined,
    pantryItems: [],
    ...overrides,
  };
}
