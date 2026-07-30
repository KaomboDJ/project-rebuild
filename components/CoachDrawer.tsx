"use client";

// Compact AI Coach drawer for the Calendar Workspace's right panel - replaces
// components/CoachPanel.tsx (a full-page chat view built against the old
// localStorage-era CoachContext shape). Fetches profile/check-in/decisions
// client-side via the browser Supabase client only when opened, and posts to
// the same /api/coach route (now validating the modernized CoachContext -
// see lib/ai/provider.ts).

import { useEffect, useRef, useState } from "react";
import { Loader2, MessageCircleHeart, Send, X } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

interface ChatMessage {
  role: "user" | "assistant";
  text: string;
}

export function CoachDrawer({ date }: { date: string }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Coach replies can run long (max_tokens: 400 in lib/ai/provider.ts, often
  // several sentences) - a short fixed-height box clipped them mid-sentence
  // with no visible scroll affordance (founder feedback on the calendar
  // workspace preview). Auto-scrolling to the newest message on every change
  // keeps the end of the latest reply in view by default, the same pattern
  // any chat UI uses.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages, sending]);

  async function send() {
    const message = input.trim();
    if (!message || sending) return;

    setSending(true);
    setError(null);
    setMessages((current) => [...current, { role: "user", text: message }]);
    setInput("");

    try {
      const supabase = createSupabaseBrowserClient();
      if (!supabase) throw new Error("supabase-not-configured");

      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("unauthenticated");

      const [{ data: profile }, { data: checkIn }, { data: decisions }] = await Promise.all([
        supabase.from("profiles").select("desired_identity, current_constraints").eq("user_id", user.id).maybeSingle(),
        supabase
          .from("daily_check_ins")
          .select("sleep_quality, energy_level, stress_level")
          .eq("user_id", user.id)
          .eq("date", date)
          .maybeSingle(),
        supabase.from("decisions").select("title, status").eq("user_id", user.id).eq("date", date),
      ]);

      const response = await fetch("/api/coach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message,
          context: {
            identity: profile?.desired_identity ?? "",
            constraints: profile?.current_constraints ?? "",
            checkIn: checkIn
              ? {
                  sleepQuality: checkIn.sleep_quality ?? 3,
                  energyLevel: checkIn.energy_level ?? 3,
                  stressLevel: checkIn.stress_level ?? 3,
                }
              : null,
            decisions: (decisions ?? []).map((d) => ({ title: d.title, status: d.status })),
          },
        }),
      });

      if (!response.ok) throw new Error("coach-request-failed");
      const { reply } = await response.json();
      setMessages((current) => [...current, { role: "assistant", text: reply }]);
    } catch {
      setError("O coach não respondeu. Tenta novamente.");
    } finally {
      setSending(false);
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="btn-secondary w-full justify-start gap-2.5 py-3"
      >
        <MessageCircleHeart size={16} className="text-emerald-400" />
        Falar com o Coach
      </button>
    );
  }

  return (
    // Full-height slide-over instead of a small inline card - a fixed
    // ~26rem box clipped longer replies with no visible scroll cue
    // (founder feedback). This still reads as a "drawer" (dismissible,
    // not a route) per the spec's "compact AI Coach drawer, not a full
    // chat page", but now has room for an actual back-and-forth.
    <div className="fixed inset-0 z-30 flex justify-end bg-black/40" onClick={() => setOpen(false)}>
      <div
        className="surface-card m-3 flex w-full max-w-md flex-col overflow-hidden md:m-4"
        style={{ height: "calc(100vh - 1.5rem)" }}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-3">
          <span className="flex items-center gap-2 text-sm font-medium text-neutral-100">
            <MessageCircleHeart size={16} className="text-emerald-400" />
            Coach
          </span>
          <button
            aria-label="Fechar"
            onClick={() => setOpen(false)}
            className="rounded-lg p-1 text-neutral-500 transition hover:bg-white/[0.06] hover:text-neutral-200"
          >
            <X size={16} />
          </button>
        </div>

        <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
          {messages.length === 0 && (
            <p className="text-sm text-neutral-500">
              Pergunta o que fazer a seguir, ou como ajustar as decisões de hoje.
            </p>
          )}
          {messages.map((message, i) => (
            <div
              key={i}
              className={`max-w-[90%] whitespace-pre-wrap rounded-xl px-3.5 py-2.5 text-sm leading-relaxed ${
                message.role === "user"
                  ? "ml-auto bg-emerald-600 text-white"
                  : "bg-white/[0.05] text-neutral-200"
              }`}
            >
              {message.text}
            </div>
          ))}
          {sending && (
            <div className="flex items-center gap-2 text-xs text-neutral-500">
              <Loader2 size={13} className="animate-spin" />
              A pensar...
            </div>
          )}
          {error && <p className="text-xs text-red-400">{error}</p>}
        </div>

        <form
          onSubmit={(event) => {
            event.preventDefault();
            send();
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
          <button
            type="submit"
            disabled={sending || !input.trim()}
            aria-label="Enviar"
            className="btn-primary p-2.5"
          >
            <Send size={14} />
          </button>
        </form>
      </div>
    </div>
  );
}
