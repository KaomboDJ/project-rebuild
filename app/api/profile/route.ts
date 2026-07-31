import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { PRIMARY_OBJECTIVES } from "@/lib/profile/onboarding";

// UX Hardening release (docs/17_UX_AUDIT.md, S1): the onboarding form was
// previously the ONLY way to ever write a `profiles` row, and it upserts
// with `onboarding_completed: true` unconditionally - reusing that action
// for edits would be a footgun (a stray retry could theoretically double as
// an insert-shaped write). This route intentionally only ever UPDATEs an
// existing row scoped to the caller's own `user_id`, never inserts one, so
// it can never create a duplicate profile and can never touch another
// user's row even if the request body were forged - `auth.uid() = user_id`
// is enforced twice: once here explicitly, and again by the
// `profiles_update_own` RLS policy regardless of what this handler does.

const TIME_RE = /^([01][0-9]|2[0-3]):[0-5][0-9]$/;
const objectiveValues = PRIMARY_OBJECTIVES.map((o) => o.value) as [string, ...string[]];
const WEEKDAY_VALUES = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"] as const;

const updateSchema = z.object({
  preferredName: z.string().trim().min(1).max(80),
  timezone: z.string().trim().min(1).max(80),
  currentIdentity: z.string().trim().min(1).max(500),
  desiredIdentity: z.string().trim().min(1).max(500),
  primaryObjective: z.enum(objectiveValues),
  preferredTrainingDays: z.array(z.enum(WEEKDAY_VALUES)).min(1),
  preferredTrainingTime: z.string().regex(TIME_RE),
  typicalDinnerTime: z.string().regex(TIME_RE),
  targetSleepTime: z.string().regex(TIME_RE),
  workingHoursStart: z.string().regex(TIME_RE),
  workingHoursEnd: z.string().regex(TIME_RE),
  currentConstraints: z.string().trim().min(1).max(1000),
  interventionTone: z.string().trim().min(1).max(300),
});

export async function GET() {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return NextResponse.json({ error: "supabase-not-configured" }, { status: 503 });

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();
  if (error) return NextResponse.json({ error: "load-failed" }, { status: 500 });
  if (!profile) return NextResponse.json({ error: "profile-not-found" }, { status: 404 });

  return NextResponse.json({ profile });
}

export async function PUT(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return NextResponse.json({ error: "supabase-not-configured" }, { status: 503 });

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const parsed = updateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid-body" }, { status: 400 });
  const draft = parsed.data;

  if (draft.workingHoursEnd <= draft.workingHoursStart) {
    return NextResponse.json({ error: "invalid-working-hours" }, { status: 400 });
  }

  // Confirm a row already exists before updating - onboarding is the only
  // flow allowed to create one. A missing row here means the (app) layout's
  // onboarding-completed gate was somehow bypassed; fail loudly rather than
  // silently creating a fresh, incomplete profile via upsert.
  const { data: existing } = await supabase
    .from("profiles")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!existing) return NextResponse.json({ error: "profile-not-found" }, { status: 404 });

  const { data: profile, error } = await supabase
    .from("profiles")
    .update({
      preferred_name: draft.preferredName,
      timezone: draft.timezone,
      current_identity: draft.currentIdentity,
      desired_identity: draft.desiredIdentity,
      primary_objective: draft.primaryObjective as never,
      preferred_training_days: draft.preferredTrainingDays,
      preferred_training_time: draft.preferredTrainingTime,
      typical_dinner_time: draft.typicalDinnerTime,
      target_sleep_time: draft.targetSleepTime,
      working_hours: { start: draft.workingHoursStart, end: draft.workingHoursEnd },
      current_constraints: draft.currentConstraints,
      intervention_tone: draft.interventionTone,
    })
    .eq("user_id", user.id)
    .select("*")
    .single();

  if (error || !profile) return NextResponse.json({ error: "save-failed" }, { status: 500 });
  return NextResponse.json({ profile });
}
