import { redirect } from "next/navigation";
import { signInWithGoogle, signInWithMicrosoft } from "@/app/auth/actions";
import { isSupabaseConfigured } from "@/lib/env/public";
import { isMicrosoftAuthEnabled } from "@/lib/auth/config";
import { safeRedirectPath } from "@/lib/auth/safe-redirect";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { SignInPanel } from "@/components/auth/SignInPanel";

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ account?: string; returnTo?: string }>;
}) {
  const configured = isSupabaseConfigured();
  const supabase = await createSupabaseServerClient();
  const { account, returnTo } = await searchParams;
  // lib/supabase/middleware.ts sets ?returnTo=<path> when redirecting an
  // unauthenticated request away from a protected route - honoring it here
  // (threaded through as `next` into every sign-in method below) is what
  // "preserve the intended destination route" actually means end to end.
  const next = safeRedirectPath(returnTo);

  if (supabase) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) redirect(next);
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col justify-center px-4 py-16">
      <div className="max-w-xl space-y-6">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-700 text-sm font-bold text-white">
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

        {account === "deleted" && (
          <p className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-neutral-300">
            A tua conta e todos os teus dados foram eliminados.
          </p>
        )}

        {configured ? (
          <SignInPanel
            next={next}
            microsoftEnabled={isMicrosoftAuthEnabled()}
            googleAction={signInWithGoogle}
            microsoftAction={signInWithMicrosoft}
          />
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
