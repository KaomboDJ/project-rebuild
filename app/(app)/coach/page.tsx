import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getFounderNow } from "@/lib/date/founder-now";
import { listConversations, getConversationMessages } from "@/lib/coach/conversations";
import { buildPantrySummary } from "@/lib/coach/pantry-context";
import { inferDayType } from "@/lib/coach/day-type";
import { CoachPageClient } from "@/components/coach/CoachPageClient";

function EmptyState({ message }: { message: string }) {
  return (
    <main className="mx-auto max-w-3xl space-y-4 px-4 py-8">
      <div>
        <p className="text-sm uppercase tracking-wide text-neutral-400">Coach</p>
        <h1 className="text-2xl font-semibold tracking-tight">Conversa completa</h1>
      </div>
      <div className="surface-card p-5 text-sm text-neutral-400">{message}</div>
    </main>
  );
}

/**
 * Full authenticated /coach route (Part 1) — persisted conversation
 * history, a "Nova conversa" action, and a context summary of what the
 * Coach currently knows (identity, day-type, pantry size), on top of the
 * same send/confirm interaction the compact and expanded drawer states
 * use (components/coach/useCoachConversation.ts).
 */
export default async function CoachPage() {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return <EmptyState message="Configuração em falta." />;

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return <EmptyState message="Sessão expirada." />;

  const { date: today } = await getFounderNow(supabase, user.id);

  const [conversations, profileResult, pantry, dayType] = await Promise.all([
    listConversations(supabase, user.id).catch(() => []),
    supabase.from("profiles").select("desired_identity").eq("user_id", user.id).maybeSingle(),
    buildPantrySummary(supabase, user.id),
    inferDayType(supabase, user.id, today),
  ]);

  const mostRecent = conversations[0];
  const initialMessages = mostRecent ? await getConversationMessages(supabase, user.id, mostRecent.id).catch(() => []) : [];

  return (
    <CoachPageClient
      conversations={conversations}
      initialConversationId={mostRecent?.id}
      initialMessages={initialMessages}
      identity={profileResult.data?.desired_identity ?? ""}
      pantryCount={pantry.length}
      dayType={dayType.dayType}
      dayTypeSource={dayType.source}
    />
  );
}
