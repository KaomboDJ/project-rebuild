import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { decryptToken } from "@/lib/crypto/tokens";

type Admin = SupabaseClient<Database>;

/**
 * "Reiniciar conta de teste" (Settings danger zone) — wipes every
 * user-owned table so the founder can walk through onboarding again as if
 * signing up for the first time, WITHOUT losing their Supabase Auth login
 * (unlike app/api/account/route.ts's full account deletion, which removes
 * the auth.users row too via cascade).
 *
 * Every table below has its own `user_id` column (confirmed against every
 * migration in supabase/migrations/ before writing this, not assumed) —
 * deletes are scoped to that column directly rather than relied on cascade,
 * so this is correct regardless of how any individual FK's ON DELETE
 * behavior is configured. Order is still child-before-parent as a second,
 * independent safety net in case any of those cascades are ever changed:
 * decision_feedback/coach_messages/inventory_events/meal_plan_items/
 * training_plan_items/shopping_list_items/notification_deliveries before
 * the rows they reference (decisions, coach_conversations, pantry_items,
 * meal_plans, training_plans, shopping_lists), and decisions before
 * decision_runs.
 *
 * Deliberately NOT touched: `recipes`/`recipe_ingredients` and
 * `workout_sessions` (all shared, global curated libraries — not per-user
 * data at all).
 *
 * Must run with the admin/service-role client: push_subscriptions and
 * notification_deliveries explicitly revoke all grants from `authenticated`
 * (supabase/migrations/202608030002_push_notifications.sql) — only
 * service_role can delete from them.
 */
export async function resetTestAccountData(admin: Admin, userId: string): Promise<void> {
  await revokeGoogleConnections(admin, userId);

  const childTables = [
    "decision_feedback",
    "coach_messages",
    "inventory_events",
    "meal_plan_items",
    "training_plan_items",
    "shopping_list_items",
    "notification_deliveries",
  ] as const;
  for (const table of childTables) {
    const { error } = await admin.from(table).delete().eq("user_id", userId);
    if (error) throw new Error(`reset-failed:${table}:${error.message}`);
  }

  const parentTables = [
    "decisions",
    "decision_runs",
    "daily_briefings",
    "daily_check_ins",
    "coach_conversations",
    "pantry_items",
    "shopping_lists",
    "meal_plans",
    "nutrition_profiles",
    "training_plans",
    "training_profiles",
    "muted_rules",
    "founder_notes",
    "push_subscriptions",
    "notification_preferences",
    "calendar_sources",
    "calendar_connections",
    "profiles",
  ] as const;
  for (const table of parentTables) {
    const { error } = await admin.from(table).delete().eq("user_id", userId);
    if (error) throw new Error(`reset-failed:${table}:${error.message}`);
  }
}

/** Best-effort — mirrors app/api/account/route.ts's revokeGoogleConnections
 * exactly (revoke failures must never block the reset itself, since the
 * rows are being deleted either way). Takes the already-constructed admin
 * client rather than building its own, since the caller already has one. */
async function revokeGoogleConnections(admin: Admin, userId: string): Promise<void> {
  const { data: connections } = await admin
    .from("calendar_connections")
    .select("provider, encrypted_access_token, encrypted_refresh_token")
    .eq("user_id", userId)
    .eq("provider", "google");

  for (const connection of connections ?? []) {
    for (const packed of [connection.encrypted_access_token, connection.encrypted_refresh_token]) {
      if (!packed) continue;
      try {
        const token = decryptToken(packed);
        await fetch("https://oauth2.googleapis.com/revoke", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: `token=${encodeURIComponent(token)}`,
        });
      } catch {
        // Best-effort only.
      }
    }
  }
}
