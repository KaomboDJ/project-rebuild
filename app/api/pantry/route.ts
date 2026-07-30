import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createPantryItem, listPantryItems } from "@/lib/pantry/queries";

const createSchema = z.object({
  name: z.string().trim().min(1).max(80),
  category: z.enum(["produce", "protein", "dairy", "grain", "pantry", "frozen", "beverage", "other"]).optional(),
  unit: z.enum(["unidade", "g", "kg", "ml", "l"]).optional(),
  quantity: z.coerce.number().min(0).optional(),
  portable: z.boolean().optional(),
  perishable: z.boolean().optional(),
  expiresOn: z.string().date().nullable().optional(),
});

export async function GET() {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return NextResponse.json({ error: "supabase-not-configured" }, { status: 503 });

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  try {
    const items = await listPantryItems(supabase, user.id);
    return NextResponse.json({ items });
  } catch {
    return NextResponse.json({ error: "list-failed" }, { status: 500 });
  }
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
    const item = await createPantryItem(supabase, user.id, parsed.data);
    return NextResponse.json({ item }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "create-failed" }, { status: 500 });
  }
}
