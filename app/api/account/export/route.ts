import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const USER_TABLES = [
  "profiles",
  "daily_check_ins",
  "decision_runs",
  "decisions",
  "decision_feedback",
  "coach_conversations",
  "coach_messages",
  "pantry_items",
  "inventory_events",
  "shopping_lists",
  "shopping_list_items",
  "nutrition_profiles",
  "meal_plans",
  "meal_plan_items",
  "muted_rules",
  "founder_notes",
  "daily_briefings",
  "notification_preferences",
  "notification_deliveries",
  "calendar_sources",
  "health_sources",
  "health_observations",
  "health_sync_runs",
] as const;

/**
 * Portable, self-service export for an authenticated user. OAuth access and
 * refresh tokens are deliberately excluded: they are credentials, not useful
 * user content, and must never be returned to a browser even in an export.
 */
export async function GET() {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return NextResponse.json({ error: "supabase-not-configured" }, { status: 503 });

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const admin = createSupabaseAdminClient();
  const results = await Promise.all(
    USER_TABLES.map(async (table) => {
      const { data, error } = await admin.from(table).select("*").eq("user_id", user.id);
      if (error) throw new Error(`export_${table}_failed`);
      return [table, data ?? []] as const;
    })
  );

  const { data: calendarConnections, error: calendarError } = await admin
    .from("calendar_connections")
    .select(
      "id,provider,scopes,calendar_id,google_account_email,label,is_primary,created_at,updated_at"
    )
    .eq("user_id", user.id);
  if (calendarError) {
    return NextResponse.json({ error: "export-failed" }, { status: 500 });
  }

  const payload = {
    exportedAt: new Date().toISOString(),
    account: { id: user.id, email: user.email ?? null, createdAt: user.created_at },
    data: Object.fromEntries([...results, ["calendar_connections", calendarConnections ?? []]]),
  };

  const date = payload.exportedAt.slice(0, 10);
  return new NextResponse(JSON.stringify(payload, null, 2), {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="project-rebuild-export-${date}.json"`,
      "Cache-Control": "no-store",
    },
  });
}
