"use client";

// UX Hardening release, section 6 - the founder pilot needs a real,
// self-service deletion path before external testers are invited (a tester
// who wants out must not have to email support and wait). Deliberately
// requires retyping the account's own email before the button even enables,
// on top of the server route's own confirmation check (app/api/account/
// route.ts) - two independent points a stray click cannot get past.

import { useState } from "react";

export function DeleteAccountSection({ email }: { email: string }) {
  const [confirmText, setConfirmText] = useState("");
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canDelete = confirmText.trim().toLowerCase() === email.toLowerCase();

  async function handleDelete() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/account", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmEmail: confirmText.trim() }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        setError(
          body.error === "email-mismatch"
            ? "O email não corresponde à tua conta."
            : "Não foi possível eliminar a conta agora. Tenta novamente."
        );
        setBusy(false);
        return;
      }
      window.location.href = "/?account=deleted";
    } catch {
      setError("Não foi possível eliminar a conta agora. Tenta novamente.");
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button type="button" className="btn-ghost text-rose-400 hover:text-rose-300" onClick={() => setOpen(true)}>
        Eliminar conta
      </button>
    );
  }

  return (
    <div className="space-y-3 rounded-xl border border-rose-500/25 bg-rose-500/[0.04] p-4">
      <p className="text-sm font-medium text-rose-300">Isto elimina tudo, sem possibilidade de reverter</p>
      <p className="text-sm text-neutral-400">
        Ao confirmar, apagamos imediatamente o teu perfil, as ligações ao Google Calendar, o histórico de
        decisões, as conversas com o Coach, a despensa e listas de compras, o plano de refeições e as notas de
        personalização. Tentamos também revogar o acesso ao Google Calendar do lado da Google. Não há forma de
        recuperar estes dados depois de confirmares.
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
          disabled={!canDelete || busy}
          onClick={handleDelete}
          className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-rose-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-rose-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? "A eliminar..." : "Eliminar conta definitivamente"}
        </button>
        <button type="button" className="btn-ghost" onClick={() => setOpen(false)} disabled={busy}>
          Cancelar
        </button>
      </div>
    </div>
  );
}
