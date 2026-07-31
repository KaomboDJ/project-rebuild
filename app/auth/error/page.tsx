import Link from "next/link";

// Auth UX Hardening milestone: every message here is deliberately generic
// and non-technical - never a raw Supabase/GoTrue/OAuth-provider message
// (explicit security/product requirement). "invalid-email" and
// "supabase-not-configured" predate this milestone and are kept for any
// old bookmarked/cached link; "magic-link-failed" and "callback-invalid"/
// "callback-failed" likewise. Everything from "oauth-cancelled" down is new.
const MESSAGES: Record<string, string> = {
  "invalid-email": "Introduz um endereço de email válido.",
  "supabase-not-configured": "A autenticação ainda não está ligada ao Supabase.",
  "magic-link-failed": "Não foi possível enviar o código de acesso.",
  "callback-invalid": "A ligação de acesso está incompleta ou expirou.",
  "callback-failed": "Não foi possível concluir a autenticação.",
  "oauth-cancelled": "Não concluíste a autenticação. Podes tentar novamente quando quiseres.",
  "oauth-failed": "Não foi possível entrar com essa conta agora. Tenta novamente dentro de momentos.",
  "microsoft-not-configured": "A entrada com Microsoft ainda não está disponível.",
};

export default async function AuthErrorPage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string }>;
}) {
  const { code } = await searchParams;

  return (
    <main className="mx-auto max-w-md space-y-4 px-4 py-16">
      <p className="text-sm uppercase tracking-wide text-rose-400">Rebuild</p>
      <h1 className="text-3xl font-semibold">Não foi possível entrar</h1>
      <p className="text-neutral-400">
        {MESSAGES[code ?? ""] ?? "Não foi possível entrar agora. Tenta novamente dentro de momentos."}
      </p>
      <Link href="/" className="inline-flex text-sm text-emerald-400 hover:text-emerald-300">
        Tentar novamente
      </Link>
    </main>
  );
}
