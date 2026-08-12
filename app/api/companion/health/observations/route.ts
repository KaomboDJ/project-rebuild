import { type NextRequest } from "next/server";
import { healthImportSchema } from "@/lib/health/import-schema";
import { importHealthObservations } from "@/lib/health/queries";
import { authenticateCompanionRequest, CompanionAuthError } from "@/lib/security/companion-auth";
import { privateJson, readBoundedJson, RequestSecurityError } from "@/lib/security/request";

export async function POST(request: NextRequest) {
  try {
    const auth = await authenticateCompanionRequest(request);
    let body: unknown;
    try {
      body = await readBoundedJson(request);
    } catch (error) {
      const status = error instanceof RequestSecurityError && error.code === "body-too-large" ? 413 : 400;
      return privateJson({ error: error instanceof RequestSecurityError ? error.code : "invalid-body" }, { status });
    }
    const parsed = healthImportSchema.safeParse(body);
    if (!parsed.success) return privateJson({ error: "invalid-body" }, { status: 400 });
    const result = await importHealthObservations(auth.admin, auth.userId, parsed.data.sourceId, parsed.data.observations);
    return privateJson(result);
  } catch (error) {
    if (error instanceof CompanionAuthError) return privateJson({ error: "unauthorized-device" }, { status: 401 });
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

