import { createSupabaseServerClient } from "@/lib/supabase/server";
import { buildDayPlan } from "@/lib/day-plan/build-day-plan";
import { HomeWorkspace } from "@/components/HomeWorkspace";
import { listConnections } from "@/lib/google/calendar";

export default async function HomePage() {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return <main className="mx-auto max-w-xl px-4 py-8">Configuração em falta.</main>;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return <main className="mx-auto max-w-xl px-4 py-8">Sessão expirada.</main>;
  const [plan, connections] = await Promise.all([
    buildDayPlan(supabase, user.id),
    listConnections(user.id),
  ]);
  return <HomeWorkspace plan={plan} connections={connections} />;
}
