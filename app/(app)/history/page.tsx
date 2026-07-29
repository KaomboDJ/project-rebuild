export default function HistoryPage() {
  return (
    <main className="mx-auto max-w-3xl space-y-4 px-4 py-8">
      <p className="text-sm uppercase tracking-wide text-neutral-500">Decisões</p>
      <h1 className="text-2xl font-semibold">Histórico</h1>
      <div className="rounded-xl border border-neutral-800 p-5 text-sm text-neutral-400">
        O histórico persistente será ativado quando as migrações do Supabase forem aplicadas.
      </div>
    </main>
  );
}
