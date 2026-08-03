import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const schema = z.object({
  enabled: z.boolean(),
  dailyBriefing: z.boolean(),
  decisionReminders: z.boolean(),
  nutritionReminders: z.boolean(),
  briefingTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
});

export async function PUT(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return NextResponse.json({ error: "unavailable" }, { status: 503 });
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid-preferences" }, { status: 400 });
  const { error } = await supabase.from("notification_preferences").upsert({
    user_id: user.id,
    enabled: parsed.data.enabled,
    daily_briefing: parsed.data.dailyBriefing,
    decision_reminders: parsed.data.decisionReminders,
    nutrition_reminders: parsed.data.nutritionReminders,
    briefing_time: parsed.data.briefingTime,
  }, { onConflict: "user_id" });
  return error
    ? NextResponse.json({ error: "save-failed" }, { status: 500 })
    : NextResponse.json({ ok: true });
}
