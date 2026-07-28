"use client";

import { useState } from "react";
import type { CheckIn, DecisionInstance, OnboardingProfile, OperatingState } from "@/lib/decisions/types";

const MAX_MESSAGE_LENGTH = 1000;

const ERROR_MESSAGES: Record<string, string> = {
  message_required: "Escreve uma mensagem antes de perguntar.",
  message_too_long: "Mensagem demasiado longa (máx. 1000 caracteres).",
  context_invalid: "Não foi possível carregar o teu contexto atual. Recarrega a página.",
  invalid_json: "Pedido inválido. Tenta novamente.",
  coach_unavailable: "O coach não está disponível agora. Tenta novamente.",
};

export function CoachPanel({
  profile,
  checkIn,
  state,
  instances,
}: {
  profile: OnboardingProfile;
  checkIn: CheckIn;
  state: OperatingState;
  instances: DecisionInstance[];
}) {
  const [message, setMessage] = useState("");
  const [reply, setReply] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function ask() {
    setLoading(true);
    setReply(null);
    try {
      const response = await fetch("/api/coach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, context: { profile, checkIn, state, instances } }),
      });
      const data = await response.json();
      setReply(data.reply ?? ERROR_MESSAGES[data.error] ?? "Sem resposta.");
    } catch {
      setReply(ERROR_MESSAGES.coach_unavailable);
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="space-y-2 rounded-lg border border-neutral-800 p-4">
      <h2 className="text-lg font-medium">Coach</h2>
      <textarea
        className="w-full rounded-md border border-neutral-700 bg-neutral-900 px-2 py-1.5 text-sm"
        rows={2}
        maxLength={MAX_MESSAGE_LENGTH}
        placeholder="Pergunta ao coach sobre a decisão de agora..."
        value={message}
        onChange={(event) => setMessage(event.target.value)}
      />
      <button
        className="rounded-md bg-emerald-600 px-3 py-1.5 text-sm text-white hover:bg-emerald-500 disabled:opacity-50"
        onClick={ask}
        disabled={loading || !message.trim()}
      >
        {loading ? "A pensar..." : "Perguntar"}
      </button>
      {reply && <p className="mt-2 whitespace-pre-wrap text-sm text-neutral-300">{reply}</p>}
    </section>
  );
}
