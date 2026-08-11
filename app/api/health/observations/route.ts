import { type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { importHealthObservations } from "@/lib/health/queries";
import { healthImportSchema } from "@/lib/health/import-schema";
import { assertTrustedBrowserOrigin, privateJson, readBoundedJson, RequestSecurityError } from "@/lib/security/request";

/** Idempotent batch import for the future native companion. Duplicate
 * source record ids are accepted but not inserted twice. */
export async function POST(request: NextRequest) {
  try {
    assertTrustedBrowserOrigin(request);
  } catch {
    return privateJson({ error: "untrusted-origin" }, { status: 403 });
  }
  const supabase = await createSupabaseServerClient();
  if (!supabase) return privateJson({ error: "supabase-not-configured" }, { status: 503 });
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return privateJson({ error: "unauthenticated" }, { status: 401 });
  let body: unknown;
  try {
    body = await readBoundedJson(request);
  } catch (error) {
    const status = error instanceof RequestSecurityError && error.code === "body-too-large" ? 413 : 400;
    return privateJson({ error: error instanceof RequestSecurityError ? error.code : "invalid-body" }, { status });
  }
  const parsed = healthImportSchema.safeParse(body);
  if (!parsed.success) return privateJson({ error: "invalid-body" }, { status: 400 });

  try {
    const result = await importHealthObservations(supabase, user.id, parsed.data.sourceId, parsed.data.observations);
    return privateJson(result);
  } catch (error) {
    const code = error instanceof Error ? error.message : "import-failed";
    if (["health-source-not-found", "health-source-not-active", "health-metric-not-authorized"].includes(code)) {
      return privateJson({ error: code }, { status: 422 });
    }
    if (code.startsWith("unsupported-unit") || code.startsWith("implausible-value") || code.startsWith("invalid-")) {
      return privateJson({ error: code }, { status: 400 });
    }
    return privateJson({ error: "import-failed" }, { status: 500 });
  }
}
