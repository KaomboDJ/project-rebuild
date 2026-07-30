import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { muteRule, unmuteRule } from "@/lib/decision-engine/queries";
import { RULE_LABELS } from "@/lib/decision-engine/rule-catalog";

const bodySchema = z.object({
  ruleId: z.string().refine((id) => id in RULE_LABELS, "unknown-rule-id"),
});

/** Mute a rule — the founder's absolute, editable opt-out (rules.ts's
 * generateCandidates filters it out entirely before scoring). */
export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return NextResponse.json({ error: "supabase-not-configured" }, { status: 503 });

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid-body" }, { status: 400 });

  try {
    await muteRule(supabase, user.id, parsed.data.ruleId);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "mute-failed" }, { status: 500 });
  }
}

/** Unmute — takes the ruleId in the JSON body (not a query string) to keep
 * this symmetrical with POST and avoid any personal/decision data ever
 * appearing in a URL. */
export async function DELETE(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return NextResponse.json({ error: "supabase-not-configured" }, { status: 503 });

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid-body" }, { status: 400 });

  try {
    await unmuteRule(supabase, user.id, parsed.data.ruleId);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "unmute-failed" }, { status: 500 });
  }
}
