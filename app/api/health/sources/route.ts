import { createSupabaseServerClient } from "@/lib/supabase/server";
import { listHealthSources } from "@/lib/health/queries";
import { privateJson } from "@/lib/security/request";

async function authenticated() {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return null;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user ? { supabase, user } : null;
}

export async function GET() {
  const auth = await authenticated();
  if (!auth) return privateJson({ error: "unauthenticated" }, { status: 401 });
  try {
    return privateJson({ sources: await listHealthSources(auth.supabase, auth.user.id) });
  } catch {
    return privateJson({ error: "load-failed" }, { status: 500 });
  }
}
