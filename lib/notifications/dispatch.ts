import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getSleepPhase, resolveSleepSchedule } from "@/lib/sleep/schedule";
import { sendPushToUser } from "@/lib/notifications/push";
import {
  DECISION_REMINDER_LEAD_MINUTES,
  DAILY_BRIEFING_LEAD_MINUTES,
  DINNER_REMINDER_LEAD_MINUTES,
  dailyBriefingKey,
  decisionReminderKey,
  isReminderDue,
  nutritionReminderKey,
} from "@/lib/notifications/schedule";

type AdminClient = ReturnType<typeof createSupabaseAdminClient>;

export interface NotificationDispatchProfile {
  user_id: string;
  target_sleep_time: string;
  target_wake_time: string;
  weekend_sleep_time: string | null;
  weekend_wake_time: string | null;
  wind_down_minutes: number;
  sleep_schedule_type: "regular" | "shift";
  typical_dinner_time: string;
}

export interface TimedNotificationResult {
  attempted: number;
  delivered: number;
  removed: number;
}

function emptyResult(): TimedNotificationResult {
  return { attempted: 0, delivered: 0, removed: 0 };
}

function addDelivery(
  result: TimedNotificationResult,
  delivery: Awaited<ReturnType<typeof sendPushToUser>>
): void {
  result.attempted += 1;
  result.delivered += delivery.delivered;
  result.removed += delivery.removed;
}

function targetIsAwake(profile: NotificationDispatchProfile, date: string, target: string): boolean {
  const schedule = resolveSleepSchedule(date, {
    targetSleepTime: profile.target_sleep_time,
    targetWakeTime: profile.target_wake_time,
    weekendSleepTime: profile.weekend_sleep_time,
    weekendWakeTime: profile.weekend_wake_time,
    windDownMinutes: profile.wind_down_minutes,
    sleepScheduleType: profile.sleep_schedule_type,
  });
  return getSleepPhase(target, schedule) === "awake";
}

/**
 * Sends the notifications whose lead-time window is open right now. Delivery
 * remains best-effort and idempotent: notification_deliveries owns the final
 * duplicate guard, while sendPushToUser enforces category preferences and
 * quiet hours again immediately before transmission.
 */
export async function dispatchTimedNotificationsForUser(
  admin: AdminClient,
  profile: NotificationDispatchProfile,
  date: string,
  localTime: string
): Promise<TimedNotificationResult> {
  const result = emptyResult();

  const { data: preferences } = await admin
    .from("notification_preferences")
    .select("enabled, daily_briefing, decision_reminders, nutrition_reminders, briefing_time")
    .eq("user_id", profile.user_id)
    .maybeSingle();

  if (preferences?.enabled === false) return result;

  if (preferences?.daily_briefing !== false) {
    const briefingTime = preferences?.briefing_time?.slice(0, 5) ?? "07:30";
    if (
      targetIsAwake(profile, date, briefingTime) &&
      isReminderDue(localTime, briefingTime, DAILY_BRIEFING_LEAD_MINUTES)
    ) {
      const { data: briefing } = await admin
        .from("daily_briefings")
        .select("summary")
        .eq("user_id", profile.user_id)
        .eq("date", date)
        .maybeSingle();

      if (briefing) {
        const delivery = await sendPushToUser(
          profile.user_id,
          dailyBriefingKey(date),
          {
            title: "O teu dia está pronto",
            body: briefing.summary,
            url: "/home",
            tag: `daily-briefing-${date}`,
            category: "daily_briefing",
          }
        );
        addDelivery(result, delivery);
      }
    }
  }

  if (preferences?.decision_reminders !== false) {
    const { data: decisions } = await admin
      .from("decisions")
      .select("id, title, recommended_start")
      .eq("user_id", profile.user_id)
      .eq("date", date)
      .in("status", ["proposed", "accepted", "edited"])
      .not("recommended_start", "is", null);

    for (const decision of decisions ?? []) {
      if (!decision.recommended_start) continue;
      const targetTime = decision.recommended_start.slice(11, 16);
      if (!targetIsAwake(profile, date, targetTime)) continue;
      if (!isReminderDue(localTime, targetTime, DECISION_REMINDER_LEAD_MINUTES)) continue;

      const delivery = await sendPushToUser(
        profile.user_id,
        decisionReminderKey(decision.id, decision.recommended_start),
        {
          title: "A tua próxima decisão aproxima-se",
          body: `${decision.title} · ${targetTime}`,
          url: "/today",
          tag: `decision-reminder-${decision.id}`,
          category: "decision_reminders",
        }
      );
      addDelivery(result, delivery);
    }
  }

  if (preferences?.nutrition_reminders !== false) {
    const dinnerTime = profile.typical_dinner_time.slice(0, 5);
    if (
      targetIsAwake(profile, date, dinnerTime) &&
      isReminderDue(localTime, dinnerTime, DINNER_REMINDER_LEAD_MINUTES)
    ) {
      const { data: dinner } = await admin
        .from("meal_plan_items")
        .select("id, recipe_id")
        .eq("user_id", profile.user_id)
        .eq("day_date", date)
        .eq("meal_slot", "dinner")
        .eq("status", "planned")
        .limit(1)
        .maybeSingle();

      if (dinner) {
        const { data: recipe } = await admin
          .from("recipes")
          .select("name")
          .eq("id", dinner.recipe_id)
          .maybeSingle();
        const mealName = recipe?.name ?? "o jantar que planeaste";
        const delivery = await sendPushToUser(
          profile.user_id,
          nutritionReminderKey(dinner.id, date, dinnerTime),
          {
            title: "O jantar já está decidido",
            body: `${mealName} às ${dinnerTime}. Confirma agora se precisas de preparar ou descongelar alguma coisa.`,
            url: "/nutrition/plan",
            tag: `nutrition-reminder-${dinner.id}`,
            category: "nutrition_reminders",
          }
        );
        addDelivery(result, delivery);
      }
    }
  }

  return result;
}
