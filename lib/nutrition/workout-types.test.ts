import { describe, expect, it } from "vitest";
import {
  TRAINING_CATEGORIES,
  TRAINING_CATEGORY_LABEL,
  TRAINING_CATEGORY_EXAMPLES,
  TRAINING_CATEGORY_MACRO_GUIDANCE,
  describeTrainingCategoryGuidance,
  isTrainingCategory,
} from "./workout-types";

describe("training category taxonomy", () => {
  it("has a label, example list, and macro guidance for every category", () => {
    for (const category of TRAINING_CATEGORIES) {
      expect(TRAINING_CATEGORY_LABEL[category]).toBeTruthy();
      expect(TRAINING_CATEGORY_EXAMPLES[category].length).toBeGreaterThan(0);
      expect(TRAINING_CATEGORY_MACRO_GUIDANCE[category]).toBeTruthy();
    }
  });

  it("keeps striking and grappling martial arts as separate categories (founder correction, 2026-08-05)", () => {
    expect(TRAINING_CATEGORIES).toContain("artes_marciais_strike");
    expect(TRAINING_CATEGORIES).toContain("wrestling_grappling");
    expect(TRAINING_CATEGORY_MACRO_GUIDANCE.artes_marciais_strike).not.toBe(
      TRAINING_CATEGORY_MACRO_GUIDANCE.wrestling_grappling
    );
  });

  it("keeps light and heavy cardio as separate categories", () => {
    expect(TRAINING_CATEGORIES).toContain("cardio_leve");
    expect(TRAINING_CATEGORIES).toContain("cardio_pesado");
    expect(TRAINING_CATEGORY_MACRO_GUIDANCE.cardio_leve).not.toBe(TRAINING_CATEGORY_MACRO_GUIDANCE.cardio_pesado);
  });

  it("includes every founder-named example under the right category", () => {
    expect(TRAINING_CATEGORY_EXAMPLES.artes_marciais_strike.map((s) => s.toLowerCase())).toEqual(
      expect.arrayContaining(["muay thai", "kickboxing"])
    );
    expect(TRAINING_CATEGORY_EXAMPLES.wrestling_grappling.map((s) => s.toLowerCase())).toEqual(
      expect.arrayContaining(["jiu-jitsu", "judo", "wrestling", "sambo"])
    );
    expect(TRAINING_CATEGORY_EXAMPLES.cardio_pesado.map((s) => s.toLowerCase())).toEqual(
      expect.arrayContaining(["hiit", "corrida de sprints", "remo"])
    );
    expect(TRAINING_CATEGORY_EXAMPLES.mobilidade.map((s) => s.toLowerCase())).toEqual(
      expect.arrayContaining(["yoga", "pilates"])
    );
  });
});

describe("isTrainingCategory", () => {
  it("accepts every known category and rejects an unknown string", () => {
    for (const category of TRAINING_CATEGORIES) {
      expect(isTrainingCategory(category)).toBe(true);
    }
    expect(isTrainingCategory("mma")).toBe(false); // the old, now-removed blended category
    expect(isTrainingCategory("not-a-category")).toBe(false);
  });
});

describe("describeTrainingCategoryGuidance", () => {
  it("returns the matching guidance paragraph for a known category", () => {
    expect(describeTrainingCategoryGuidance("hipertrofia")).toBe(TRAINING_CATEGORY_MACRO_GUIDANCE.hipertrofia);
  });

  it("returns null for an unknown category id", () => {
    expect(describeTrainingCategoryGuidance("not-a-real-category")).toBeNull();
  });
});
