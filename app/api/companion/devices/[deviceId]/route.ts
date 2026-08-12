import { type NextRequest } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { assertTrustedBrowserOrigin, privateJson } from "@/lib/security/request";

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ deviceId: string }> }) {
  try {
    assertTrustedBrowserOrigin(request);
  } catch {
    return privateJson({ error: "untrusted-origin" }, { status: 403 });
  }
  const supabase = await createSupabaseServerClient();
  if (!supabase) return privateJson({ error: "supabase-not-configured" }, { status: 503 });
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return privateJson({ error: "unauthenticated" }, { status: 401 });
  const { deviceId } = await params;
  const admin = createSupabaseAdminClient();
  const { error } = await admin
    .from("companion_devices")
    .update({ status: "revoked", revoked_at: new Date().toISOString() })
    .eq("id", deviceId)
    .eq("user_id", user.id);
  if (error) return privateJson({ error: "revoke-failed" }, { status: 500 });
  return privateJson({ ok: true });
}
