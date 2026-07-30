import Link from "next/link";
import { AlertTriangle, ListChecks, ShoppingCart } from "lucide-react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getFounderNow } from "@/lib/date/founder-now";
import { listPantryItems, getOrCreateOpenShoppingList, listShoppingItems } from "@/lib/pantry/queries";

export default async function NutritionDashboardPage() {
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

  const { date: today } = await getFounderNow(supabase, user.id);
  const [pantryItems, listId] = await Promise.all([
    listPantryItems(supabase, user.id).catch(() => []),
    getOrCreateOpenShoppingList(supabase, user.id),
  ]);
  const shoppingItems = await listShoppingItems(supabase, user.id, listId).catch(() => []);

  const expiringSoon = pantryItems.filter((item) => item.expires_on && item.expires_on <= today);
  const pendingShopping = shoppingItems.filter((item) => !item.purchased);

  return (
    <main className="mx-auto max-w-3xl space-y-6 px-4 py-8">
      <div>
        <p className="text-sm uppercase tracking-wide text-neutral-500">Alimentação</p>
        <h1 className="text-2xl font-semibold tracking-tight">Despensa e compras</h1>
        <p className="mt-1 text-sm text-neutral-400">
          O Coach usa isto para sugerir refeições com o que já existe em casa — parte do não-negociável de janta com
          comida que já tens.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Link href="/nutrition/pantry" className="surface-card surface-card-hover block p-5">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-300">
            <ListChecks size={17} />
          </span>
          <p className="mt-3 font-medium text-neutral-100">Despensa</p>
          <p className="text-sm text-neutral-400">{pantryItems.length} item(ns) registados</p>
        </Link>
        <Link href="/nutrition/shopping" className="surface-card surface-card-hover block p-5">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-500/15 text-amber-300">
            <ShoppingCart size={17} />
          </span>
          <p className="mt-3 font-medium text-neutral-100">Lista de compras</p>
          <p className="text-sm text-neutral-400">{pendingShopping.length} por comprar</p>
        </Link>
      </div>

      {expiringSoon.length > 0 && (
        <div className="surface-card border-amber-500/20 p-4">
          <p className="flex items-center gap-2 text-sm font-medium text-amber-300">
            <AlertTriangle size={15} /> A expirar
          </p>
          <ul className="mt-2 space-y-1 text-sm text-neutral-300">
            {expiringSoon.map((item) => (
              <li key={item.id}>
                {item.name} — {item.expires_on}
              </li>
            ))}
          </ul>
        </div>
      )}
    </main>
  );
}
