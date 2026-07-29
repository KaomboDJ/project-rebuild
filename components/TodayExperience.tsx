"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckInForm } from "@/components/CheckIn";
import { DecisionCard } from "@/components/DecisionCard";
import { DecisionScoreView } from "@/components/DecisionScore";
import { ReminderBanner } from "@/components/ReminderBanner";
import { CoachPanel } from "@/components/CoachPanel";
import {
  getCheckIn,
  getDecisionInstances,
  getProfile,
  saveCheckIn,
  saveDecisionInstances,
} from "@/lib/storage/local";
import { buildDecisionInstances, deriveOperatingState } from "@/lib/decisions/prioritize";
import { localDateKey } from "@/lib/date/local";
import type {
  CheckIn,
  DecisionInstance,
  OnboardingProfile,
  OperatingState,
} from "@/lib/decisions/types";

/**
 * Temporary bridge from the first local-only slice. Milestone 2 replaces
 * localStorage profile/check-in persistence with Supabase without discarding
 * the already-tested decision UI and prioritization behavior.
 */
export function TodayExperience() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [profile, setProfile] = useState<OnboardingProfile | null>(null);
  const [checkIn, setCheckIn] = useState<CheckIn | null>(null);
  const [instances, setInstances] = useState<DecisionInstance[]>([]);

  useEffect(() => {
    const storedProfile = getProfile();
    if (!storedProfile) {
      router.replace("/onboarding");
      return;
    }

    setProfile(storedProfile);
    const date = localDateKey();
    setCheckIn(getCheckIn(date));
    setInstances(getDecisionInstances(date) ?? []);
    setReady(true);
  }, [router]);

  const state: OperatingState | null = checkIn ? deriveOperatingState(checkIn) : null;

  function handleCheckIn(next: CheckIn) {
    saveCheckIn(next);
    setCheckIn(next);
    const derived = deriveOperatingState(next);
    const chosen = buildDecisionInstances(next.dayType, derived, next.date);
    saveDecisionInstances(next.date, chosen);
    setInstances(chosen);
  }

  function handleUpdate(id: string, status: DecisionInstance["status"], skipReason?: string) {
    const date = localDateKey();
    const next = instances.map((instance) =>
      instance.id === id ? { ...instance, status, skipReason } : instance
    );
    setInstances(next);
    saveDecisionInstances(date, next);
  }

  if (!ready || !profile) return null;

  return (
    <main className="mx-auto max-w-xl space-y-6 px-4 py-8">
      <header>
        <p className="text-sm uppercase tracking-wide text-neutral-400">
          Sou um atleta em reconstrução.
        </p>
        <h1 className="text-2xl font-semibold">Hoje</h1>
      </header>

      {!checkIn ? (
        <CheckInForm onSubmit={handleCheckIn} />
      ) : (
        <>
          <ReminderBanner instances={instances} />
          <DecisionScoreView instances={instances} />
          <section className="space-y-3">
            {instances.map((instance) => (
              <DecisionCard key={instance.id} instance={instance} onUpdate={handleUpdate} />
            ))}
          </section>
          {state && (
            <CoachPanel
              profile={profile}
              checkIn={checkIn}
              state={state}
              instances={instances}
            />
          )}
        </>
      )}
    </main>
  );
}
