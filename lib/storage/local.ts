"use client";

import { isValidCheckIn } from "@/lib/decisions/validate";
import type { CheckIn, DecisionInstance, OnboardingProfile } from "@/lib/decisions/types";

const KEYS = {
  profile: "rebuild:profile",
  checkIn: (date: string) => `rebuild:checkin:${date}`,
  decisions: (date: string) => `rebuild:decisions:${date}`,
};

function read<T>(key: string): T | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(key);
  return raw ? (JSON.parse(raw) as T) : null;
}

function write<T>(key: string, value: T): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, JSON.stringify(value));
}

export function getProfile(): OnboardingProfile | null {
  return read<OnboardingProfile>(KEYS.profile);
}

export function saveProfile(profile: OnboardingProfile): void {
  write(KEYS.profile, profile);
}

export function getCheckIn(date: string): CheckIn | null {
  const stored = read<unknown>(KEYS.checkIn(date));
  return isValidCheckIn(stored) ? stored : null;
}

export function saveCheckIn(checkIn: CheckIn): void {
  write(KEYS.checkIn(checkIn.date), checkIn);
}

export function getDecisionInstances(date: string): DecisionInstance[] | null {
  return read<DecisionInstance[]>(KEYS.decisions(date));
}

export function saveDecisionInstances(date: string, instances: DecisionInstance[]): void {
  write(KEYS.decisions(date), instances);
}
