import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createFounderNote, listFounderNotes } from "@/lib/decision-engine/queries";
import { RULE_LABELS } from "@/lib/decision-engine/rule-catalog";

const createSchema = z.object({
  content: z.string().trim().min(1).max(2000),
  ruleId: z
    .string()
    .refine((id) => id in RULE_LABELS, "unknown-rule-id")
    .nullable()
    .optional(),
});

/** Founder-authored notes (/settings/memory) — general (ruleId null, folded
 * into the Coach's system prompt) or scoped to one rule's insight card. */
export async function GET() {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return NextResponse.json({ error: "supabase-not-configured" }, { status: 503 });

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const notes = await listFounderNotes(supabase, user.id);
  return NextResponse.json({ notes });
}

export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return NextResponse.json({ error: "supabase-not-configured" }, { status: 503 });

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const parsed = createSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid-body" }, { status: 400 });

  try {
    const note = await createFounderNote(supabase, user.id, parsed.data);
    return NextResponse.json({ note });
  } catch {
    return NextResponse.json({ error: "save-failed" }, { status: 500 });
  }
}
