import Link from "next/link";
import {
  Check,
  ChevronRight,
  PartyPopper,
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
    <nav aria-label="Progresso da alimentação" className="surface-card overflow-hidden p-3 sm:p-4">
      <div className="mb-3 flex items-center justify-between gap-3 px-1">
        <div>
          <p className="consumer-kicker text-amber-300/90">A tua preparação</p>
          <p className="mt-1 text-sm font-medium text-neutral-200">
            {state.completedCount === 4 ? "A semana está pronta" : "Continua de onde paraste"}
          </p>
        </div>
        <p className="rounded-full bg-white/[0.045] px-3 py-1.5 text-xs font-semibold tabular-nums text-neutral-300">
          {state.completedCount}/4
        </p>
      </div>
      <div className="mb-3 h-1.5 overflow-hidden rounded-full bg-black/25">
        <div
          className="h-full rounded-full bg-gradient-to-r from-amber-400 via-emerald-400 to-teal-400 transition-[width] duration-700"
          style={{ width: `${(state.completedCount / 4) * 100}%` }}
        />
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
              className={`group flex items-center gap-3 rounded-2xl border px-3 py-3 transition ${
                status === "current"
                  ? "border-amber-400/20 bg-amber-400/[0.07] text-amber-100"
                  : status === "complete"
                    ? "border-emerald-400/10 bg-emerald-400/[0.035] text-neutral-300"
                    : "border-transparent text-neutral-500 hover:border-white/[0.06] hover:bg-white/[0.04] hover:text-neutral-200"
              }`}
            >
              <span
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                  status === "complete"
                    ? "bg-emerald-500/15 text-emerald-300"
                    : status === "current"
                      ? "bg-amber-400/15 text-amber-300"
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
    <div className="relative overflow-hidden rounded-2xl border border-emerald-400/20 bg-gradient-to-r from-emerald-400/[0.1] to-teal-400/[0.04] p-4">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-emerald-400/15 text-emerald-300">
          <PartyPopper size={15} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-emerald-50">{children}</p>
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
