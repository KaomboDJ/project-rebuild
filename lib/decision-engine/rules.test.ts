import { describe, expect, it } from "vitest";
import { baseContext } from "./fixtures";
import {
  avoidTakeawayCommitment,
  decideDinnerEarly,
  defrostIngredients,
  earlierSleepForTomorrow,
  generateCandidates,
  lunchTraining,
  mobilityInsteadOfCancellation,
  moveLowPriorityWork,
  prepareNextDay,
  prepareTomorrowsLunch,
  prepareTrainingEquipment,
  protectFreeWindow,
  reducedTraining,
  shortWalk,
  shutdownRoutine,
} from "./rules";

describe("lunchTraining", () => {
  it("fires on a preferred training day with no adverse check-in", () => {
    const candidates = lunchTraining(baseContext());
    expect(candidates).toHaveLength(1);
    expect(candidates[0].domain).toBe("training");
    expect(candidates[0].baseImpact).toBe("high");
  });

  it("never fires on a non-training day", () => {
    const candidates = lunchTraining(baseContext({ date: "2026-07-30" })); // Thursday
    expect(candidates).toHaveLength(0);
  });

  it("does not fire when a physical limitation was reported", () => {
    const candidates = lunchTraining(
      baseContext({ userCheckIn: { physicalLimitation: "joelho" } })
    );
    expect(candidates).toHaveLength(0);
  });

  it("does not fire after poor sleep (reducedTraining takes over instead)", () => {
    const candidates = lunchTraining(baseContext({ userCheckIn: { sleepQuality: 1 } }));
    expect(candidates).toHaveLength(0);
  });

  it("respects a confirmed calendar conflict at lunchtime", () => {
    const context = baseContext({
      calendarEvents: [
        { id: "e1", title: "Cliente", start: "2026-07-29T11:00:00", end: "2026-07-29T14:00:00", isAllDay: false },
      ],
      freeWindows: [], // computeFreeWindows would produce no lunch window here
    });
    expect(lunchTraining(context)).toHaveLength(0);
  });
});

describe("reducedTraining", () => {
  it("fires after poor sleep", () => {
    const candidates = reducedTraining(baseContext({ userCheckIn: { sleepQuality: 2 } }));
    expect(candidates).toHaveLength(1);
    expect(candidates[0].baseImpact).toBe("medium");
  });

  it("fires after low energy", () => {
    expect(reducedTraining(baseContext({ userCheckIn: { energyLevel: 1 } }))).toHaveLength(1);
  });

  it("does not fire on a normal check-in", () => {
    expect(reducedTraining(baseContext({ userCheckIn: { sleepQuality: 4, energyLevel: 4 } }))).toHaveLength(0);
  });

  it("does not fire when a physical limitation is reported (mobility rule takes over)", () => {
    expect(
      reducedTraining(baseContext({ userCheckIn: { sleepQuality: 1, physicalLimitation: "costas" } }))
    ).toHaveLength(0);
  });
});

describe("mobilityInsteadOfCancellation", () => {
  it("fires only when a physical limitation is reported", () => {
    expect(mobilityInsteadOfCancellation(baseContext())).toHaveLength(0);
    expect(
      mobilityInsteadOfCancellation(baseContext({ userCheckIn: { physicalLimitation: "joelho" } }))
    ).toHaveLength(1);
  });
});

describe("prepareTrainingEquipment", () => {
  it("fires ahead of today's training window", () => {
    const candidates = prepareTrainingEquipment(baseContext({ now: "2026-07-29T10:00:00" }));
    expect(candidates).toHaveLength(1);
  });

  it("does not fire once the training time has passed", () => {
    expect(prepareTrainingEquipment(baseContext({ now: "2026-07-29T13:00:00" }))).toHaveLength(0);
  });

  it("does not fire too far ahead of the training time", () => {
    expect(prepareTrainingEquipment(baseContext({ now: "2026-07-29T06:00:00" }))).toHaveLength(0);
  });
});

describe("decideDinnerEarly", () => {
  it("fires 1-4 hours before typical dinner time", () => {
    expect(decideDinnerEarly(baseContext({ now: "2026-07-29T17:30:00" }))).toHaveLength(1);
  });

  it("does not fire right after dinner time", () => {
    expect(decideDinnerEarly(baseContext({ now: "2026-07-29T20:30:00" }))).toHaveLength(0);
  });

  it("does not fire far from dinner time", () => {
    expect(decideDinnerEarly(baseContext({ now: "2026-07-29T09:00:00" }))).toHaveLength(0);
  });

  it("uses the generic prompt when there is no pantry data (Milestone 11C)", () => {
    const [candidate] = decideDinnerEarly(baseContext({ now: "2026-07-29T17:30:00" }));
    expect(candidate.recommendedAction).toBe("Decide o jantar agora, antes da janela de fadiga da noite.");
  });

  it("leaves relatedPantryItem unset when there is no pantry data (Milestone 11D)", () => {
    const [candidate] = decideDinnerEarly(baseContext({ now: "2026-07-29T17:30:00" }));
    expect(candidate.relatedPantryItem).toBeUndefined();
  });

  it("names the soonest-expiring pantry item when pantry data exists (Milestone 11C)", () => {
    const [candidate] = decideDinnerEarly(
      baseContext({
        now: "2026-07-29T17:30:00",
        pantryItems: [
          { name: "Frango", quantity: 2, unit: "un", portable: true, expiresOn: "2026-07-30" },
          { name: "Arroz", quantity: 1, unit: "kg", portable: true, expiresOn: null },
        ],
      })
    );
    expect(candidate.recommendedAction).toBe(
      "Janta Frango, que já tens em casa. Decide agora, antes da janela de fadiga da noite."
    );
  });

  it("sets relatedPantryItem to the named item's exact pantry name (Milestone 11D)", () => {
    const [candidate] = decideDinnerEarly(
      baseContext({
        now: "2026-07-29T17:30:00",
        pantryItems: [{ name: "Frango", quantity: 2, unit: "un", portable: true, expiresOn: "2026-07-30" }],
      })
    );
    expect(candidate.relatedPantryItem).toBe("Frango");
  });

  it("prefers today's meal-plan dinner over the pantry pick when both exist (Milestone 12)", () => {
    const [candidate] = decideDinnerEarly(
      baseContext({
        now: "2026-07-29T17:30:00",
        pantryItems: [{ name: "Frango", quantity: 2, unit: "un", portable: true, expiresOn: "2026-07-30" }],
        todaysDinnerPlanName: "Salmão grelhado com espargos",
      })
    );
    expect(candidate.recommendedAction).toContain("Salmão grelhado com espargos");
    expect(candidate.recommendedAction).toContain("plano");
  });

  it("leaves relatedPantryItem unset when the dinner comes from the meal plan, not the pantry (Milestone 12)", () => {
    const [candidate] = decideDinnerEarly(
      baseContext({
        now: "2026-07-29T17:30:00",
        pantryItems: [{ name: "Frango", quantity: 2, unit: "un", portable: true, expiresOn: "2026-07-30" }],
        todaysDinnerPlanName: "Salmão grelhado com espargos",
      })
    );
    expect(candidate.relatedPantryItem).toBeUndefined();
  });
});

describe("defrostIngredients", () => {
  it("requires both lead time and an afternoon free window", () => {
    expect(defrostIngredients(baseContext({ now: "2026-07-29T14:00:00" }))).toHaveLength(0); // no free window
    const withWindow = defrostIngredients(
      baseContext({
        now: "2026-07-29T14:00:00",
        freeWindows: [{ start: "2026-07-29T14:00:00", end: "2026-07-29T14:30:00", durationMinutes: 30 }],
      })
    );
    expect(withWindow).toHaveLength(1);
  });
});

describe("prepareTomorrowsLunch", () => {
  it("does not fire without evidence tomorrow is dense", () => {
    expect(prepareTomorrowsLunch(baseContext())).toHaveLength(0);
  });

  it("fires when tomorrow already has multiple events", () => {
    const context = baseContext({
      calendarEvents: [
        { id: "t1", title: "A", start: "2026-07-30T09:00:00", end: "2026-07-30T10:00:00", isAllDay: false },
        { id: "t2", title: "B", start: "2026-07-30T11:00:00", end: "2026-07-30T12:00:00", isAllDay: false },
      ],
    });
    expect(prepareTomorrowsLunch(context)).toHaveLength(1);
  });
});

describe("avoidTakeawayCommitment", () => {
  it("requires both the evening and a repeated recent skip pattern", () => {
    expect(avoidTakeawayCommitment(baseContext({ now: "2026-07-29T18:00:00" }))).toHaveLength(0);

    const withPattern = avoidTakeawayCommitment(
      baseContext({
        now: "2026-07-29T18:00:00",
        recentDecisions: [
          { date: "2026-07-27", domain: "nutrition", status: "skipped" },
          { date: "2026-07-28", domain: "nutrition", status: "skipped" },
        ],
      })
    );
    expect(withPattern).toHaveLength(1);
  });

  it("names the soonest-expiring pantry item when pantry data exists (Milestone 11C)", () => {
    const [candidate] = avoidTakeawayCommitment(
      baseContext({
        now: "2026-07-29T18:00:00",
        recentDecisions: [
          { date: "2026-07-27", domain: "nutrition", status: "skipped" },
          { date: "2026-07-28", domain: "nutrition", status: "skipped" },
        ],
        pantryItems: [{ name: "Peixe", quantity: 1, unit: "un", portable: true, expiresOn: "2026-07-29" }],
      })
    );
    expect(candidate.recommendedAction).toBe(
      "Compromete-te já com Peixe, que já tens em casa, antes de abrires uma app de entregas."
    );
  });

  it("sets relatedPantryItem to the named item's exact pantry name (Milestone 11D)", () => {
    const [candidate] = avoidTakeawayCommitment(
      baseContext({
        now: "2026-07-29T18:00:00",
        recentDecisions: [
          { date: "2026-07-27", domain: "nutrition", status: "skipped" },
          { date: "2026-07-28", domain: "nutrition", status: "skipped" },
        ],
        pantryItems: [{ name: "Peixe", quantity: 1, unit: "un", portable: true, expiresOn: "2026-07-29" }],
      })
    );
    expect(candidate.relatedPantryItem).toBe("Peixe");
  });

  it("names today's meal-plan dinner in preference to the pantry pick (Milestone 12)", () => {
    const [candidate] = avoidTakeawayCommitment(
      baseContext({
        now: "2026-07-29T18:00:00",
        recentDecisions: [
          { date: "2026-07-27", domain: "nutrition", status: "skipped" },
          { date: "2026-07-28", domain: "nutrition", status: "skipped" },
        ],
        pantryItems: [{ name: "Peixe", quantity: 1, unit: "un", portable: true, expiresOn: "2026-07-29" }],
        todaysDinnerPlanName: "Frango estufado com batata-doce",
      })
    );
    expect(candidate.recommendedAction).toContain("Frango estufado com batata-doce");
    expect(candidate.relatedPantryItem).toBeUndefined();
  });
});

describe("shutdownRoutine", () => {
  it("fires within 2 hours of target sleep time", () => {
    expect(shutdownRoutine(baseContext({ now: "2026-07-29T21:45:00" }))).toHaveLength(1);
  });

  it("does not fire far from sleep time", () => {
    expect(shutdownRoutine(baseContext({ now: "2026-07-29T09:00:00" }))).toHaveLength(0);
  });
});

describe("earlierSleepForTomorrow", () => {
  it("fires after a poor-sleep check-in", () => {
    expect(earlierSleepForTomorrow(baseContext({ userCheckIn: { sleepQuality: 1 } }))).toHaveLength(1);
  });

  it("does not fire otherwise", () => {
    expect(earlierSleepForTomorrow(baseContext({ userCheckIn: { sleepQuality: 4 } }))).toHaveLength(0);
  });
});

describe("prepareNextDay", () => {
  it("fires when tomorrow starts early", () => {
    const context = baseContext({
      calendarEvents: [
        { id: "e1", title: "Voo", start: "2026-07-30T06:30:00", end: "2026-07-30T08:00:00", isAllDay: false },
      ],
    });
    expect(prepareNextDay(context)).toHaveLength(1);
  });

  it("does not fire without an early event tomorrow", () => {
    expect(prepareNextDay(baseContext())).toHaveLength(0);
  });
});

describe("shortWalk", () => {
  it("fires under high stress", () => {
    expect(shortWalk(baseContext({ userCheckIn: { stressLevel: 4 } }))).toHaveLength(1);
  });

  it("does not fire under normal stress", () => {
    expect(shortWalk(baseContext({ userCheckIn: { stressLevel: 2 } }))).toHaveLength(0);
  });
});

describe("protectFreeWindow", () => {
  it("fires when exactly one meaningful window remains", () => {
    const context = baseContext({
      freeWindows: [{ start: "2026-07-29T15:00:00", end: "2026-07-29T15:45:00", durationMinutes: 45 }],
    });
    expect(protectFreeWindow(context)).toHaveLength(1);
  });

  it("does not fire with zero or multiple windows", () => {
    expect(protectFreeWindow(baseContext())).toHaveLength(0);
  });
});

describe("moveLowPriorityWork", () => {
  it("fires on an overloaded calendar with no meaningful free window", () => {
    const events = Array.from({ length: 5 }, (_, i) => ({
      id: `e${i}`,
      title: "Reunião",
      start: `2026-07-29T${String(9 + i).padStart(2, "0")}:00:00`,
      end: `2026-07-29T${String(9 + i).padStart(2, "0")}:45:00`,
      isAllDay: false,
    }));
    expect(moveLowPriorityWork(baseContext({ calendarEvents: events }))).toHaveLength(1);
  });

  it("does not fire on a light calendar", () => {
    expect(moveLowPriorityWork(baseContext())).toHaveLength(0);
  });
});

describe("generateCandidates", () => {
  it("never throws and returns an array for an empty context", () => {
    expect(() => generateCandidates(baseContext())).not.toThrow();
    expect(Array.isArray(generateCandidates(baseContext()))).toBe(true);
  });

  it("produces multiple domains on a rich day (training day + check-in signals)", () => {
    const context = baseContext({
      now: "2026-07-29T18:15:00",
      userCheckIn: { sleepQuality: 4, energyLevel: 4, stressLevel: 4 },
    });
    const domains = new Set(generateCandidates(context).map((c) => c.domain));
    expect(domains.size).toBeGreaterThanOrEqual(2);
  });

  it("Milestone 14 — filters out a muted ruleId entirely, before scoring", () => {
    const withoutMute = generateCandidates(baseContext());
    expect(withoutMute.some((c) => c.ruleId === "lunch-training")).toBe(true);

    const withMute = generateCandidates(baseContext({ mutedRuleIds: ["lunch-training"] }));
    expect(withMute.some((c) => c.ruleId === "lunch-training")).toBe(false);
    // Every other candidate that would have fired is unaffected.
    expect(withMute.length).toBe(withoutMute.length - 1);
  });

  it("Milestone 14 — an empty/absent mutedRuleIds behaves exactly like pre-Milestone-14 (deterministic cold start)", () => {
    const withoutField = generateCandidates(baseContext());
    const withEmptyArray = generateCandidates(baseContext({ mutedRuleIds: [] }));
    expect(withEmptyArray.map((c) => c.ruleId)).toEqual(withoutField.map((c) => c.ruleId));
  });
});
