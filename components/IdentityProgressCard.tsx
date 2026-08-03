import { ShieldCheck, Trophy } from "lucide-react";
import type { IdentityProgression } from "@/lib/gamification/progression";
import { HelpTip } from "@/components/ui/HelpTip";

export function IdentityProgressCard({ progression, compact = false }: { progression: IdentityProgression; compact?: boolean }) {
  return (
    <section className="surface-card border-emerald-500/15 p-4" aria-label="Progressão de identidade">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-300">
          {progression.current.id === "mentor" ? <ShieldCheck size={19} /> : <Trophy size={19} />}
        </span>
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1 text-xs uppercase tracking-wide text-neutral-400">
            Identidade · {progression.current.label}
            <HelpTip heading="Progressão de identidade">
              Avanças com XP e dias em que concluíste pelo menos uma decisão. Saltar uma decisão nunca retira pontos, e o peso não determina o teu nível.
            </HelpTip>
          </p>
          <p className="text-sm text-neutral-200">{progression.current.description}</p>
        </div>
        <p className="shrink-0 text-sm font-semibold text-emerald-300">{progression.xp} XP</p>
      </div>
      {progression.next && (
        <>
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
            <div className="h-full rounded-full bg-emerald-500" style={{ width: `${progression.progressPercent}%` }} />
          </div>
          {!compact && (
            <p className="mt-2 text-xs text-neutral-500">
              Próximo: {progression.next.label} · faltam {progression.xpRemaining} XP e {progression.activeDaysRemaining} {progression.activeDaysRemaining === 1 ? "dia ativo" : "dias ativos"}.
            </p>
          )}
        </>
      )}
      {!progression.next && <p className="mt-2 text-xs text-emerald-400">Nível máximo alcançado — mantém o sistema simples e sustentável.</p>}
    </section>
  );
}
