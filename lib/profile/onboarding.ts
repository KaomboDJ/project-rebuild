// Pure helpers for the real (Supabase-backed) onboarding form — Milestone 2.
// Field set and required-ness mirror docs/05_MVP_SPEC.md's `/onboarding`
// route description and the `profiles` table constraints in
// supabase/migrations/202607290001_foundation.sql (time format regex,
// primary_objective check). Kept separate from lib/decision-engine/types.ts
// so this stays importable from client components (no "server-only").

export const PRIMARY_OBJECTIVES = [
  { value: "rebuild-fitness", label: "Reconstruir a forma física" },
  { value: "lose-weight", label: "Perder peso" },
  { value: "train-consistently", label: "Treinar com consistência" },
  { value: "improve-nutrition", label: "Melhorar a nutrição" },
  { value: "improve-sleep", label: "Melhorar o sono" },
] as const;

export type PrimaryObjective = (typeof PRIMARY_OBJECTIVES)[number]["value"];

export const WEEKDAYS = [
  { value: "monday", label: "Segunda" },
  { value: "tuesday", label: "Terça" },
  { value: "wednesday", label: "Quarta" },
  { value: "thursday", label: "Quinta" },
  { value: "friday", label: "Sexta" },
  { value: "saturday", label: "Sábado" },
  { value: "sunday", label: "Domingo" },
] as const;

// Mirrors lib/decision-engine/context-builder.ts's DEFAULT_PROFILE (kept as
// plain literals here, not imported, since that module is server-only).
export const ONBOARDING_DEFAULTS: OnboardingDraft = {
  preferredName: "",
  timezone: "Europe/Lisbon",
  currentIdentity: "",
  desiredIdentity: "",
  primaryObjective: "rebuild-fitness",
  preferredTrainingDays: ["monday", "wednesday", "friday"],
  preferredTrainingTime: "12:00",
  typicalDinnerTime: "20:00",
  targetSleepTime: "23:00",
  targetWakeTime: "07:00",
  weekendSleepTime: "00:00",
  weekendWakeTime: "08:00",
  windDownMinutes: 45,
  sleepScheduleType: "regular",
  workingHoursStart: "09:00",
  workingHoursEnd: "18:00",
  currentConstraints: "",
  interventionTone: "",
};

export interface OnboardingDraft {
  preferredName: string;
  timezone: string;
  currentIdentity: string;
  desiredIdentity: string;
  primaryObjective: string;
  preferredTrainingDays: string[];
  preferredTrainingTime: string;
  typicalDinnerTime: string;
  targetSleepTime: string;
  targetWakeTime: string;
  weekendSleepTime: string;
  weekendWakeTime: string;
  windDownMinutes: number;
  sleepScheduleType: "regular" | "shift";
  /** Persisted as `profiles.working_hours` ({start,end} jsonb) - the Decision
   * Engine (context-builder.ts) has read this since Milestone 1, but until
   * the UX Hardening release (docs/17_UX_AUDIT.md, S1) no form ever exposed
   * it, so every account silently ran on the DB default of 09:00-18:00. */
  workingHoursStart: string;
  workingHoursEnd: string;
  currentConstraints: string;
  interventionTone: string;
}

export interface OnboardingErrors {
  preferredName?: string;
  currentIdentity?: string;
  desiredIdentity?: string;
  primaryObjective?: string;
  preferredTrainingDays?: string;
  preferredTrainingTime?: string;
  typicalDinnerTime?: string;
  targetSleepTime?: string;
  targetWakeTime?: string;
  weekendSleepTime?: string;
  weekendWakeTime?: string;
  windDownMinutes?: string;
  sleepScheduleType?: string;
  workingHoursStart?: string;
  workingHoursEnd?: string;
  currentConstraints?: string;
  interventionTone?: string;
}

const TIME_RE = /^([01][0-9]|2[0-3]):[0-5][0-9]$/;

/** Same shape of checks as the DB constraints, run client-side first so a
 * bad submission never round-trips to Supabase only to be rejected there.
 * Reused as-is by the Settings profile-edit form (components/settings/
 * ProfileEditForm.tsx) - onboarding and editing persist the same fields, so
 * they share one validation function rather than drifting into two. */
export function validateOnboardingDraft(draft: OnboardingDraft): OnboardingErrors {
  const errors: OnboardingErrors = {};

  if (!draft.preferredName.trim()) errors.preferredName = "Obrigatório.";
  if (!draft.currentIdentity.trim()) errors.currentIdentity = "Obrigatório.";
  if (!draft.desiredIdentity.trim()) errors.desiredIdentity = "Obrigatório.";
  if (!PRIMARY_OBJECTIVES.some((objective) => objective.value === draft.primaryObjective)) {
    errors.primaryObjective = "Escolhe um objetivo.";
  }
  if (draft.preferredTrainingDays.length === 0) {
    errors.preferredTrainingDays = "Escolhe pelo menos um dia.";
  }
  if (!TIME_RE.test(draft.preferredTrainingTime)) errors.preferredTrainingTime = "Hora inválida (HH:MM).";
  if (!TIME_RE.test(draft.typicalDinnerTime)) errors.typicalDinnerTime = "Hora inválida (HH:MM).";
  if (!TIME_RE.test(draft.targetSleepTime)) errors.targetSleepTime = "Hora inválida (HH:MM).";
  if (!TIME_RE.test(draft.targetWakeTime)) errors.targetWakeTime = "Hora inválida (HH:MM).";
  if (draft.weekendSleepTime && !TIME_RE.test(draft.weekendSleepTime)) {
    errors.weekendSleepTime = "Hora inválida (HH:MM).";
  }
  if (draft.weekendWakeTime && !TIME_RE.test(draft.weekendWakeTime)) {
    errors.weekendWakeTime = "Hora inválida (HH:MM).";
  }
  if (!Number.isInteger(draft.windDownMinutes) || draft.windDownMinutes < 15 || draft.windDownMinutes > 120) {
    errors.windDownMinutes = "Escolhe entre 15 e 120 minutos.";
  }
  if (draft.sleepScheduleType !== "regular" && draft.sleepScheduleType !== "shift") {
    errors.sleepScheduleType = "Escolhe um tipo de horário.";
  }
  if (!TIME_RE.test(draft.workingHoursStart)) errors.workingHoursStart = "Hora inválida (HH:MM).";
  if (!TIME_RE.test(draft.workingHoursEnd)) errors.workingHoursEnd = "Hora inválida (HH:MM).";
  if (
    TIME_RE.test(draft.workingHoursStart) &&
    TIME_RE.test(draft.workingHoursEnd) &&
    draft.workingHoursEnd <= draft.workingHoursStart
  ) {
    errors.workingHoursEnd = "Tem de ser depois da hora de início.";
  }
  if (!draft.currentConstraints.trim()) errors.currentConstraints = "Obrigatório.";
  if (!draft.interventionTone.trim()) errors.interventionTone = "Obrigatório.";

  return errors;
}

export function isOnboardingValid(draft: OnboardingDraft): boolean {
  return Object.keys(validateOnboardingDraft(draft)).length === 0;
}
