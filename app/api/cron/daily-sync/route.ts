import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getServerEnvironment } from "@/lib/env/server";
import { getFounderNow } from "@/lib/date/founder-now";
import { getUnifiedCalendarEventsForDate } from "@/lib/calendar-intelligence/unified";
import { computeFreeWindows, DEFAULT_PROFILE } from "@/lib/decision-engine/context-builder";
import { runDecisionGeneration } from "@/lib/decision-engine/run";
import { detectFreeWindowDrift, buildBriefingSummary } from "@/lib/decision-engine/drift";
import type { FreeWindow } from "@/lib/decision-engine/types";
import { sendPushToUser } from "@/lib/notifications/push";
import { clipFreeWindowsToWakingHours, resolveSleepSchedule } from "@/lib/sleep/schedule";

function clockDistanceMinutes(left: string, right: string): number {
  const toMinutes = (value: string) => {
    const [hours, minutes] = value.slice(0, 5).split(":").map(Number);
    return hours * 60 + minutes;
  };
  const difference = Math.abs(toMinutes(left) - toMinutes(right));
  return Math.min(difference, 1440 - difference);
}

/**
 * Milestone 13 — Automation and continuous synchronization.
 *
 * Scheduled entry point (see vercel.json's cron config) that, for every
 * onboarded founder:
 *   1. Re-reads today's Google Calendar state (a fresh, non-incremental
 *      poll — see docs/14_AUTOMATION.md for why true Google sync-token
 *      incremental fetching was deliberately deferred rather than shipped
 *      unverified).
 *   2. Generates today's three decisions proactively if they don't exist
 *      yet (the "daily briefing" — the plan is ready before the founder
 *      even opens the app, via the same lib/decision-engine/run.ts pipeline
 *      the interactive route uses).
 *   3. If decisions already exist, compares the current free-window shape
 *      against what was true when they were generated
 *      (lib/decision-engine/drift.ts) and flags decisions_stale when it has
 *      drifted — surfaced as a "consider regenerating" banner on /today
 *      (components/CalendarWorkspace.tsx), never a silent auto-replace.
 *   4. Upserts one daily_briefings row per founder per day.
 *
 * Protected by CRON_SECRET (already anticipated in .env.example) rather than
 * a user session, since a scheduled job has neither.
 */
export async function GET(request: NextRequest) {
  const { CRON_SECRET } = getServerEnvironment();
  if (!CRON_SECRET) {
    return NextResponse.json({ error: "cron-not-configured" }, { status: 503 });
  }

  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const admin = createSupabaseAdminClient();

  const { data: profiles, error: profilesError } = await admin
    .from("profiles")
    .select(
      "user_id, timezone, target_sleep_time, target_wake_time, weekend_sleep_time, weekend_wake_time, wind_down_minutes, sleep_schedule_type"
    )
    .eq("onboarding_completed", true);

  if (profilesError) {
    console.error("cron_list_founders_error", {
      message: profilesError.message,
      code: profilesError.code,
      details: profilesError.details,
      hint: profilesError.hint,
    });
    return NextResponse.json({ error: "failed-to-list-founders" }, { status: 500 });
  }

  const results: { userId: string; decisionsGenerated: boolean; decisionsStale: boolean; notificationsDelivered: number }[] = [];

  for (const profile of profiles ?? []) {
    const userId = profile.user_id;
    try {
      const { date, now, timezone } = await getFounderNow(admin, userId);
      const events = await getUnifiedCalendarEventsForDate(userId, date, timezone || DEFAULT_PROFILE.timezone);
      const sleepSchedule = resolveSleepSchedule(date, {
        targetSleepTime: profile.target_sleep_time || DEFAULT_PROFILE.targetSleepTime,
        targetWakeTime: profile.target_wake_time || DEFAULT_PROFILE.targetWakeTime,
        weekendSleepTime: profile.weekend_sleep_time ?? DEFAULT_PROFILE.weekendSleepTime,
        weekendWakeTime: profile.weekend_wake_time ?? DEFAULT_PROFILE.weekendWakeTime,
        windDownMinutes: profile.wind_down_minutes || DEFAULT_PROFILE.windDownMinutes,
        sleepScheduleType: profile.sleep_schedule_type || DEFAULT_PROFILE.sleepScheduleType,
      });
      // Same fix as lib/day-plan/build-day-plan.ts and context-builder.ts:
      // clip to waking hours before this feeds the persisted daily_briefings
      // summary ("Hoje: N livres em M janela(s)") or the drift comparison
      // below, otherwise both quietly reintroduce the 00:00-23:59 bug.
      const freeWindows = clipFreeWindowsToWakingHours(
        computeFreeWindows(events, date, timezone || DEFAULT_PROFILE.timezone, 15),
        date,
        sleepSchedule
      );

      const { data: existingRun } = await admin
        .from("decision_runs")
        .select("context_snapshot")
        .eq("user_id", userId)
        .eq("date", date)
        .maybeSingle();

      let decisionsGenerated = Boolean(existingRun);
      let drift: ReturnType<typeof detectFreeWindowDrift> | undefined;

      if (!existingRun) {
        await runDecisionGeneration(admin, userId);
        decisionsGenerated = true;
      } else {
        const snapshot = existingRun.context_snapshot as { freeWindows?: FreeWindow[] } | null;
        const previousFreeWindows = snapshot?.freeWindows ?? [];
        drift = detectFreeWindowDrift(previousFreeWindows, freeWindows);
      }

      const totalFreeMinutes = freeWindows.reduce((sum, w) => sum + w.durationMinutes, 0);
      const summary = buildBriefingSummary({
        eventCount: events.length,
        freeWindows,
        decisionsGenerated,
        drift,
      });

      await admin.from("daily_briefings").upsert(
        {
          user_id: userId,
          date,
          generated_at: new Date().toISOString(),
          event_count: events.length,
          free_minutes: totalFreeMinutes,
          decisions_generated: decisionsGenerated,
          decisions_stale: drift?.changed ?? false,
          summary,
        },
        { onConflict: "user_id,date" }
      );

      const { data: notificationPreferences } = await admin
        .from("notification_preferences")
        .select("enabled, daily_briefing, briefing_time")
        .eq("user_id", userId)
        .maybeSingle();
      const localTime = now.slice(11, 16);
      const briefingTime = notificationPreferences?.briefing_time?.slice(0, 5) ?? "07:30";
      let notificationsDelivered = 0;
      if (
        notificationPreferences?.enabled !== false &&
        notificationPreferences?.daily_briefing !== false &&
        clockDistanceMinutes(localTime, briefingTime) <= 45
      ) {
        const push = await sendPushToUser(userId, `daily-briefing:${date}`, {
          title: "O teu dia está pronto",
          body: `${events.length} compromissos considerados. Abre o Rebuild para veres as 3 decisões que mais importam.`,
          url: "/home",
          tag: `daily-briefing-${date}`,
          category: "daily_briefing",
        });
        notificationsDelivered = push.delivered;
      }

      results.push({ userId, decisionsGenerated, decisionsStale: drift?.changed ?? false, notificationsDelivered });
    } catch (error) {
      // Best-effort across founders: one failure must not block the rest of
      // the batch (there is only one founder today, but this keeps the loop
      // safe as the user base grows). Logged (message only, no payload) so a
      // per-founder failure is diagnosable instead of silently disappearing
      // into a "processed" response that looks successful.
      console.error("cron_founder_processing_error", {
        userId,
        message: error instanceof Error ? error.message : String(error),
      });
      results.push({ userId, decisionsGenerated: false, decisionsStale: false, notificationsDelivered: 0 });
    }
  }

  return NextResponse.json({ processed: results.length, results });
}
