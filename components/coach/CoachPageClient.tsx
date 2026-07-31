"use client";

import { useEffect, useRef, useState } from "react";
import { Info, MessageCircleHeart, Plus, Send, X } from "lucide-react";
import type { ChatMessage, ConversationSummary } from "@/lib/coach/types";
import { useCoachConversation } from "./useCoachConversation";
import { MessageList } from "./MessageList";
import { Drawer } from "@/components/ui/Drawer";
import { pluralizePt } from "@/lib/format/pluralize";

const DAY_TYPE_LABEL: Record<string, string> = { home: "Em casa", office: "Fora / escritório" };

function ContextSummary({
  identity,
  pantryCount,
  dayType,
  dayTypeSource,
}: {
  identity: string;
  /** Items with usable stock (quantity > 0) - the same "currently
   * available" selector the Coach's own get_inventory/suggest_available_meal
   * tools ground on (lib/pantry/selectors.ts), not the dashboard's "total
   * registered" count. Showing the dashboard's total here was the exact
   * source of docs/17_UX_AUDIT.md's N2 finding: the number the founder saw
   * on /nutrition and the number the Coach actually reasoned from disagreed
   * because they were two different concepts wearing the same unlabeled
   * "item(ns) registados" text. */
  pantryCount: number;
  dayType: string | null;
  dayTypeSource: string;
}) {
  return (
    <div className="space-y-3 text-sm">
      <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-neutral-500">
        <Info size={13} /> O que o Coach sabe
      </p>
      <div className="space-y-2 text-neutral-400">
        <p>
          <span className="text-neutral-300">Identidade:</span> {identity || "não definida"}
        </p>
        <p>
          <span className="text-neutral-300">Despensa (disponível agora):</span>{" "}
          {pluralizePt(pantryCount, "item", "itens")}
        </p>
        <p>
          <span className="text-neutral-300">Tipo de dia:</span>{" "}
          {dayType ? `${DAY_TYPE_LABEL[dayType]} (${dayTypeSource})` : "por confirmar — o Coach pode perguntar"}
        </p>
      </div>
    </div>
  );
}

function ConversationHistory({
  conversations,
  activeId,
  onSelect,
  onNew,
}: {
  conversations: ConversationSummary[];
  activeId: string | undefined;
  onSelect: (id: string) => void;
  onNew: () => void;
}) {
  return (
    <div className="flex h-full flex-col">
      <button onClick={onNew} className="btn-secondary mb-3 w-full justify-start gap-2">
        <Plus size={14} /> Nova conversa
      </button>
      <div className="flex-1 space-y-1 overflow-y-auto">
        {conversations.length === 0 && <p className="text-xs text-neutral-500">Ainda sem conversas.</p>}
        {conversations.map((conversation) => (
          <button
            key={conversation.id}
            onClick={() => onSelect(conversation.id)}
            className={`block w-full truncate rounded-lg px-3 py-2 text-left text-sm transition ${
              conversation.id === activeId
                ? "bg-emerald-500/15 text-emerald-300"
                : "text-neutral-400 hover:bg-white/[0.05] hover:text-neutral-100"
            }`}
          >
            {conversation.title || "Nova conversa"}
          </button>
        ))}
      </div>
    </div>
  );
}

export function CoachPageClient({
  conversations,
  initialConversationId,
  initialMessages,
  identity,
  pantryCount,
  dayType,
  dayTypeSource,
}: {
  conversations: ConversationSummary[];
  initialConversationId?: string;
  initialMessages: ChatMessage[];
  identity: string;
  pantryCount: number;
  dayType: string | null;
  dayTypeSource: string;
}) {
  const { conversationId, messages, sending, error, send, resolveToolCall, loadConversation, startNew } = useCoachConversation({
    conversationId: initialConversationId,
    messages: initialMessages,
  });
  const [conversationList, setConversationList] = useState(conversations);
  const [input, setInput] = useState("");
  const [mobileContextOpen, setMobileContextOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages, sending]);

  // Refresh the sidebar list (title/last-message-at) after each exchange so
  // a brand-new conversation shows up without a full page reload.
  useEffect(() => {
    if (!conversationId) return;
    fetch("/api/coach/conversations")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data.conversations)) setConversationList(data.conversations);
      })
      .catch(() => undefined);
  }, [conversationId, messages.length]);

  async function selectConversation(id: string) {
    setMobileContextOpen(false);
    try {
      const response = await fetch(`/api/coach/conversations/${id}`);
      const data = await response.json();
      if (Array.isArray(data.messages)) loadConversation(id, data.messages);
    } catch {
      // Leave current conversation open on failure.
    }
  }

  async function submit() {
    const text = input.trim();
    if (!text) return;
    setInput("");
    await send(text);
  }

  return (
    <main className="mx-auto flex h-[calc(100vh-1px)] max-w-6xl gap-4 px-4 py-6 md:h-screen">
      <aside className="hidden w-56 shrink-0 md:block">
        <ConversationHistory conversations={conversationList} activeId={conversationId} onSelect={selectConversation} onNew={startNew} />
      </aside>

      <section className="surface-card flex min-w-0 flex-1 flex-col overflow-hidden">
        <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-3">
          <span className="flex items-center gap-2 text-sm font-medium text-neutral-100">
            <MessageCircleHeart size={16} className="text-emerald-400" />
            Coach
          </span>
          <button
            onClick={() => setMobileContextOpen(true)}
            className="rounded-lg p-1.5 text-neutral-500 transition hover:bg-white/[0.06] hover:text-neutral-200 md:hidden"
            aria-label="Ver contexto"
          >
            <Info size={16} />
          </button>
        </div>

        <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
          <MessageList
            messages={messages}
            sending={sending}
            error={error}
            emptyHint="Começa uma conversa — pergunta o que fazer a seguir, ou o que cozinhar com o que tens em casa."
            onResolveToolCall={resolveToolCall}
          />
        </div>

        <form
          onSubmit={(event) => {
            event.preventDefault();
            submit();
          }}
          className="flex items-center gap-2 border-t border-white/[0.06] p-3"
        >
          <input
            className="field-input flex-1 py-2 text-sm"
            placeholder="Escreve aqui..."
            value={input}
            onChange={(event) => setInput(event.target.value)}
            disabled={sending}
          />
          <button type="submit" disabled={sending || !input.trim()} aria-label="Enviar" className="btn-primary p-2.5">
            <Send size={14} />
          </button>
        </form>
      </section>

      <aside className="surface-card hidden w-64 shrink-0 p-4 md:block">
        <ContextSummary identity={identity} pantryCount={pantryCount} dayType={dayType} dayTypeSource={dayTypeSource} />
      </aside>

      {mobileContextOpen && (
        <div className="md:hidden">
          <Drawer
            onClose={() => setMobileContextOpen(false)}
            className="w-full max-w-xs p-4"
            labelledBy="coach-context-drawer-title"
          >
            <div className="mb-3 flex items-center justify-between">
              <span id="coach-context-drawer-title" className="text-sm font-medium text-neutral-100">
                Contexto
              </span>
              <button
                onClick={() => setMobileContextOpen(false)}
                aria-label="Fechar"
                className="text-neutral-500 hover:text-neutral-200"
              >
                <X size={16} />
              </button>
            </div>
            <ContextSummary identity={identity} pantryCount={pantryCount} dayType={dayType} dayTypeSource={dayTypeSource} />
          </Drawer>
        </div>
      )}
    </main>
  );
}
