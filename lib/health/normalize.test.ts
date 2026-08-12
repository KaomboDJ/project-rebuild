import { describe, expect, it } from "vitest";
import { deriveBmi, normalizeHealthObservation } from "./normalize";

describe("normalizeHealthObservation", () => {
  it("normalizes pounds to kilograms", () => {
    const result = normalizeHealthObservation({
      metric: "weight_kg",
      value: 220,
      unit: "lb",
      recordedAt: "2026-08-11T08:00:00Z",
      externalRecordId: "weight-1",
    });
    expect(result.value).toBe(99.79);
    expect(result.unit).toBe("kg");
  });

  it("rejects implausible readings before persistence", () => {
    expect(() => normalizeHealthObservation({
      metric: "spo2_percent",
      value: 140,
      unit: "%",
      recordedAt: "2026-08-11T08:00:00Z",
      externalRecordId: "spo2-1",
    })).toThrow("implausible-value:spo2_percent");
  });

  it("rejects unsupported units instead of guessing", () => {
    expect(() => normalizeHealthObservation({
      metric: "weight_kg",
      value: 100,
      unit: "stone",
      recordedAt: "2026-08-11T08:00:00Z",
      externalRecordId: "weight-2",
    })).toThrow("unsupported-unit");
  });
});

describe("deriveBmi", () => {
  it("derives BMI from canonical weight and height", () => {
    expect(deriveBmi(98, 180)).toBe(30.2);
  });

  it("does not produce a value from missing measurements", () => {
    expect(deriveBmi(98, 0)).toBeNull();
  });
});

