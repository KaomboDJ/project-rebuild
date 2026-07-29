import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/database.types";

type DecisionUpdate = Database["public"]["Tables"]["decisions"]["Update"];

const patchSchema = z.object({
  status: z.enum(["accepted", "edited", "completed", "skipped"]),
  skippedReason: z.string().max(280).optional(),
  recommendedAction: z.string().min(1).max(280).optional(),
});

/**
 * Accept / Edit / Complete / Skip a single decision. RLS already restricts
 * this to the row's owner; the explicit `.eq("user_id", user.id)` below is
 * defense in depth, not a substitute for it.
 */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return NextResponse.json({ error: "supabase-not-configured" }, { status: 503 });
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const parsed = patchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid-body" }, { status: 400 });
  }

  const { status, skippedReason, recommendedAction } = parsed.data;

  const update: DecisionUpdate = { status };
  if (status === "completed") update.completed_at = new Date().toISOString();
  if (status === "skipped" && skippedReason) update.skipped_reason = skippedReason;
  if (status === "edited" && recommendedAction) update.recommended_action = recommendedAction;

  const { data, error } = await supabase
    .from("decisions")
    .update(update)
    .eq("id", id)
    .eq("user_id", user.id)
    .select("*")
    .single();

  if (error || !data) {
    return NextResponse.json({ error: "update-failed" }, { status: 404 });
  }

  return NextResponse.json({ decision: data });
}
