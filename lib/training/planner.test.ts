import { describe, expect, it } from "vitest";
import { candidatesForTrainingDay, generateWeekTrainingPlan, suggestTrainingReplacement } from "./planner";
import type { TrainingProfile, WorkoutSession } from "./types";

function session(overrides: Partial<WorkoutSession> & Pick<WorkoutSession, "id" | "workoutTypeId">): WorkoutSession {
  return {
    name: overrides.id,
    durationMinutes: 45,
    location: "mixed",
    intensity: "medium",
    equipment: [],
    structure: "",
    safetyNote: "",
    ...overrides,
  };
}

function profile(overrides: Partial<TrainingProfile> = {}): TrainingProfile {
  return {
    userId: "u1",
    preferredCategories: [],
    sessionDurationMinutes: 60,
    location: "mixed",
    intensityPreference: "medium",
    varietyPreference: "medium",
    physicalLimitations: "",
    ...overrides,
  };
}

const HIPERTROFIA_SESSIONS: WorkoutSession[] = [
  session({ id: "h1", workoutTypeId: "hipertrofia" }),
  session({ id: "h2", workoutTypeId: "hipertrofia" }),
  session({ id: "h3", workoutTypeId: "hipertrofia" }),
];

describe("candidatesForTrainingDay", () => {
  it("with no preferred categories, every session is a candidate", () => {
    const sessions = [...HIPERTROFIA_SESSIONS, session({ id: "m1", workoutTypeId: "mobilidade" })];
    const { candidates } = candidatesForTrainingDay(sessions, profile());
    expect(candidates).toHaveLength(4);
  });

  it("restricts to the founder's preferred categories when set", () => {
    const sessions = [...HIPERTROFIA_SESSIONS, session({ id: "m1", workoutTypeId: "mobilidade" })];
    const { candidates } = candidatesForTrainingDay(sessions, profile({ preferredCategories: ["hipertrofia"] }));
    expect(candidates.every((s) => s.workoutTypeId === "hipertrofia")).toBe(true);
    expect(candidates).toHaveLength(3);
  });

  it("excludes a category the founder never selected", () => {
    const sessions = [session({ id: "m1", workoutTypeId: "mobilidade" })];
    const { candidates } = candidatesForTrainingDay(sessions, profile({ preferredCategories: ["hipertrofia"] }));
    expect(candidates).toHaveLength(0);
  });

  it("a 'mixed' location session matches any founder location", () => {
    const sessions = [session({ id: "s1", workoutTypeId: "hipertrofia", location: "mixed" })];
    const { candidates, relaxed } = candidatesForTrainingDay(sessions, profile({ location: "gym" }));
    expect(candidates).toHaveLength(1);
    expect(relaxed).toBe(false);
  });

  it("a founder with 'mixed' location accepts a location-specific session", () => {
    const sessions = [session({ id: "s1", workoutTypeId: "hipertrofia", location: "outdoor" })];
    const { candidates } = candidatesForTrainingDay(sessions, profile({ location: "mixed" }));
    expect(candidates).toHaveLength(1);
  });

  it("relaxes location before returning nothing when duration also fits", () => {
    const sessions = [session({ id: "s1", workoutTypeId: "hipertrofia", location: "gym", durationMinutes: 30 })];
    const { candidates, relaxed } = candidatesForTrainingDay(sessions, profile({ location: "home", sessionDurationMinutes: 60 }));
    expect(candidates).toHaveLength(1);
    expect(relaxed).toBe(true);
  });

  it("relaxes duration when nothing fits the founder's session-length budget", () => {
    const sessions = [session({ id: "s1", workoutTypeId: "hipertrofia", durationMinutes: 90 })];
    const { candidates, relaxed } = candidatesForTrainingDay(sessions, profile({ sessionDurationMinutes: 20 }));
    expect(candidates).toHaveLength(1);
    expect(relaxed).toBe(true);
  });

  it("does not offer automatic candidates when free-text physical limitations exist", () => {
    const { candidates, relaxed } = candidatesForTrainingDay(
      HIPERTROFIA_SESSIONS,
      profile({ physicalLimitations: "dor no joelho" })
    );
    expect(candidates).toHaveLength(0);
    expect(relaxed).toBe(false);
  });
});

describe("generateWeekTrainingPlan", () => {
  it("only plans days present in trainingDaysOfWeek - every other day is absent, not a placeholder", () => {
    const result = generateWeekTrainingPlan({
      weekStart: "2026-08-03", // Monday
      profile: profile(),
      sessions: HIPERTROFIA_SESSIONS,
      trainingDaysOfWeek: ["monday", "wednesday", "friday"],
    });
    expect(result.items.map((i) => i.dayDate)).toEqual(["2026-08-03", "2026-08-05", "2026-08-07"]);
  });

  it("plans zero days when trainingDaysOfWeek is empty", () => {
    const result = generateWeekTrainingPlan({
      weekStart: "2026-08-03",
      profile: profile(),
      sessions: HIPERTROFIA_SESSIONS,
      trainingDaysOfWeek: [],
    });
    expect(result.items).toHaveLength(0);
  });

  it("respects variety by avoiding immediate repeats when enough candidates exist", () => {
    const result = generateWeekTrainingPlan({
      weekStart: "2026-08-03",
      profile: profile({ varietyPreference: "high" }),
      sessions: HIPERTROFIA_SESSIONS,
      trainingDaysOfWeek: ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"],
    });
    for (let i = 1; i < result.items.length; i++) {
      expect(result.items[i].sessionId).not.toBe(result.items[i - 1].sessionId);
    }
  });

  it("flags limitedVariety and reuses the only candidate when just one exists", () => {
    const result = generateWeekTrainingPlan({
      weekStart: "2026-08-03",
      profile: profile(),
      sessions: [session({ id: "only", workoutTypeId: "hipertrofia" })],
      trainingDaysOfWeek: ["monday", "wednesday"],
    });
    expect(result.limitedVariety).toBe(true);
    expect(result.items.every((i) => i.sessionId === "only")).toBe(true);
  });

  it("leaves every day unplanned when no session satisfies the founder's preferred categories", () => {
    const result = generateWeekTrainingPlan({
      weekStart: "2026-08-03",
      profile: profile({ preferredCategories: ["parkour"] }),
      sessions: HIPERTROFIA_SESSIONS,
      trainingDaysOfWeek: ["monday", "wednesday"],
    });
    expect(result.items).toHaveLength(0);
    expect(result.limitedVariety).toBe(true);
  });

  it("carries over recently-used session ids across a week boundary", () => {
    const result = generateWeekTrainingPlan({
      weekStart: "2026-08-03",
      profile: profile({ varietyPreference: "high" }),
      sessions: HIPERTROFIA_SESSIONS,
      trainingDaysOfWeek: ["monday"],
      carryOverSessionIds: ["h1", "h2"],
    });
    expect(result.items[0].sessionId).toBe("h3");
  });

  it("blocks the plan instead of interpreting free-text physical limitations", () => {
    const result = generateWeekTrainingPlan({
      weekStart: "2026-08-03",
      profile: profile({ physicalLimitations: "ombro em recuperação" }),
      sessions: HIPERTROFIA_SESSIONS,
      trainingDaysOfWeek: ["monday", "wednesday"],
    });
    expect(result.items).toEqual([]);
    expect(result.blockedByPhysicalLimitations).toBe(true);
    expect(result.limitedVariety).toBe(false);
  });
});

describe("suggestTrainingReplacement", () => {
  it("prefers an alternative session over the currently assigned one when others exist", () => {
    const replacement = suggestTrainingReplacement(HIPERTROFIA_SESSIONS, profile({ preferredCategories: ["hipertrofia"] }), "h1");
    expect(replacement?.id).not.toBe("h1");
  });

  it("picks the closest duration match among eligible alternatives", () => {
    const sessions = [
      session({ id: "current", workoutTypeId: "hipertrofia", durationMinutes: 45 }),
      session({ id: "close", workoutTypeId: "hipertrofia", durationMinutes: 50 }),
      session({ id: "far", workoutTypeId: "hipertrofia", durationMinutes: 120 }),
    ];
    const replacement = suggestTrainingReplacement(sessions, profile({ preferredCategories: ["hipertrofia"], sessionDurationMinutes: 120 }), "current");
    expect(replacement?.id).toBe("close");
  });

  it("returns null when no session satisfies the founder's preferred categories", () => {
    const replacement = suggestTrainingReplacement(HIPERTROFIA_SESSIONS, profile({ preferredCategories: ["parkour"] }), "h1");
    expect(replacement).toBeNull();
  });

  it("falls back to the current session if it is the only eligible option", () => {
    const solo = [session({ id: "solo", workoutTypeId: "hipertrofia" })];
    const replacement = suggestTrainingReplacement(solo, profile({ preferredCategories: ["hipertrofia"] }), "solo");
    expect(replacement?.id).toBe("solo");
  });
});
