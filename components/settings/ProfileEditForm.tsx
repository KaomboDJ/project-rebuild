"use client";

// UX Hardening release (docs/17_UX_AUDIT.md, S1 - confirmed P1). Before this,
// the onboarding answers (identity, objective, tone, schedule) were
// permanently write-once: there was no way to correct a typo, update a
// stale objective, or adjust training/dinner/sleep/working-hours times
// without engineering help. This form is the fix - same fields, same
// validation (lib/profile/onboarding.ts, shared with OnboardingForm so the
// two never drift), against PUT /api/profile instead of onboarding's
// insert-shaped upsert.

import { useState } from "react";
import type { Database } from "@/lib/supabase/database.types";
import {
  ONBOARDING_DEFAULTS,
  PRIMARY_OBJECTIVES,
  WEEKDAYS,
  type OnboardingDraft,
  validateOnboardingDraft,
} from "@/lib/profile/onboarding";

type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];

function workingHoursFromRow(value: ProfileRow["working_hours"]): { start: string; end: string } {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const record = value as { start?: unknown; end?: unknown };
    return {
      start: typeof record.start === "string" ? record.start : ONBOARDING_DEFAULTS.workingHoursStart,
      end: typeof record.end === "string" ? record.end : ONBOARDING_DEFAULTS.workingHoursEnd,
    };
  }
  return { start: ONBOARDING_DEFAULTS.workingHoursStart, end: ONBOARDING_DEFAULTS.workingHoursEnd };
}

function draftFromProfile(profile: ProfileRow): OnboardingDraft {
  const workingHours = workingHoursFromRow(profile.working_hours);
  return {
    preferredName: profile.preferred_name,
    timezone: profile.timezone,
    currentIdentity: profile.current_identity,
    desiredIdentity: profile.desired_identity,
    primaryObjective: profile.primary_objective,
    preferredTrainingDays:
      profile.preferred_training_days.length > 0
        ? profile.preferred_training_days
        : ONBOARDING_DEFAULTS.preferredTrainingDays,
    preferredTrainingTime: profile.preferred_training_time,
    typicalDinnerTime: profile.typical_dinner_time,
    targetSleepTime: profile.target_sleep_time,
    workingHoursStart: workingHours.start,
    workingHoursEnd: workingHours.end,
    currentConstraints: profile.current_constraints,
    interventionTone: profile.intervention_tone,
  };
}

type SaveState = "idle" | "saving" | "saved" | "error";

export function ProfileEditForm({ initialProfile }: { initialProfile: ProfileRow }) {
  const [initialDraft, setInitialDraft] = useState<OnboardingDraft>(() => draftFromProfile(initialProfile));
  const [draft, setDraft] = useState<OnboardingDraft>(initialDraft);
  const [showErrors, setShowErrors] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const errors = validateOnboardingDraft(draft);
  const isDirty = JSON.stringify(draft) !== JSON.stringify(initialDraft);

  function toggleDay(day: string) {
    setDraft((current) => ({
      ...current,
      preferredTrainingDays: current.preferredTrainingDays.includes(day)
        ? current.preferredTrainingDays.filter((d) => d !== day)
        : [...current.preferredTrainingDays, day],
    }));
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (Object.keys(errors).length > 0) {
      setShowErrors(true);
      return;
    }

    setSaveState("saving");
    setErrorMessage(null);

    try {
      const response = await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        setErrorMessage(
          body.error === "invalid-working-hours"
            ? "O fim do horário de trabalho tem de ser depois do início."
            : "Não foi possível guardar as alterações. Tenta novamente."
        );
        setSaveState("error");
        return;
      }

      // Every field that didn't change is simply carried through unmodified
      // in `draft` (this form always initializes from the persisted row and
      // only ever mutates state via its own inputs) - the PUT above writes
      // the full draft back, so unchanged fields round-trip untouched.
      setInitialDraft(draft);
      setSaveState("saved");
    } catch {
      setErrorMessage("Não foi possível guardar as alterações. Tenta novamente.");
      setSaveState("error");
    }
  }

  return (
    <form className="space-y-5" onSubmit={handleSubmit}>
      <label className="block text-sm">
        Como te devemos chamar? <span className="text-rose-500">*</span>
        <input
          className="field-input mt-1"
          value={draft.preferredName}
          onChange={(event) => setDraft({ ...draft, preferredName: event.target.value })}
        />
        {showErrors && errors.preferredName && (
          <span className="mt-1 block text-xs text-rose-500">{errors.preferredName}</span>
        )}
      </label>

      <label className="block text-sm">
        Quem és hoje? <span className="text-rose-500">*</span>
        <textarea
          className="field-input mt-1"
          rows={2}
          value={draft.currentIdentity}
          onChange={(event) => setDraft({ ...draft, currentIdentity: event.target.value })}
        />
        {showErrors && errors.currentIdentity && (
          <span className="mt-1 block text-xs text-rose-500">{errors.currentIdentity}</span>
        )}
      </label>

      <label className="block text-sm">
        Quem queres voltar a ser? <span className="text-rose-500">*</span>
        <textarea
          className="field-input mt-1"
          rows={2}
          value={draft.desiredIdentity}
          onChange={(event) => setDraft({ ...draft, desiredIdentity: event.target.value })}
        />
        {showErrors && errors.desiredIdentity && (
          <span className="mt-1 block text-xs text-rose-500">{errors.desiredIdentity}</span>
        )}
      </label>

      <label className="block text-sm">
        Objetivo principal <span className="text-rose-500">*</span>
        <select
          className="field-input mt-1"
          value={draft.primaryObjective}
          onChange={(event) => setDraft({ ...draft, primaryObjective: event.target.value })}
        >
          {PRIMARY_OBJECTIVES.map((objective) => (
            <option key={objective.value} value={objective.value}>
              {objective.label}
            </option>
          ))}
        </select>
      </label>

      <label className="block text-sm">
        Fuso horário
        <input
          className="field-input mt-1"
          value={draft.timezone}
          onChange={(event) => setDraft({ ...draft, timezone: event.target.value })}
        />
      </label>

      <fieldset className="text-sm">
        <legend>
          Dias preferidos para treinar <span className="text-rose-500">*</span>
        </legend>
        <div className="mt-1 flex flex-wrap gap-2">
          {WEEKDAYS.map((day) => {
            const checked = draft.preferredTrainingDays.includes(day.value);
            return (
              <button
                key={day.value}
                type="button"
                onClick={() => toggleDay(day.value)}
                className={`chip ${checked ? "chip-active" : "chip-inactive"}`}
              >
                {day.label}
              </button>
            );
          })}
        </div>
        {showErrors && errors.preferredTrainingDays && (
          <span className="mt-1 block text-xs text-rose-500">{errors.preferredTrainingDays}</span>
        )}
      </fieldset>

      <div className="grid grid-cols-3 gap-3">
        <label className="block text-sm">
          Hora de treino
          <input
            type="time"
            className="field-input mt-1"
            value={draft.preferredTrainingTime}
            onChange={(event) => setDraft({ ...draft, preferredTrainingTime: event.target.value })}
          />
        </label>
        <label className="block text-sm">
          Hora do jantar
          <input
            type="time"
            className="field-input mt-1"
            value={draft.typicalDinnerTime}
            onChange={(event) => setDraft({ ...draft, typicalDinnerTime: event.target.value })}
          />
        </label>
        <label className="block text-sm">
          Hora de dormir
          <input
            type="time"
            className="field-input mt-1"
            value={draft.targetSleepTime}
            onChange={(event) => setDraft({ ...draft, targetSleepTime: event.target.value })}
          />
        </label>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <label className="block text-sm">
          Início do horário de trabalho
          <input
            type="time"
            className="field-input mt-1"
            value={draft.workingHoursStart}
            onChange={(event) => setDraft({ ...draft, workingHoursStart: event.target.value })}
          />
          {showErrors && errors.workingHoursStart && (
            <span className="mt-1 block text-xs text-rose-500">{errors.workingHoursStart}</span>
          )}
        </label>
        <label className="block text-sm">
          Fim do horário de trabalho
          <input
            type="time"
            className="field-input mt-1"
            value={draft.workingHoursEnd}
            onChange={(event) => setDraft({ ...draft, workingHoursEnd: event.target.value })}
          />
          {showErrors && errors.workingHoursEnd && (
            <span className="mt-1 block text-xs text-rose-500">{errors.workingHoursEnd}</span>
          )}
        </label>
      </div>

      <label className="block text-sm">
        Que responsabilidades e limites moldam a tua vida? <span className="text-rose-500">*</span>
        <textarea
          className="field-input mt-1"
          rows={2}
          value={draft.currentConstraints}
          onChange={(event) => setDraft({ ...draft, currentConstraints: event.target.value })}
        />
        {showErrors && errors.currentConstraints && (
          <span className="mt-1 block text-xs text-rose-500">{errors.currentConstraints}</span>
        )}
      </label>

      <label className="block text-sm">
        Que tom de comunicação funciona contigo? <span className="text-rose-500">*</span>
        <input
          className="field-input mt-1"
          value={draft.interventionTone}
          onChange={(event) => setDraft({ ...draft, interventionTone: event.target.value })}
        />
        {showErrors && errors.interventionTone && (
          <span className="mt-1 block text-xs text-rose-500">{errors.interventionTone}</span>
        )}
      </label>

      <div className="flex items-center gap-3 pt-1">
        <button
          type="submit"
          disabled={saveState === "saving" || !isDirty}
          className="btn-primary px-5 py-2.5"
        >
          {saveState === "saving" ? "A guardar..." : "Guardar alterações"}
        </button>
        <span aria-live="polite" className="text-sm">
          {saveState === "saved" && !isDirty && <span className="text-emerald-400">Alterações guardadas.</span>}
          {saveState === "error" && errorMessage && <span className="text-rose-400">{errorMessage}</span>}
          {saveState !== "error" && saveState !== "saved" && !isDirty && (
            <span className="text-neutral-500">Sem alterações por guardar.</span>
          )}
        </span>
      </div>
    </form>
  );
}
