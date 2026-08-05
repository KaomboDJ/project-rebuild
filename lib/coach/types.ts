// Shared types for the Coach UX + Pantry Intelligence milestone (Part 1 +
// Part 3). Used by both the server (app/api/coach/*, lib/coach/*) and the
// client components (CoachDrawer, /coach page) so the wire shape only has
// one definition.

export type ToolName =
  | "get_inventory"
  | "consume_item"
  | "adjust_inventory"
  | "add_to_shopping_list"
  | "mark_item_purchased"
  | "suggest_available_meal"
  | "record_meal"
  | "get_week_plan"
  | "generate_week_plan"
  | "replace_meal"
  | "mark_meal_eaten"
  | "get_week_training_plan"
  | "generate_week_training_plan"
  | "replace_session"
  | "mark_session_done";

/** Tools the server executes immediately and feeds back to the model in the
 * same turn — they only read data, so there's nothing for the user to
 * confirm. */
export const READ_ONLY_TOOLS: ReadonlySet<ToolName> = new Set([
  "get_inventory",
  "suggest_available_meal",
  "get_week_plan",
  "get_week_training_plan",
]);

/** Tools that change pantry/shopping state. The model may only *propose*
 * these — see lib/coach/tools.ts and app/api/coach/tools/confirm/route.ts.
 * Never executed from the assistant turn itself. */
export const MUTATING_TOOLS: ReadonlySet<ToolName> = new Set([
  "consume_item",
  "adjust_inventory",
  "add_to_shopping_list",
  "mark_item_purchased",
  "record_meal",
  "generate_week_plan",
  "replace_meal",
  "mark_meal_eaten",
  "generate_week_training_plan",
  "replace_session",
  "mark_session_done",
]);

export type ToolCallStatus = "proposed" | "confirmed" | "declined" | "executed" | "failed";

export interface ToolCall {
  id: string;
  name: ToolName;
  args: Record<string, unknown>;
  status: ToolCallStatus;
  /** Human-readable one-line summary shown next to confirm/decline, e.g.
   * "Marcar 2 bananas como consumidas". Generated server-side so the UI
   * never has to interpret raw tool args. */
  summary: string;
  result?: unknown;
  error?: string;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  toolCalls: ToolCall[];
  createdAt: string;
}

export interface ConversationSummary {
  id: string;
  title: string;
  lastMessageAt: string;
  startedAt: string;
}
