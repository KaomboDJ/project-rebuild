import "server-only";

import type { NextRequest } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { hashDeviceToken, isValidDeviceToken } from "./companion-secrets";

export type CompanionAuthFailure = "missing-token" | "invalid-token" | "expired-token" | "insufficient-scope";

export class CompanionAuthError extends Error {
  constructor(public readonly code: CompanionAuthFailure) {
    super(code);
    this.name = "CompanionAuthError";
  }
}

export async function authenticateCompanionRequest(request: NextRequest) {
  const header = request.headers.get("authorization") ?? "";
  const [scheme, token, ...rest] = header.trim().split(/\s+/);
  if (scheme?.toLowerCase() !== "bearer" || !token || rest.length > 0) {
    throw new CompanionAuthError("missing-token");
  }
  if (!isValidDeviceToken(token)) throw new CompanionAuthError("invalid-token");

  const admin = createSupabaseAdminClient();
  const tokenHash = hashDeviceToken(token);
  const { data: device, error } = await admin
    .from("companion_devices")
    .select("id,user_id,scopes,status,expires_at,last_seen_at")
    .eq("token_hash", tokenHash)
    .maybeSingle();

  if (error || !device || device.status !== "active") throw new CompanionAuthError("invalid-token");
  if (Date.parse(device.expires_at) <= Date.now()) throw new CompanionAuthError("expired-token");
  if (!device.scopes.includes("health:write")) throw new CompanionAuthError("insufficient-scope");

  const lastSeen = device.last_seen_at ? Date.parse(device.last_seen_at) : 0;
  if (Date.now() - lastSeen > 15 * 60_000) {
    void admin
      .from("companion_devices")
      .update({ last_seen_at: new Date().toISOString() })
      .eq("id", device.id)
      .eq("user_id", device.user_id);
  }

  return { admin, deviceId: device.id, userId: device.user_id };
}

