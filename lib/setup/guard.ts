import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { isAnyCalendarConnected } from "@/lib/calendar-intelligence/sources";
import { hasTrainingProfile } from "@/lib/training/queries";

type Supabase = SupabaseClient<Database>;

export type SetupStage = "calendar" | "training" | "done";

const SETUP_REDIRECT: Record<Exclude<SetupStage, "done">, string> = {
  calendar: "/settings?setup=calendar",
  training: "/training/profile?setup=training",
};

/**
 * Sequential setup gate (founder request, 2026-08-07): "the app shows
 * everything at once and people don't know where to start." Início, Hoje,
 * Coach, Alimentação and Histórico all lean on there being a connected
 * calendar and a training profile to say anything useful - without them
 * they're mostly empty states, which reads as broken rather than
 * "not set up yet".
 *
 * Deliberately two stages only. Nutrition/despensa is NOT part of this
 * gate: docs/12_ROADMAP.md treats it as a secondary module added after
 * the core calendar-aware decision loop was already validated, not a
 * prerequisite for it - gating on it here would block the app's primary
 * loop behind an optional one. It stays reachable once "done" and is
 * nudged (not forced) from Início instead - see the FirstUseCallout
 * rendered from app/(app)/home/page.tsx.
 */
export async function getSetupStage(supabase: Supabase, userId: string): Promise<SetupStage> {
  const calendarConnected = await isAnyCalendarConnected(userId);
  if (!calendarConnected) return "calendar";

  const trainingReady = await hasTrainingProfile(supabase, userId).catch(() => false);
  if (!trainingReady) return "training";

  return "done";
}

/**
 * Call from Início/Hoje/Coach/Alimentação/Histórico's server components
 * only - never from /settings or /training(/profile), which are this
 * gate's own destinations and would otherwise redirect to themselves.
 * Returns the path to redirect to, or null when setup is complete.
 */
export async function requireSetupComplete(
  supabase: Supabase,
  userId: string
): Promise<string | null> {
  const stage = await getSetupStage(supabase, userId);
  return stage === "done" ? null : SETUP_REDIRECT[stage];
}
