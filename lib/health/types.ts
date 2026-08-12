export const HEALTH_METRICS = [
  "height_cm",
  "weight_kg",
  "body_fat_percent",
  "visceral_fat_index",
  "steps_count",
  "sleep_minutes",
  "resting_heart_rate_bpm",
  "hrv_ms",
  "workout_minutes",
  "spo2_percent",
] as const;

export type HealthMetric = (typeof HEALTH_METRICS)[number];

export const HEALTH_PROVIDERS = [
  "apple_health",
  "health_connect",
  "xiaomi_mi_fitness",
  "xiaomi_home",
  "manual_import",
] as const;

export type HealthProvider = (typeof HEALTH_PROVIDERS)[number];

export interface IncomingHealthObservation {
  metric: HealthMetric;
  value: number;
  unit: string;
  recordedAt: string;
  externalRecordId: string;
  originName?: string;
  deviceName?: string;
  metadata?: Record<string, string | number | boolean | null>;
}

export interface NormalizedHealthObservation extends Omit<IncomingHealthObservation, "unit"> {
  unit: string;
}

export interface HealthSummary {
  latest: Partial<Record<HealthMetric, { value: number; unit: string; recordedAt: string; sourceLabel: string }>>;
  bmi: { value: number; weightRecordedAt: string; heightRecordedAt: string } | null;
  sevenDay: {
    averageSteps: number | null;
    averageSleepMinutes: number | null;
    totalWorkoutMinutes: number | null;
  };
  sourceCount: number;
  lastSyncedAt: string | null;
}

