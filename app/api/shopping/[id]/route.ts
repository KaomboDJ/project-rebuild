import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { deleteShoppingItem, markShoppingItemPurchased } from "@/lib/pantry/queries";

const patchSchema = z.object({
  purchased: z.literal(true),
  actualQuantity: z.coerce.number().min(0).optional(),
});

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  if (!supabase) return NextResponse.json({ error: "supabase-not-configured" }, { status: 503 });

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const parsed = patchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid-body" }, { status: 400 });

  try {
    const item = await markShoppingItemPurchased(supabase, id, parsed.data.actualQuantity);
    return NextResponse.json({ item });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "update-failed" }, { status: 400 });
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  if (!supabase) return NextResponse.json({ error: "supabase-not-configured" }, { status: 503 });

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  try {
    await deleteShoppingItem(supabase, user.id, id);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "delete-failed" }, { status: 500 });
  }
}
