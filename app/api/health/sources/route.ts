import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { HEALTH_METRICS, HEALTH_PROVIDERS } from "@/lib/health/types";
import { listHealthSources, upsertHealthSource } from "@/lib/health/queries";

const sourceSchema = z.object({
  sourceKey: z.string().trim().min(1).max(200),
  provider: z.enum(HEALTH_PROVIDERS),
  label: z.string().trim().min(1).max(120),
  deviceName: z.string().trim().max(120).nullable().optional(),
  authorizedMetrics: z.array(z.enum(HEALTH_METRICS)).min(1).max(HEALTH_METRICS.length),
});

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
  const auth = await authenticated();
  if (!auth) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  const parsed = sourceSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid-body" }, { status: 400 });
  try {
    const source = await upsertHealthSource(auth.supabase, auth.user.id, parsed.data);
    return NextResponse.json({ source }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "save-failed" }, { status: 500 });
  }
}

