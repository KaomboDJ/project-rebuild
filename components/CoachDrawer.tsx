"use client";

// Compact AI Coach drawer for the Calendar Workspace's right panel - replaces
// components/CoachPanel.tsx (a full-page chat view built against the old
// localStorage-era CoachContext shape). Fetches profile/check-in/decisions
// client-side via the browser Supabase client only when opened, and posts to
// the same /api/coach route (now validating the modernized CoachContext -
// see lib/ai/provider.ts).

import { useState } from "react";
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
    <div className="surface-card flex max-h-[26rem] flex-col overflow-hidden">
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

      <div className="flex-1 space-y-2.5 overflow-y-auto px-4 py-3">
        {messages.length === 0 && (
          <p className="text-sm text-neutral-500">
            Pergunta o que fazer a seguir, ou como ajustar as decisões de hoje.
          </p>
        )}
        {messages.map((message, i) => (
          <div
            key={i}
            className={`max-w-[85%] rounded-xl px-3 py-2 text-sm leading-snug ${
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
        className="flex items-center gap-2 border-t border-white/[0.06] p-2.5"
      >
        <input
          className="field-input flex-1 py-1.5 text-sm"
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
  );
}
