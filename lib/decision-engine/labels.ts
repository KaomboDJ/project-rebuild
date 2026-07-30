// Shared Portuguese display labels for decision domain/status, used by both
// the client-side today view (components/DecisionEngineCard.tsx) and the
// server-rendered /history page. Pure, no "use client"/"server-only" — safe
// to import from either side.

import type { DecisionDomain, DecisionStatus } from "./types";

export const DOMAIN_LABEL: Record<DecisionDomain, string> = {
  training: "Treino",
  nutrition: "Nutrição",
  sleep: "Sono",
  recovery: "Recuperação",
  planning: "Planeamento",
};

export const STATUS_LABEL: Record<DecisionStatus, string> = {
  proposed: "Não decidido",
  accepted: "Aceite",
  edited: "Editado",
  completed: "Concluído",
  skipped: "Não feito",
};
