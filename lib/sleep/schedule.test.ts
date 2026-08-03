import { describe, expect, it } from "vitest";
import {
  getSleepPhase,
  isActivityInsideAwakeWindow,
  resolveSleepSchedule,
  type SleepScheduleProfile,
} from "./schedule";

const PROFILE: SleepScheduleProfile = {
  targetSleepTime: "23:00",
  targetWakeTime: "07:00",
  weekendSleepTime: "00:00",
  weekendWakeTime: "08:30",
  windDownMinutes: 45,
  sleepScheduleType: "regular",
};

describe("sleep schedule", () => {
  it("protects the overnight sleep window and wind-down", () => {
    const schedule = resolveSleepSchedule("2026-08-03", PROFILE);
    expect(getSleepPhase("02:15", schedule)).toBe("sleep");
    expect(getSleepPhase("22:30", schedule)).toBe("wind_down");
    expect(getSleepPhase("12:00", schedule)).toBe("awake");
  });

  it("uses weekend times when configured", () => {
    const schedule = resolveSleepSchedule("2026-08-01", PROFILE);
    expect(schedule.sleepTime).toBe("00:00");
    expect(schedule.wakeTime).toBe("08:30");
  });

  it("supports a shift-worker daytime sleep window", () => {
    const schedule = resolveSleepSchedule("2026-08-03", {
      ...PROFILE,
      targetSleepTime: "06:00",
      targetWakeTime: "14:00",
      weekendSleepTime: null,
      weekendWakeTime: null,
      sleepScheduleType: "shift",
    });
    expect(getSleepPhase("23:00", schedule)).toBe("awake");
    expect(getSleepPhase("05:30", schedule)).toBe("wind_down");
    expect(getSleepPhase("08:00", schedule)).toBe("sleep");
  });

  it("rejects activities that overlap wind-down or sleep", () => {
    const schedule = resolveSleepSchedule("2026-08-03", PROFILE);
    expect(isActivityInsideAwakeWindow("18:00", "18:30", schedule)).toBe(true);
    expect(isActivityInsideAwakeWindow("22:30", "22:45", schedule)).toBe(false);
    expect(isActivityInsideAwakeWindow("02:00", "02:15", schedule)).toBe(false);
  });
});

