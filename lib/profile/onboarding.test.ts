import { describe, expect, it } from "vitest";
import {
  ONBOARDING_DEFAULTS,
  type OnboardingDraft,
  isOnboardingValid,
  validateOnboardingDraft,
} from "./onboarding";

const VALID: OnboardingDraft = {
  ...ONBOARDING_DEFAULTS,
  preferredName: "Marco",
  currentIdentity: "Ex-atleta com rotina interrompida",
  desiredIdentity: "Atleta em reconstrução",
  currentConstraints: "Sono interrompido, trabalho exigente",
  interventionTone: "direto e prático",
};

describe("validateOnboardingDraft", () => {
  it("accepts a fully filled draft", () => {
    expect(validateOnboardingDraft(VALID)).toEqual({});
    expect(isOnboardingValid(VALID)).toBe(true);
  });

  it("requires preferredName", () => {
    const errors = validateOnboardingDraft({ ...VALID, preferredName: "  " });
    expect(errors.preferredName).toBeDefined();
    expect(isOnboardingValid({ ...VALID, preferredName: "" })).toBe(false);
  });

  it("requires currentIdentity and desiredIdentity", () => {
    const errors = validateOnboardingDraft({ ...VALID, currentIdentity: "", desiredIdentity: "" });
    expect(errors.currentIdentity).toBeDefined();
    expect(errors.desiredIdentity).toBeDefined();
  });

  it("rejects an unknown primaryObjective", () => {
    const errors = validateOnboardingDraft({ ...VALID, primaryObjective: "world-domination" });
    expect(errors.primaryObjective).toBeDefined();
  });

  it("requires at least one preferred training day", () => {
    const errors = validateOnboardingDraft({ ...VALID, preferredTrainingDays: [] });
    expect(errors.preferredTrainingDays).toBeDefined();
  });

  it.each(["9:00", "24:00", "12:60", "noon", ""])(
    "rejects invalid preferredTrainingTime %s",
    (time) => {
      const errors = validateOnboardingDraft({ ...VALID, preferredTrainingTime: time });
      expect(errors.preferredTrainingTime).toBeDefined();
    }
  );

  it("accepts valid HH:MM times at the boundaries", () => {
    const draft = { ...VALID, preferredTrainingTime: "00:00", typicalDinnerTime: "23:59" };
    const errors = validateOnboardingDraft(draft);
    expect(errors.preferredTrainingTime).toBeUndefined();
    expect(errors.typicalDinnerTime).toBeUndefined();
  });

  it("requires currentConstraints and interventionTone", () => {
    const errors = validateOnboardingDraft({ ...VALID, currentConstraints: "", interventionTone: "  " });
    expect(errors.currentConstraints).toBeDefined();
    expect(errors.interventionTone).toBeDefined();
  });
});
