import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { listHealthSources, upsertHealthSource } from "@/lib/health/queries";
import { healthSourceSchema } from "@/lib/health/import-schema";
import { assertTrustedBrowserOrigin, privateJson, readBoundedJson } from "@/lib/security/request";

async function authenticated() {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return null;
  const { data: { user } } = await supabase.auth.getUser();
  return user ? { supabase, user } : null;
}

export async function GET() {
  const auth = await authenticated();
  if (!auth) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  try {
    return NextResponse.json({ sources: await listHealthSources(auth.supabase, auth.user.id) });
  } catch {
    return NextResponse.json({ error: "load-failed" }, { status: 500 });
  }
}

/** Native companion registration endpoint. It stores source metadata and
 * granted metric names only — never HealthKit/Health Connect credentials. */
export async function POST(request: NextRequest) {
  try {
    assertTrustedBrowserOrigin(request);
  } catch {
    return privateJson({ error: "untrusted-origin" }, { status: 403 });
  }
  const auth = await authenticated();
  if (!auth) return privateJson({ error: "unauthenticated" }, { status: 401 });
  const parsed = healthSourceSchema.safeParse(await readBoundedJson(request, 32 * 1024).catch(() => null));
  if (!parsed.success) return privateJson({ error: "invalid-body" }, { status: 400 });
  try {
    const source = await upsertHealthSource(auth.supabase, auth.user.id, parsed.data);
    return NextResponse.json({ source }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "save-failed" }, { status: 500 });
  }
}
