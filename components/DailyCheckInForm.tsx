"use client";

import { useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

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
    <form
      onSubmit={handleSubmit}
      className="space-y-4 rounded-lg border border-neutral-800 p-4"
    >
      <h2 className="text-lg font-medium">Como estás hoje?</h2>

      <label className="block text-sm">
        Qualidade do sono (1-5): {sleepQuality}
        <input
          type="range"
          min={1}
          max={5}
          value={sleepQuality}
          onChange={(event) => setSleepQuality(Number(event.target.value))}
          className="w-full"
        />
      </label>

      <label className="block text-sm">
        Energia (1-5): {energyLevel}
        <input
          type="range"
          min={1}
          max={5}
          value={energyLevel}
          onChange={(event) => setEnergyLevel(Number(event.target.value))}
          className="w-full"
        />
      </label>

      <label className="block text-sm">
        Stress (1-5): {stressLevel}
        <input
          type="range"
          min={1}
          max={5}
          value={stressLevel}
          onChange={(event) => setStressLevel(Number(event.target.value))}
          className="w-full"
        />
      </label>

      <label className="block text-sm">
        Limitação física hoje? (opcional)
        <input
          className="mt-1 w-full rounded-md border border-neutral-700 bg-neutral-900 px-2 py-1.5 text-sm"
          placeholder="ex.: joelho, costas..."
          value={physicalLimitation}
          onChange={(event) => setPhysicalLimitation(event.target.value)}
        />
      </label>

      <label className="block text-sm">
        Algo importante que o sistema deva saber? (opcional)
        <textarea
          className="mt-1 w-full rounded-md border border-neutral-700 bg-neutral-900 px-2 py-1.5 text-sm"
          rows={2}
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
        />
      </label>

      {error && <p className="text-sm text-red-400">{error}</p>}

      <button
        type="submit"
        disabled={submitting}
        className="w-full rounded-md bg-emerald-600 py-2 font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
      >
        {submitting ? "A gerar as decisões..." : "Ver as decisões de hoje"}
      </button>
    </form>
  );
}
