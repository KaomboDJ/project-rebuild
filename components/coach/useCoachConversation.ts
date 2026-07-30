"use client";

import { useCallback, useState } from "react";
import type { ChatMessage } from "@/lib/coach/types";

/**
 * Shared conversation state/actions for both the compact/expanded Coach
 * (components/CoachDrawer.tsx) and the full /coach page - kept in one hook
 * so the send/confirm/decline logic against /api/coach and
 * /api/coach/tools/confirm isn't duplicated between the two surfaces.
 */
export function useCoachConversation(initial?: { conversationId?: string; messages?: ChatMessage[] }) {
  const [conversationId, setConversationId] = useState<string | undefined>(initial?.conversationId);
  const [messages, setMessages] = useState<ChatMessage[]>(initial?.messages ?? []);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const send = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || sending) return;

      setSending(true);
      setError(null);
      const optimisticUser: ChatMessage = {
        id: `local-${Date.now()}`,
        role: "user",
        content: trimmed,
        toolCalls: [],
        createdAt: new Date().toISOString(),
      };
      setMessages((current) => [...current, optimisticUser]);

      try {
        const response = await fetch("/api/coach", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: trimmed, conversationId }),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data?.error ?? "coach-request-failed");

        setConversationId(data.conversationId);
        setMessages((current) => [
          ...current,
          {
            id: data.messageId,
            role: "assistant",
            content: data.reply,
            toolCalls: data.toolCalls ?? [],
            createdAt: new Date().toISOString(),
          },
        ]);
      } catch {
        setError("O coach não respondeu. Tenta novamente.");
      } finally {
        setSending(false);
      }
    },
    [conversationId, sending]
  );

  const resolveToolCall = useCallback(async (messageId: string, toolCallId: string, decision: "confirm" | "decline") => {
    setMessages((current) =>
      current.map((message) =>
        message.id === messageId
          ? {
              ...message,
              toolCalls: message.toolCalls.map((call) =>
                call.id === toolCallId ? { ...call, status: decision === "confirm" ? "confirmed" : "declined" } : call
              ),
            }
          : message
      )
    );

    try {
      const response = await fetch("/api/coach/tools/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messageId, toolCallId, decision }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error ?? "confirm-failed");

      setMessages((current) =>
        current.map((message) =>
          message.id === messageId
            ? { ...message, toolCalls: message.toolCalls.map((call) => (call.id === toolCallId ? data.toolCall : call)) }
            : message
        )
      );
    } catch {
      setError("Não foi possível concluir a ação. Tenta novamente.");
    }
  }, []);

  const loadConversation = useCallback((id: string, loaded: ChatMessage[]) => {
    setConversationId(id);
    setMessages(loaded);
    setError(null);
  }, []);

  const startNew = useCallback(() => {
    setConversationId(undefined);
    setMessages([]);
    setError(null);
  }, []);

  return { conversationId, messages, sending, error, send, resolveToolCall, loadConversation, startNew };
}
