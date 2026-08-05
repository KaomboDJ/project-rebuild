import Anthropic from "@anthropic-ai/sdk";
import { TOOL_DEFINITIONS, buildToolCallProposal } from "@/lib/coach/tools";
import { READ_ONLY_TOOLS, type ToolCall, type ToolName } from "@/lib/coach/types";
import type { PantrySummaryItem } from "@/lib/coach/pantry-context";
import type { DayTypeInference } from "@/lib/coach/day-type";
import type { SleepPhase, SleepScheduleType } from "@/lib/sleep/schedule";

// CoachContext used to mirror lib/decisions/types.ts (the pre-Milestone-2
// localStorage-era shape: OnboardingProfile/CheckIn/OperatingState/
// DecisionInstance). That shape predates the current Supabase schema
// (profiles/daily_check_ins/decisions) and nothing else in the app still
// uses it - updated here to the current data model as part of wiring the
// Coach into the Calendar Workspace's drawer (see components/CoachDrawer.tsx).
//
// Extended for the Coach UX + Pantry Intelligence milestone (Part 3/4)
// with `pantry` and `dayType` - both optional so anything still
// constructing the pre-milestone shape keeps compiling.
export interface CoachContext {
  /** profiles.desired_identity - who the founder is rebuilding into. */
  identity: string;
  /** profiles.current_constraints. */
  constraints: string;
  /** Today's daily_check_ins row, if the founder has checked in yet. */
  checkIn: { sleepQuality: number; energyLevel: number; stressLevel: number } | null;
  /** Today's decisions (title + current status), most-recent engine run. */
  decisions: { title: string; status: string; timingType?: string; timeLabel?: string | null }[];
  /** Current pantry snapshot (Part 3) - omitted/empty for founders who
   * haven't used the pantry feature, which keeps the prompt unchanged for
   * them. */
  pantry?: PantrySummaryItem[];
  /** Home/office inference for today (Part 4) - null value means "ask the
   * founder directly", not "assume home". */
  dayType?: DayTypeInference;
  /** Milestone 14 — general founder_notes (rule_id null), most recent
   * first, capped at 10 by lib/decision-engine/queries.ts's
   * listGeneralFounderNotes. Free text the founder wrote themselves at
   * /settings/memory; the Coach should treat it as a standing preference,
   * not as new information to react to or comment on unprompted. */
  founderNotes?: string[];
  sleepSchedule?: {
    currentTime: string;
    sleepTime: string;
    wakeTime: string;
    windDownMinutes: number;
    scheduleType: SleepScheduleType;
    phase: SleepPhase;
  };
}

export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

/** Executes read-only tools (get_inventory, suggest_available_meal)
 * immediately, bound to the calling founder's Supabase session. Provided by
 * the route handler so this module never imports Supabase directly - the
 * provider stays a swappable AI adapter, not a data-access layer. */
export interface CoachToolRuntime {
  executeReadOnly(name: ToolName, args: Record<string, unknown>): Promise<unknown>;
}

export interface CoachReply {
  text: string;
  /** Mutating tool calls the model proposed this turn, awaiting explicit
   * user confirmation via app/api/coach/tools/confirm/route.ts. Read-only
   * tool calls are never surfaced here - they're already resolved into the
   * text reply by the time respond() returns. */
  toolCalls: ToolCall[];
}

export interface CoachProvider {
  respond(context: CoachContext, message: string, history: ChatTurn[], tools?: CoachToolRuntime): Promise<CoachReply>;
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
Founder instruction (2026-08-05): nothing you say has been reviewed or confirmed by a doctor, nutritionist, or other health professional - frame every answer as a suggestion or starting point, never as a settled fact or a validated conclusion. When a question carries real health weight (the founder's reported conditions, anything that would change with a real diagnosis, anything where being wrong could cause harm), say plainly that you cannot confirm it and recommend checking with a doctor or nutritionist before acting - do not soften this into vague hedging language and then answer as if it were confirmed anyway.
The configured sleep window is a hard safety boundary. During sleep or wind-down, never suggest a walk, workout, meal preparation, work task, or any stimulating activity. The next action must protect sleep. Do not impose 23:00 on shift workers; use the configured schedule.
Respond in Portuguese from Portugal, direct and concise. You may use light Markdown (short paragraphs, bullet lists, bold for the single key action) - it will be rendered, not shown as raw text.
You have tools to read and change the founder's pantry and shopping list. Use get_inventory or suggest_available_meal freely to ground suggestions in what actually exists at home - never invent pantry contents.
You also have tools for the Nutrition Toolkit's weekly meal plan (Milestone 12): get_week_plan reads the current 7-day plan with estimated macros (use it before answering "what's for dinner" or "what's the plan this week" instead of guessing); generate_week_plan, replace_meal, and mark_meal_eaten are proposals like the pantry tools below. Never invent recipes, macros, or ingredients that aren't in get_week_plan's result - the plan is generated by deterministic rules, not by you, and macro figures are estimates, never medical fact.
You also have tools for the Training Toolkit's weekly training plan: get_week_training_plan reads the current 7-day plan (session, category, duration, location, structure, status) - use it before answering "what am I training today" or "what's this week's training plan" instead of guessing; generate_week_training_plan, replace_session, and mark_session_done are proposals like the ones below. Never invent sessions, structures, or safety notes that aren't in get_week_training_plan's result - the plan is generated by deterministic rules from the curated session library, not by you.
Founder request (2026-08-05): whenever you help generate or discuss one of the weekly plans (training, meal plan, shopping list), proactively ask the founder with a short closed yes/no question whether they also want the other related plans generated, instead of waiting to be asked - for example, after generating a training plan ask "Queres também que gere o plano alimentar desta semana?", and after generating a meal plan ask "Queres também que eu gere a lista de compras?". Only propose the corresponding tool after the founder answers yes; never generate something they didn't ask for or confirm.
Friction-reduction request (2026-08-05, real user feedback: "Preciso que a app trabalhe para mim e não eu para a app"): onboarding no longer forces the founder to fill in their current identity, life constraints, or preferred communication tone up front - those fields may be empty. If the founder mentions any of this naturally in conversation (e.g. describing their routine, what's limiting them, or reacting to your tone), use update_profile_notes to offer saving it to their profile so they never have to repeat it - propose this at most once per conversation, and only with fields the founder actually said, never invented or inferred ones. Never interrogate the founder about these fields out of nowhere; only pick them up when volunteered.
Mutating tools (consume_item, adjust_inventory, add_to_shopping_list, mark_item_purchased, record_meal, generate_week_plan, replace_meal, mark_meal_eaten, generate_week_training_plan, replace_session, mark_session_done, update_profile_notes) only ever create a proposal the founder must confirm in the UI - never claim an action is done until it has actually been confirmed and executed; describe it as a suggestion ("queres que eu registe...?").
`.trim();

function buildSystemPrompt(context: CoachContext): string {
  const { identity, constraints, checkIn, decisions, pantry, dayType, founderNotes, sleepSchedule } = context;
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

  if (sleepSchedule) {
    lines.push(
      `Hora local ${sleepSchedule.currentTime}; sono ${sleepSchedule.sleepTime}–${sleepSchedule.wakeTime}; desaceleração ${sleepSchedule.windDownMinutes} min; tipo ${sleepSchedule.scheduleType}; estado atual ${sleepSchedule.phase}.`
    );
  }
  lines.push(
    decisions.length > 0
      ? `Decisões de hoje: ${decisions.map((d) => `${d.title}${d.timeLabel ? ` [${d.timeLabel}]` : ""} (${d.status})`).join("; ")}. Estes horários foram definidos pelo motor determinístico. Não proponhas outro horário para a mesma decisão; orienta o utilizador para Alterar horário.`
      : "Ainda sem decisões geradas hoje."
  );

  if (dayType) {
    if (dayType.dayType) {
      lines.push(`Tipo de dia (${dayType.source}): ${dayType.dayType === "home" ? "em casa" : "fora de casa / escritório"}.`);
    } else if (dayType.shouldAsk) {
      lines.push(
        "Não sabemos se hoje é dia em casa ou fora - se for relevante para a pergunta (ex.: sugestão de refeição), pergunta diretamente antes de assumir."
      );
    }
  }

  if (pantry && pantry.length > 0) {
    const summary = pantry
      .slice(0, 25)
      .map((item) => `${item.name} (${item.quantity}${item.unit}${item.portable ? ", portátil" : ""}${item.expiresOn ? `, expira ${item.expiresOn}` : ""})`)
      .join("; ");
    lines.push(`Despensa atual: ${summary}.`);
  } else if (pantry) {
    lines.push("Despensa vazia ou ainda não configurada.");
  }

  if (founderNotes && founderNotes.length > 0) {
    lines.push(`Notas que o próprio utilizador guardou sobre preferências (respeita-as sempre): ${founderNotes.join(" | ")}.`);
  }

  return lines.join("\n");
}

const MAX_TOOL_ROUNDS = 4;

class AnthropicCoachProvider implements CoachProvider {
  private client: Anthropic;
  private model: string;

  constructor(apiKey: string, model: string) {
    this.client = new Anthropic({ apiKey });
    this.model = model;
  }

  async respond(context: CoachContext, message: string, history: ChatTurn[], tools?: CoachToolRuntime): Promise<CoachReply> {
    const messages: Anthropic.MessageParam[] = [
      ...history.map((turn) => ({ role: turn.role, content: turn.content }) as Anthropic.MessageParam),
      { role: "user", content: message },
    ];

    let finalText = "";
    const proposals: ToolCall[] = [];

    for (let round = 0; round < MAX_TOOL_ROUNDS; round += 1) {
      const response = await this.client.messages.create({
        model: this.model,
        // Was 600 - confirmed via live M10 smoke test (2026-07-30) that this
        // truncates genuine multi-paragraph/bulleted answers mid-sentence
        // even though the safety prompt asks for concise replies; the model
        // still needs headroom for a full bulleted answer plus any tool_use
        // blocks sharing the same budget. 2048 keeps a bound (no runaway
        // cost/latency) while giving real answers room to finish.
        max_tokens: 2048,
        system: buildSystemPrompt(context),
        messages,
        tools: tools ? TOOL_DEFINITIONS : undefined,
      });

      const textBlocks = response.content.filter((b): b is Anthropic.TextBlock => b.type === "text");
      finalText = textBlocks.map((b) => b.text).join("\n").trim() || finalText;

      const toolUseBlocks = response.content.filter((b): b is Anthropic.ToolUseBlock => b.type === "tool_use");
      if (toolUseBlocks.length === 0 || !tools) break;

      const mutatingBlocks = toolUseBlocks.filter((b) => !READ_ONLY_TOOLS.has(b.name as ToolName));
      if (mutatingBlocks.length > 0) {
        // Never execute mutations here - surface them as proposals and stop
        // the loop. Any read-only calls in this same batch are dropped
        // rather than executed, since the model would need to see their
        // results to give a coherent final answer anyway, and the next
        // user turn (after confirm/decline) will re-ground it.
        proposals.push(...mutatingBlocks.map((b) => buildToolCallProposal(b)));
        break;
      }

      // All tool_use blocks this round are read-only: execute each and
      // feed the results back so the model can produce its real answer.
      messages.push({ role: "assistant", content: response.content });
      const toolResults: Anthropic.ToolResultBlockParam[] = [];
      for (const block of toolUseBlocks) {
        try {
          const result = await tools.executeReadOnly(block.name as ToolName, (block.input ?? {}) as Record<string, unknown>);
          toolResults.push({ type: "tool_result", tool_use_id: block.id, content: JSON.stringify(result) });
        } catch (error) {
          toolResults.push({
            type: "tool_result",
            tool_use_id: block.id,
            content: error instanceof Error ? error.message : "Falha ao executar tool.",
            is_error: true,
          });
        }
      }
      messages.push({ role: "user", content: toolResults });
    }

    return { text: finalText, toolCalls: proposals };
  }
}

class MockCoachProvider implements CoachProvider {
  async respond(context: CoachContext): Promise<CoachReply> {
    const [first] = context.decisions;
    const text = first
      ? `Agora: ${first.title} (${first.status}). [Resposta simulada — configura ANTHROPIC_API_KEY para respostas reais.]`
      : "Ainda sem decisões definidas para hoje.";
    return { text, toolCalls: [] };
  }
}

export function getCoachProvider(): CoachProvider {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return new MockCoachProvider();
  const model = process.env.ANTHROPIC_MODEL ?? "claude-sonnet-5";
  return new AnthropicCoachProvider(apiKey, model);
}

export function createToolRuntime(
  executeReadOnly: (name: ToolName, args: Record<string, unknown>) => Promise<unknown>
): CoachToolRuntime {
  return { executeReadOnly };
}
