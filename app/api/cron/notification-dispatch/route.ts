import { NextRequest, NextResponse } from "next/server";
import { getServerEnvironment } from "@/lib/env/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getFounderNow } from "@/lib/date/founder-now";
import { dispatchTimedNotificationsForUser } from "@/lib/notifications/dispatch";
import { hasValidBearerToken } from "@/lib/security/bearer";

export async function GET(request: NextRequest) {
  const { NOTIFICATION_CRON_SECRET } = getServerEnvironment();
  if (!NOTIFICATION_CRON_SECRET) {
    return NextResponse.json({ error: "cron-not-configured" }, { status: 503 });
  }
  if (!hasValidBearerToken(request.headers.get("authorization"), NOTIFICATION_CRON_SECRET)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const admin = createSupabaseAdminClient();
  const { data: profiles, error } = await admin
    .from("profiles")
    .select(
      "user_id, target_sleep_time, target_wake_time, weekend_sleep_time, weekend_wake_time, wind_down_minutes, sleep_schedule_type, typical_dinner_time"
    )
    .eq("onboarding_completed", true);

  if (error) {
    console.error("notification_dispatch_profiles_error", {
      message: error.message,
      code: error.code,
    });
    return NextResponse.json({ error: "failed-to-list-founders" }, { status: 500 });
  }

  let attempted = 0;
  let delivered = 0;
  let removed = 0;
  let failed = 0;

  for (const profile of profiles ?? []) {
    try {
      const { date, now } = await getFounderNow(admin, profile.user_id);
      const outcome = await dispatchTimedNotificationsForUser(
        admin,
        profile,
        date,
        now.slice(11, 16)
      );
      attempted += outcome.attempted;
      delivered += outcome.delivered;
      removed += outcome.removed;
    } catch (dispatchError) {
      failed += 1;
      console.error("notification_dispatch_founder_error", {
        userId: profile.user_id,
        message: dispatchError instanceof Error ? dispatchError.message : String(dispatchError),
      });
    }
  }

  return NextResponse.json({ processed: profiles?.length ?? 0, attempted, delivered, removed, failed });
}

// Supabase Cron invokes external endpoints through pg_net POST requests. The
// same authorization and idempotent dispatcher are shared with Vercel's GET
// convention so neither scheduler gets a privileged alternate code path.
export const POST = GET;
