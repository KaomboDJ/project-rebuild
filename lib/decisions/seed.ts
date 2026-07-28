import type { Decision } from "./types";

// Sourced from FOUNDER_CONTEXT.md "Initial Founder Decision Moments" and
// PROJECT_REBUILD_STATE.md "Current experiment". Update both docs, not just
// this list, if the underlying experiment changes.
export const CORE_DECISIONS: Decision[] = [
  {
    id: "decide-dinner",
    title: "Decide o jantar antes das 18:00",
    trigger: "18:00",
    scoreValue: 15,
    priority: 1,
    appliesToStates: ["performer", "consistent", "survival", "recovery"],
  },
  {
    id: "avoid-takeout",
    title: "Janta comida que já existe em casa",
    trigger: "Hora do jantar",
    scoreValue: 15,
    priority: 2,
    appliesToStates: ["performer", "consistent", "survival", "recovery"],
    fallback:
      "Se não houver nada preparado, usa uma opção simples já decidida com antecedência — não abras a app de entregas primeiro.",
  },
  {
    id: "lunchtime-training",
    title: "Treino de 30 min a meio do dia",
    trigger: "12:00, dias de trabalho remoto",
    scoreValue: 20,
    priority: 3,
    appliesToStates: ["performer", "consistent", "survival"],
    requiresRemoteDay: true,
    reducedAction: {
      title: "Caminhada ou mobilidade de 15-20 min",
      trigger: "A meio do dia, em vez de cancelar",
    },
    reminderTime: "11:55",
    reminderWindowMinutes: 65,
  },
  {
    id: "hydration",
    title: "Bebe água ao longo do dia",
    trigger: "Contínuo",
    scoreValue: 10,
    priority: 4,
    appliesToStates: ["performer", "consistent", "survival", "recovery"],
  },
  {
    id: "close-kitchen",
    title: "Fecha a cozinha depois do jantar",
    trigger: "Depois do jantar",
    scoreValue: 10,
    priority: 5,
    appliesToStates: ["performer", "consistent", "survival", "recovery"],
    fallback: "Vontade de doce: água, escovar os dentes, sair da cozinha, esperar 10 minutos.",
  },
  {
    id: "prep-food",
    title: "Prepara comida com antecedência",
    trigger: "Fim do dia / fim de semana",
    scoreValue: 15,
    priority: 6,
    appliesToStates: ["performer", "consistent", "survival", "recovery"],
  },
  {
    id: "stop-work-protect-sleep",
    title: "Para de trabalhar para proteger o sono",
    trigger: "Fim do dia",
    scoreValue: 10,
    priority: 7,
    appliesToStates: ["performer", "consistent", "survival", "recovery"],
  },
];
