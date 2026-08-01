import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { confirmDayPlan } from "@/lib/day-plan/confirm-day-plan";

const bodySchema = z.object({ connectionId: z.string().uuid().optional() });

export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return NextResponse.json({ error: "supabase-not-configured" }, { status: 503 });
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  const parsed = bodySchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "invalid-body" }, { status: 400 });
  try {
    return NextResponse.json(await confirmDayPlan(supabase, user.id, parsed.data));
  } catch (error) {
    if (error instanceof Error && error.message === "no-decision-run-for-today") {
      return NextResponse.json({ error: error.message }, { status: 422 });
    }
    return NextResponse.json({ error: "confirm-failed" }, { status: 500 });
  }
}
