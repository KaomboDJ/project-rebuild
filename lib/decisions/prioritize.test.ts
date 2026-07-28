import { describe, expect, it } from "vitest";
import { buildDecisionInstances, deriveOperatingState, prioritizeDecisions } from "./prioritize";

describe("deriveOperatingState", () => {
  it("returns recovery when the day type is recovery", () => {
    const state = deriveOperatingState({ date: "2026-07-28", sleepHours: 7, energy: 5, stress: 1, dayType: "recovery" });
    expect(state).toBe("recovery");
  });

  it("returns survival after poor sleep", () => {
    const state = deriveOperatingState({ date: "2026-07-28", sleepHours: 4, energy: 3, stress: 2, dayType: "remote" });
    expect(state).toBe("survival");
  });

  it("returns performer with good sleep, energy, and low stress", () => {
    const state = deriveOperatingState({ date: "2026-07-28", sleepHours: 7, energy: 5, stress: 1, dayType: "remote" });
    expect(state).toBe("performer");
  });

  it("defaults to consistent otherwise", () => {
    const state = deriveOperatingState({ date: "2026-07-28", sleepHours: 6, energy: 3, stress: 3, dayType: "remote" });
    expect(state).toBe("consistent");
  });
});

describe("prioritizeDecisions", () => {
  it("returns at most three decisions", () => {
    expect(prioritizeDecisions("remote", "consistent").length).toBeLessThanOrEqual(3);
  });

  it("includes lunchtime training on a remote performer day", () => {
    const ids = prioritizeDecisions("remote", "performer").map((decision) => decision.id);
    expect(ids).toContain("lunchtime-training");
  });

  it("never includes lunchtime training on an office day", () => {
    const ids = prioritizeDecisions("office", "performer").map((decision) => decision.id);
    expect(ids).not.toContain("lunchtime-training");
  });

  it("never includes lunchtime training on a weekend", () => {
    const ids = prioritizeDecisions("weekend", "performer").map((decision) => decision.id);
    expect(ids).not.toContain("lunchtime-training");
  });

  it("never includes lunchtime training on a recovery day", () => {
    const ids = prioritizeDecisions("remote", "recovery").map((decision) => decision.id);
    expect(ids).not.toContain("lunchtime-training");
  });

  it("still includes lunchtime training (reduced later) on a remote survival day", () => {
    const ids = prioritizeDecisions("remote", "survival").map((decision) => decision.id);
    expect(ids).toContain("lunchtime-training");
  });

  it("always leads with the dinner decision", () => {
    const [first] = prioritizeDecisions("remote", "performer");
    expect(first.id).toBe("decide-dinner");
  });
});

describe("buildDecisionInstances", () => {
  it("shows the reduced action directly in survival, not the full session", () => {
    const instances = buildDecisionInstances("remote", "survival", "2026-07-28");
    const training = instances.find((instance) => instance.id === "lunchtime-training");
    expect(training?.title).toBe("Caminhada ou mobilidade de 15-20 min");
    expect(training?.fallback).toBeUndefined();
  });

  it("keeps the full session title outside survival", () => {
    const instances = buildDecisionInstances("remote", "performer", "2026-07-28");
    const training = instances.find((instance) => instance.id === "lunchtime-training");
    expect(training?.title).toBe("Treino de 30 min a meio do dia");
  });

  it("omits training entirely on an office day even in survival", () => {
    const instances = buildDecisionInstances("office", "survival", "2026-07-28");
    expect(instances.some((instance) => instance.id === "lunchtime-training")).toBe(false);
  });

  it("stamps every instance with pending status and the given date", () => {
    const instances = buildDecisionInstances("remote", "consistent", "2026-07-28");
    expect(instances.every((instance) => instance.status === "pending" && instance.date === "2026-07-28")).toBe(true);
  });
});
