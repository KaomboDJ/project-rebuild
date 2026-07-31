import { createSupabaseServerClient } from "@/lib/supabase/server";
import { listPantryItems } from "@/lib/pantry/queries";
import { PantryList } from "@/components/nutrition/PantryList";
import { FirstUseCallout } from "@/components/ui/FirstUseCallout";

export default async function PantryPage() {
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return (
      <main className="mx-auto max-w-3xl space-y-4 px-4 py-8">
        <div className="surface-card p-5 text-sm text-neutral-400">Configuração em falta.</div>
      </main>
    );
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return (
      <main className="mx-auto max-w-3xl space-y-4 px-4 py-8">
        <div className="surface-card p-5 text-sm text-neutral-400">Sessão expirada.</div>
      </main>
    );
  }

  const items = await listPantryItems(supabase, user.id).catch(() => []);

  return (
    <main className="mx-auto max-w-3xl space-y-6 px-4 py-8">
      <div>
        <p className="text-sm uppercase tracking-wide text-neutral-400">Alimentação</p>
        <h1 className="text-2xl font-semibold tracking-tight">Despensa</h1>
        <p className="mt-1 text-sm text-neutral-400">
          O que tens em casa agora. O Coach usa isto para sugerir refeições em vez de assumir.
        </p>
      </div>
      <FirstUseCallout id="pantry">
        Regista o que tens e as quantidades aproximadas. Usa +/− para ajustar rápido, ou &quot;Terminou&quot; quando
        acabar. O Coach só sugere refeições com itens que aqui aparecem como disponíveis.
      </FirstUseCallout>
      <PantryList initialItems={items} />
    </main>
  );
}
