import Anthropic from "@anthropic-ai/sdk";
import type { CheckIn, DecisionInstance, OnboardingProfile, OperatingState } from "@/lib/decisions/types";

export interface CoachContext {
  profile: OnboardingProfile;
  checkIn: CheckIn;
  state: OperatingState;
  instances: DecisionInstance[];
}

export interface CoachProvider {
  respond(context: CoachContext, message: string): Promise<string>;
}

// Mirrors CLAUDE.md "Coaching safety": no diagnosis, no promised reversal of
// prediabetes/insulin resistance, no medication/supplement prescriptions, no
// unsafe fasting, dehydration, punishment, or compensatory exercise.
const SAFETY_RULES = `
You are the Decision Coach for Project Rebuild, a Decision Operating System (not a fitness or diet app).
Recommend one clear next action, briefly. Lead with the action, then the trigger/timing, then a reduced fallback if useful.
Reinforce the identity "Sou um atleta em reconstrução." Never shame or moralize.
Never diagnose, promise reversal of prediabetes/insulin resistance, prescribe medication or supplements, or recommend unsafe fasting, dehydration, punishment, or compensatory exercise.
The user has reported prediabetes/possible insulin resistance, interrupted sleep, and a kidney-stone history — respect these constraints and defer to clinicians for medical judgment calls.
Respond in Portuguese from Portugal, direct and concise.
`.trim();

function buildSystemPrompt(context: CoachContext): string {
  const { profile, checkIn, state, instances } = context;
  return [
    SAFETY_RULES,
    `Estado operacional atual: ${state}.`,
    `Tipo de dia: ${checkIn.dayType}.`,
    `Check-in: sono ${checkIn.sleepHours}h, energia ${checkIn.energy}/5, stress ${checkIn.stress}/5.`,
    `Identidade do utilizador: ${profile.wantToBecome}.`,
    `Restrições: ${profile.constraints}.`,
    `Decisões de hoje: ${instances.map((d) => `${d.title} (${d.status})`).join("; ")}.`,
  ].join("\n");
}

class AnthropicCoachProvider implements CoachProvider {
  private client: Anthropic;
  private model: string;

  constructor(apiKey: string, model: string) {
    this.client = new Anthropic({ apiKey });
    this.model = model;
  }

  async respond(context: CoachContext, message: string): Promise<string> {
    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: 400,
      system: buildSystemPrompt(context),
      messages: [{ role: "user", content: message }],
    });
    const block = response.content.find((b) => b.type === "text");
    return block && block.type === "text" ? block.text : "";
  }
}

class MockCoachProvider implements CoachProvider {
  async respond(context: CoachContext): Promise<string> {
    const [first] = context.instances;
    return first
      ? `Agora: ${first.title} (${first.trigger}). [Resposta simulada — configura ANTHROPIC_API_KEY para respostas reais.]`
      : "Sem decisões definidas para hoje ainda.";
  }
}

export function getCoachProvider(): CoachProvider {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return new MockCoachProvider();
  const model = process.env.ANTHROPIC_MODEL ?? "claude-sonnet-5";
  return new AnthropicCoachProvider(apiKey, model);
}
