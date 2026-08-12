import { type NextRequest } from "next/server";
import { z } from "zod";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  generateDeviceToken,
  hashDeviceToken,
  hashPairingCode,
  isValidPairingCode,
} from "@/lib/security/companion-secrets";
import { privateJson, readBoundedJson } from "@/lib/security/request";

const schema = z.object({
  code: z.string().trim().min(1).max(32).refine(isValidPairingCode),
  deviceName: z.string().trim().min(1).max(120),
  installationId: z.string().trim().min(8).max(200).regex(/^[A-Za-z0-9._:-]+$/),
});

const DEVICE_TTL_MS = 90 * 24 * 60 * 60_000;

export async function POST(request: NextRequest) {
  const parsed = schema.safeParse(await readBoundedJson(request, 8 * 1024).catch(() => null));
  if (!parsed.success) return privateJson({ error: "invalid-pairing" }, { status: 400 });

  try {
    const admin = createSupabaseAdminClient();
    const token = generateDeviceToken();
    const expiresAt = new Date(Date.now() + DEVICE_TTL_MS).toISOString();
    const { data, error } = await admin.rpc("exchange_companion_pairing_code", {
      p_code_hash: hashPairingCode(parsed.data.code),
      p_token_hash: hashDeviceToken(token),
      p_device_name: parsed.data.deviceName,
      p_installation_id: parsed.data.installationId,
      p_expires_at: expiresAt,
    });
    const result = data?.[0];
    if (error || !result) return privateJson({ error: "invalid-pairing" }, { status: 401 });
    return privateJson({ token, expiresAt, deviceId: result.device_id }, { status: 201 });
  } catch {
    return privateJson({ error: "pairing-unavailable" }, { status: 503 });
  }
}

