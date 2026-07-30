// The rule catalog from docs/07_DECISION_CATALOG.md (sourced from
// REBUILD_MASTER_HANDOFF.md §14). Each rule is a pure function
// `(context: DailyContext) => DecisionCandidate[]` — no side effects, no
// network calls, returns an empty array when its trigger condition isn't
// met, never throws. Every rule is exported individually so it can be
// tested in isolation with synthetic fixtures (see rules.test.ts).
//
// Rules whose condition genuinely requires calendar data (free windows,
// tomorrow's events) degrade gracefully to an empty array until
// Milestone 3 (Google Calendar) supplies `calendarEvents`/`freeWindows` —
// this is the deterministic-fallback contract, not a bug: the engine must
// keep working with whatever context is actually available today.

import type { DailyContext, DecisionCandidate, DecisionDomain, PantryItemSummary } from "./types";

const DAY_NAMES = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

function dayOfWeek(date: string): string {
  // Noon UTC avoids date-boundary/DST edge cases for a plain "YYYY-MM-DD" string.
  return DAY_NAMES[new Date(`${date}T12:00:00Z`).getUTCDay()];
}

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + (m || 0);
}

function nowMinutes(context: DailyContext): number {
  const time = context.now.slice(11, 16); // "HH:MM" out of "...T13:15:00"
  return toMinutes(time || "00:00");
}

function hasRecentDomainStatus(
  context: DailyContext,
  domain: DecisionDomain,
  status: string,
  withinDays: number
): number {
  const cutoff = new Date(context.date);
  cutoff.setDate(cutoff.getDate() - withinDays);
  const cutoffStr = cutoff.toISOString().slice(0, 10);
  return context.recentDecisions.filter(
    (d) => d.domain === domain && d.status === status && d.date >= cutoffStr
  ).length;
}

/**
 * Milestone 11C: names a specific at-home meal item instead of a generic
 * "decide now" prompt, when pantry data exists — directly serving the
 * founder's non-negotiable ("Mesmo num dia péssimo, janto comida que já
 * existe em casa"). `context.pantryItems` is expected pre-sorted
 * soonest-expiring first (see context-builder.ts), so the first entry is
 * simply the most useful one to suggest using before it's wasted. Returns
 * null when there's no pantry data yet, so callers can fall back to the
 * original generic phrasing untouched.
 */
function pickDinnerSuggestion(pantryItems: PantryItemSummary[]): PantryItemSummary | null {
  return pantryItems[0] ?? null;
}

/**
 * Milestone 12: what to name as tonight's dinner. A Nutrition Toolkit plan
 * for today (context.todaysDinnerPlanName) takes priority over the
 * Milestone 11C ad-hoc pantry pick — an already-decided weekly plan is a
 * stronger commitment than "whatever's about to expire". `relatedPantryItem`
 * is only ever set from the pantry-fallback path: a planned recipe name
 * isn't a pantry_items row, so it must not flow into the Milestone 11D
 * auto-consume mechanism (which does a full-quantity pantry match) — the
 * meal plan has its own completion/auto-consume path
 * (lib/nutrition/queries.ts's completeMealPlanItem).
 */
function pickDinnerLabel(context: DailyContext): { name: string; relatedPantryItem?: string } | null {
  if (context.todaysDinnerPlanName) {
    return { name: context.todaysDinnerPlanName };
  }
  const suggestion = pickDinnerSuggestion(context.pantryItems);
  return suggestion ? { name: suggestion.name, relatedPantryItem: suggestion.name } : null;
}

function findWindowOverlapping(
  context: DailyContext,
  windowStartMin: number,
  windowEndMin: number,
  minDurationMinutes: number
): boolean {
  return context.freeWindows.some((fw) => {
    const start = toMinutes(fw.start.slice(11, 16));
    const end = toMinutes(fw.end.slice(11, 16));
    const overlapStart = Math.max(start, windowStartMin);
    const overlapEnd = Math.min(end, windowEndMin);
    return overlapEnd - overlapStart >= minDurationMinutes;
  });
}

// ---------------------------------------------------------------------------
// Training (domain: training)
// ---------------------------------------------------------------------------

/** Preferred training day; free lunch window >= 35 min; no calendar conflict. */
export function lunchTraining(context: DailyContext): DecisionCandidate[] {
  const { profile, userCheckIn } = context;
  const isTrainingDay = profile.preferredTrainingDays.includes(dayOfWeek(context.date));
  if (!isTrainingDay) return [];
  if (userCheckIn?.physicalLimitation) return [];
  if (userCheckIn && ((userCheckIn.sleepQuality ?? 5) <= 2 || (userCheckIn.energyLevel ?? 5) <= 2)) {
    return []; // reducedTraining takes over instead
  }

  // Without a calendar connection there's no free-window data yet — proceed
  // optimistically on the profile's preferred time rather than blocking.
  const hasCalendarData = context.freeWindows.length > 0 || context.calendarEvents.length > 0;
  if (hasCalendarData) {
    const start = toMinutes(profile.preferredTrainingTime);
    const available = findWindowOverlapping(context, start - 15, start + 60, 35);
    if (!available) return [];
  }

  const start = profile.preferredTrainingTime;
  const [h, m] = start.split(":").map(Number);
  const endMinutes = h * 60 + m + 40;
  const end = `${String(Math.floor(endMinutes / 60)).padStart(2, "0")}:${String(endMinutes % 60).padStart(2, "0")}`;

  return [
    {
      ruleId: "lunch-training",
      domain: "training",
      recommendedAction: `Treina entre as ${start} e as ${end}.`,
      baseTitle: "Treino ao almoço",
      baseReason: "Hoje é um dos teus dias de treino planeados e esta é a melhor janela disponível.",
      requiresFreeWindow: true,
      minWindowMinutes: 35,
      baseImpact: "high",
    },
  ];
}

/** Overloaded day, low energy, or poor sleep; useful window shorter than ideal. */
export function reducedTraining(context: DailyContext): DecisionCandidate[] {
  const { userCheckIn, profile } = context;
  if (!userCheckIn) return [];
  const poorSleep = (userCheckIn.sleepQuality ?? 5) <= 2;
  const lowEnergy = (userCheckIn.energyLevel ?? 5) <= 2;
  if (!poorSleep && !lowEnergy) return [];
  if (userCheckIn.physicalLimitation) return []; // mobility rule takes over instead

  return [
    {
      ruleId: "reduced-training",
      domain: "training",
      recommendedAction: `Faz 20 minutos de treino, por volta das ${profile.preferredTrainingTime}.`,
      baseTitle: "Treino reduzido",
      baseReason: "O sono ou a energia de hoje não dão para o treino completo. O objetivo é consistência, não performance máxima.",
      requiresFreeWindow: false,
      baseImpact: "medium",
    },
  ];
}

/** Physical limitation or poor recovery reported; no appropriate full-training window. */
export function mobilityInsteadOfCancellation(context: DailyContext): DecisionCandidate[] {
  if (!context.userCheckIn?.physicalLimitation) return [];

  return [
    {
      ruleId: "mobility-instead-of-cancellation",
      domain: "training",
      recommendedAction: "Substitui a sessão completa por 15 minutos de mobilidade.",
      baseTitle: "Mobilidade em vez de cancelar",
      baseReason: `Reportaste uma limitação física hoje (${context.userCheckIn.physicalLimitation}). Mobilidade mantém a identidade sem arriscar a recuperação.`,
      requiresFreeWindow: false,
      baseImpact: "medium",
    },
  ];
}

/** Training planned later today; preparation friction is a known risk. */
export function prepareTrainingEquipment(context: DailyContext): DecisionCandidate[] {
  const { profile } = context;
  const isTrainingDay = profile.preferredTrainingDays.includes(dayOfWeek(context.date));
  if (!isTrainingDay) return [];
  if (context.userCheckIn?.physicalLimitation) return [];

  const trainingStart = toMinutes(profile.preferredTrainingTime);
  const current = nowMinutes(context);
  if (current >= trainingStart || trainingStart - current > 180) return [];

  return [
    {
      ruleId: "prepare-training-equipment",
      domain: "training",
      recommendedAction: "Prepara agora a roupa de treino.",
      baseTitle: "Prepara o treino de hoje",
      baseReason: "Remover esta fricção agora reduz a hipótese de cancelares mais tarde.",
      requiresFreeWindow: false,
      baseImpact: "low",
    },
  ];
}

// ---------------------------------------------------------------------------
// Nutrition (domain: nutrition)
// ---------------------------------------------------------------------------

/** Busy evening; approaching the takeaway-risk period; no dinner decision recorded yet today. */
export function decideDinnerEarly(context: DailyContext): DecisionCandidate[] {
  const dinnerStart = toMinutes(context.profile.typicalDinnerTime);
  const current = nowMinutes(context);
  const minutesUntilDinner = dinnerStart - current;
  if (minutesUntilDinner < 60 || minutesUntilDinner > 240) return [];

  const dinner = pickDinnerLabel(context);

  return [
    {
      ruleId: "decide-dinner-early",
      domain: "nutrition",
      recommendedAction: dinner
        ? context.todaysDinnerPlanName
          ? `Segue o plano da semana: ${dinner.name}. Decide agora, antes da janela de fadiga da noite.`
          : `Janta ${dinner.name}, que já tens em casa. Decide agora, antes da janela de fadiga da noite.`
        : "Decide o jantar agora, antes da janela de fadiga da noite.",
      baseTitle: "Decide o jantar",
      baseReason: "Decidir agora evita a decisão por cansaço mais tarde — janta comida que já existe em casa.",
      requiresFreeWindow: false,
      baseImpact: "high",
      relatedPantryItem: dinner?.relatedPantryItem,
    },
  ];
}

/** A home meal requires prep and enough time remains before dinner. */
export function defrostIngredients(context: DailyContext): DecisionCandidate[] {
  const dinnerStart = toMinutes(context.profile.typicalDinnerTime);
  const current = nowMinutes(context);
  if (dinnerStart - current < 180) return []; // not enough lead time left

  const hasAfternoonWindow = findWindowOverlapping(context, 13 * 60, dinnerStart, 20);
  if (!hasAfternoonWindow) return [];

  return [
    {
      ruleId: "defrost-ingredients",
      domain: "nutrition",
      recommendedAction: "Tira a proteína do congelador agora.",
      baseTitle: "Prepara o jantar de hoje",
      baseReason: "Ainda vais a tempo de descongelar e evitar decidir por cansaço mais tarde.",
      requiresFreeWindow: false,
      baseImpact: "low",
    },
  ];
}

/** Tomorrow's calendar is busy; lunch prep is likely to fail later. */
export function prepareTomorrowsLunch(context: DailyContext): DecisionCandidate[] {
  const tomorrow = new Date(`${context.date}T12:00:00Z`);
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  const tomorrowStr = tomorrow.toISOString().slice(0, 10);

  const tomorrowEvents = context.calendarEvents.filter((e) => e.start.slice(0, 10) === tomorrowStr);
  if (tomorrowEvents.length < 2) return []; // no signal that tomorrow is dense

  return [
    {
      ruleId: "prepare-tomorrows-lunch",
      domain: "nutrition",
      recommendedAction: "Prepara o almoço de amanhã depois do jantar.",
      baseTitle: "Prepara o amanhã",
      baseReason: "Amanhã está cheio — preparar agora remove uma decisão de última hora.",
      requiresFreeWindow: false,
      baseImpact: "medium",
    },
  ];
}

/** High-risk evening; repeated recent takeaway pattern. */
export function avoidTakeawayCommitment(context: DailyContext): DecisionCandidate[] {
  const current = nowMinutes(context);
  if (current < 17 * 60) return []; // only relevant approaching the evening

  const recentSkippedNutrition = hasRecentDomainStatus(context, "nutrition", "skipped", 5);
  if (recentSkippedNutrition < 2) return [];

  const dinner = pickDinnerLabel(context);

  return [
    {
      ruleId: "avoid-takeaway-commitment",
      domain: "nutrition",
      recommendedAction: dinner
        ? context.todaysDinnerPlanName
          ? `Compromete-te já com o plano de hoje — ${dinner.name} — antes de abrires uma app de entregas.`
          : `Compromete-te já com ${dinner.name}, que já tens em casa, antes de abrires uma app de entregas.`
        : "Compromete-te com a refeição de hoje antes de abrires uma app de entregas.",
      baseTitle: "Evita o Uber Eats",
      baseReason: "Nos últimos dias houve um padrão de saltar a decisão do jantar — vamos travar isso agora.",
      requiresFreeWindow: false,
      baseImpact: "high",
      relatedPantryItem: dinner?.relatedPantryItem,
    },
  ];
}

// ---------------------------------------------------------------------------
// Sleep (domain: sleep)
// ---------------------------------------------------------------------------

/** Target sleep time approaching; work/screen use is likely to continue. */
export function shutdownRoutine(context: DailyContext): DecisionCandidate[] {
  const sleepStart = toMinutes(context.profile.targetSleepTime);
  const current = nowMinutes(context);
  const minutesUntilSleep = sleepStart - current;
  if (minutesUntilSleep < 30 || minutesUntilSleep > 120) return [];

  const shutdownMinutes = sleepStart - 30;
  const shutdownTime = `${String(Math.floor(shutdownMinutes / 60) % 24).padStart(2, "0")}:${String(shutdownMinutes % 60).padStart(2, "0")}`;

  return [
    {
      ruleId: "shutdown-routine",
      domain: "sleep",
      recommendedAction: `Começa a desligar às ${shutdownTime}.`,
      baseTitle: "Rotina de fecho",
      baseReason: "Proteger o horário de sono hoje ajuda a consistência da semana.",
      requiresFreeWindow: false,
      baseImpact: "medium",
    },
  ];
}

/** Recent poor sleep (check-in or recentDecisions); protect tonight's sleep. */
export function earlierSleepForTomorrow(context: DailyContext): DecisionCandidate[] {
  const poorSleepToday = (context.userCheckIn?.sleepQuality ?? 5) <= 2;
  if (!poorSleepToday) return [];

  return [
    {
      ruleId: "earlier-sleep-for-tomorrow",
      domain: "sleep",
      recommendedAction: "Protege o sono de hoje — evita continuar a trabalhar depois da hora combinada.",
      baseTitle: "Protege o sono de hoje",
      baseReason: "O sono de hoje já foi curto. Recuperar esta noite é a decisão de maior alavancagem.",
      requiresFreeWindow: false,
      baseImpact: "medium",
    },
  ];
}

/** Dense morning schedule tomorrow. */
export function prepareNextDay(context: DailyContext): DecisionCandidate[] {
  const tomorrow = new Date(`${context.date}T12:00:00Z`);
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  const tomorrowStr = tomorrow.toISOString().slice(0, 10);

  const earlyTomorrow = context.calendarEvents.some(
    (e) => e.start.slice(0, 10) === tomorrowStr && toMinutes(e.start.slice(11, 16)) < 8 * 60
  );
  if (!earlyTomorrow) return [];

  return [
    {
      ruleId: "prepare-next-day",
      domain: "sleep",
      recommendedAction: "Prepara a roupa e o essencial antes de dormir.",
      baseTitle: "Amanhã começa cedo",
      baseReason: "Tens um compromisso cedo amanhã — preparar agora reduz fricção da manhã.",
      requiresFreeWindow: false,
      baseImpact: "low",
    },
  ];
}

// ---------------------------------------------------------------------------
// Recovery (domain: recovery)
// ---------------------------------------------------------------------------

/** High stress; sedentary schedule; insufficient time for a full workout. */
export function shortWalk(context: DailyContext): DecisionCandidate[] {
  const highStress = (context.userCheckIn?.stressLevel ?? 0) >= 4;
  if (!highStress) return [];

  return [
    {
      ruleId: "short-walk",
      domain: "recovery",
      recommendedAction: "Faz uma caminhada de 15 minutos entre compromissos.",
      baseTitle: "Caminhada curta",
      baseReason: "O stress de hoje está elevado — uma pausa curta ajuda mais do que continuar sentado.",
      requiresFreeWindow: false,
      baseImpact: "medium",
    },
  ];
}

// ---------------------------------------------------------------------------
// Planning (domain: planning)
// ---------------------------------------------------------------------------

/** Only meaningful free period remaining today. */
export function protectFreeWindow(context: DailyContext): DecisionCandidate[] {
  if (context.freeWindows.length !== 1) return [];
  const [window] = context.freeWindows;
  if (window.durationMinutes < 30) return [];

  return [
    {
      ruleId: "protect-free-window",
      domain: "planning",
      recommendedAction: `Mantém livre a janela das ${window.start.slice(11, 16)} às ${window.end.slice(11, 16)}.`,
      baseTitle: "Protege a tua janela livre",
      baseReason: "É a melhor oportunidade de recuperação ou treino que resta hoje.",
      requiresFreeWindow: false,
      baseImpact: "medium",
    },
  ];
}

/** Overloaded calendar; no meal, exercise, or recovery window remains. */
export function moveLowPriorityWork(context: DailyContext): DecisionCandidate[] {
  if (context.calendarEvents.length < 5) return [];
  if (context.freeWindows.some((w) => w.durationMinutes >= 20)) return [];

  return [
    {
      ruleId: "move-low-priority-work",
      domain: "planning",
      recommendedAction: "Move uma tarefa de baixa prioridade e protege 30 minutos.",
      baseTitle: "Liberta uma janela",
      baseReason: "O dia está sobrecarregado e não sobra tempo para nenhuma decisão de saúde.",
      requiresFreeWindow: false,
      baseImpact: "medium",
    },
  ];
}

const ALL_RULES: ((context: DailyContext) => DecisionCandidate[])[] = [
  lunchTraining,
  reducedTraining,
  mobilityInsteadOfCancellation,
  prepareTrainingEquipment,
  decideDinnerEarly,
  defrostIngredients,
  prepareTomorrowsLunch,
  avoidTakeawayCommitment,
  shutdownRoutine,
  earlierSleepForTomorrow,
  prepareNextDay,
  shortWalk,
  protectFreeWindow,
  moveLowPriorityWork,
];

/**
 * Assembles the full candidate pool by running every rule against the
 * context, then drops any candidate whose ruleId the founder has explicitly
 * muted (Milestone 14, /settings/memory) — muting is absolute and applied
 * before scoring even runs, not a soft down-weight like
 * scorer.ts's personalization adjustment. The founder's own editable memory
 * always wins.
 */
export function generateCandidates(context: DailyContext): DecisionCandidate[] {
  const muted = new Set(context.mutedRuleIds ?? []);
  return ALL_RULES.flatMap((rule) => rule(context)).filter((candidate) => !muted.has(candidate.ruleId));
}
