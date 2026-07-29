import "server-only";

// docs/06_DECISION_ENGINE.md + docs/08_AI_ARCHITECTURE.md
//
// Orchestrates context -> rules -> scorer -> selector -> AI refinement.
// The deterministic path (rule candidates, exactly 3, source: "rule") is
// always computed first and is what ships if there's no AI provider, if it
// times out, throws, or returns output that fails validation.ts. The AI
// provider is never a single point of failure.

import Anthropic from "@anthropic-ai/sdk";
import { generateCandidates } from "./rules";
import { scoreCandidates } from "./scorer";
import { selectThree } from "./selector";
import { buildRefinementPrompt, PROMPT_VERSION } from "./prompts";
import { validateGeneratedDecisions } from "./validation";
import type { DailyContext, GeneratedDecision, ScoredCandidate } from "./types";

export interface AIProvider {
  refineDecisions(context: DailyContext, candidates: GeneratedDecision[]): Promise<GeneratedDecision[]>;
}

function toGeneratedDecision(candidate: ScoredCandidate): GeneratedDecision {
  return {
    domain: candidate.domain,
    title: candidate.baseTitle,
    reason: candidate.baseReason,
    recommendedAction: candidate.recommendedAction,
    recommendedStart: candidate.recommendedStart,
    recommendedEnd: candidate.recommendedEnd,
    impact: candidate.baseImpact,
    confidence: candidate.confidence,
    source: "rule",
  };
}

/** Selects exactly three (or fewer, if genuinely unavailable) rule-sourced decisions. Never touches the network. */
export function generateRuleDecisions(context: DailyContext): GeneratedDecision[] {
  const candidates = generateCandidates(context);
  const scored = scoreCandidates(candidates, context);
  const selected = selectThree(scored, context);
  return selected.map(toGeneratedDecision);
}

class AnthropicDecisionAIProvider implements AIProvider {
  private client: Anthropic;
  private model: string;

  constructor(apiKey: string, model: string) {
    this.client = new Anthropic({ apiKey });
    this.model = model;
  }

  async refineDecisions(context: DailyContext, candidates: GeneratedDecision[]): Promise<GeneratedDecision[]> {
    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: 800,
      messages: [{ role: "user", content: buildRefinementPrompt(context, candidates) }],
    });
    const block = response.content.find((b) => b.type === "text");
    const text = block && block.type === "text" ? block.text : "[]";
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    return JSON.parse(jsonMatch ? jsonMatch[0] : text);
  }
}

export function getDecisionAIProvider(): AIProvider | null {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;
  const model = process.env.ANTHROPIC_MODEL ?? "claude-sonnet-5";
  return new AnthropicDecisionAIProvider(apiKey, model);
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error("AI refinement timed out")), ms)),
  ]);
}

export interface GenerateDecisionsResult {
  decisions: GeneratedDecision[];
  engineVersion: string;
}

/**
 * Full pipeline: deterministic candidates -> scored -> selected three ->
 * optional AI refinement. `aiProvider` defaults to `getDecisionAIProvider()`
 * but can be overridden (e.g. a mock) for testing.
 */
export async function generateDecisions(
  context: DailyContext,
  aiProvider: AIProvider | null = getDecisionAIProvider(),
  timeoutMs = 8000
): Promise<GenerateDecisionsResult> {
  const ruleDecisions = generateRuleDecisions(context);

  if (!aiProvider || ruleDecisions.length === 0) {
    return { decisions: ruleDecisions, engineVersion: "rules-v1" };
  }

  try {
    const raw = await withTimeout(aiProvider.refineDecisions(context, ruleDecisions), timeoutMs);
    const validated = validateGeneratedDecisions(raw, ruleDecisions);
    if (!validated) {
      return { decisions: ruleDecisions, engineVersion: "rules-v1" };
    }
    return { decisions: validated, engineVersion: `rules-v1+${PROMPT_VERSION}` };
  } catch {
    return { decisions: ruleDecisions, engineVersion: "rules-v1" };
  }
}
