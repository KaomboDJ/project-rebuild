"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CircleHelp, Compass, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

interface GuideContent {
  title: string;
  description: string;
  steps: string[];
  nextHref: string;
  nextLabel: string;
}

function guideFor(pathname: string): GuideContent {
  if (pathname.startsWith("/settings/health")) return {
    title: "Guia dos dados de saúde",
    description: "Vê de onde veio cada leitura e decide se essa fonte pode ajudar o Coach.",
    steps: ["Confirma a origem e a última sincronização.", "Escolhe entre Usado pelo Coach e Só guardar.", "Desliga a fonte para apagar os dados que importou."],
    nextHref: "/settings",
    nextLabel: "Voltar às definições",
  };
  if (pathname.startsWith("/nutrition")) return {
    title: "Guia da alimentação",
    description: "Prepara o contexto uma vez; depois o Rebuild decide a semana e calcula apenas o que falta comprar.",
    steps: ["Guarda o perfil alimentar.", "Regista o que já tens na despensa.", "Gera o plano semanal e a lista de compras."],
    nextHref: "/nutrition#profile",
    nextLabel: "Continuar a preparação",
  };
  if (pathname.startsWith("/today")) return {
    title: "Guia das decisões",
    description: "Aqui executas as três decisões de maior impacto — o dia completo é preparado no Início.",
    steps: ["Vê por que foi sugerida.", "Aceita ou ajusta o horário.", "Marca Feito ou explica por que não deu."],
    nextHref: "/home",
    nextLabel: "Ver o plano completo do dia",
  };
  if (pathname.startsWith("/coach")) return {
    title: "Guia do Coach",
    description: "O Coach ajuda numa decisão de saúde concreta e usa o teu plano, calendário e despensa como contexto.",
    steps: ["Descreve o momento real.", "Pede uma única próxima ação.", "Confirma qualquer alteração antes de ser executada."],
    nextHref: "/today",
    nextLabel: "Voltar às decisões",
  };
  if (pathname.startsWith("/history")) return {
    title: "Guia do histórico",
    description: "Usa tendências para ajustar o sistema, não para te culpares por um dia imperfeito.",
    steps: ["Revê decisões concluídas.", "Identifica os contextos difíceis.", "Leva um padrão útil para a Memória."],
    nextHref: "/settings/memory",
    nextLabel: "Abrir Memória",
  };
  if (pathname.startsWith("/settings")) return {
    title: "Guia das definições",
    description: "Mantém horários, calendários, notificações e preferências verdadeiros para receber boas sugestões.",
    steps: ["Confirma a janela de sono.", "Escolhe os calendários que contam.", "Ativa notificações no dispositivo."],
    nextHref: "/home",
    nextLabel: "Voltar ao Início",
  };
  return {
    title: "Guia do Início",
    description: "O Rebuild junta compromissos, refeições, treino e recuperação numa agenda possível — sem sobreposições.",
    steps: ["Confirma o check-in rápido.", "Revê as sugestões colocadas nos espaços livres.", "Aceita o plano ou ajusta apenas o que não funciona."],
    nextHref: "/today",
    nextLabel: "Executar as decisões",
  };
}

export function AppGuide() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const guide = useMemo(() => guideFor(pathname), [pathname]);

  useEffect(() => {
    if (!open) return;
    const close = (event: KeyboardEvent) => event.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [open]);

  function showGuide() {
    setOpen(true);
  }

  // Founder report, live on mobile (2026-08-05): the floating "?" bubble
  // sits at `fixed bottom-24 right-4`, meant to clear the ~64-80px bottom
  // tab bar (components/AppNav.tsx) with a small margin. Every other
  // page's content scrolls independently of that corner, but /coach's
  // compose form (components/coach/CoachPageClient.tsx) is the last
  // in-flow element inside a near-full-viewport-height card, so on mobile
  // its own "Enviar" button lands directly under this fixed bubble - not
  // just visually overlapped but literally untappable, since the fixed
  // button sits on top in the stacking order. Rather than chase a corner
  // offset that's guaranteed to clear a compose bar whose height varies
  // with font scaling and the safe-area inset, skip rendering the bubble
  // on /coach entirely: the page already has its own "Ver contexto" (Info
  // icon) affordance in the header, and the guide's own copy on every
  // other page already points founders at the Coach for anything more
  // specific ("Para decisoes pessoais ... usa o Coach"). This check runs
  // after every hook above, never before, so hook order stays identical
  // across renders regardless of route.
  if (pathname.startsWith("/coach")) return null;

  return (
    <>
      {/* Founder report (2026-08-05): the expanded "Precisas de ajuda?"
          text pill (shown once per browser via localStorage) made this
          fixed-position button wide enough to sit on top of page content
          on most screens, not just clear the corner. Icon-only, always -
          same tap target, no longer competes with whatever's underneath. */}
      <button
        type="button"
        onClick={showGuide}
        aria-label="Abrir guia da aplicação"
        className="fixed bottom-24 right-4 z-30 flex h-12 w-12 items-center justify-center rounded-full border border-emerald-400/25 bg-emerald-700 text-white shadow-2xl shadow-black/40 transition hover:bg-emerald-600 md:bottom-6 md:right-6"
      >
        <CircleHelp size={20} />
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/65" onMouseDown={(event) => event.target === event.currentTarget && setOpen(false)}>
          <aside role="dialog" aria-modal="true" aria-labelledby="app-guide-title" className="h-full w-full max-w-md overflow-y-auto border-l border-white/10 bg-[#0d0f0f] p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div className="flex gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-300"><Compass size={19} /></span>
                <div>
                  <p className="text-xs uppercase tracking-wide text-emerald-400">Assistente da aplicação</p>
                  <h2 id="app-guide-title" className="mt-1 text-xl font-semibold">{guide.title}</h2>
                </div>
              </div>
              <button type="button" onClick={() => setOpen(false)} className="btn-ghost h-9 w-9 p-0" aria-label="Fechar guia"><X size={18} /></button>
            </div>

            <p className="mt-5 text-sm leading-relaxed text-neutral-300">{guide.description}</p>
            <ol className="mt-5 space-y-3">
              {guide.steps.map((step, index) => (
                <li key={step} className="flex gap-3 rounded-xl bg-white/[0.035] p-3 text-sm text-neutral-300">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-xs font-semibold text-emerald-300">{index + 1}</span>
                  {step}
                </li>
              ))}
            </ol>

            <Link href={guide.nextHref} onClick={() => setOpen(false)} className="btn-primary mt-6 flex w-full justify-center">{guide.nextLabel}</Link>

            <div className="mt-8 border-t border-white/10 pt-5">
              <h3 className="text-sm font-medium">Explorar o Rebuild</h3>
              <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                {[["Início", "/home"], ["Decisões", "/today"], ["Alimentação", "/nutrition"], ["Definições", "/settings"]].map(([label, href]) => (
                  <Link key={href} href={href} onClick={() => setOpen(false)} className="rounded-xl bg-white/[0.035] px-3 py-2.5 text-neutral-300 hover:bg-white/[0.07]">{label}</Link>
                ))}
              </div>
            </div>
            <p className="mt-6 text-xs leading-relaxed text-neutral-500">Este assistente explica a aplicação. Para decisões pessoais de treino, alimentação ou recuperação, usa o Coach.</p>
          </aside>
        </div>
      )}
    </>
  );
}
