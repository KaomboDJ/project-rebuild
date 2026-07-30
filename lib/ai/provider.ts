import Anthropic from "@anthropic-ai/sdk";

// CoachContext used to mirror lib/decisions/types.ts (the pre-Milestone-2
// localStorage-era shape: OnboardingProfile/CheckIn/OperatingState/
// DecisionInstance). That shape predates the current Supabase schema
// (profiles/daily_check_ins/decisions) and nothing else in the app still
// uses it - updated here to the current data model as part of wiring the
// Coach into the Calendar Workspace's drawer (see components/CoachDrawer.tsx).
export interface CoachContext {
  /** profiles.desired_identity - who the founder is rebuilding into. */
  identity: string;
  /** profiles.current_constraints. */
  constraints: string;
  /** Today's daily_check_ins row, if the founder has checked in yet. */
  checkIn: { sleepQuality: number; energyLevel: number; stressLevel: number } | null;
  /** Today's decisions (title + current status), most-recent engine run. */
  decisions: { title: string; status: string }[];
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
The user has reported prediabetes/possible insulin resistance, interrupted sleep, and a kidney-stone history - respect these constraints and defer to clinicians for medical judgment calls.
Respond in Portuguese from Portugal, direct and concise.
`.trim();

function buildSystemPrompt(context: CoachContext): string {
  const { identity, constraints, checkIn, decisions } = context;
  const lines = [
    SAFETY_RULES,
    `Identidade que o utilizador está a reconstruir: ${identity || "não definida"}.`,
    `Restrições atuais: ${constraints || "nenhuma indicada"}.`,
  ];
  lines.push(
    checkIn
      ? `Check-in de hoje: sono ${checkIn.sleepQuality}/5, energia ${checkIn.energyLevel}/5, stress ${checkIn.stressLevel}/5.`
      : "Ainda sem check-in hoje."
  );
  lines.push(
    decisions.length > 0
      ? `Decisões de hoje: ${decisions.map((d) => `${d.title} (${d.status})`).join("; ")}.`
      : "Ainda sem decisões geradas hoje."
  );
  return lines.join("\n");
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
    const [first] = context.decisions;
    return first
      ? `Agora: ${first.title} (${first.status}). [Resposta simulada — configura ANTHROPIC_API_KEY para respostas reais.]`
      : "Ainda sem decisões definidas para hoje.";
  }
}

export function getCoachProvider(): CoachProvider {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return new MockCoachProvider();
  const model = process.env.ANTHROPIC_MODEL ?? "claude-sonnet-5";
  return new AnthropicCoachProvider(apiKey, model);
}
