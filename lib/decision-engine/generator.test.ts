import { describe, expect, it } from "vitest";
import { baseContext } from "./fixtures";
import { generateDecisions, generateRuleDecisions } from "./generator";
import type { AIProvider } from "./generator";
import type { GeneratedDecision } from "./types";

describe("generateRuleDecisions", () => {
  it("never touches the network and returns rule-sourced decisions", () => {
    const decisions = generateRuleDecisions(
      baseContext({ now: "2026-07-29T18:15:00", userCheckIn: { stressLevel: 4 } })
    );
    expect(decisions.every((d) => d.source === "rule")).toBe(true);
  });

  it("carries relatedPantryItem through to the generated nutrition decision (Milestone 11D)", () => {
    const decisions = generateRuleDecisions(
      baseContext({
        now: "2026-07-29T17:30:00",
        pantryItems: [{ name: "Frango", quantity: 2, unit: "un", portable: true, expiresOn: "2026-07-30" }],
      })
    );
    const nutrition = decisions.find((d) => d.domain === "nutrition");
    expect(nutrition?.relatedPantryItem).toBe("Frango");
  });
});

describe("generateDecisions", () => {
  const context = baseContext({ now: "2026-07-29T18:15:00", userCheckIn: { stressLevel: 4 } });

  it("returns the deterministic rule decisions when there is no AI provider", async () => {
    const result = await generateDecisions(context, null);
    expect(result.engineVersion).toBe("rules-v1");
    expect(result.decisions.every((d) => d.source === "rule")).toBe(true);
  });

  it("uses the AI provider's refinement when it returns a valid, matching payload", async () => {
    const provider: AIProvider = {
      async refineDecisions(_ctx, candidates) {
        return candidates.map((c) => ({ ...c, title: `${c.title} (reformulado)`, source: "ai" }));
      },
    };
    const result = await generateDecisions(context, provider);
    expect(result.decisions.every((d) => d.source === "ai")).toBe(true);
    expect(result.engineVersion).toContain("decision-refine-v1");
  });

  it("falls back to rule decisions when the AI provider throws", async () => {
    const provider: AIProvider = {
      async refineDecisions(): Promise<GeneratedDecision[]> {
        throw new Error("provider is down");
      },
    };
    const result = await generateDecisions(context, provider);
    expect(result.decisions.every((d) => d.source === "rule")).toBe(true);
    expect(result.engineVersion).toBe("rules-v1");
  });

  it("falls back to rule decisions when the AI provider returns an invalid shape", async () => {
    const provider: AIProvider = {
      async refineDecisions(): Promise<GeneratedDecision[]> {
        return [] as unknown as GeneratedDecision[]; // wrong length -> fails validation
      },
    };
    const result = await generateDecisions(context, provider);
    expect(result.decisions.every((d) => d.source === "rule")).toBe(true);
  });

  it("falls back to rule decisions when the AI provider times out", async () => {
    const provider: AIProvider = {
      refineDecisions() {
        return new Promise<GeneratedDecision[]>((resolve) => setTimeout(() => resolve([]), 200));
      },
    };
    const result = await generateDecisions(context, provider, 10);
    expect(result.decisions.every((d) => d.source === "rule")).toBe(true);
    expect(result.engineVersion).toBe("rules-v1");
  });

  it("never returns more or fewer than the original three domains, even when AI reorders", async () => {
    const provider: AIProvider = {
      async refineDecisions(_ctx, candidates) {
        return [...candidates].reverse();
      },
    };
    const original = generateRuleDecisions(context);
    const result = await generateDecisions(context, provider);
    expect(result.decisions).toHaveLength(original.length);
  });
});
