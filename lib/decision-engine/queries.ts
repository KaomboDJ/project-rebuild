import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { buildRuleAdjustments, computeRuleInsights, type RuleInsight } from "./patterns";

type Supabase = SupabaseClient<Database>;
export type FounderNote = Database["public"]["Tables"]["founder_notes"]["Row"];

const DEFAULT_HISTORY_DAYS = 90;

function daysAgoDateKey(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

/**
 * Loads this founder's own decision/feedback history and turns it into
 * per-rule insights (lib/decision-engine/patterns.ts). Bounded to the last
 * `historyDays` (default 90) so a long-lived founder's pattern data stays a
 * reasonably-sized, still-representative window rather than growing
 * unbounded — matches the same "recent, not all-time" scope
 * lib/decision-engine/scorer.ts's domain-level adherenceOf already uses via
 * DailyContext.recentDecisions.
 */
export async function getRuleInsights(supabase: Supabase, userId: string, historyDays = DEFAULT_HISTORY_DAYS): Promise<RuleInsight[]> {
  const since = daysAgoDateKey(historyDays);

  const [{ data: decisionRows }, { data: feedbackRows }] = await Promise.all([
    supabase.from("decisions").select("id, rule_id, status").eq("user_id", userId).gte("date", since),
    supabase
      .from("decision_feedback")
      .select("decision_id, useful")
      .eq("user_id", userId),
  ]);

  const ruleIdByDecisionId = new Map((decisionRows ?? []).map((row) => [row.id, row.rule_id]));

  const decisions = (decisionRows ?? []).map((row) => ({ ruleId: row.rule_id, status: row.status }));
  const feedback = (feedbackRows ?? []).map((row) => ({
    ruleId: ruleIdByDecisionId.get(row.decision_id) ?? null,
    useful: row.useful,
  }));

  return computeRuleInsights(decisions, feedback);
}

/** The bounded score-adjustment map scorer.ts consumes — see
 * lib/decision-engine/patterns.ts's header for the "no opaque scoring"
 * guarantee this is built to satisfy. */
export async function getRuleAdjustments(supabase: Supabase, userId: string): Promise<Record<string, number>> {
  const insights = await getRuleInsights(supabase, userId);
  return buildRuleAdjustments(insights);
}

export async function listMutedRuleIds(supabase: Supabase, userId: string): Promise<string[]> {
  const { data } = await supabase.from("muted_rules").select("rule_id").eq("user_id", userId);
  return (data ?? []).map((row) => row.rule_id);
}

export async function muteRule(supabase: Supabase, userId: string, ruleId: string): Promise<void> {
  const { error } = await supabase.from("muted_rules").upsert({ user_id: userId, rule_id: ruleId }, { onConflict: "user_id,rule_id" });
  if (error) throw new Error(error.message);
}

export async function unmuteRule(supabase: Supabase, userId: string, ruleId: string): Promise<void> {
  const { error } = await supabase.from("muted_rules").delete().eq("user_id", userId).eq("rule_id", ruleId);
  if (error) throw new Error(error.message);
}

export async function listFounderNotes(supabase: Supabase, userId: string): Promise<FounderNote[]> {
  const { data, error } = await supabase
    .from("founder_notes")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
}

/** General notes only (rule_id null) — what lib/ai/provider.ts's Coach
 * system prompt includes, since a note scoped to a specific rule is about
 * the Decision Engine's ranking, not something the Coach chat needs to know
 * unprompted. */
export async function listGeneralFounderNotes(supabase: Supabase, userId: string): Promise<string[]> {
  const { data } = await supabase
    .from("founder_notes")
    .select("content")
    .eq("user_id", userId)
    .is("rule_id", null)
    .order("created_at", { ascending: false })
    .limit(10);
  return (data ?? []).map((row) => row.content);
}

export async function createFounderNote(
  supabase: Supabase,
  userId: string,
  input: { content: string; ruleId?: string | null }
): Promise<FounderNote> {
  const { data, error } = await supabase
    .from("founder_notes")
    .insert({ user_id: userId, content: input.content, rule_id: input.ruleId ?? null })
    .select("*")
    .single();
  if (error || !data) throw new Error(error?.message ?? "Falha ao guardar a nota.");
  return data;
}

export async function updateFounderNote(supabase: Supabase, userId: string, id: string, content: string): Promise<FounderNote> {
  const { data, error } = await supabase
    .from("founder_notes")
    .update({ content })
    .eq("id", id)
    .eq("user_id", userId)
    .select("*")
    .single();
  if (error || !data) throw new Error(error?.message ?? "Falha ao atualizar a nota.");
  return data;
}

export async function deleteFounderNote(supabase: Supabase, userId: string, id: string): Promise<void> {
  const { error } = await supabase.from("founder_notes").delete().eq("id", id).eq("user_id", userId);
  if (error) throw new Error(error.message);
}
