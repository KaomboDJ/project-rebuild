// Workout-type catalog (founder request, 2026-08-03): "a essência destes
// treinos ou é mais cardio, ou é mais calistenia, ou é mais hipertrofia, ou
// pode ser mais mental e relaxing" — a fixed, named list of common training
// styles, each tagged with the training-style category (or two, for hybrid
// styles) that actually drives how a day's nutrition should be reasoned
// about. Deliberately qualitative, not a numeric macro multiplier applied
// automatically to real targets — see lib/nutrition/macros.ts's own "never
// present as medical advice, prefer useful ranges over false precision"
// principle and CLAUDE.md's coaching-safety rules (the founder has
// reported prediabetes/possible insulin resistance; nothing here should
// read as a clinical macro prescription). This is plain-language reasoning
// a founder who doesn't know what "macros" means can actually use, not a
// nutrition-science model.

export type TrainingCategory = "cardio" | "forca_hipertrofia" | "calistenia" | "mental_relaxamento";

export interface WorkoutType {
  id: string;
  label: string;
  primaryCategory: TrainingCategory;
  /** Some styles genuinely span two categories (jiu-jitsu is both grappling
   * endurance and strength) - secondary is optional and only set when the
   * style is a real hybrid, not a stretch. */
  secondaryCategory?: TrainingCategory;
}

export const TRAINING_CATEGORY_LABEL: Record<TrainingCategory, string> = {
  cardio: "Cardio",
  forca_hipertrofia: "Força / hipertrofia",
  calistenia: "Calistenia",
  mental_relaxamento: "Mental / relaxamento",
};

/** One plain-language paragraph per category, written for someone who
 * knows what to avoid eating but not what "macros" are or why they'd
 * matter on a given day. */
export const TRAINING_CATEGORY_MACRO_GUIDANCE: Record<TrainingCategory, string> = {
  cardio:
    "Treino de cardio gasta bastante energia em movimento contínuo. Faz sentido garantir hidratos de carbono suficientes para teres combustível disponível, com proteína moderada para recuperar depois.",
  forca_hipertrofia:
    "Treino de força/hipertrofia cria pequenas lesões musculares que o corpo repara e fortalece a seguir. Precisas de mais proteína do que o habitual para essa reparação, com hidratos suficientes para teres energia durante o treino.",
  calistenia:
    "Treino de calistenia trabalha força, controlo e mobilidade com o peso do corpo. Uma alimentação equilibrada entre proteína e hidratos costuma chegar — não há necessidade de exagerar em nenhum dos dois.",
  mental_relaxamento:
    "Treino mais mental e de relaxamento (respiração, mobilidade, recuperação) não pede ajustes especiais de macros. O mais importante é uma refeição leve e fácil de digerir, sem exageros antes da sessão.",
};

export const WORKOUT_TYPES: WorkoutType[] = [
  { id: "natacao", label: "Natação", primaryCategory: "cardio" },
  { id: "musculacao", label: "Musculação", primaryCategory: "forca_hipertrofia" },
  { id: "jiu_jitsu", label: "Jiu-jitsu", primaryCategory: "forca_hipertrofia", secondaryCategory: "cardio" },
  { id: "yoga", label: "Yoga", primaryCategory: "mental_relaxamento" },
  { id: "insanity", label: "Insanity", primaryCategory: "cardio" },
  { id: "p90x", label: "P90X", primaryCategory: "forca_hipertrofia", secondaryCategory: "cardio" },
  { id: "mma", label: "MMA", primaryCategory: "forca_hipertrofia", secondaryCategory: "cardio" },
  { id: "parkour", label: "Parkour", primaryCategory: "calistenia", secondaryCategory: "cardio" },
  { id: "corrida", label: "Corrida", primaryCategory: "cardio" },
  { id: "ciclismo", label: "Ciclismo", primaryCategory: "cardio" },
  { id: "crossfit", label: "CrossFit", primaryCategory: "forca_hipertrofia", secondaryCategory: "cardio" },
  { id: "pilates", label: "Pilates", primaryCategory: "calistenia", secondaryCategory: "mental_relaxamento" },
  { id: "caminhada", label: "Caminhada", primaryCategory: "mental_relaxamento", secondaryCategory: "cardio" },
  { id: "calistenia_livre", label: "Calistenia (peso do corpo)", primaryCategory: "calistenia" },
  { id: "boxe", label: "Boxe", primaryCategory: "cardio", secondaryCategory: "forca_hipertrofia" },
  { id: "danca", label: "Dança", primaryCategory: "cardio", secondaryCategory: "mental_relaxamento" },
];

export function getWorkoutType(id: string): WorkoutType | undefined {
  return WORKOUT_TYPES.find((w) => w.id === id);
}

/** Combines the primary category's guidance with the secondary's (if any
 * and if genuinely different), so a hybrid style like Jiu-jitsu explains
 * both the strength and the cardio side instead of picking just one. */
export function describeWorkoutMacroGuidance(workoutTypeId: string): string | null {
  const workout = getWorkoutType(workoutTypeId);
  if (!workout) return null;

  const primary = TRAINING_CATEGORY_MACRO_GUIDANCE[workout.primaryCategory];
  if (!workout.secondaryCategory || workout.secondaryCategory === workout.primaryCategory) return primary;

  const secondary = TRAINING_CATEGORY_MACRO_GUIDANCE[workout.secondaryCategory];
  return `${primary} Como também tem um lado de ${TRAINING_CATEGORY_LABEL[workout.secondaryCategory].toLowerCase()}: ${secondary.charAt(0).toLowerCase()}${secondary.slice(1)}`;
}
