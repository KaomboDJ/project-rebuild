import Link from "next/link";

const MESSAGES: Record<string, string> = {
  "invalid-email": "Introduz um endereço de email válido.",
  "supabase-not-configured": "A autenticação ainda não está ligada ao Supabase.",
  "magic-link-failed": "Não foi possível enviar a ligação de acesso.",
  "callback-invalid": "A ligação de acesso está incompleta ou expirou.",
  "callback-failed": "Não foi possível concluir a autenticação.",
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
        {MESSAGES[code ?? ""] ?? "Ocorreu um erro de autenticação. Tenta novamente."}
      </p>
      <Link href="/" className="inline-flex text-sm text-emerald-400 hover:text-emerald-300">
        Tentar novamente
      </Link>
    </main>
  );
}
