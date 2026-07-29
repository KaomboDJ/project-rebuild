import Link from "next/link";

export default function CheckEmailPage() {
  return (
    <main className="mx-auto max-w-md space-y-4 px-4 py-16">
      <p className="text-sm uppercase tracking-wide text-emerald-400">Rebuild</p>
      <h1 className="text-3xl font-semibold">Confirma o teu email</h1>
      <p className="text-neutral-400">
        Enviámos uma ligação segura. Abre-a neste dispositivo para entrares no Rebuild.
      </p>
      <Link href="/" className="inline-flex text-sm text-emerald-400 hover:text-emerald-300">
        Voltar ao início
      </Link>
    </main>
  );
}
