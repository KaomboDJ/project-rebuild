import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { addShoppingItem, getOrCreateOpenShoppingList, listShoppingItems } from "@/lib/pantry/queries";

const createSchema = z.object({
  name: z.string().trim().min(1).max(80),
  quantity: z.coerce.number().min(0).optional(),
  unit: z.enum(["unidade", "g", "kg", "ml", "l"]).optional(),
  pantryItemId: z.string().uuid().nullable().optional(),
});

export async function GET() {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return NextResponse.json({ error: "supabase-not-configured" }, { status: 503 });

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  try {
    const listId = await getOrCreateOpenShoppingList(supabase, user.id);
    const items = await listShoppingItems(supabase, user.id, listId);
    return NextResponse.json({ listId, items });
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
    const listId = await getOrCreateOpenShoppingList(supabase, user.id);
    const item = await addShoppingItem(supabase, user.id, listId, parsed.data);
    return NextResponse.json({ item }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "create-failed" }, { status: 500 });
  }
}
