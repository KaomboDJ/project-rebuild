import Link from "next/link";

export default function TermsPage() {
  return (
    <main className="mx-auto max-w-3xl space-y-8 px-4 py-12 text-neutral-200">
      <div className="space-y-2">
        <Link href="/" className="text-sm text-emerald-400 underline underline-offset-2">
          ← Voltar ao Rebuild
        </Link>
        <h1 className="text-3xl font-semibold tracking-tight text-white">
          Termos da alpha privada
        </h1>
        <p className="text-sm text-neutral-500">Última atualização: 31 de julho de 2026</p>
      </div>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold text-white">Finalidade</h2>
        <p>
          O Project Rebuild é uma versão experimental disponibilizada a um grupo limitado para
          avaliar utilidade, clareza e segurança. Funcionalidades podem mudar, falhar ou ser
          removidas durante a alpha.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold text-white">Não substitui cuidados profissionais</h2>
        <p>
          O Coach e os planos da aplicação fornecem apoio geral à tomada de decisões. Não fazem
          diagnóstico, não prescrevem tratamento e não substituem médico, nutricionista ou outro
          profissional qualificado. Em caso de emergência ou sintomas preocupantes, procura
          assistência profissional.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold text-white">Responsabilidade do utilizador</h2>
        <p>
          Confirma que qualquer sugestão é adequada à tua situação, limitações e orientação clínica.
          Não partilhes a tua sessão nem permitas que outra pessoa use a tua conta.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold text-white">Conta e saída da alpha</h2>
        <p>
          Podes deixar de usar o serviço a qualquer momento. Nas Definições podes desligar
          integrações e eliminar a conta. O acesso pode ser suspenso para proteger utilizadores,
          dados ou a estabilidade da alpha.
        </p>
      </section>

      <p className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm text-neutral-400">
        Consulta também a{" "}
        <Link href="/privacy" className="text-emerald-400 underline underline-offset-2">
          Política de privacidade
        </Link>
        .
      </p>
    </main>
  );
}
