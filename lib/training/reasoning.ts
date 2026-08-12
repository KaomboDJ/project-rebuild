// "Porquê esta sessão?" plain-language explanation per planned training
// slot (founder request, 2026-08-05, extending the same closed-question /
// explanation pattern already shipped for meals — see
// lib/nutrition/reasoning.ts's own header comment and
// components/DecisionEngineCard.tsx's "Porquê esta sugestão?").
//
// Every sentence here must describe something the planner/profile actually
// does or is, never an invented claim — same discipline
// lib/training/planner.ts's header comment requires ("never choose
// differently" than what the deterministic rules picked).
//
// Deliberately qualitative, never a numeric prescription — see
// CLAUDE.md's coaching-safety rules and
// lib/nutrition/workout-types.ts's own "never present as medical advice"
// principle for the category guidance this pairs with.

import { TRAINING_CATEGORY_LABEL } from "@/lib/nutrition/workout-types";
import type { TrainingProfile, WorkoutSession } from "./types";

function locationMatches(session: WorkoutSession, profile: TrainingProfile): boolean {
  if (session.location === "mixed" || profile.location === "mixed") return true;
  return session.location === profile.location;
}

const LOCATION_LABEL: Record<WorkoutSession["location"], string> = {
  home: "em casa",
  gym: "no ginásio",
  outdoor: "ao ar livre",
  mixed: "em qualquer lugar",
};

/**
 * Builds the plain-language "why this session" explanation for one planned
 * training slot. Every sentence is grounded in a real, checkable fact about
 * this specific session and profile.
 */
export function explainSessionChoice(params: { session: WorkoutSession; profile: TrainingProfile }): string[] {
  const { session, profile } = params;
  const sentences: string[] = [];

  if (profile.preferredCategories.length > 0 && profile.preferredCategories.includes(session.workoutTypeId)) {
    sentences.push(`Escolhemos ${TRAINING_CATEGORY_LABEL[session.workoutTypeId]} porque é um dos tipos de treino que marcaste como preferência.`);
  } else {
    sentences.push(`É uma sessão de ${TRAINING_CATEGORY_LABEL[session.workoutTypeId]}, escolhida para dar variedade à tua semana.`);
  }

  if (session.durationMinutes <= profile.sessionDurationMinutes) {
    sentences.push(`Dura cerca de ${session.durationMinutes} min, dentro do tempo que costumas ter disponível para treinar.`);
  }

  if (locationMatches(session, profile)) {
    sentences.push(`Pode ser feita ${LOCATION_LABEL[session.location]}, de acordo com onde costumas treinar.`);
  }

  if (profile.intensityPreference === session.intensity) {
    sentences.push("A intensidade encaixa no nível que preferes para os teus treinos.");
  }

  return sentences;
}
