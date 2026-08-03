import { computeDecisionScore, type ScorableDecision } from "@/lib/decision-engine/scorer";

export type IdentityLevelId = "restart" | "momentum" | "competitor" | "athlete" | "mentor";

export interface ProgressionDecision extends ScorableDecision { date: string }

export interface IdentityLevel {
  id: IdentityLevelId;
  label: string;
  description: string;
  requiredXp: number;
  requiredActiveDays: number;
}

export const IDENTITY_LEVELS: IdentityLevel[] = [
  { id: "restart", label: "Recomeço", description: "Decidiste reconstruir.", requiredXp: 0, requiredActiveDays: 0 },
  { id: "momentum", label: "Ritmo", description: "As boas decisões começam a repetir-se.", requiredXp: 100, requiredActiveDays: 7 },
  { id: "competitor", label: "Competidor", description: "Já executas como alguém que treina.", requiredXp: 350, requiredActiveDays: 21 },
  { id: "athlete", label: "Atleta", description: "A identidade física voltou a ser o padrão.", requiredXp: 1000, requiredActiveDays: 60 },
  { id: "mentor", label: "Mentor", description: "Manténs o sistema e ajudas pelo exemplo.", requiredXp: 2500, requiredActiveDays: 120 },
];

export interface IdentityProgression {
  current: IdentityLevel;
  next: IdentityLevel | null;
  xp: number;
  activeDays: number;
  completedDecisions: number;
  progressPercent: number;
  xpRemaining: number;
  activeDaysRemaining: number;
}

export function computeIdentityProgression(decisions: ProgressionDecision[]): IdentityProgression {
  const xp = computeDecisionScore(decisions);
  const completed = decisions.filter((decision) => decision.status === "completed");
  const activeDays = new Set(completed.map((decision) => decision.date)).size;
  const current = [...IDENTITY_LEVELS]
    .reverse()
    .find((level) => xp >= level.requiredXp && activeDays >= level.requiredActiveDays) ?? IDENTITY_LEVELS[0];
  const currentIndex = IDENTITY_LEVELS.findIndex((level) => level.id === current.id);
  const next = IDENTITY_LEVELS[currentIndex + 1] ?? null;
  const xpProgress = next ? Math.min(1, xp / next.requiredXp) : 1;
  const dayProgress = next ? Math.min(1, activeDays / next.requiredActiveDays) : 1;

  return {
    current,
    next,
    xp,
    activeDays,
    completedDecisions: completed.length,
    progressPercent: Math.round(Math.min(xpProgress, dayProgress) * 100),
    xpRemaining: next ? Math.max(0, next.requiredXp - xp) : 0,
    activeDaysRemaining: next ? Math.max(0, next.requiredActiveDays - activeDays) : 0,
  };
}
