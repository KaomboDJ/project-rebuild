"use client";

// Settings danger zone — "Reiniciar conta de teste". Requested after a live
// audit walkthrough: testing the first-open experience meant either using a
// disposable throwaway account or accepting that the real account's
// profile/history/nutrition data would always be there. Mirrors
// DeleteAccountSection's retype-email confirmation exactly (two independent
// points a stray click cannot get past: the button only enables once the
// account's own email is retyped, and the server route re-checks it too),
// but keeps the login itself — see app/api/account/reset/route.ts and
// lib/account/reset.ts for exactly what does and doesn't get cleared.

import { useState } from "react";

export function ResetAccountSection({ email }: { email: string }) {
  const [confirmText, setConfirmText] = useState("");
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canReset = confirmText.trim().toLowerCase() === email.toLowerCase();

  async function handleReset() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/account/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmEmail: confirmText.trim() }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        setError(
          body.error === "email-mismatch"
            ? "O email não corresponde à tua conta."
            : "Não foi possível reiniciar a conta agora. Tenta novamente."
        );
        setBusy(false);
        return;
      }
      window.location.href = "/onboarding";
    } catch {
      setError("Não foi possível reiniciar a conta agora. Tenta novamente.");
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button type="button" className="btn-ghost text-amber-400 hover:text-amber-300" onClick={() => setOpen(true)}>
        Reiniciar conta de teste
      </button>
    );
  }

  return (
    <div className="space-y-3 rounded-xl border border-amber-500/25 bg-amber-500/[0.04] p-4">
      <p className="text-sm font-medium text-amber-300">Isto apaga os teus dados, mas mantém a sessão</p>
      <p className="text-sm text-neutral-400">
        Ao confirmar, apagamos imediatamente o teu perfil e onboarding, o histórico de decisões, check-ins e
        conversas com o Coach, a despensa e listas de compras, o plano de refeições, notas de personalização e
        preferências de notificações — e desligamos o Google Calendar (terás de o voltar a ligar). O login com
        este email mantém-se: entras direto no ecrã de onboarding, como se fosses um novo utilizador. Não há
        forma de recuperar estes dados depois de confirmares.
      </p>
      <label className="block text-sm">
        Escreve <span className="font-mono text-neutral-200">{email}</span> para confirmares
        <input
          className="field-input mt-1"
          value={confirmText}
          onChange={(event) => setConfirmText(event.target.value)}
          autoComplete="off"
        />
      </label>
      {error && <p className="text-sm text-rose-400">{error}</p>}
      <div className="flex gap-2">
        <button
          type="button"
          disabled={!canReset || busy}
          onClick={handleReset}
          className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-amber-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-amber-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? "A reiniciar..." : "Reiniciar dados definitivamente"}
        </button>
        <button type="button" className="btn-ghost" onClick={() => setOpen(false)} disabled={busy}>
          Cancelar
        </button>
      </div>
    </div>
  );
}
