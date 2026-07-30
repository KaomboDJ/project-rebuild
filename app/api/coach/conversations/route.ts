import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { listConversations } from "@/lib/coach/conversations";

/** Conversation history list for the full /coach page (Part 1). New
 * conversations are created implicitly by app/api/coach/route.ts on the
 * first message - there's no POST here on purpose, to avoid empty
 * conversations accumulating from a user opening "Nova conversa" and never
 * sending anything. */
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

  try {
    const conversations = await listConversations(supabase, user.id);
    return NextResponse.json({ conversations });
  } catch {
    return NextResponse.json({ error: "list-failed" }, { status: 500 });
  }
}
