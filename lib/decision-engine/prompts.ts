// docs/08_AI_ARCHITECTURE.md — prompt template + safety constraints for the
// AI refinement stage. Carried forward from lib/ai/provider.ts's
// SAFETY_RULES and CLAUDE.md's "Coaching safety" section. `PROMPT_VERSION`
// is stored alongside AI-refined decisions so behavior changes are
// auditable (see decision_runs.engine_version).

import type { DailyContext, GeneratedDecision } from "./types";

export const PROMPT_VERSION = "decision-refine-v1";

// Mirrors lib/ai/provider.ts's SAFETY_RULES — kept in sync deliberately.
const SAFETY_RULES = `
Es o Decision Coach do Rebuild, um Decision Operating System (não uma app de fitness ou dieta).
Podes reordenar, encurtar e adaptar o tom das três decisões que recebes. Não podes inventar uma quarta
decisão, remover uma das três, mudar o domínio, o impacto, ou os horários recomendados — esses vêm do
motor determinístico e não são teus para alterar.
Nunca diagnostiques, prometas reversão de pré-diabetes/resistência à insulina, prescrevas medicação ou
suplementos, ou recomendes jejum inseguro, desidratação, punição ou exercício compensatório.
O utilizador reportou possível pré-diabetes/resistência à insulina, sono interrompido e histórico de
pedras nos rins — respeita estas condições e remete para um clínico quando for uma decisão médica.
Responde em português de Portugal, direto e conciso — sem discursos motivacionais longos.
`.trim();

export function buildRefinementPrompt(context: DailyContext, candidates: GeneratedDecision[]): string {
  const { profile, userCheckIn } = context;
  return [
    SAFETY_RULES,
    "",
    `Identidade atual: ${profile.currentIdentity || "não definida"}.`,
    `Identidade desejada: ${profile.desiredIdentity || "não definida"}.`,
    `Tom preferido: ${profile.interventionTone}.`,
    `Restrições: ${profile.currentConstraints || "nenhuma reportada"}.`,
    userCheckIn
      ? `Check-in de hoje: sono ${userCheckIn.sleepQuality ?? "?"}/5, energia ${userCheckIn.energyLevel ?? "?"}/5, stress ${userCheckIn.stressLevel ?? "?"}/5.`
      : "Sem check-in registado hoje.",
    "",
    "As três decisões já escolhidas pelo motor determinístico (não inventes uma quarta, não removas nenhuma):",
    JSON.stringify(candidates, null, 2),
    "",
    "Devolve APENAS um array JSON com exatamente 3 objetos no mesmo formato, com 'title', 'reason' e",
    "'recommendedAction' reescritos no teu tom — mantém 'domain', 'impact', 'recommendedStart',",
    "'recommendedEnd' e 'confidence' exatamente iguais. Define 'source' como \"ai\".",
  ].join("\n");
}
