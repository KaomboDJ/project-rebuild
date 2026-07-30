"use client";

import { useState } from "react";
import { Activity, Moon, Zap } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

const SLIDERS = [
  { key: "sleepQuality", label: "Qualidade do sono", icon: Moon } as const,
  { key: "energyLevel", label: "Energia", icon: Zap } as const,
  { key: "stressLevel", label: "Stress", icon: Activity } as const,
];

export function DailyCheckInForm({
  date,
  onSubmitted,
}: {
  date: string;
  onSubmitted: () => void;
}) {
  const [sleepQuality, setSleepQuality] = useState(3);
  const [energyLevel, setEnergyLevel] = useState(3);
  const [stressLevel, setStressLevel] = useState(3);
  const [physicalLimitation, setPhysicalLimitation] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const values: Record<(typeof SLIDERS)[number]["key"], number> = {
    sleepQuality,
    energyLevel,
    stressLevel,
  };
  const setters: Record<(typeof SLIDERS)[number]["key"], (value: number) => void> = {
    sleepQuality: setSleepQuality,
    energyLevel: setEnergyLevel,
    stressLevel: setStressLevel,
  };

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    const supabase = createSupabaseBrowserClient();
    if (!supabase) {
      setError("Supabase não está configurado.");
      setSubmitting(false);
      return;
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setError("Sessão expirada. Inicia sessão novamente.");
      setSubmitting(false);
      return;
    }

    const { error: upsertError } = await supabase.from("daily_check_ins").upsert(
      {
        user_id: user.id,
        date,
        sleep_quality: sleepQuality,
        energy_level: energyLevel,
        stress_level: stressLevel,
        physical_limitation: physicalLimitation || null,
        notes: notes || null,
      },
      { onConflict: "user_id,date" }
    );

    if (upsertError) {
      setError("Não foi possível guardar o check-in.");
      setSubmitting(false);
      return;
    }

    onSubmitted();
  }

  return (
    <form onSubmit={handleSubmit} className="surface-card space-y-5 p-5">
      <h2 className="text-lg font-semibold tracking-tight">Como estás hoje?</h2>

      <div className="space-y-4">
        {SLIDERS.map(({ key, label, icon: Icon }) => (
          <label key={key} className="block">
            <span className="flex items-center gap-2 text-sm text-neutral-300">
              <Icon size={15} className="text-neutral-500" />
              {label}
              <span className="ml-auto font-medium text-neutral-100">{values[key]}</span>
            </span>
            <input
              type="range"
              min={1}
              max={5}
              value={values[key]}
              onChange={(event) => setters[key](Number(event.target.value))}
              className="mt-2 w-full"
            />
          </label>
        ))}
      </div>

      <label className="field-label">
        Limitação física hoje? (opcional)
        <input
          className="field-input mt-1"
          placeholder="ex.: joelho, costas..."
          value={physicalLimitation}
          onChange={(event) => setPhysicalLimitation(event.target.value)}
        />
      </label>

      <label className="field-label">
        Algo importante que o sistema deva saber? (opcional)
        <textarea
          className="field-input mt-1"
          rows={2}
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
        />
      </label>

      {error && <p className="text-sm text-red-400">{error}</p>}

      <button type="submit" disabled={submitting} className="btn-primary w-full py-2.5">
        {submitting ? "A gerar as decisões..." : "Ver as decisões de hoje"}
      </button>
    </form>
  );
}
