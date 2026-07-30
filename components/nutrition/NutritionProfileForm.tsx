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
import { BUDGET_PREFERENCES, DIET_STYLES, KNOWN_ALLERGENS, NUTRITION_GOALS, VARIETY_PREFERENCES } from "@/lib/nutrition/options";

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
          includeSnack: draft.includeSnack,
          peopleCount: draft.peopleCount,
          cookingTimeMinutes: draft.cookingTimeMinutes,
          budgetPreference: draft.budgetPreference,
          varietyPreference: draft.varietyPreference,
          targetCalories: draft.targetCalories,
          targetProteinG: draft.targetProteinG,
          targetCarbsG: draft.targetCarbsG,
          targetFatG: draft.targetFatG,
          macroSource: draft.targetCalories ? "user-provided" : "system-estimate",
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
      <label className="block text-sm">
        Objetivo
        <select
          className="field-input mt-1"
          value={draft.goal}
          onChange={(e) => setDraft({ ...draft, goal: e.target.value as NutritionProfile["goal"] })}
        >
          {NUTRITION_GOALS.map((g) => (
            <option key={g.value} value={g.value}>
              {g.label}
            </option>
          ))}
        </select>
      </label>

      <label className="block text-sm">
        Estilo alimentar
        <select
          className="field-input mt-1"
          value={draft.dietStyle}
          onChange={(e) => setDraft({ ...draft, dietStyle: e.target.value as NutritionProfile["dietStyle"] })}
        >
          {DIET_STYLES.map((d) => (
            <option key={d.value} value={d.value}>
              {d.label}
            </option>
          ))}
        </select>
      </label>

      <div className="text-sm">
        <p className="mb-1.5">Alergias / intolerâncias</p>
        <div className="flex flex-wrap gap-1.5">
          {KNOWN_ALLERGENS.map((allergen) => (
            <button
              type="button"
              key={allergen}
              onClick={() => setDraft({ ...draft, allergies: toggleInList(draft.allergies, allergen) })}
              className={`rounded-full px-3 py-1 text-xs transition ${
                draft.allergies.includes(allergen)
                  ? "bg-rose-500/20 text-rose-300"
                  : "bg-white/[0.05] text-neutral-400 hover:text-neutral-200"
              }`}
            >
              {allergen}
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

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={draft.includeSnack}
          onChange={(e) => setDraft({ ...draft, includeSnack: e.target.checked })}
        />
        Incluir um lanche por dia
      </label>

      <div className="grid grid-cols-2 gap-4">
        <label className="block text-sm">
          Orçamento
          <select
            className="field-input mt-1"
            value={draft.budgetPreference}
            onChange={(e) => setDraft({ ...draft, budgetPreference: e.target.value as NutritionProfile["budgetPreference"] })}
          >
            {BUDGET_PREFERENCES.map((b) => (
              <option key={b.value} value={b.value}>
                {b.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          Variedade desejada
          <select
            className="field-input mt-1"
            value={draft.varietyPreference}
            onChange={(e) => setDraft({ ...draft, varietyPreference: e.target.value as NutritionProfile["varietyPreference"] })}
          >
            {VARIETY_PREFERENCES.map((v) => (
              <option key={v.value} value={v.value}>
                {v.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="border-t border-white/[0.06] pt-4">
        <p className="mb-2 text-sm text-neutral-400">
          Alvos de macros (opcional — deixa em branco para uma estimativa do sistema)
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
                onChange={(e) => setDraft({ ...draft, [field]: e.target.value === "" ? null : Number(e.target.value) })}
              />
            </label>
          ))}
        </div>
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}
      {saved && <p className="text-sm text-emerald-400">Perfil guardado.</p>}

      <button type="submit" className="btn-primary w-full" disabled={saving}>
        {saving ? "A guardar..." : "Guardar perfil"}
      </button>
    </form>
  );
}
