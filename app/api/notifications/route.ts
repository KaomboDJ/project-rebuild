import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getVapidPublicKey, isPushConfigured } from "@/lib/notifications/push";

const subscriptionSchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({ p256dh: z.string().min(1), auth: z.string().min(1) }),
});

async function requireUser() {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return null;
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

export async function GET() {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  const admin = createSupabaseAdminClient();
  const [{ count }, { data: preferences }] = await Promise.all([
    admin.from("push_subscriptions").select("id", { count: "exact", head: true }).eq("user_id", user.id).eq("enabled", true),
    admin.from("notification_preferences").select("*").eq("user_id", user.id).maybeSingle(),
  ]);
  return NextResponse.json({
    configured: isPushConfigured(),
    publicKey: getVapidPublicKey(),
    subscribed: (count ?? 0) > 0,
    preferences: preferences ?? {
      enabled: true,
      daily_briefing: true,
      decision_reminders: true,
      nutrition_reminders: true,
      briefing_time: "07:30:00",
    },
  });
}

export async function POST(request: NextRequest) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  const parsed = subscriptionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid-subscription" }, { status: 400 });
  const admin = createSupabaseAdminClient();
  const { error } = await admin.from("push_subscriptions").upsert(
    {
      user_id: user.id,
      endpoint: parsed.data.endpoint,
      p256dh: parsed.data.keys.p256dh,
      auth: parsed.data.keys.auth,
      user_agent: request.headers.get("user-agent"),
      enabled: true,
      failure_count: 0,
    },
    { onConflict: "user_id,endpoint" }
  );
  if (error) return NextResponse.json({ error: "save-failed" }, { status: 500 });
  await admin.from("notification_preferences").upsert({ user_id: user.id, enabled: true }, { onConflict: "user_id" });
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: NextRequest) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  const endpoint = request.nextUrl.searchParams.get("endpoint");
  const admin = createSupabaseAdminClient();
  let query = admin.from("push_subscriptions").delete().eq("user_id", user.id);
  if (endpoint) query = query.eq("endpoint", endpoint);
  await query;
  return NextResponse.json({ ok: true });
}
