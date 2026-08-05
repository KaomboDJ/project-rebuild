// Training-category catalog (founder request, 2026-08-03, refined
// 2026-08-05). Original version tagged 16 named activities with 1-2 of 4
// broad categories (cardio / força-hipertrofia / calistenia / mental) -
// the founder corrected this: striking martial arts (Muay Thai,
// kickboxing) and grappling martial arts (jiu-jitsu, judo, wrestling,
// sambo) are physically different disciplines and must not share a
// category, and light cardio (walking, easy jog) is a different demand
// than heavy cardio (HIIT, sprints, bike, rowing intervals). This is now
// the founder's own 8-category taxonomy - the category IS the thing a
// founder picks for a day's training (see lib/training/types.ts), not an
// activity that gets tagged with a category after the fact.
//
// Deliberately qualitative guidance, not a numeric macro multiplier
// applied automatically to real targets - see lib/nutrition/macros.ts's
// own "never present as medical advice, prefer useful ranges over false
// precision" principle and CLAUDE.md's coaching-safety rules (the founder
// has reported prediabetes/possible insulin resistance; nothing here
// should read as a clinical macro prescription). This is plain-language
// reasoning a founder who doesn't know what "macros" means can actually
// use, not a nutrition-science model.

export type TrainingCategory =
  | "calistenia"
  | "cardio_leve"
  | "cardio_pesado"
  | "hipertrofia"
  | "artes_marciais_strike"
  | "wrestling_grappling"
  | "mobilidade"
  | "parkour";

export const TRAINING_CATEGORIES: TrainingCategory[] = [
  "calistenia",
  "cardio_leve",
  "cardio_pesado",
  "hipertrofia",
  "artes_marciais_strike",
  "wrestling_grappling",
  "mobilidade",
  "parkour",
];

export const TRAINING_CATEGORY_LABEL: Record<TrainingCategory, string> = {
  calistenia: "Calistenia",
  cardio_leve: "Cardio leve",
  cardio_pesado: "Cardio pesado",
  hipertrofia: "Hipertrofia",
  artes_marciais_strike: "Artes marciais (strike)",
  wrestling_grappling: "Wrestling & Grappling",
  mobilidade: "Mobilidade",
  parkour: "Parkour",
};

/** Named styles a founder would actually recognise under each category -
 * purely descriptive (shown in the UI so "Artes marciais (strike)" reads
 * as more than a label), not a separate selectable entity. The concrete,
 * plannable session library lives in `workout_sessions`
 * (supabase/migrations/202608050001_training_toolkit.sql) and
 * lib/training/planner.ts picks from it by category. */
export const TRAINING_CATEGORY_EXAMPLES: Record<TrainingCategory, string[]> = {
  calistenia: ["Calistenia (peso do corpo)"],
  cardio_leve: ["Caminhada", "Jogging / corrida leve", "Natação contínua"],
  cardio_pesado: ["HIIT", "Corrida de sprints", "Máquina de bike (spin)", "Remo"],
  hipertrofia: ["Musculação"],
  artes_marciais_strike: ["Muay Thai", "Kickboxing", "Boxe"],
  wrestling_grappling: ["Jiu-jitsu", "Judo", "Wrestling", "Sambo"],
  mobilidade: ["Yoga", "Pilates"],
  parkour: ["Parkour"],
};

/** One plain-language paragraph per category, written for someone who
 * knows what to avoid eating but not what "macros" are or why they'd
 * matter on a given day. Categories are mutually exclusive now (no more
 * primary/secondary blending) - striking and grappling in particular are
 * deliberately separate entries because their physical demands differ. */
export const TRAINING_CATEGORY_MACRO_GUIDANCE: Record<TrainingCategory, string> = {
  calistenia:
    "Treino de calistenia trabalha força, controlo e mobilidade com o peso do corpo. Uma alimentação equilibrada entre proteína e hidratos costuma chegar — não há necessidade de exagerar em nenhum dos dois.",
  cardio_leve:
    "Cardio leve (caminhada, jogging tranquilo) gasta energia de forma constante mas moderada. Não pede grandes ajustes — uma refeição equilibrada normal costuma chegar, e é uma boa opção nos dias em que precisas de algo mais suave.",
  cardio_pesado:
    "Cardio pesado (HIIT, sprints, bike ou remo intervalado) exige muita energia disponível rapidamente. Faz sentido garantir hidratos de carbono suficientes antes da sessão para teres combustível, com proteína depois para ajudar na recuperação.",
  hipertrofia:
    "Treino de hipertrofia cria pequenas lesões musculares que o corpo repara e fortalece a seguir. Precisas de mais proteína do que o habitual para essa reparação, com hidratos suficientes para teres energia durante o treino.",
  artes_marciais_strike:
    "Artes marciais de strike (Muay Thai, kickboxing, boxe) combinam esforço explosivo com bastante exigência cardiovascular. Garante hidratos suficientes para energia e proteína depois para recuperar dos impactos repetidos.",
  wrestling_grappling:
    "Wrestling e grappling (jiu-jitsu, judo, wrestling, sambo) exigem força de pega, resistência muscular prolongada e muito controlo corporal. Precisas de proteína para a recuperação muscular e de hidratos suficientes para aguentares o esforço contínuo.",
  mobilidade:
    "Treino de mobilidade (yoga, pilates) não pede ajustes especiais de macros. O mais importante é uma refeição leve e fácil de digerir antes da sessão, sem exageros.",
  parkour:
    "Parkour combina força explosiva, controlo corporal e impacto nas articulações. Uma alimentação equilibrada entre proteína (para a recuperação) e hidratos (para a energia explosiva) costuma ser suficiente.",
};

export function isTrainingCategory(value: string): value is TrainingCategory {
  return (TRAINING_CATEGORIES as string[]).includes(value);
}

/** Plain-language macro guidance for a category id - returns null for an
 * unknown id rather than guessing, same defensive pattern as the old
 * getWorkoutType/describeWorkoutMacroGuidance this replaces. */
export function describeTrainingCategoryGuidance(categoryId: string): string | null {
  if (!isTrainingCategory(categoryId)) return null;
  return TRAINING_CATEGORY_MACRO_GUIDANCE[categoryId];
}
