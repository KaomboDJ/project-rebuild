import { describe, expect, it } from "vitest";
import { healthObservationSchema } from "./import-schema";

const valid = {
  metric: "weight_kg" as const,
  value: 98.4,
  unit: "kg",
  recordedAt: new Date().toISOString(),
  externalRecordId: "record-1",
};

describe("health import boundary", () => {
  it("accepts a minimal attributable observation", () => {
    expect(healthObservationSchema.safeParse(valid).success).toBe(true);
  });

  it("rejects observations too far in the future", () => {
    expect(
      healthObservationSchema.safeParse({ ...valid, recordedAt: new Date(Date.now() + 6 * 60_000).toISOString() }).success
    ).toBe(false);
  });

  it("bounds unstructured metadata", () => {
    const metadata = Object.fromEntries(Array.from({ length: 21 }, (_, index) => [`k${index}`, index]));
    expect(healthObservationSchema.safeParse({ ...valid, metadata }).success).toBe(false);
  });
});

