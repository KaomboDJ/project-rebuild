import { type NextRequest } from "next/server";
import { authenticateCompanionRequest, CompanionAuthError } from "@/lib/security/companion-auth";
import { privateJson } from "@/lib/security/request";

export async function POST(request: NextRequest) {
  try {
    const auth = await authenticateCompanionRequest(request);
    const { error } = await auth.admin
      .from("companion_devices")
      .update({ status: "revoked", revoked_at: new Date().toISOString() })
      .eq("id", auth.deviceId)
      .eq("user_id", auth.userId);
    if (error) throw error;
    return privateJson({ ok: true });
  } catch (error) {
    if (error instanceof CompanionAuthError) return privateJson({ error: "unauthorized-device" }, { status: 401 });
    return privateJson({ error: "disconnect-failed" }, { status: 500 });
  }
}
