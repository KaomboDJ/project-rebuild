import { redirect } from "next/navigation";
import { signInWithMagicLink } from "@/app/auth/actions";
import { isSupabaseConfigured } from "@/lib/env/public";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function HomePage() {
  const configured = isSupabaseConfigured();
  const supabase = await createSupabaseServerClient();

  if (supabase) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) redirect("/today");
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col justify-center px-4 py-16">
      <div className="max-w-xl space-y-6">
        <p className="text-sm font-medium uppercase tracking-[0.2em] text-emerald-400">
          Rebuild
        </p>
        <h1 className="text-4xl font-semibold leading-tight sm:text-5xl">
          Torna-te atleta outra vez, uma decisão de cada vez.
        </h1>
        <p className="text-lg leading-relaxed text-neutral-400">
          O Rebuild usa contexto diário para identificar os momentos que importam e
          recomendar a próxima ação útil — sem transformar a tua vida num dashboard.
        </p>

        {configured ? (
          <form action={signInWithMagicLink} className="space-y-3 rounded-xl border border-neutral-800 p-5">
            <label htmlFor="email" className="block text-sm font-medium">
              Entra com uma ligação segura
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              autoComplete="email"
              placeholder="nome@exemplo.com"
              className="w-full rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2"
            />
            <button
              type="submit"
              className="w-full rounded-md bg-emerald-600 px-4 py-2 font-medium text-white hover:bg-emerald-500"
            >
              Enviar ligação de acesso
            </button>
          </form>
        ) : (
          <div className="rounded-xl border border-amber-800 bg-amber-950/30 p-5">
            <p className="font-medium text-amber-200">Fundação pronta para ligar</p>
            <p className="mt-1 text-sm text-amber-100/70">
              Adiciona as credenciais públicas do Supabase ao ficheiro .env.local para
              ativar autenticação e persistência.
            </p>
          </div>
        )}
      </div>
    </main>
  );
}
