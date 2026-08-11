import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { HEALTH_METRICS } from "@/lib/health/types";
import { importHealthObservations } from "@/lib/health/queries";

const metadataValue = z.union([z.string(), z.number(), z.boolean(), z.null()]);
const observationSchema = z.object({
  metric: z.enum(HEALTH_METRICS),
  value: z.number().finite(),
  unit: z.string().trim().min(1).max(30),
  recordedAt: z.iso.datetime({ offset: true }),
  externalRecordId: z.string().trim().min(1).max(300),
  originName: z.string().trim().max(120).optional(),
  deviceName: z.string().trim().max(120).optional(),
  metadata: z.record(z.string(), metadataValue).optional(),
});
const importSchema = z.object({
  sourceId: z.uuid(),
  observations: z.array(observationSchema).min(1).max(500),
});

/** Idempotent batch import for the future native companion. Duplicate
 * source record ids are accepted but not inserted twice. */
export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return NextResponse.json({ error: "supabase-not-configured" }, { status: 503 });
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  const parsed = importSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid-body" }, { status: 400 });

  try {
    const result = await importHealthObservations(supabase, user.id, parsed.data.sourceId, parsed.data.observations);
    return NextResponse.json(result);
  } catch (error) {
    const code = error instanceof Error ? error.message : "import-failed";
    if (["health-source-not-found", "health-source-not-active", "health-metric-not-authorized"].includes(code)) {
      return NextResponse.json({ error: code }, { status: 422 });
    }
    if (code.startsWith("unsupported-unit") || code.startsWith("implausible-value") || code.startsWith("invalid-")) {
      return NextResponse.json({ error: code }, { status: 400 });
    }
    return NextResponse.json({ error: "import-failed" }, { status: 500 });
  }
}

