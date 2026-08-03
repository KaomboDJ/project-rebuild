import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { getFounderNow } from "@/lib/date/founder-now";
import { instantToLocalWallClockIso } from "@/lib/date/timezone";
import { createInterventionEvent, listConnections } from "@/lib/google/calendar";
import { getUnifiedCalendarEventsForDate } from "@/lib/calendar-intelligence/unified";
import { DEFAULT_PROFILE } from "@/lib/decision-engine/context-builder";
import {
  decisionsNeedingAcceptance,
  decisionsNeedingCalendarEvent,
  type DecisionRow,
} from "@/lib/decision-engine/day-plan";
import { overlapsFixedEvent } from "./slot-finder";

type Supabase = SupabaseClient<Database>;

export interface ConfirmDayPlanResult {
  acceptedCount: number;
  scheduledCount: number;
  skippedConflictCount: number;
  alreadyConfirmed: boolean;
  planConfirmedAt: string;
}

export async function confirmDayPlan(
  supabase: Supabase,
  userId: string,
  params: { connectionId?: string } = {}
): Promise<ConfirmDayPlanResult> {
  const { date, timezone: founderTimezone } = await getFounderNow(supabase, userId);
  const { data: run } = await supabase
    .from("decision_runs")
    .select("id, plan_confirmed_at")
    .eq("user_id", userId)
    .eq("date", date)
    .maybeSingle();
  if (!run) throw new Error("no-decision-run-for-today");

  const { data: profile } = await supabase.from("profiles").select("timezone").eq("user_id", userId).maybeSingle();
  const timezone = profile?.timezone || founderTimezone || DEFAULT_PROFILE.timezone;
  const { data } = await supabase.from("decisions").select("*").eq("decision_run_id", run.id);
  let current: DecisionRow[] = data ?? [];
  let acceptedCount = 0;

  for (const decision of decisionsNeedingAcceptance(current)) {
    const { data: updated, error } = await supabase
      .from("decisions")
      .update({ status: "accepted" })
      .eq("id", decision.id)
      .eq("user_id", userId)
      .select("*")
      .single();
    if (!error && updated) {
      current = current.map((item) => (item.id === updated.id ? updated : item));
      acceptedCount += 1;
    }
  }

  const freshEvents = await getUnifiedCalendarEventsForDate(userId, date, timezone);
  const connections = await listConnections(userId);
  const resolvedConnectionId =
    params.connectionId ?? connections.find((connection) => connection.isPrimary)?.id ?? connections[0]?.id;
  let scheduledCount = 0;
  let skippedConflictCount = 0;
  for (const decision of decisionsNeedingCalendarEvent(current)) {
    if (!decision.recommended_start || !decision.recommended_end) continue;
    const localStart = instantToLocalWallClockIso(new Date(decision.recommended_start), timezone);
    const localEnd = instantToLocalWallClockIso(new Date(decision.recommended_end), timezone);
    if (overlapsFixedEvent(localStart, localEnd, freshEvents)) {
      skippedConflictCount += 1;
      continue;
    }
    const eventId = await createInterventionEvent(
      userId,
      {
        title: decision.title,
        description: decision.recommended_action || decision.reason,
        start: decision.recommended_start,
        end: decision.recommended_end,
        timeZone: timezone,
        reminderMinutes: 10,
      },
      resolvedConnectionId
    );
    if (eventId) {
      await supabase
        .from("decisions")
        .update({ calendar_event_id: eventId, calendar_connection_id: resolvedConnectionId ?? null })
        .eq("id", decision.id)
        .eq("user_id", userId);
      scheduledCount += 1;
    }
  }

  const alreadyConfirmed = Boolean(run.plan_confirmed_at);
  const planConfirmedAt = run.plan_confirmed_at ?? new Date().toISOString();
  if (!alreadyConfirmed) {
    await supabase.from("decision_runs").update({ plan_confirmed_at: planConfirmedAt }).eq("id", run.id);
  }
  return { acceptedCount, scheduledCount, skippedConflictCount, alreadyConfirmed, planConfirmedAt };
}
