import "server-only";

import webpush from "web-push";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getServerEnvironment } from "@/lib/env/server";
import { nowInTimeZone } from "@/lib/date/timezone";
import { getSleepPhase, resolveSleepSchedule } from "@/lib/sleep/schedule";

export type NotificationCategory = "daily_briefing" | "decision_reminders" | "nutrition_reminders";

export interface RebuildPushPayload {
  title: string;
  body: string;
  url: string;
  tag: string;
  category: NotificationCategory;
}

export function isPushConfigured(): boolean {
  const env = getServerEnvironment();
  return Boolean(env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY);
}

export function getVapidPublicKey(): string | null {
  return getServerEnvironment().VAPID_PUBLIC_KEY ?? null;
}

function configureWebPush(): boolean {
  const env = getServerEnvironment();
  if (!env.VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY) return false;
  webpush.setVapidDetails(env.VAPID_SUBJECT, env.VAPID_PUBLIC_KEY, env.VAPID_PRIVATE_KEY);
  return true;
}

/** Notifications are always subordinate to recovery. A configured sleep or
 * wind-down window is a hard quiet period; no category toggle can bypass it. */
async function userCanReceiveNow(userId: string, category: NotificationCategory): Promise<boolean> {
  const admin = createSupabaseAdminClient();
  const [{ data: profile }, { data: preferences }] = await Promise.all([
    admin
      .from("profiles")
      .select("timezone, target_sleep_time, target_wake_time, weekend_sleep_time, weekend_wake_time, wind_down_minutes, sleep_schedule_type")
      .eq("user_id", userId)
      .maybeSingle(),
    admin.from("notification_preferences").select("*").eq("user_id", userId).maybeSingle(),
  ]);

  if (preferences && (!preferences.enabled || !preferences[category])) return false;
  if (!profile) return false;

  const now = nowInTimeZone(profile.timezone);
  const schedule = resolveSleepSchedule(now.dateKey, {
    targetSleepTime: profile.target_sleep_time,
    targetWakeTime: profile.target_wake_time,
    weekendSleepTime: profile.weekend_sleep_time,
    weekendWakeTime: profile.weekend_wake_time,
    windDownMinutes: profile.wind_down_minutes,
    sleepScheduleType: profile.sleep_schedule_type,
  });
  return getSleepPhase(now.time, schedule) === "awake";
}

export interface PushDeliveryResult {
  delivered: number;
  removed: number;
  skipped: "not-configured" | "quiet-hours" | "duplicate" | "no-subscriptions" | null;
}

export async function sendPushToUser(
  userId: string,
  notificationKey: string,
  payload: RebuildPushPayload
): Promise<PushDeliveryResult> {
  if (!configureWebPush()) return { delivered: 0, removed: 0, skipped: "not-configured" };
  if (!(await userCanReceiveNow(userId, payload.category))) {
    return { delivered: 0, removed: 0, skipped: "quiet-hours" };
  }

  const admin = createSupabaseAdminClient();
  const { data: prior } = await admin
    .from("notification_deliveries")
    .select("id")
    .eq("user_id", userId)
    .eq("notification_key", notificationKey)
    .maybeSingle();
  if (prior) return { delivered: 0, removed: 0, skipped: "duplicate" };

  const { data: subscriptions } = await admin
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth, failure_count")
    .eq("user_id", userId)
    .eq("enabled", true);
  if (!subscriptions?.length) return { delivered: 0, removed: 0, skipped: "no-subscriptions" };

  let delivered = 0;
  let removed = 0;
  for (const subscription of subscriptions) {
    try {
      await webpush.sendNotification(
        {
          endpoint: subscription.endpoint,
          keys: { p256dh: subscription.p256dh, auth: subscription.auth },
        },
        JSON.stringify(payload),
        { TTL: 60 * 60 * 6, urgency: "normal" }
      );
      delivered += 1;
      await admin
        .from("push_subscriptions")
        .update({ failure_count: 0, last_success_at: new Date().toISOString() })
        .eq("id", subscription.id);
    } catch (error) {
      const statusCode = typeof error === "object" && error && "statusCode" in error
        ? Number((error as { statusCode?: unknown }).statusCode)
        : 0;
      if (statusCode === 404 || statusCode === 410) {
        await admin.from("push_subscriptions").delete().eq("id", subscription.id);
        removed += 1;
      } else {
        await admin
          .from("push_subscriptions")
          .update({ failure_count: subscription.failure_count + 1 })
          .eq("id", subscription.id);
      }
    }
  }

  if (delivered > 0) {
    await admin.from("notification_deliveries").insert({ user_id: userId, notification_key: notificationKey });
  }
  return { delivered, removed, skipped: null };
}
