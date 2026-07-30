"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { Database } from "@/lib/supabase/database.types";
import {
  ONBOARDING_DEFAULTS,
  PRIMARY_OBJECTIVES,
  WEEKDAYS,
  type OnboardingDraft,
  validateOnboardingDraft,
} from "@/lib/profile/onboarding";

type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];

function draftFromProfile(profile: ProfileRow | null): OnboardingDraft {
  if (!profile) return ONBOARDING_DEFAULTS;
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
    currentConstraints: profile.current_constraints,
    interventionTone: profile.intervention_tone,
  };
}

export function OnboardingForm({ initialProfile }: { initialProfile: ProfileRow | null }) {
  const router = useRouter();
  const [draft, setDraft] = useState<OnboardingDraft>(() => draftFromProfile(initialProfile));
  const [showErrors, setShowErrors] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const errors = validateOnboardingDraft(draft);

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

    setSubmitting(true);
    setSubmitError(null);

    const supabase = createSupabaseBrowserClient();
    if (!supabase) {
      setSubmitError("Supabase não está configurado.");
      setSubmitting(false);
      return;
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setSubmitError("Sessão expirada. Inicia sessão novamente.");
      setSubmitting(false);
      return;
    }

    const { error } = await supabase.from("profiles").upsert(
      {
        user_id: user.id,
        preferred_name: draft.preferredName.trim(),
        timezone: draft.timezone,
        current_identity: draft.currentIdentity.trim(),
        desired_identity: draft.desiredIdentity.trim(),
        primary_objective: draft.primaryObjective as ProfileRow["primary_objective"],
        preferred_training_days: draft.preferredTrainingDays,
        preferred_training_time: draft.preferredTrainingTime,
        typical_dinner_time: draft.typicalDinnerTime,
        target_sleep_time: draft.targetSleepTime,
        current_constraints: draft.currentConstraints.trim(),
        intervention_tone: draft.interventionTone.trim(),
        onboarding_completed: true,
      },
      { onConflict: "user_id" }
    );

    if (error) {
      setSubmitError("Não foi possível guardar o perfil. Tenta novamente.");
      setSubmitting(false);
      return;
    }

    router.replace("/today");
    router.refresh();
  }

  return (
    <form className="surface-card space-y-5 p-5" onSubmit={handleSubmit}>
      <label className="block text-sm">
        Como te devemos chamar? <span className="text-rose-500">*</span>
        <input
          className="field-input mt-1"
          placeholder="Marco"
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
          placeholder="Ex.: ex-atleta, rotina interrompida, sono irregular"
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
          placeholder="Ex.: atleta em reconstrução"
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

      <label className="block text-sm">
        Que responsabilidades e limites moldam a tua vida? <span className="text-rose-500">*</span>
        <textarea
          className="field-input mt-1"
          placeholder="Trabalho, família, sono..."
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
          placeholder="Ex.: direto, sem lição de moral"
          value={draft.interventionTone}
          onChange={(event) => setDraft({ ...draft, interventionTone: event.target.value })}
        />
        {showErrors && errors.interventionTone && (
          <span className="mt-1 block text-xs text-rose-500">{errors.interventionTone}</span>
        )}
      </label>

      {submitError && <p className="text-sm text-red-400">{submitError}</p>}

      <button type="submit" disabled={submitting} className="btn-primary w-full py-2.5">
        {submitting ? "A guardar..." : "Começar"}
      </button>
    </form>
  );
}
