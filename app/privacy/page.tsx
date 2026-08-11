import Link from "next/link";

export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-3xl space-y-8 px-4 py-12 text-neutral-200">
      <div className="space-y-2">
        <Link href="/" className="text-sm text-emerald-400 underline underline-offset-2">
          ← Voltar ao Rebuild
        </Link>
        <h1 className="text-3xl font-semibold tracking-tight text-white">
          Política de privacidade — alpha privada
        </h1>
        <p className="text-sm text-neutral-500">Última atualização: 31 de julho de 2026</p>
      </div>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold text-white">Que dados tratamos</h2>
        <p>
          O Rebuild guarda os dados que forneces para personalizar decisões: identidade e objetivos,
          horários, check-ins de sono, energia e stress, decisões e feedback, conversas com o Coach,
          dados de alimentação, despensa e listas de compras. Se ligares um calendário, tratamos os
          eventos necessários para identificar períodos ocupados e oportunidades no teu dia.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold text-white">Como são usados</h2>
        <p>
          Estes dados servem exclusivamente para operar a aplicação, gerar o teu plano diário,
          adaptar sugestões e manter o teu histórico. Não vendemos dados pessoais e não os usamos
          para publicidade.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold text-white">Privacidade do calendário</h2>
        <p>
          Cada calendário começa no modo “Só disponibilidade”: o Rebuild pede apenas o início, o
          fim e o estado ocupado/livre necessários para evitar conflitos. Podes autorizar “Título e
          local” separadamente para um calendário específico; eventos marcados como privados
          continuam ocultos.
        </p>
        <p>
          Não pedimos descrições, participantes nem anexos dos eventos. Os eventos externos são
          consultados quando necessário e não são guardados na base de dados do Rebuild. Os títulos
          apresentados na agenda não são enviados em bruto ao Coach. No Google, a leitura e a
          autorização para o Rebuild criar eventos são consentimentos separados.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold text-white">Fornecedores técnicos</h2>
        <p>
          A aplicação usa Vercel para alojamento, Supabase para autenticação e base de dados e
          Anthropic para respostas do Coach e refinamento assistido por IA. Google e, quando
          ativado, Microsoft processam apenas os dados necessários aos serviços que decidires ligar.
          Cada ligação de calendário exige autorização separada e pode ser desligada nas Definições.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold text-white">Segurança e controlo</h2>
        <p>
          Os dados de cada conta são isolados por políticas de acesso na base de dados. Tokens de
          calendário são encriptados antes de serem guardados e não são enviados para o navegador.
          Podes rever a memória da aplicação, desligar calendários e eliminar a conta e os dados
          associados nas Definições.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold text-white">Retenção e pedidos</h2>
        <p>
          Mantemos os dados enquanto a conta existir ou enquanto forem necessários para prestar a
          alpha. Para aceder, corrigir ou eliminar dados, usa as ferramentas da aplicação ou
          contacta a pessoa que te enviou o convite para esta alpha privada.
        </p>
      </section>

      <p className="rounded-2xl border border-amber-500/20 bg-amber-500/[0.05] p-4 text-sm text-amber-100/80">
        Esta política descreve uma alpha privada e deverá ser revista juridicamente antes de um
        lançamento público.
      </p>
    </main>
  );
}
