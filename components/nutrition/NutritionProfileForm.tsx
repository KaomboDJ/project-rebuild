"use client";

// Milestone 12 — the "minimum necessary information" form
// (PRODUCT_BACKLOG.md's Core experience) behind the Nutrition Toolkit's
// planner. Saves via PUT /api/nutrition/profile (not a direct Supabase
// upsert like OnboardingForm) so the same Zod validation
// (app/api/nutrition/profile/route.ts) guards both this form and any future
// programmatic caller.

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { NutritionProfile } from "@/lib/nutrition/types";
import {
  ALLERGEN_LABELS,
  BUDGET_PREFERENCES,
  DIET_STYLES,
  KNOWN_ALLERGENS,
  NUTRITION_GOALS,
  VARIETY_PREFERENCES,
} from "@/lib/nutrition/options";
import { HelpTip } from "@/components/ui/HelpTip";
import { Select } from "@/components/ui/Select";
import { JourneySuccess } from "@/components/nutrition/NutritionJourney";

function toggleInList(list: string[], value: string): string[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

export function NutritionProfileForm({ initialProfile }: { initialProfile: NutritionProfile }) {
  const router = useRouter();
  const [draft, setDraft] = useState<NutritionProfile>(initialProfile);
  const [exclusionsText, setExclusionsText] = useState(initialProfile.exclusions.join(", "));
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setSaved(false);
    setError(null);

    const exclusions = exclusionsText
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    try {
      const response = await fetch("/api/nutrition/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          goal: draft.goal,
          dietStyle: draft.dietStyle,
          allergies: draft.allergies,
          exclusions,
          medicalConstraints: draft.medicalConstraints,
          mealsPerDay: draft.mealsPerDay,
          includeSnack: draft.mealsPerDay >= 4,
          peopleCount: draft.peopleCount,
          cookingTimeMinutes: draft.cookingTimeMinutes,
          budgetPreference: draft.budgetPreference,
          varietyPreference: draft.varietyPreference,
          targetCalories: draft.targetCalories,
          targetProteinG: draft.targetProteinG,
          targetCarbsG: draft.targetCarbsG,
          targetFatG: draft.targetFatG,
          macroSource: draft.targetCalories ? "user-provided" : "system-estimate",
          preferredPlanMode: draft.preferredPlanMode,
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
      <Select
        label="Objetivo"
        value={draft.goal}
        options={NUTRITION_GOALS}
        onChange={(value) => setDraft({ ...draft, goal: value as NutritionProfile["goal"] })}
      />

      <Select
        label="Estilo alimentar"
        value={draft.dietStyle}
        options={DIET_STYLES}
        onChange={(value) =>
          setDraft({ ...draft, dietStyle: value as NutritionProfile["dietStyle"] })
        }
      />

      <div className="text-sm">
        <p className="mb-1.5">Alergias / intolerâncias</p>
        <div className="flex flex-wrap gap-1.5">
          {KNOWN_ALLERGENS.map((allergen) => (
            <button
              type="button"
              key={allergen}
              onClick={() =>
                setDraft({ ...draft, allergies: toggleInList(draft.allergies, allergen) })
              }
              className={`rounded-full px-3 py-1 text-xs transition ${
                draft.allergies.includes(allergen)
                  ? "bg-rose-500/20 text-rose-300"
                  : "bg-white/[0.05] text-neutral-400 hover:text-neutral-200"
              }`}
            >
              {ALLERGEN_LABELS[allergen]}
            </button>
          ))}
        </div>
      </div>

      <label className="block text-sm">
        Exclusões (ingredientes a evitar, separados por vírgula)
        <input
          className="field-input mt-1"
          placeholder="ex.: cogumelos, marisco"
          value={exclusionsText}
          onChange={(e) => setExclusionsText(e.target.value)}
        />
      </label>

      <label className="block text-sm">
        Restrições médicas relevantes (texto livre — nunca usado para diagnóstico, só para contexto)
        <textarea
          className="field-input mt-1 min-h-20"
          value={draft.medicalConstraints}
          onChange={(e) => setDraft({ ...draft, medicalConstraints: e.target.value })}
        />
      </label>

      <div className="grid grid-cols-2 gap-4">
        <label className="block text-sm">
          Pessoas a cozinhar para
          <input
            type="number"
            min={1}
            max={12}
            className="field-input mt-1"
            value={draft.peopleCount}
            onChange={(e) => setDraft({ ...draft, peopleCount: Number(e.target.value) })}
          />
        </label>
        <label className="block text-sm">
          Tempo de cozinha por refeição (min)
          <input
            type="number"
            min={5}
            max={180}
            className="field-input mt-1"
            value={draft.cookingTimeMinutes}
            onChange={(e) => setDraft({ ...draft, cookingTimeMinutes: Number(e.target.value) })}
          />
        </label>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Select
          label="Refeições planeadas por dia"
          value={String(draft.mealsPerDay)}
          options={[
            { value: "2", label: "2 — almoço e jantar" },
            { value: "3", label: "3 — pequeno-almoço, almoço e jantar" },
            { value: "4", label: "4 — inclui um lanche" },
          ]}
          onChange={(value) => setDraft({ ...draft, mealsPerDay: Number(value), includeSnack: Number(value) >= 4 })}
        />
        <Select
          label="Como queres planear"
          value={draft.preferredPlanMode}
          options={[
            { value: "decide-for-me", label: "Decide por mim" },
            { value: "simple-rotation", label: "Rotação simples" },
            { value: "flexible-week", label: "Semana flexível" },
          ]}
          onChange={(value) => setDraft({ ...draft, preferredPlanMode: value as NutritionProfile["preferredPlanMode"] })}
        />
      </div>
      <p className="-mt-3 text-xs text-neutral-500">
        Rotação simples repete poucas opções para reduzir preparação. Semana flexível privilegia variedade e substituições fáceis.
      </p>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Select
          label="Orçamento"
          value={draft.budgetPreference}
          options={BUDGET_PREFERENCES}
          onChange={(value) =>
            setDraft({ ...draft, budgetPreference: value as NutritionProfile["budgetPreference"] })
          }
        />
        <Select
          label="Variedade desejada"
          value={draft.varietyPreference}
          options={VARIETY_PREFERENCES}
          onChange={(value) =>
            setDraft({
              ...draft,
              varietyPreference: value as NutritionProfile["varietyPreference"],
            })
          }
        />
      </div>

      <div className="border-t border-white/[0.06] pt-4">
        <p className="mb-2 flex items-center gap-1.5 text-sm text-neutral-400">
          Alvos de macros (opcional — deixa em branco para uma estimativa do sistema)
          <HelpTip heading="Estimativa de macros">
            Se deixares em branco, o Rebuild calcula uma estimativa aproximada de
            calorias/proteína/hidratos/ gordura com base no teu objetivo e nas receitas planeadas.
            Não substitui indicação de um profissional de saúde — preenche os campos se já tiveres
            valores indicados por um.
          </HelpTip>
        </p>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {(
            [
              ["targetCalories", "Calorias"],
              ["targetProteinG", "Proteína (g)"],
              ["targetCarbsG", "Hidratos (g)"],
              ["targetFatG", "Gordura (g)"],
            ] as const
          ).map(([field, label]) => (
            <label key={field} className="block text-xs">
              {label}
              <input
                type="number"
                min={0}
                className="field-input mt-1"
                value={draft[field] ?? ""}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    [field]: e.target.value === "" ? null : Number(e.target.value),
                  })
                }
              />
            </label>
          ))}
        </div>
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}

      <button type="submit" className="btn-primary w-full" disabled={saving}>
        {saving ? "A guardar..." : "Guardar perfil"}
      </button>

      {saved && (
        <JourneySuccess href="/nutrition#pantry" action="Continuar para a despensa">
          Boa — o perfil está preparado. O Rebuild já consegue adaptar as refeições aos teus
          objetivos.
        </JourneySuccess>
      )}
    </form>
  );
}
