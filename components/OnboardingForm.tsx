"use client";

import { useState } from "react";
import type { OnboardingProfile } from "@/lib/decisions/types";

export type OnboardingDraft = Omit<OnboardingProfile, "completedAt">;

const FIELDS: { key: keyof OnboardingDraft; label: string; placeholder: string }[] = [
  { key: "bestSelf", label: "Quem eras no teu melhor?", placeholder: "Ex.: competidor de BJJ, ativo, confiante" },
  { key: "currentSelf", label: "Quem és hoje?", placeholder: "Ex.: pai, profissional ocupado, sono interrompido" },
  { key: "wantToBecome", label: "Quem queres voltar a ser?", placeholder: "Ex.: atleta em reconstrução" },
  { key: "constraints", label: "Que responsabilidades e limites moldam a tua vida?", placeholder: "Trabalho, família, sono..." },
  { key: "derailingDecisions", label: "Que decisões mais te desviam?", placeholder: "Ex.: Uber Eats à noite, cancelar treino" },
  { key: "tonePreference", label: "Que tom de comunicação funciona contigo?", placeholder: "Ex.: direto, sem lição de moral" },
];

const EMPTY_DRAFT: OnboardingDraft = {
  bestSelf: "",
  currentSelf: "",
  wantToBecome: "",
  constraints: "",
  derailingDecisions: "",
  tonePreference: "",
};

export function OnboardingForm({ onSubmit }: { onSubmit: (draft: OnboardingDraft) => void }) {
  const [draft, setDraft] = useState<OnboardingDraft>(EMPTY_DRAFT);
  const [showErrors, setShowErrors] = useState(false);

  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        const trimmed = Object.fromEntries(
          Object.entries(draft).map(([key, value]) => [key, value.trim()])
        ) as OnboardingDraft;
        const hasEmptyField = Object.values(trimmed).some((value) => value.length === 0);
        if (hasEmptyField) {
          setShowErrors(true);
          return;
        }
        onSubmit(trimmed);
      }}
    >
      {FIELDS.map((field) => {
        const isEmpty = draft[field.key].trim().length === 0;
        return (
          <label key={field.key} className="block text-sm">
            {field.label} <span className="text-rose-500">*</span>
            <textarea
              required
              className="mt-1 w-full rounded-md border border-neutral-700 bg-neutral-900 px-2 py-1.5 text-sm"
              placeholder={field.placeholder}
              value={draft[field.key]}
              onChange={(event) => setDraft({ ...draft, [field.key]: event.target.value })}
              rows={2}
            />
            {showErrors && isEmpty && (
              <span className="mt-1 block text-xs text-rose-500">Este campo é obrigatório.</span>
            )}
          </label>
        );
      })}
      <button
        type="submit"
        className="w-full rounded-md bg-emerald-600 py-2 font-medium text-white hover:bg-emerald-500"
      >
        Começar
      </button>
    </form>
  );
}
