"use client";

// Training Toolkit stage 3 — the training-profile settings form, mirroring
// components/nutrition/NutritionProfileForm.tsx's structure. Saves via PUT
// /api/training/profile so the same Zod validation
// (app/api/training/profile/route.ts) guards both this form and any future
// programmatic caller (e.g. the Coach).

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { TrainingProfile } from "@/lib/training/types";
import { TRAINING_CATEGORIES, TRAINING_CATEGORY_LABEL } from "@/lib/nutrition/workout-types";
import { Select } from "@/components/ui/Select";

const LOCATION_OPTIONS = [
  { value: "home", label: "Em casa" },
  { value: "gym", label: "Ginásio" },
  { value: "outdoor", label: "Ao ar livre" },
  { value: "mixed", label: "Sem preferência" },
];

const INTENSITY_OPTIONS = [
  { value: "low", label: "Baixa" },
  { value: "medium", label: "Média" },
  { value: "high", label: "Alta" },
];

const VARIETY_OPTIONS = [
  { value: "low", label: "Pouca — repetir o que resulta" },
  { value: "medium", label: "Moderada" },
  { value: "high", label: "Muita — sessões diferentes cada dia" },
];

function toggleInList<T extends string>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

export function TrainingProfileForm({ initialProfile }: { initialProfile: TrainingProfile }) {
  const router = useRouter();
  const [draft, setDraft] = useState<TrainingProfile>(initialProfile);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setSaved(false);
    setError(null);

    try {
      const response = await fetch("/api/training/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          preferredCategories: draft.preferredCategories,
          sessionDurationMinutes: draft.sessionDurationMinutes,
          location: draft.location,
          intensityPreference: draft.intensityPreference,
          varietyPreference: draft.varietyPreference,
          physicalLimitations: draft.physicalLimitations,
        }),
      });
      if (!response.ok) throw new Error();
      setSaved(true);
      router.refresh();
    } catch {
      setError("Não foi possível guardar o perfil. Tenta novamente.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="surface-card space-y-5 p-5" onSubmit={handleSubmit}>
      <div className="text-sm">
        <p className="mb-1.5">Tipos de treino que fazes</p>
        <p className="mb-2 text-xs text-neutral-500">Deixa tudo por marcar para o plano incluir variedade de todas as categorias.</p>
        <div className="flex flex-wrap gap-1.5">
          {TRAINING_CATEGORIES.map((category) => (
            <button
              type="button"
              key={category}
              onClick={() => setDraft({ ...draft, preferredCategories: toggleInList(draft.preferredCategories, category) })}
              className={`rounded-full px-3 py-1 text-xs transition ${
                draft.preferredCategories.includes(category)
                  ? "bg-emerald-500/20 text-emerald-300"
                  : "bg-white/[0.05] text-neutral-400 hover:text-neutral-200"
              }`}
            >
              {TRAINING_CATEGORY_LABEL[category]}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="block text-sm">
          Duração habitual da sessão (min)
          <input
            type="number"
            min={10}
            max={180}
            className="field-input mt-1"
            value={draft.sessionDurationMinutes}
            onChange={(e) => setDraft({ ...draft, sessionDurationMinutes: Number(e.target.value) })}
          />
        </label>
        <Select
          label="Onde costumas treinar"
          value={draft.location}
          options={LOCATION_OPTIONS}
          onChange={(value) => setDraft({ ...draft, location: value as TrainingProfile["location"] })}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Select
          label="Intensidade preferida"
          value={draft.intensityPreference}
          options={INTENSITY_OPTIONS}
          onChange={(value) => setDraft({ ...draft, intensityPreference: value as TrainingProfile["intensityPreference"] })}
        />
        <Select
          label="Variedade desejada"
          value={draft.varietyPreference}
          options={VARIETY_OPTIONS}
          onChange={(value) => setDraft({ ...draft, varietyPreference: value as TrainingProfile["varietyPreference"] })}
        />
      </div>

      <label className="block text-sm">
        Limitações físicas relevantes (texto livre — nunca usado para diagnóstico, só para contexto)
        <textarea
          className="field-input mt-1 min-h-20"
          value={draft.physicalLimitations}
          onChange={(e) => setDraft({ ...draft, physicalLimitations: e.target.value })}
        />
      </label>

      {error && <p className="text-sm text-red-400">{error}</p>}

      <button type="submit" className="btn-primary w-full" disabled={saving}>
        {saving ? "A guardar..." : "Guardar perfil"}
      </button>

      {saved && <p className="text-sm text-emerald-400">Perfil de treino guardado.</p>}
    </form>
  );
}
