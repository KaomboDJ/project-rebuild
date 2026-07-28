"use client";

import { useState } from "react";
import { localDateKey } from "@/lib/date/local";
import type { CheckIn, DayType } from "@/lib/decisions/types";

const DAY_TYPE_OPTIONS: { value: DayType; label: string }[] = [
  { value: "remote", label: "Teletrabalho" },
  { value: "office", label: "Escritório" },
  { value: "weekend", label: "Fim de semana" },
  { value: "recovery", label: "Recuperação" },
];

export function CheckInForm({ onSubmit }: { onSubmit: (checkIn: CheckIn) => void }) {
  const [sleepHours, setSleepHours] = useState(6);
  const [energy, setEnergy] = useState<CheckIn["energy"]>(3);
  const [stress, setStress] = useState<CheckIn["stress"]>(3);
  const [dayType, setDayType] = useState<DayType>("remote");

  return (
    <form
      className="space-y-4 rounded-lg border border-neutral-800 p-4"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit({ date: localDateKey(), sleepHours, energy, stress, dayType });
      }}
    >
      <h2 className="text-lg font-medium">Como estás hoje?</h2>

      <label className="block text-sm">
        Tipo de dia
        <select
          className="mt-1 w-full rounded-md border border-neutral-700 bg-neutral-900 px-2 py-1.5 text-sm"
          value={dayType}
          onChange={(event) => setDayType(event.target.value as DayType)}
        >
          {DAY_TYPE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>

      <label className="block text-sm">
        Horas de sono: {sleepHours}h
        <input
          type="range"
          min={0}
          max={10}
          step={0.5}
          value={sleepHours}
          onChange={(event) => setSleepHours(Number(event.target.value))}
          className="w-full"
        />
      </label>

      <label className="block text-sm">
        Energia (1-5): {energy}
        <input
          type="range"
          min={1}
          max={5}
          value={energy}
          onChange={(event) => setEnergy(Number(event.target.value) as CheckIn["energy"])}
          className="w-full"
        />
      </label>

      <label className="block text-sm">
        Stress (1-5): {stress}
        <input
          type="range"
          min={1}
          max={5}
          value={stress}
          onChange={(event) => setStress(Number(event.target.value) as CheckIn["stress"])}
          className="w-full"
        />
      </label>

      <button
        type="submit"
        className="w-full rounded-md bg-emerald-600 py-2 font-medium text-white hover:bg-emerald-500"
      >
        Ver as decisões de hoje
      </button>
    </form>
  );
}
