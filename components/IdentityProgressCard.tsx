import { Flame, ShieldCheck, Sparkles } from "lucide-react";
import type { IdentityProgression } from "@/lib/gamification/progression";
import { HelpTip } from "@/components/ui/HelpTip";

export function IdentityProgressCard({
  progression,
  compact = false,
}: {
  progression: IdentityProgression;
  compact?: boolean;
}) {
  if (compact) {
    return (
      <section
        className="rounded-2xl border border-emerald-400/10 bg-gradient-to-br from-emerald-400/[0.09] to-teal-500/[0.025] p-3"
        aria-label="Progressão de identidade"
      >
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-emerald-400/15 text-emerald-300">
            {progression.current.id === "mentor" ? <ShieldCheck size={16} /> : <Flame size={16} />}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-semibold text-emerald-100">
              {progression.current.label}
            </p>
            <p className="text-[10px] text-neutral-500">
              {progression.xp} XP · identidade em construção
            </p>
          </div>
        </div>
        {progression.next && (
          <div className="mt-2.5 h-1 overflow-hidden rounded-full bg-black/25">
            <div
              className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-teal-400"
              style={{ width: `${progression.progressPercent}%` }}
            />
          </div>
        )}
      </section>
    );
  }

  return (
    <section
      className="relative overflow-hidden rounded-3xl border border-emerald-400/15 bg-gradient-to-br from-emerald-400/[0.11] via-white/[0.035] to-teal-500/[0.04] p-5 shadow-xl shadow-black/20"
      aria-label="Progressão de identidade"
    >
      <Sparkles
        className="absolute -right-3 -top-3 text-emerald-300/10"
        size={76}
        aria-hidden="true"
      />
      <div className="relative flex items-center gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-400/15 text-emerald-300 shadow-inner shadow-white/5">
          {progression.current.id === "mentor" ? <ShieldCheck size={20} /> : <Flame size={20} />}
        </span>
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1 text-xs uppercase tracking-wide text-neutral-400">
            Identidade · {progression.current.label}
            <HelpTip heading="Progressão de identidade">
              Avanças com XP e dias em que concluíste pelo menos uma decisão. Saltar uma decisão
              nunca retira pontos, e o peso não determina o teu nível.
            </HelpTip>
          </p>
          <p className="mt-0.5 text-sm text-neutral-200">{progression.current.description}</p>
        </div>
        <p className="shrink-0 rounded-full bg-black/20 px-3 py-1.5 text-sm font-semibold text-emerald-200">
          {progression.xp} XP
        </p>
      </div>
      {progression.next && (
        <>
          <div className="relative mt-4 h-2 overflow-hidden rounded-full bg-black/25">
            <div
              className="h-full rounded-full bg-gradient-to-r from-emerald-400 via-teal-400 to-cyan-400"
              style={{ width: `${progression.progressPercent}%` }}
            />
          </div>
          <p className="mt-2 text-xs text-neutral-400">
            Próximo: <span className="font-medium text-neutral-200">{progression.next.label}</span>{" "}
            · faltam {progression.xpRemaining} XP e {progression.activeDaysRemaining}{" "}
            {progression.activeDaysRemaining === 1 ? "dia ativo" : "dias ativos"}.
          </p>
        </>
      )}
      {!progression.next && (
        <p className="mt-2 text-xs text-emerald-400">
          Nível máximo alcançado — mantém o sistema simples e sustentável.
        </p>
      )}
    </section>
  );
}
