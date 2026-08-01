import { describe, expect, it } from "vitest";
import { validateGeneratedDecisions } from "./validation";
import type { GeneratedDecision } from "./types";

const ORIGINAL: GeneratedDecision[] = [
  {
    domain: "training",
    title: "Treino ao almoço",
    reason: "Dia de treino planeado.",
    recommendedAction: "Treina às 12:00.",
    recommendedStart: "2026-07-29T12:00:00",
    recommendedEnd: "2026-07-29T12:40:00",
    impact: "high",
    confidence: 0.8,
    source: "rule",
    timingType: "calendar_slot",
  },
  {
    domain: "nutrition",
    title: "Decide o jantar",
    reason: "Evita a fadiga da noite.",
    recommendedAction: "Decide agora.",
    impact: "high",
    confidence: 0.7,
    source: "rule",
    timingType: "flexible",
  },
  {
    domain: "recovery",
    title: "Caminhada curta",
    reason: "Stress elevado hoje.",
    recommendedAction: "Caminha 15 min.",
    impact: "medium",
    confidence: 0.6,
    source: "rule",
    timingType: "calendar_slot",
  },
];

describe("validateGeneratedDecisions", () => {
  it("accepts a reworded payload with the same domains, impact, and timing", () => {
    const reworded = ORIGINAL.map((d) => ({ ...d, title: `${d.title}!`, source: "ai" as const }));
    const result = validateGeneratedDecisions(reworded, ORIGINAL);
    expect(result).not.toBeNull();
    expect(result?.every((d) => d.source === "ai")).toBe(true);
  });

  it("rejects a payload with the wrong number of decisions", () => {
    expect(validateGeneratedDecisions(ORIGINAL.slice(0, 2), ORIGINAL)).toBeNull();
  });

  it("rejects a payload that invents a domain not in the original", () => {
    const invented = [...ORIGINAL.slice(0, 2), { ...ORIGINAL[2], domain: "sleep" as const }];
    expect(validateGeneratedDecisions(invented, ORIGINAL)).toBeNull();
  });

  it("rejects a payload that changes the recommended time window", () => {
    const rescheduled = [
      { ...ORIGINAL[0], recommendedStart: "2026-07-29T15:00:00" },
      ORIGINAL[1],
      ORIGINAL[2],
    ];
    expect(validateGeneratedDecisions(rescheduled, ORIGINAL)).toBeNull();
  });

  it("rejects a payload that changes the impact level", () => {
    const changed = [{ ...ORIGINAL[0], impact: "low" as const }, ORIGINAL[1], ORIGINAL[2]];
    expect(validateGeneratedDecisions(changed, ORIGINAL)).toBeNull();
  });

  it("re-attaches relatedPantryItem from the original rather than trusting the AI payload (Milestone 11D)", () => {
    const withPantryItem: GeneratedDecision[] = [
      ORIGINAL[0],
      { ...ORIGINAL[1], relatedPantryItem: "Frango" },
      ORIGINAL[2],
    ];
    const reworded = withPantryItem.map((d) => ({ ...d, title: `${d.title}!`, source: "ai" as const }));
    const result = validateGeneratedDecisions(reworded, withPantryItem);
    expect(result).not.toBeNull();
    const nutrition = result?.find((d) => d.domain === "nutrition");
    expect(nutrition?.relatedPantryItem).toBe("Frango");
  });

  it("leaves relatedPantryItem undefined when the original didn't set one", () => {
    const reworded = ORIGINAL.map((d) => ({ ...d, title: `${d.title}!`, source: "ai" as const }));
    const result = validateGeneratedDecisions(reworded, ORIGINAL);
    expect(result?.every((d) => d.relatedPantryItem === undefined)).toBe(true);
  });

  it("rejects malformed JSON shapes gracefully (no throw)", () => {
    expect(() => validateGeneratedDecisions({ not: "an array" }, ORIGINAL)).not.toThrow();
    expect(validateGeneratedDecisions({ not: "an array" }, ORIGINAL)).toBeNull();
    expect(validateGeneratedDecisions(null, ORIGINAL)).toBeNull();
    expect(validateGeneratedDecisions(undefined, ORIGINAL)).toBeNull();
  });
});
