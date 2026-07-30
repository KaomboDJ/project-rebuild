import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getRuleInsights, listMutedRuleIds } from "@/lib/decision-engine/queries";
import { ALL_RULE_IDS, ruleLabel } from "@/lib/decision-engine/rule-catalog";
import { describeRuleInsight, MIN_EVIDENCE_COUNT, type RuleInsight } from "@/lib/decision-engine/patterns";

/**
 * Milestone 14 — read model for /settings/memory: every known rule, its
 * computed insight (patterns.ts, recomputed live — nothing persisted, see
 * that module's header), whether it's muted, and a plain-language
 * description. Rules the founder has no history for yet still appear
 * (hasEnoughEvidence: false) so the page can show "sem histórico
 * suficiente" rather than omitting them silently.
 */
export async function GET() {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return NextResponse.json({ error: "supabase-not-configured" }, { status: 503 });

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const [insights, mutedRuleIds] = await Promise.all([
    getRuleInsights(supabase, user.id),
    listMutedRuleIds(supabase, user.id),
  ]);

  const insightByRuleId = new Map(insights.map((insight) => [insight.ruleId, insight]));
  const mutedSet = new Set(mutedRuleIds);

  const rows = ALL_RULE_IDS.map((ruleId) => {
    const insight: RuleInsight =
      insightByRuleId.get(ruleId) ?? {
        ruleId,
        proposedCount: 0,
        completedCount: 0,
        skippedCount: 0,
        usefulCount: 0,
        notUsefulCount: 0,
        hasEnoughEvidence: false,
        completionRate: null,
        usefulnessRate: null,
        personalizationAdjustment: 0,
      };

    return {
      ruleId,
      label: ruleLabel(ruleId),
      muted: mutedSet.has(ruleId),
      insight,
      description: describeRuleInsight(insight, ruleLabel(ruleId)),
    };
  });

  return NextResponse.json({ rows, minEvidenceCount: MIN_EVIDENCE_COUNT });
}
