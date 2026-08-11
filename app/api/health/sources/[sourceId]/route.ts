import { type NextRequest } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { deleteHealthSource, setHealthSourceCoaching } from "@/lib/health/queries";
import { assertTrustedBrowserOrigin, privateJson, readBoundedJson } from "@/lib/security/request";

const updateSchema = z.object({ useForCoaching: z.boolean() });

async function authenticated() {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return null;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user ? { supabase, user } : null;
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ sourceId: string }> }) {
  try {
    assertTrustedBrowserOrigin(request);
  } catch {
    return privateJson({ error: "untrusted-origin" }, { status: 403 });
  }
  const auth = await authenticated();
  if (!auth) return privateJson({ error: "unauthenticated" }, { status: 401 });
  const parsed = updateSchema.safeParse(await readBoundedJson(request, 4 * 1024).catch(() => null));
  if (!parsed.success) return privateJson({ error: "invalid-body" }, { status: 400 });
  const { sourceId } = await params;
  try {
    await setHealthSourceCoaching(auth.supabase, auth.user.id, sourceId, parsed.data.useForCoaching);
    return privateJson({ ok: true });
  } catch {
    return privateJson({ error: "update-failed" }, { status: 500 });
  }
}

/** Disconnecting a source deletes its imported readings by FK cascade. */
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ sourceId: string }> }) {
  try {
    assertTrustedBrowserOrigin(request);
  } catch {
    return privateJson({ error: "untrusted-origin" }, { status: 403 });
  }
  const auth = await authenticated();
  if (!auth) return privateJson({ error: "unauthenticated" }, { status: 401 });
  const { sourceId } = await params;
  try {
    await deleteHealthSource(auth.supabase, auth.user.id, sourceId);
    return privateJson({ ok: true });
  } catch {
    return privateJson({ error: "delete-failed" }, { status: 500 });
  }
}
