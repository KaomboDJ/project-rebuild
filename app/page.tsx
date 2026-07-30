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
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-600 text-sm font-bold text-white">
            R
          </span>
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-emerald-400">Rebuild</p>
        </div>
        <h1 className="text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">
          Torna-te atleta outra vez, uma decisão de cada vez.
        </h1>
        <p className="text-lg leading-relaxed text-neutral-400">
          O Rebuild usa contexto diário para identificar os momentos que importam e
          recomendar a próxima ação útil — sem transformar a tua vida num dashboard.
        </p>

        {configured ? (
          <form action={signInWithMagicLink} className="surface-card space-y-3 p-5">
            <label htmlFor="email" className="field-label">
              Entra com uma ligação segura
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              autoComplete="email"
              placeholder="nome@exemplo.com"
              className="field-input"
            />
            <button type="submit" className="btn-primary w-full py-2.5">
              Enviar ligação de acesso
            </button>
          </form>
        ) : (
          <div className="rounded-2xl border border-amber-800 bg-amber-950/30 p-5">
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
