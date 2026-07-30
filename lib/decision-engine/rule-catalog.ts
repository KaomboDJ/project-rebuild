// Milestone 14 — human-readable labels for each rule.ts ruleId, used by
// /settings/memory (patterns.ts's describeRuleInsight, the mute toggle) so
// the founder sees "Treino ao almoço", not a camelCase/kebab-case internal
// id. Deliberately kept as a small, separate, pure/no-import module (not
// re-exported from rules.ts) so rules.ts stays free of any UI-facing
// concern — mirrors the baseTitle already defined per-rule there, so this
// list must stay in sync if a rule's baseTitle changes or a rule is added.
export const RULE_LABELS: Record<string, string> = {
  "lunch-training": "Treino ao almoço",
  "reduced-training": "Treino reduzido",
  "mobility-instead-of-cancellation": "Mobilidade em vez de cancelar",
  "prepare-training-equipment": "Prepara o treino de hoje",
  "decide-dinner-early": "Decide o jantar",
  "defrost-ingredients": "Prepara o jantar de hoje",
  "prepare-tomorrows-lunch": "Prepara o amanhã",
  "avoid-takeaway-commitment": "Evita o Uber Eats",
  "shutdown-routine": "Rotina de fecho",
  "earlier-sleep-for-tomorrow": "Protege o sono de hoje",
  "prepare-next-day": "Amanhã começa cedo",
  "short-walk": "Caminhada curta",
  "protect-free-window": "Protege a tua janela livre",
  "move-low-priority-work": "Liberta uma janela",
};

export function ruleLabel(ruleId: string): string {
  return RULE_LABELS[ruleId] ?? ruleId;
}

/** Every known ruleId, in the same order as rules.ts's ALL_RULES — used to
 * show mutable/insight rows for rules with zero history too, not only ones
 * that already appear in decisions/muted_rules. */
export const ALL_RULE_IDS = Object.keys(RULE_LABELS);
