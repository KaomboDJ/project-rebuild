import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getTrainingProfile, upsertTrainingProfile } from "@/lib/training/queries";

// Mirrors lib/nutrition/workout-types.ts's TrainingCategory union as a
// literal tuple so z.enum infers the exact same type, instead of casting
// the plain TrainingCategory[] array (which would widen to `string[]` and
// lose literal-type checking against upsertTrainingProfile's input type).
const TRAINING_CATEGORY_VALUES = [
  "calistenia", "cardio_leve", "cardio_pesado", "hipertrofia",
  "artes_marciais_strike", "wrestling_grappling", "mobilidade", "parkour",
] as const;

const updateSchema = z.object({
  preferredCategories: z.array(z.enum(TRAINING_CATEGORY_VALUES)).max(8).optional(),
  sessionDurationMinutes: z.coerce.number().int().min(10).max(180).optional(),
  location: z.enum(["home", "gym", "outdoor", "mixed"]).optional(),
  intensityPreference: z.enum(["low", "medium", "high"]).optional(),
  varietyPreference: z.enum(["low", "medium", "high"]).optional(),
  physicalLimitations: z.string().max(1000).optional(),
});

export async function GET() {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return NextResponse.json({ error: "supabase-not-configured" }, { status: 503 });

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const profile = await getTrainingProfile(supabase, user.id);
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

  try {
    const profile = await upsertTrainingProfile(supabase, user.id, parsed.data);
    return NextResponse.json({ profile });
  } catch {
    return NextResponse.json({ error: "save-failed" }, { status: 500 });
  }
}
