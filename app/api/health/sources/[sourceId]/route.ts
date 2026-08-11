import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { deleteHealthSource, setHealthSourceCoaching } from "@/lib/health/queries";

const updateSchema = z.object({ useForCoaching: z.boolean() });

async function authenticated() {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return null;
  const { data: { user } } = await supabase.auth.getUser();
  return user ? { supabase, user } : null;
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ sourceId: string }> }) {
  const auth = await authenticated();
  if (!auth) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  const parsed = updateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid-body" }, { status: 400 });
  const { sourceId } = await params;
  try {
    await setHealthSourceCoaching(auth.supabase, auth.user.id, sourceId, parsed.data.useForCoaching);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "update-failed" }, { status: 500 });
  }
}

/** Disconnecting a source deletes its imported readings by FK cascade. */
export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ sourceId: string }> }) {
  const auth = await authenticated();
  if (!auth) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  const { sourceId } = await params;
  try {
    await deleteHealthSource(auth.supabase, auth.user.id, sourceId);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "delete-failed" }, { status: 500 });
  }
}

