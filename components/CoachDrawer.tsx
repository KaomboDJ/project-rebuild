"use client";

// Coach entry point for the Calendar Workspace's right panel. Rebuilt for
// the Coach UX + Pantry Intelligence milestone (Part 1) into three explicit
// states instead of the previous single "small drawer that clips long
// replies" (founder feedback, fixed once already in 174173b, then
// superseded by this proper three-state design):
//
//   closed   -> "Falar com o Coach" button.
//   compact  -> small docked card (~420px), shows only the latest exchange
//               as a deliberate preview with "Abrir conversa" to expand -
//               never tries to fit the whole scrollable history in a small
//               box, which is what caused the original clipping bug.
//   expanded -> full-height slide-over, full scrollable history, Markdown
//               rendering, a context summary, and a link to the full
//               /coach page for real conversation management (history,
//               new conversation).
//
// Context (profile/check-in/decisions/pantry/day-type) is no longer
// fetched client-side here - app/api/coach/route.ts now builds it
// server-side from the authenticated session (see that file's comment).

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ChevronDown, Maximize2, MessageCircleHeart, Send, X } from "lucide-react";
import { useCoachConversation } from "@/components/coach/useCoachConversation";
import { MessageList } from "@/components/coach/MessageList";

type ViewState = "closed" | "compact" | "expanded";

export function CoachDrawer() {
  const [view, setView] = useState<ViewState>("closed");
  const [input, setInput] = useState("");
  const { messages, sending, error, send, resolveToolCall } = useCoachConversation();
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (view === "expanded") {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
    }
  }, [messages, sending, view]);

  async function submit() {
    const text = input.trim();
    if (!text) return;
    setInput("");
    await send(text);
  }

  if (view === "closed") {
    return (
      <button onClick={() => setView("compact")} className="btn-secondary w-full justify-start gap-2.5 py-3">
        <MessageCircleHeart size={16} className="text-emerald-400" />
        Falar com o Coach
      </button>
    );
  }

  if (view === "compact") {
    const latest = messages[messages.length - 1];
    return (
      <div className="surface-card flex w-full flex-col overflow-hidden" style={{ maxHeight: 420, minHeight: 200 }}>
        <div className="flex items-center justify-between border-b border-white/[0.06] px-3.5 py-2.5">
          <span className="flex items-center gap-2 text-sm font-medium text-neutral-100">
            <MessageCircleHeart size={16} className="text-emerald-400" />
            Coach
          </span>
          <div className="flex items-center gap-1">
            <button
              aria-label="Expandir"
              onClick={() => setView("expanded")}
              className="rounded-lg p-1 text-neutral-400 transition hover:bg-white/[0.06] hover:text-neutral-200"
            >
              <Maximize2 size={14} />
            </button>
            <button
              aria-label="Fechar"
              onClick={() => setView("closed")}
              className="rounded-lg p-1 text-neutral-400 transition hover:bg-white/[0.06] hover:text-neutral-200"
            >
              <X size={14} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-hidden px-3.5 py-3">
          {!latest && <p className="text-sm text-neutral-400">Pergunta o que fazer a seguir, ou o que cozinhar com o que tens em casa.</p>}
          {latest && (
            <div className="space-y-2">
              <p className="line-clamp-4 text-sm leading-relaxed text-neutral-300">{latest.content}</p>
              <button
                onClick={() => setView("expanded")}
                className="flex items-center gap-1 text-xs font-medium text-emerald-400 hover:text-emerald-300"
              >
                Abrir conversa <ChevronDown size={13} className="-rotate-90" />
              </button>
            </div>
          )}
          {sending && <p className="mt-2 text-xs text-neutral-400">A pensar...</p>}
          {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
        </div>

        <form
          onSubmit={(event) => {
            event.preventDefault();
            submit();
          }}
          className="flex items-center gap-2 border-t border-white/[0.06] p-2.5"
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
        <p className="px-3 pb-2 text-center text-[11px] text-neutral-500">
          Sugestões do Coach — não confirmadas por um médico ou nutricionista.
        </p>
      </div>
    );
  }

  // expanded
  return (
    <div className="fixed inset-0 z-30 flex justify-end bg-black/40" onClick={() => setView("compact")}>
      <div
        className="surface-card m-3 flex w-full max-w-md flex-col overflow-hidden md:m-4"
        style={{ height: "calc(100vh - 1.5rem)", minHeight: 480 }}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-3">
          <span className="flex items-center gap-2 text-sm font-medium text-neutral-100">
            <MessageCircleHeart size={16} className="text-emerald-400" />
            Coach
          </span>
          <div className="flex items-center gap-1">
            <Link
              href="/coach"
              aria-label="Abrir página completa"
              className="rounded-lg p-1 text-neutral-400 transition hover:bg-white/[0.06] hover:text-neutral-200"
            >
              <Maximize2 size={15} />
            </Link>
            <button
              aria-label="Minimizar"
              onClick={() => setView("compact")}
              className="rounded-lg p-1 text-neutral-400 transition hover:bg-white/[0.06] hover:text-neutral-200"
            >
              <ChevronDown size={16} />
            </button>
            <button
              aria-label="Fechar"
              onClick={() => setView("closed")}
              className="rounded-lg p-1 text-neutral-400 transition hover:bg-white/[0.06] hover:text-neutral-200"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
          <MessageList
            messages={messages}
            sending={sending}
            error={error}
            emptyHint="Pergunta o que fazer a seguir, ou o que cozinhar com o que tens em casa."
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
        <p className="px-3 pb-2 text-center text-[11px] text-neutral-500">
          Sugestões do Coach — não confirmadas por um médico ou nutricionista.
        </p>
      </div>
    </div>
  );
}
