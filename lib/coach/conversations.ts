import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import type { ChatMessage, ConversationSummary, ToolCall } from "./types";

type Supabase = SupabaseClient<Database>;
type MessageRow = Database["public"]["Tables"]["coach_messages"]["Row"];

function toChatMessage(row: MessageRow): ChatMessage {
  return {
    id: row.id,
    role: row.role,
    content: row.content,
    toolCalls: Array.isArray(row.tool_calls) ? (row.tool_calls as unknown as ToolCall[]) : [],
    createdAt: row.created_at,
  };
}

/** First ~60 chars of the founder's opening message, used as the
 * conversation's list-view title until/unless renamed. Exported for
 * conversations.test.ts. */
export function titleFrom(message: string): string {
  const trimmed = message.trim().replace(/\s+/g, " ");
  return trimmed.length > 60 ? `${trimmed.slice(0, 57)}...` : trimmed || "Nova conversa";
}

export async function listConversations(supabase: Supabase, userId: string): Promise<ConversationSummary[]> {
  const { data, error } = await supabase
    .from("coach_conversations")
    .select("id, title, started_at, last_message_at")
    .eq("user_id", userId)
    .order("last_message_at", { ascending: false })
    .limit(50);
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => ({
    id: row.id,
    title: row.title,
    lastMessageAt: row.last_message_at,
    startedAt: row.started_at,
  }));
}

export async function getConversationMessages(
  supabase: Supabase,
  userId: string,
  conversationId: string
): Promise<ChatMessage[]> {
  const { data, error } = await supabase
    .from("coach_messages")
    .select("*")
    .eq("user_id", userId)
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map(toChatMessage);
}

export async function createConversation(
  supabase: Supabase,
  userId: string,
  firstMessage: string
): Promise<string> {
  const { data, error } = await supabase
    .from("coach_conversations")
    .insert({ user_id: userId, title: titleFrom(firstMessage) })
    .select("id")
    .single();
  if (error || !data) throw new Error(error?.message ?? "Falha ao criar conversa.");
  return data.id;
}

export async function appendMessage(
  supabase: Supabase,
  userId: string,
  conversationId: string,
  message: Pick<ChatMessage, "role" | "content"> & { toolCalls?: ToolCall[] }
): Promise<ChatMessage> {
  const { data, error } = await supabase
    .from("coach_messages")
    .insert({
      user_id: userId,
      conversation_id: conversationId,
      role: message.role,
      content: message.content,
      tool_calls: (message.toolCalls ?? []) as unknown as Database["public"]["Tables"]["coach_messages"]["Insert"]["tool_calls"],
    })
    .select("*")
    .single();
  if (error || !data) throw new Error(error?.message ?? "Falha ao guardar mensagem.");
  return toChatMessage(data);
}

export async function getMessageById(
  supabase: Supabase,
  userId: string,
  messageId: string
): Promise<MessageRow | null> {
  const { data } = await supabase
    .from("coach_messages")
    .select("*")
    .eq("user_id", userId)
    .eq("id", messageId)
    .maybeSingle();
  return data ?? null;
}

export async function updateMessageToolCalls(
  supabase: Supabase,
  userId: string,
  messageId: string,
  toolCalls: ToolCall[]
): Promise<ChatMessage> {
  const { data, error } = await supabase
    .from("coach_messages")
    .update({ tool_calls: toolCalls as unknown as Database["public"]["Tables"]["coach_messages"]["Update"]["tool_calls"] })
    .eq("id", messageId)
    .eq("user_id", userId)
    .select("*")
    .single();
  if (error || !data) throw new Error(error?.message ?? "Falha ao atualizar tool call.");
  return toChatMessage(data);
}
