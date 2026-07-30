import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { executeMutatingTool } from "@/lib/coach/tools";
import { MUTATING_TOOLS, type ToolCall, type ToolName } from "@/lib/coach/types";
import { getMessageById, updateMessageToolCalls } from "@/lib/coach/conversations";

const bodySchema = z.object({
  messageId: z.string().uuid(),
  toolCallId: z.string().min(1),
  decision: z.enum(["confirm", "decline"]),
});

/**
 * The only place a pantry/shopping mutation the Coach proposed can actually
 * execute (Part 3: "The model must never execute inventory mutations
 * silently" / "every natural-language-initiated mutation must go through
 * interpret -> propose -> show in UI -> explicit user confirmation ->
 * authenticated server-side mutation"). The assistant turn in
 * app/api/coach/route.ts only ever writes a 'proposed' tool call into
 * coach_messages.tool_calls; this route is the sole path from 'proposed' to
 * 'executed'.
 */
export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return NextResponse.json({ error: "supabase-not-configured" }, { status: 503 });
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid-body" }, { status: 400 });
  }
  const { messageId, toolCallId, decision } = parsed.data;

  const message = await getMessageById(supabase, user.id, messageId);
  if (!message) {
    return NextResponse.json({ error: "message-not-found" }, { status: 404 });
  }

  const toolCalls = (Array.isArray(message.tool_calls) ? message.tool_calls : []) as unknown as ToolCall[];
  const index = toolCalls.findIndex((call) => call.id === toolCallId);
  if (index === -1) {
    return NextResponse.json({ error: "tool-call-not-found" }, { status: 404 });
  }

  const toolCall = toolCalls[index];
  if (toolCall.status !== "proposed") {
    return NextResponse.json({ error: "tool-call-already-resolved", toolCall }, { status: 409 });
  }
  if (!MUTATING_TOOLS.has(toolCall.name)) {
    return NextResponse.json({ error: "tool-call-not-mutating" }, { status: 400 });
  }

  let updated: ToolCall;
  if (decision === "decline") {
    updated = { ...toolCall, status: "declined" };
  } else {
    try {
      const result = await executeMutatingTool(supabase, user.id, toolCall.name as ToolName, toolCall.args);
      updated = { ...toolCall, status: "executed", result };
    } catch (error) {
      updated = { ...toolCall, status: "failed", error: error instanceof Error ? error.message : "Falha ao executar." };
    }
  }

  const nextToolCalls = [...toolCalls];
  nextToolCalls[index] = updated;

  const updatedMessage = await updateMessageToolCalls(supabase, user.id, messageId, nextToolCalls);
  return NextResponse.json({ toolCall: updated, message: updatedMessage });
}
