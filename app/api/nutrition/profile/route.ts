import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getNutritionProfile, upsertNutritionProfile } from "@/lib/nutrition/queries";

const updateSchema = z.object({
  goal: z.enum(["lose-weight", "maintain-weight", "build-muscle", "manage-blood-sugar", "improve-energy"]).optional(),
  dietStyle: z.enum(["omnivore", "vegetarian", "vegan", "pescatarian", "low-carb", "mediterranean"]).optional(),
  allergies: z.array(z.string().trim().min(1)).max(20).optional(),
  exclusions: z.array(z.string().trim().min(1)).max(40).optional(),
  medicalConstraints: z.string().max(1000).optional(),
  mealsPerDay: z.coerce.number().int().min(2).max(5).optional(),
  includeSnack: z.boolean().optional(),
  peopleCount: z.coerce.number().int().min(1).max(12).optional(),
  cookingTimeMinutes: z.coerce.number().int().min(5).max(180).optional(),
  budgetPreference: z.enum(["low", "medium", "high"]).optional(),
  varietyPreference: z.enum(["low", "medium", "high"]).optional(),
  targetCalories: z.coerce.number().int().positive().nullable().optional(),
  targetProteinG: z.coerce.number().int().min(0).nullable().optional(),
  targetCarbsG: z.coerce.number().int().min(0).nullable().optional(),
  targetFatG: z.coerce.number().int().min(0).nullable().optional(),
  macroSource: z.enum(["system-estimate", "user-provided", "clinician-provided"]).optional(),
});

export async function GET() {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return NextResponse.json({ error: "supabase-not-configured" }, { status: 503 });

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const profile = await getNutritionProfile(supabase, user.id);
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
    const profile = await upsertNutritionProfile(supabase, user.id, parsed.data);
    return NextResponse.json({ profile });
  } catch {
    return NextResponse.json({ error: "save-failed" }, { status: 500 });
  }
}
