import { type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { generatePairingCode, hashPairingCode } from "@/lib/security/companion-secrets";
import { assertTrustedBrowserOrigin, privateJson } from "@/lib/security/request";

const PAIRING_TTL_MS = 5 * 60_000;

export async function GET() {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return privateJson({ error: "supabase-not-configured" }, { status: 503 });
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return privateJson({ error: "unauthenticated" }, { status: 401 });

  const { data, error } = await supabase
    .from("companion_devices")
    .select("id,device_name,status,expires_at,last_seen_at,created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });
  if (error) return privateJson({ error: "load-failed" }, { status: 500 });
  return privateJson({ devices: data ?? [] });
}

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

  try {
    const code = generatePairingCode();
    const expiresAt = new Date(Date.now() + PAIRING_TTL_MS).toISOString();
    await supabase
      .from("companion_pairing_codes")
      .delete()
      .eq("user_id", user.id)
      .is("used_at", null);
    const { error } = await supabase.from("companion_pairing_codes").insert({
      user_id: user.id,
      code_hash: hashPairingCode(code),
      expires_at: expiresAt,
    });
    if (error) throw error;
    return privateJson({ code, expiresAt }, { status: 201 });
  } catch {
    return privateJson({ error: "pairing-unavailable" }, { status: 503 });
  }
}
