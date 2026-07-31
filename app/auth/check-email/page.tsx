import Link from "next/link";

export default function CheckEmailPage() {
  return (
    <main className="mx-auto max-w-md space-y-4 px-4 py-16">
      <p className="text-sm uppercase tracking-wide text-emerald-400">Rebuild</p>
      <h1 className="text-3xl font-semibold">Verifica o teu email</h1>
      <p className="text-neutral-400">
        Enviámos uma ligação de acesso para o email que indicaste. Pode demorar um ou dois minutos a chegar —
        verifica também a pasta de spam.
      </p>
      <ul className="space-y-2 text-sm text-neutral-400">
        <li>• A ligação é pessoal: não a reencaminhes nem partilhes com mais ninguém.</li>
        <li>• Abre-a no mesmo dispositivo e navegador onde pediste o acesso.</li>
        <li>• Deixa de funcionar depois de usada uma vez ou passado algum tempo.</li>
      </ul>
      <p className="text-sm text-neutral-400">
        Não chegou, ou a ligação já não funciona?{" "}
        <Link href="/" className="text-emerald-400 hover:underline">
          Pede uma nova ligação de acesso
        </Link>
        .
      </p>
    </main>
  );
}
