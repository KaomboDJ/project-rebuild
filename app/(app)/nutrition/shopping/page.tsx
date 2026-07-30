import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrCreateOpenShoppingList, listShoppingItems } from "@/lib/pantry/queries";
import { ShoppingList } from "@/components/nutrition/ShoppingList";

export default async function ShoppingPage() {
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

  const listId = await getOrCreateOpenShoppingList(supabase, user.id);
  const items = await listShoppingItems(supabase, user.id, listId).catch(() => []);

  return (
    <main className="mx-auto max-w-3xl space-y-6 px-4 py-8">
      <div>
        <p className="text-sm uppercase tracking-wide text-neutral-500">Alimentação</p>
        <h1 className="text-2xl font-semibold tracking-tight">Lista de compras</h1>
        <p className="mt-1 text-sm text-neutral-400">Marcar como comprado adiciona automaticamente à despensa.</p>
      </div>
      <ShoppingList initialItems={items} />
    </main>
  );
}
