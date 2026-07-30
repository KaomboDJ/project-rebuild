import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { deletePantryItem, recordInventoryEvent } from "@/lib/pantry/queries";

// Quick inventory actions (Part 2): -1 / +1 / Consumido / Terminou / Ajustar
// quantidade. All expressed as a signed quantityDelta so the UI never has
// to know the item's current quantity to build the request - it just says
// "the founder tapped -1" and the RPC (apply_inventory_event) does the
// read-modify-write atomically.
const patchSchema = z.object({
  eventType: z.enum(["purchase", "consume", "adjust", "waste"]),
  quantityDelta: z.coerce.number().refine((n) => n !== 0, "quantityDelta não pode ser 0"),
  note: z.string().max(200).optional(),
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
    const event = await recordInventoryEvent(supabase, {
      pantryItemId: id,
      eventType: parsed.data.eventType,
      quantityDelta: parsed.data.quantityDelta,
      note: parsed.data.note,
    });
    return NextResponse.json({ event });
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
    await deletePantryItem(supabase, user.id, id);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "delete-failed" }, { status: 500 });
  }
}
