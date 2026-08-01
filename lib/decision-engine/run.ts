import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { buildDailyContext } from "./context-builder";
import { generateDecisions } from "./generator";
import { getFounderNow } from "@/lib/date/founder-now";
import { zonedWallTimeToUtc } from "@/lib/date/timezone";
import { getCalendarEventsForDate } from "@/lib/google/calendar";
import { buildPantrySummary } from "@/lib/coach/pantry-context";
import { getTodaysDinnerPlanName } from "@/lib/nutrition/queries";
import { getRuleAdjustments, listMutedRuleIds } from "./queries";
import type { GeneratedDecision } from "./types";

type Supabase = SupabaseClient<Database>;

export interface RunDecisionGenerationResult {
  decisions: Database["public"]["Tables"]["decisions"]["Row"][];
  engineVersion: string;
}

/**
 * The full "generate (or regenerate) today's exactly-three decisions and
 * persist them" pipeline — extracted from
 * app/api/decisions/generate/route.ts (Milestone 4/11C/11D/12) so Milestone
 * 13's cron-driven proactive generation (app/api/cron/daily-sync/route.ts)
 * and the founder-triggered interactive route share one implementation
 * instead of two copies that could silently drift apart. Takes a Supabase
 * client rather than constructing one, since the two callers need different
 * clients: the interactive route's session-scoped (RLS-enforced) client, and
 * the cron route's admin client (no session exists in a scheduled job) -
 * see lib/supabase/admin.ts. Every query below still filters by the passed
 * `userId` explicitly, so the admin client's bypassed RLS never becomes "act
 * on the wrong user" - it only removes a redundant enforcement layer for a
 * trusted server-side caller that already knows which user it's acting for.
 */
export async function runDecisionGeneration(supabase: Supabase, userId: string): Promise<RunDecisionGenerationResult> {
  const { date, now, timezone } = await getFounderNow(supabase, userId);

  const calendarEvents = await getCalendarEventsForDate(userId, date, timezone);

  const pantrySummary = await buildPantrySummary(supabase, userId);
  const pantryItems = pantrySummary.map((item) => ({
    name: item.name,
    quantity: item.quantity,
    unit: item.unit,
    portable: item.portable,
    expiresOn: item.expiresOn,
  }));

  const todaysDinnerPlanName = await getTodaysDinnerPlanName(supabase, userId, date).catch(() => null);

  // Milestone 14 — learned, bounded scoring nudges (queries.ts's
  // getRuleAdjustments, backed by patterns.ts) and the founder's own
  // absolute mutes. Both default to "no effect" (empty map/array) on any
  // failure, so a personalization-layer error can never block the core
  // three-decisions-a-day loop — see context-builder.ts's defaults, which
  // this mirrors.
  const [mutedRuleIds, ruleAdjustments] = await Promise.all([
    listMutedRuleIds(supabase, userId).catch(() => []),
    getRuleAdjustments(supabase, userId).catch(() => ({})),
  ]);

  const context = await buildDailyContext({
    supabase,
    userId,
    date,
    now,
    calendarEvents,
    pantryItems,
    todaysDinnerPlanName,
    mutedRuleIds,
    ruleAdjustments,
  });
  const { decisions, engineVersion } = await generateDecisions(context);

  const { data: run, error: runError } = await supabase
    .from("decision_runs")
    .upsert(
      {
        user_id: userId,
        date,
        context_snapshot: JSON.parse(JSON.stringify(context)),
        engine_version: engineVersion,
        generated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,date" }
    )
    .select("id")
    .single();

  if (runError || !run) {
    throw new Error("failed-to-create-run");
  }

  await supabase.from("decisions").delete().eq("decision_run_id", run.id);

  if (decisions.length === 0) {
    return { decisions: [], engineVersion };
  }

  const toUtcInstant = (naiveLocalIso: string | undefined): string | null => {
    if (!naiveLocalIso) return null;
    const [dateKey, timePart] = naiveLocalIso.split("T");
    return zonedWallTimeToUtc(dateKey, timePart, context.timezone).toISOString();
  };

  const insertRow = (decision: GeneratedDecision) => ({
    user_id: userId,
    decision_run_id: run.id,
    date,
    title: decision.title,
    reason: decision.reason,
    recommended_action: decision.recommendedAction,
    recommended_start: toUtcInstant(decision.recommendedStart),
    recommended_end: toUtcInstant(decision.recommendedEnd),
    domain: decision.domain,
    impact: decision.impact,
    confidence: decision.confidence,
    source: decision.source,
    status: "proposed" as const,
    related_pantry_item: decision.relatedPantryItem ?? null,
    rule_id: decision.ruleId ?? null,
    timing_type: decision.timingType,
    trigger_label: decision.triggerLabel ?? null,
  });

  const { data: inserted, error: insertError } = await supabase
    .from("decisions")
    .insert(decisions.map(insertRow))
    .select("*");

  if (insertError) {
    throw new Error("failed-to-create-decisions");
  }

  return { decisions: inserted ?? [], engineVersion };
}
