import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { listConnections } from "@/lib/google/calendar";

/**
 * Lists the authenticated user's connected Google accounts (Milestone 11A).
 * Used by the "Adicionar ao calendário" account picker (DecisionEngineCard)
 * to decide whether to ask which account to write to, and by Settings to
 * render the connected-accounts list. Never returns tokens.
 */
export async function GET() {
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return NextResponse.json({ error: "supabase-not-configured" }, { status: 503 });
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const connections = await listConnections(user.id);
  return NextResponse.json({ connections });
}
