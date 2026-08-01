// docs/08_AI_ARCHITECTURE.md — schema validation for AI output before it's
// trusted. On any failure, the caller (generator.ts) falls back to the
// rule-generated candidates unchanged. The AI may reorder/reword the three
// decisions it was given; it must not invent a fourth, drop one, or change
// domain/impact/recommendedStart/recommendedEnd (those came from the
// deterministic engine and are not the AI's to invent).

import { z } from "zod";
import type { GeneratedDecision } from "./types";

const generatedDecisionSchema = z.object({
  domain: z.enum(["training", "nutrition", "sleep", "recovery", "planning"]),
  title: z.string().min(1).max(80),
  reason: z.string().min(1).max(280),
  recommendedAction: z.string().min(1).max(280),
  recommendedStart: z.string().optional(),
  recommendedEnd: z.string().optional(),
  impact: z.enum(["low", "medium", "high"]),
  confidence: z.number().min(0).max(1),
  source: z.enum(["rule", "ai", "hybrid"]),
  timingType: z.enum(["calendar_slot", "trigger_based", "flexible"]).optional(),
  triggerLabel: z.string().optional(),
});

const generatedDecisionsSchema = z.array(generatedDecisionSchema).length(3);

/**
 * Validates the AI's JSON output against the expected shape AND against the
 * rule-generated originals: same three domains, same set, no invented
 * scheduling. Returns the validated decisions (source forced to "ai") on
 * success, or `null` on any mismatch — the caller must then fall back to
 * `original` unchanged.
 */
export function validateGeneratedDecisions(
  candidate: unknown,
  original: GeneratedDecision[]
): GeneratedDecision[] | null {
  const parsed = generatedDecisionsSchema.safeParse(candidate);
  if (!parsed.success) return null;

  const originalDomains = [...original.map((d) => d.domain)].sort();
  const candidateDomains = [...parsed.data.map((d) => d.domain)].sort();
  const sameDomains = originalDomains.every((d, i) => d === candidateDomains[i]);
  if (!sameDomains) return null;

  // The AI may reword/reorder/re-rank but must not move the clock times or
  // impact the deterministic engine assigned.
  const byDomain = new Map(original.map((d) => [d.domain, d]));
  for (const decision of parsed.data) {
    const source = byDomain.get(decision.domain);
    if (!source) return null;
    if (decision.impact !== source.impact) return null;
    if ((decision.recommendedStart ?? null) !== (source.recommendedStart ?? null)) return null;
    if ((decision.recommendedEnd ?? null) !== (source.recommendedEnd ?? null)) return null;
    if ((decision.timingType ?? source.timingType) !== source.timingType) return null;
  }

  // relatedPantryItem (Milestone 11D) and ruleId (Milestone 14) aren't part
  // of what the AI is asked to return — both are re-attached here from the
  // deterministic original rather than trusted from the AI payload, same
  // treatment as impact/timing above. ruleId in particular must never come
  // from the AI: it's the join key outcome-logging uses to attribute
  // acceptance/feedback back to a specific rule (lib/decision-engine/patterns.ts) -
  // an AI-invented value here would silently corrupt that history.
  return parsed.data.map((d) => ({
    ...d,
    source: "ai" as const,
    relatedPantryItem: byDomain.get(d.domain)?.relatedPantryItem,
    ruleId: byDomain.get(d.domain)?.ruleId,
    timingType: byDomain.get(d.domain)!.timingType,
    triggerLabel: byDomain.get(d.domain)?.triggerLabel,
  }));
}
