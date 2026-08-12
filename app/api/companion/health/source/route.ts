import { type NextRequest } from "next/server";
import { healthSourceSchema } from "@/lib/health/import-schema";
import { upsertHealthSource } from "@/lib/health/queries";
import { authenticateCompanionRequest, CompanionAuthError } from "@/lib/security/companion-auth";
import { privateJson, readBoundedJson } from "@/lib/security/request";

export async function POST(request: NextRequest) {
  try {
    const auth = await authenticateCompanionRequest(request);
    const parsed = healthSourceSchema.safeParse(await readBoundedJson(request, 32 * 1024).catch(() => null));
    if (!parsed.success || parsed.data.provider !== "health_connect") {
      return privateJson({ error: "invalid-body" }, { status: 400 });
    }
    const source = await upsertHealthSource(auth.admin, auth.userId, parsed.data);
    return privateJson({ sourceId: source.id }, { status: 201 });
  } catch (error) {
    if (error instanceof CompanionAuthError) return privateJson({ error: "unauthorized-device" }, { status: 401 });
    return privateJson({ error: "save-failed" }, { status: 500 });
  }
}

