import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { decryptToken } from "@/lib/crypto/tokens";

// UX Hardening release (docs/17_UX_AUDIT.md, section 6 - account privacy
// readiness). Self-service account deletion, deliberately narrow in scope:
//
// - Session-scoped only. This route reads the caller's own user id from
//   their own authenticated session (createSupabaseServerClient, never the
//   admin client, for that lookup) - there is no id/target parameter
//   anywhere in the request body, so this endpoint structurally cannot be
//   pointed at any account other than the one making the request. It can
//   never be used against the founder's account except by the founder
//   themselves, deliberately, from their own signed-in session.
// - Explicit typed confirmation: the caller must resend their own exact
//   email address in the body, checked server-side, not just a UI checkbox.
// - Every user-owned table (profiles, calendar_connections, pantry/shopping,
//   nutrition, coach history, decisions, personalization memory - see
//   supabase/migrations/*.sql) has `user_id references auth.users(id) on
//   delete cascade`, so deleting the auth.users row via the admin API
//   cascades the delete across every one of them in a single transaction -
//   verified against every migration file before writing this route, not
//   assumed.
// - Best-effort Google token revocation before deletion ("revoke/disconnect
//   Google credentials where practical" per the release brief) - failures
//   are swallowed since the row is being deleted either way and a revoke
//   failure must never block account deletion itself.
//
// Known, documented gap (see docs/17_UX_AUDIT.md's resolution notes): this
// does not implement a step-up/"recent authentication" re-challenge beyond
// the caller already holding a valid session plus retyping their email -
// Supabase's magic-link auth has no built-in recency check equivalent to a
// password re-prompt. Treated as acceptable for the founder-pilot/invited-
// tester stage, flagged as a public-launch hardening item.

const bodySchema = z.object({
  confirmEmail: z.string().trim().email(),
});

async function revokeGoogleConnections(userId: string): Promise<void> {
  const admin = createSupabaseAdminClient();
  const { data: connections } = await admin
    .from("calendar_connections")
    .select("encrypted_access_token, encrypted_refresh_token")
    .eq("user_id", userId);

  for (const connection of connections ?? []) {
    for (const packed of [connection.encrypted_access_token, connection.encrypted_refresh_token]) {
      if (!packed) continue;
      try {
        const token = decryptToken(packed);
        await fetch("https://oauth2.googleapis.com/revoke", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: `token=${encodeURIComponent(token)}`,
        });
      } catch {
        // Best-effort only - never block deletion on Google's revoke call.
      }
    }
  }
}

export async function DELETE(request: NextRequest) {
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

  await revokeGoogleConnections(user.id);

  const admin = createSupabaseAdminClient();
  const { error } = await admin.auth.admin.deleteUser(user.id);
  if (error) return NextResponse.json({ error: "delete-failed" }, { status: 500 });

  await supabase.auth.signOut();
  return NextResponse.json({ deleted: true });
}
