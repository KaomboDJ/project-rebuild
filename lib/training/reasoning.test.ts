import { describe, expect, it } from "vitest";
import { explainSessionChoice } from "./reasoning";
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

describe("explainSessionChoice", () => {
  it("credits the category preference when it was actually a match", () => {
    const s = session({ id: "s1", workoutTypeId: "hipertrofia" });
    const sentences = explainSessionChoice({ session: s, profile: profile({ preferredCategories: ["hipertrofia"] }) });
    expect(sentences.some((line) => line.includes("Hipertrofia"))).toBe(true);
    expect(sentences.some((line) => line.includes("preferência"))).toBe(true);
  });

  it("frames it as variety, not preference, when categories weren't specified", () => {
    const s = session({ id: "s1", workoutTypeId: "mobilidade" });
    const sentences = explainSessionChoice({ session: s, profile: profile() });
    expect(sentences.some((line) => line.includes("variedade"))).toBe(true);
    expect(sentences.some((line) => line.includes("preferência"))).toBe(false);
  });

  it("mentions duration only when the session actually fits the founder's window", () => {
    const fits = session({ id: "s1", workoutTypeId: "mobilidade", durationMinutes: 30 });
    const tooLong = session({ id: "s2", workoutTypeId: "mobilidade", durationMinutes: 90 });
    const p = profile({ sessionDurationMinutes: 45 });

    expect(explainSessionChoice({ session: fits, profile: p }).some((l) => l.includes("30 min"))).toBe(true);
    expect(explainSessionChoice({ session: tooLong, profile: p }).some((l) => l.includes("90 min"))).toBe(false);
  });

  it("mentions location only when it actually matches (accounting for 'mixed')", () => {
    const home = session({ id: "s1", workoutTypeId: "mobilidade", location: "home" });
    const gym = session({ id: "s2", workoutTypeId: "mobilidade", location: "gym" });
    const p = profile({ location: "home" });

    expect(explainSessionChoice({ session: home, profile: p }).some((l) => l.includes("em casa"))).toBe(true);
    expect(explainSessionChoice({ session: gym, profile: p }).some((l) => l.includes("ginásio"))).toBe(false);
  });

  it("mentions intensity fit only when it actually matches", () => {
    const s = session({ id: "s1", workoutTypeId: "mobilidade", intensity: "low" });
    const matching = profile({ intensityPreference: "low" });
    const notMatching = profile({ intensityPreference: "high" });

    expect(explainSessionChoice({ session: s, profile: matching }).some((l) => l.includes("intensidade"))).toBe(true);
    expect(explainSessionChoice({ session: s, profile: notMatching }).some((l) => l.includes("intensidade"))).toBe(false);
  });

  it("mentions physical limitations only when the founder actually reported any", () => {
    const s = session({ id: "s1", workoutTypeId: "mobilidade" });
    const withLimitation = profile({ physicalLimitations: "joelho sensível" });
    const without = profile({ physicalLimitations: "" });

    expect(explainSessionChoice({ session: s, profile: withLimitation }).some((l) => l.includes("limitações"))).toBe(true);
    expect(explainSessionChoice({ session: s, profile: without }).some((l) => l.includes("limitações"))).toBe(false);
  });
});
