import Link from "next/link";
import {
  Check,
  ChevronRight,
  ListChecks,
  ShoppingCart,
  UserCog,
  CalendarRange,
} from "lucide-react";
import type { NutritionJourneyState, NutritionJourneyStep } from "@/lib/nutrition/journey";

const STEP_META: Record<
  NutritionJourneyStep,
  { number: number; label: string; description: string; icon: typeof UserCog }
> = {
  profile: { number: 1, label: "Perfil", description: "Objetivos e preferências", icon: UserCog },
  pantry: { number: 2, label: "Despensa", description: "O que já tens", icon: ListChecks },
  plan: {
    number: 3,
    label: "Plano semanal",
    description: "As refeições da semana",
    icon: CalendarRange,
  },
  shopping: { number: 4, label: "Compras", description: "Só o que falta", icon: ShoppingCart },
};

export function NutritionJourney({ state }: { state: NutritionJourneyState }) {
  return (
    <nav aria-label="Progresso da alimentação" className="surface-card overflow-hidden p-2">
      <div className="mb-2 flex items-center justify-between px-2 pt-1">
        <p className="text-xs font-medium uppercase tracking-wide text-neutral-400">
          A tua preparação
        </p>
        <p className="text-xs tabular-nums text-neutral-400">
          {state.completedCount}/4 passos preparados
        </p>
      </div>
      <div className="grid gap-1 sm:grid-cols-4">
        {(Object.keys(STEP_META) as NutritionJourneyStep[]).map((step) => {
          const meta = STEP_META[step];
          const status = state.statuses[step];
          const Icon = meta.icon;
          return (
            <Link
              key={step}
              href={`#${step}`}
              aria-current={status === "current" ? "step" : undefined}
              className={`group flex items-center gap-3 rounded-xl px-3 py-3 transition ${
                status === "current"
                  ? "bg-emerald-500/10 text-emerald-100"
                  : "text-neutral-400 hover:bg-white/[0.04] hover:text-neutral-200"
              }`}
            >
              <span
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                  status === "complete"
                    ? "bg-emerald-500/15 text-emerald-400"
                    : status === "current"
                      ? "bg-emerald-500/20 text-emerald-300"
                      : "bg-white/[0.04] text-neutral-500"
                }`}
              >
                {status === "complete" ? <Check size={15} /> : <Icon size={15} />}
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium">{meta.label}</span>
                <span className="hidden truncate text-xs text-neutral-500 lg:block">
                  {meta.description}
                </span>
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

export function NutritionSectionHeading({
  step,
  complete,
  children,
}: {
  step: NutritionJourneyStep;
  complete: boolean;
  children: React.ReactNode;
}) {
  const meta = STEP_META[step];
  return (
    <div className="mb-4 flex items-start justify-between gap-4">
      <div className="flex items-start gap-3">
        <span
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-sm font-semibold ${
            complete ? "bg-emerald-500/15 text-emerald-300" : "bg-white/[0.05] text-neutral-300"
          }`}
        >
          {complete ? <Check size={16} /> : meta.number}
        </span>
        <div>
          <h2 className="text-lg font-semibold text-neutral-100">{meta.label}</h2>
          <div className="mt-0.5 text-sm text-neutral-400">{children}</div>
        </div>
      </div>
      {complete && (
        <span className="hidden text-xs font-medium text-emerald-400 sm:block">Preparado</span>
      )}
    </div>
  );
}

export function NutritionBackLink() {
  return (
    <Link href="/nutrition" className="btn-ghost -ml-3 w-fit gap-1.5 text-sm">
      <ChevronRight size={15} className="rotate-180" /> Voltar à jornada de alimentação
    </Link>
  );
}

export function JourneySuccess({
  children,
  href,
  action,
}: {
  children: React.ReactNode;
  href: string;
  action: string;
}) {
  return (
    <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/[0.07] p-4">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-300">
          <Check size={14} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm text-emerald-100">{children}</p>
          <Link
            href={href}
            className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-emerald-300 hover:text-emerald-200"
          >
            {action} <ChevronRight size={15} />
          </Link>
        </div>
      </div>
    </div>
  );
}
