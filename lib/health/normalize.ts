import type { HealthMetric, IncomingHealthObservation, NormalizedHealthObservation } from "./types";

const CANONICAL_UNIT: Record<HealthMetric, string> = {
  height_cm: "cm",
  weight_kg: "kg",
  body_fat_percent: "%",
  visceral_fat_index: "index",
  steps_count: "count",
  sleep_minutes: "min",
  resting_heart_rate_bpm: "bpm",
  hrv_ms: "ms",
  workout_minutes: "min",
  spo2_percent: "%",
};

const RANGE: Record<HealthMetric, [number, number]> = {
  height_cm: [80, 250],
  weight_kg: [20, 400],
  body_fat_percent: [2, 75],
  visceral_fat_index: [0, 100],
  steps_count: [0, 200_000],
  sleep_minutes: [0, 1_440],
  resting_heart_rate_bpm: [20, 250],
  hrv_ms: [0, 1_000],
  workout_minutes: [0, 1_440],
  spo2_percent: [50, 100],
};

function convert(metric: HealthMetric, value: number, unit: string): number {
  const normalizedUnit = unit.trim().toLowerCase();
  if (metric === "weight_kg" && ["lb", "lbs", "pound", "pounds"].includes(normalizedUnit)) return value * 0.45359237;
  if (metric === "height_cm" && ["m", "meter", "metre"].includes(normalizedUnit)) return value * 100;
  if (metric === "height_cm" && ["in", "inch", "inches"].includes(normalizedUnit)) return value * 2.54;
  if ((metric === "sleep_minutes" || metric === "workout_minutes") && ["h", "hr", "hour", "hours"].includes(normalizedUnit)) return value * 60;
  if ((metric === "sleep_minutes" || metric === "workout_minutes") && ["s", "sec", "second", "seconds"].includes(normalizedUnit)) return value / 60;
  if (normalizedUnit !== CANONICAL_UNIT[metric].toLowerCase()) {
    throw new Error(`unsupported-unit:${metric}:${unit}`);
  }
  return value;
}

export function normalizeHealthObservation(input: IncomingHealthObservation): NormalizedHealthObservation {
  if (!Number.isFinite(input.value)) throw new Error("invalid-value");
  if (!input.externalRecordId.trim()) throw new Error("missing-external-record-id");
  if (Number.isNaN(Date.parse(input.recordedAt))) throw new Error("invalid-recorded-at");

  const converted = convert(input.metric, input.value, input.unit);
  const [min, max] = RANGE[input.metric];
  if (converted < min || converted > max) throw new Error(`implausible-value:${input.metric}`);

  const decimals = input.metric === "steps_count" ? 0 : 2;
  return {
    ...input,
    value: Number(converted.toFixed(decimals)),
    unit: CANONICAL_UNIT[input.metric],
    externalRecordId: input.externalRecordId.trim(),
  };
}

export function deriveBmi(weightKg: number, heightCm: number): number | null {
  if (weightKg <= 0 || heightCm <= 0) return null;
  const heightM = heightCm / 100;
  const bmi = weightKg / (heightM * heightM);
  return Number.isFinite(bmi) ? Number(bmi.toFixed(1)) : null;
}

