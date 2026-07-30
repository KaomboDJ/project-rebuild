import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const feedbackSchema = z.object({
  useful: z.boolean(),
});

/**
 * Records "Útil / Não útil" for a single decision (pre-pilot stabilization
 * sprint - see PROJECT_REBUILD_STATE.md). One row per (user, decision) via
 * upsert, so re-tapping the other option corrects it rather than
 * accumulating duplicate feedback. Free-text `feedback` isn't collected here
 * yet - the founder can extend this later if a reason field turns out to be
 * needed; the thumbs signal is what the 14-day pilot's metrics call for.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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

  const parsed = feedbackSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid-body" }, { status: 400 });
  }

  // Confirms the decision belongs to this user before recording feedback on
  // it - RLS on `decisions` already scopes the read, this is defense in
  // depth plus how we surface a clean 404 instead of an FK error.
  const { data: decision } = await supabase
    .from("decisions")
    .select("id")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!decision) {
    return NextResponse.json({ error: "not-found" }, { status: 404 });
  }

  const { data, error } = await supabase
    .from("decision_feedback")
    .upsert(
      { user_id: user.id, decision_id: id, useful: parsed.data.useful },
      { onConflict: "user_id,decision_id" }
    )
    .select("useful")
    .single();

  if (error || !data) {
    return NextResponse.json({ error: "feedback-failed" }, { status: 500 });
  }

  return NextResponse.json({ useful: data.useful });
}
