import { describe, expect, it } from "vitest";
import {
  WORKOUT_TYPES,
  TRAINING_CATEGORY_LABEL,
  TRAINING_CATEGORY_MACRO_GUIDANCE,
  describeWorkoutMacroGuidance,
  getWorkoutType,
} from "./workout-types";

describe("workout type catalog", () => {
  it("has a unique id for every workout type", () => {
    const ids = WORKOUT_TYPES.map((w) => w.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("every workout's category (and optional secondary) is a known category", () => {
    const knownCategories = Object.keys(TRAINING_CATEGORY_LABEL);
    for (const workout of WORKOUT_TYPES) {
      expect(knownCategories).toContain(workout.primaryCategory);
      if (workout.secondaryCategory) expect(knownCategories).toContain(workout.secondaryCategory);
    }
  });

  it("includes every example the founder named", () => {
    const labels = WORKOUT_TYPES.map((w) => w.label.toLowerCase());
    for (const example of ["natação", "musculação", "jiu-jitsu", "yoga", "insanity", "p90x", "mma", "parkour"]) {
      expect(labels).toContain(example);
    }
  });

  it("getWorkoutType finds a real entry and returns undefined for an unknown id", () => {
    expect(getWorkoutType("musculacao")?.label).toBe("Musculação");
    expect(getWorkoutType("does-not-exist")).toBeUndefined();
  });

  it("describeWorkoutMacroGuidance returns just the primary category's guidance for a single-category workout", () => {
    expect(describeWorkoutMacroGuidance("yoga")).toBe(TRAINING_CATEGORY_MACRO_GUIDANCE.mental_relaxamento);
  });

  it("describeWorkoutMacroGuidance blends both categories for a hybrid workout", () => {
    const text = describeWorkoutMacroGuidance("jiu_jitsu");
    expect(text).toContain(TRAINING_CATEGORY_MACRO_GUIDANCE.forca_hipertrofia);
    expect(text?.toLowerCase()).toContain("cardio");
  });

  it("returns null for an unknown workout id", () => {
    expect(describeWorkoutMacroGuidance("not-a-real-workout")).toBeNull();
  });
});
