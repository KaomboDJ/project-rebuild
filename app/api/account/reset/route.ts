import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { resetTestAccountData } from "@/lib/account/reset";

// Settings danger-zone "Reiniciar conta de teste" — same security model as
// app/api/account/route.ts's full deletion: session-scoped only (the
// caller's own user id is read from their own session, never a request
// parameter, so this structurally cannot target any other account), plus
// an explicit typed re-confirmation of the account's own email, checked
// server-side. The difference from full deletion is scope: this clears
// every user-owned table (see lib/account/reset.ts) but leaves the
// auth.users row itself alone, so the founder stays logged in and lands on
// /onboarding on the next request (the (app) layout's own
// onboarding_completed gate handles that automatically once profiles is
// gone - no redirect logic duplicated here).
const bodySchema = z.object({
  confirmEmail: z.string().trim().email(),
});

export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return NextResponse.json({ error: "supabase-not-configured" }, { status: 503 });

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid-body" }, { status: 400 });

  if (!user.email || parsed.data.confirmEmail.toLowerCase() !== user.email.toLowerCase()) {
    return NextResponse.json({ error: "email-mismatch" }, { status: 400 });
  }

  try {
    const admin = createSupabaseAdminClient();
    await resetTestAccountData(admin, user.id);
  } catch {
    return NextResponse.json({ error: "reset-failed" }, { status: 500 });
  }

  return NextResponse.json({ reset: true });
}
