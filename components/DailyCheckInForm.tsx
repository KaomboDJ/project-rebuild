"use client";

// Founder feedback (2026-08-05, real user via José Gama): "Preciso que a
// app trabalhe para mim e não eu para a app" - this form was already fairly
// light (3 sliders defaulting to 3, 2 optional fields), but on a day where
// nothing changed the founder still had to open the app and confirm three
// sliders by hand. The "Foi como ontem" shortcut below fetches yesterday's
// sleep/energy/stress values and submits with one tap when they exist,
// while leaving physical_limitation/notes untouched (those are genuinely
// day-specific - e.g. yesterday's knee pain may not apply today - so they
// are never silently carried forward).

import { useEffect, useState } from "react";
import { Activity, Moon, Zap } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { addDays } from "@/lib/date/calendar-grid";

const SLIDERS = [
  { key: "sleepQuality", label: "Qualidade do sono", icon: Moon } as const,
  { key: "energyLevel", label: "Energia", icon: Zap } as const,
  { key: "stressLevel", label: "Stress", icon: Activity } as const,
];

interface YesterdayValues {
  sleepQuality: number;
  energyLevel: number;
  stressLevel: number;
}

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
  const [yesterday, setYesterday] = useState<YesterdayValues | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function loadYesterday() {
      const supabase = createSupabaseBrowserClient();
      if (!supabase) return;
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from("daily_check_ins")
        .select("sleep_quality, energy_level, stress_level")
        .eq("user_id", user.id)
        .eq("date", addDays(date, -1))
        .maybeSingle();

      if (!cancelled && data && data.sleep_quality !== null && data.energy_level !== null && data.stress_level !== null) {
        setYesterday({
          sleepQuality: data.sleep_quality,
          energyLevel: data.energy_level,
          stressLevel: data.stress_level,
        });
      }
    }
    loadYesterday();
    return () => {
      cancelled = true;
    };
  }, [date]);

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

  async function submitCheckIn(overrides?: YesterdayValues) {
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
        sleep_quality: overrides?.sleepQuality ?? sleepQuality,
        energy_level: overrides?.energyLevel ?? energyLevel,
        stress_level: overrides?.stressLevel ?? stressLevel,
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
      onSubmit={(event) => {
        event.preventDefault();
        submitCheckIn();
      }}
      className="surface-card space-y-5 p-5"
    >
      <h2 className="text-lg font-semibold tracking-tight">Como estás hoje?</h2>

      {yesterday && (
        <button
          type="button"
          disabled={submitting}
          onClick={() => submitCheckIn(yesterday)}
          className="btn-secondary w-full py-2.5 text-sm"
        >
          Foi como ontem (sono {yesterday.sleepQuality}, energia {yesterday.energyLevel}, stress {yesterday.stressLevel})
        </button>
      )}

      <div className="space-y-4">
        {SLIDERS.map(({ key, label, icon: Icon }) => (
          <label key={key} className="block">
            <span className="flex items-center gap-2 text-sm text-neutral-300">
              <Icon size={15} className="text-neutral-400" />
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
