import { signOut } from "@/app/auth/actions";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function SettingsPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = supabase ? await supabase.auth.getUser() : { data: { user: null } };

  return (
    <main className="mx-auto max-w-3xl space-y-6 px-4 py-8">
      <div>
        <p className="text-sm uppercase tracking-wide text-neutral-500">Conta</p>
        <h1 className="text-2xl font-semibold">Definições</h1>
      </div>
      <section className="rounded-xl border border-neutral-800 p-5">
        <h2 className="font-medium">Sessão</h2>
        <p className="mt-1 text-sm text-neutral-400">{user?.email}</p>
        <form action={signOut} className="mt-4">
          <button
            type="submit"
            className="rounded-md border border-neutral-700 px-3 py-2 text-sm hover:bg-neutral-900"
          >
            Terminar sessão
          </button>
        </form>
      </section>
      <section className="rounded-xl border border-neutral-800 p-5 text-sm text-neutral-400">
        Perfil, calendário e preferências serão ligados nas próximas etapas do MVP.
      </section>
    </main>
  );
}
