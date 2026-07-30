import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getConversationMessages } from "@/lib/coach/conversations";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
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
    const messages = await getConversationMessages(supabase, user.id, id);
    return NextResponse.json({ messages });
  } catch {
    return NextResponse.json({ error: "fetch-failed" }, { status: 500 });
  }
}
