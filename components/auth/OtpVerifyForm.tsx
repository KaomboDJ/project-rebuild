"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { mapOtpRequestError, mapOtpVerifyError } from "@/lib/auth/errors";
import { maskEmail } from "@/lib/auth/mask-email";
import { safeRedirectPath } from "@/lib/auth/safe-redirect";

const PENDING_OTP_KEY = "rebuild_otp_pending";
const RESEND_COOLDOWN_SECONDS = 30;

interface PendingOtp {
  email: string;
  next: string;
}

function readPendingOtp(): PendingOtp | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(PENDING_OTP_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PendingOtp>;
    if (typeof parsed.email !== "string" || !parsed.email.includes("@")) return null;
    return { email: parsed.email, next: safeRedirectPath(parsed.next) };
  } catch {
    return null;
  }
}

/**
 * The six-digit code-entry screen. Reads the pending email from
 * sessionStorage rather than the URL, so the address never appears in
 * browser history/analytics/shared links - this also means a refresh of
 * this exact screen still works (sessionStorage survives a reload), while
 * opening this URL on a *different* device (no sessionStorage entry there)
 * gracefully falls back to "ask for a new code" instead of erroring, which
 * is the correct behavior since a code can only ever be usefully entered
 * from a device where the founder also knows which email it was sent to.
 */
export function OtpVerifyForm() {
  const router = useRouter();
  const codeId = useId();
  const [pending, setPending] = useState<PendingOtp | null | undefined>(undefined);
  const [code, setCode] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resendCooldown, setResendCooldown] = useState(RESEND_COOLDOWN_SECONDS);
  const [resendStatus, setResendStatus] = useState<string | null>(null);
  const codeInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setPending(readPendingOtp());
  }, []);

  useEffect(() => {
    if (!pending) return;
    if (resendCooldown <= 0) return;
    const timer = window.setInterval(() => {
      setResendCooldown((current) => Math.max(current - 1, 0));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [pending, resendCooldown]);

  const handleChangeEmail = useCallback(() => {
    if (typeof window !== "undefined") {
      window.sessionStorage.removeItem(PENDING_OTP_KEY);
    }
  }, []);

  async function handleVerify(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!pending || verifying) return;

    if (code.length !== 6) {
      setError("Introduz os 6 dígitos do código.");
      return;
    }

    const supabase = createSupabaseBrowserClient();
    if (!supabase) {
      setError("A autenticação ainda não está ligada ao Supabase.");
      return;
    }

    setVerifying(true);
    setError(null);

    const { error: verifyError } = await supabase.auth.verifyOtp({
      email: pending.email,
      token: code,
      type: "email",
    });

    if (verifyError) {
      setVerifying(false);
      setError(mapOtpVerifyError(verifyError));
      return;
    }

    if (typeof window !== "undefined") {
      window.sessionStorage.removeItem(PENDING_OTP_KEY);
    }
    router.refresh();
    router.push(pending.next);
  }

  async function handleResend() {
    if (!pending || resendCooldown > 0) return;
    const supabase = createSupabaseBrowserClient();
    if (!supabase) return;

    setResendStatus(null);
    const { error: resendError } = await supabase.auth.signInWithOtp({
      email: pending.email,
      options: { shouldCreateUser: true },
    });

    if (resendError) {
      setError(mapOtpRequestError(resendError));
      return;
    }

    setError(null);
    setCode("");
    setResendCooldown(RESEND_COOLDOWN_SECONDS);
    setResendStatus("Enviámos um novo código.");
    codeInputRef.current?.focus();
  }

  // Still checking sessionStorage on first render - avoid a flash of the
  // "no pending code" state for what will be the common case.
  if (pending === undefined) {
    return <div className="surface-card p-5" aria-hidden="true" />;
  }

  if (pending === null) {
    return (
      <div className="surface-card space-y-3 p-5">
        <h1 className="text-lg font-semibold text-neutral-100">Pede um novo código</h1>
        <p className="text-sm text-neutral-400">
          Não encontrámos um pedido de código ativo neste dispositivo. Isto acontece, por exemplo, se abriste esta
          página noutro dispositivo ou navegador. Pede um novo código para continuar.
        </p>
        <Link href="/" className="btn-secondary inline-flex">
          Voltar a entrar
        </Link>
      </div>
    );
  }

  return (
    <div className="surface-card space-y-4 p-5">
      <div>
        <h1 className="text-lg font-semibold text-neutral-100">Introduz o código enviado para {maskEmail(pending.email)}</h1>
        <p className="mt-1 text-sm text-neutral-400">
          Enviamos um código de 6 dígitos. Não precisas de abrir nenhum link.
        </p>
      </div>

      <form onSubmit={handleVerify} className="space-y-3" noValidate>
        <div>
          <label htmlFor={codeId} className="field-label">
            Código de 6 dígitos
          </label>
          <input
            ref={codeInputRef}
            id={codeId}
            name="code"
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            autoComplete="one-time-code"
            maxLength={6}
            required
            autoFocus
            value={code}
            onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
            className="field-input mt-1 text-center text-lg tracking-[0.5em]"
            aria-describedby={error ? `${codeId}-error` : undefined}
            aria-invalid={error ? true : undefined}
          />
        </div>

        <div aria-live="polite" className="sr-only">
          {verifying ? "A confirmar código." : ""}
        </div>

        {error && (
          <p id={`${codeId}-error`} role="alert" className="text-sm text-rose-400">
            {error}
          </p>
        )}
        {resendStatus && !error && (
          <p role="status" className="text-sm text-emerald-400">
            {resendStatus}
          </p>
        )}

        <button type="submit" disabled={verifying || code.length !== 6} className="btn-primary w-full py-2.5">
          {verifying ? "A confirmar…" : "Confirmar e continuar"}
        </button>
      </form>

      <div className="flex items-center justify-between text-sm">
        <button
          type="button"
          onClick={handleResend}
          disabled={resendCooldown > 0}
          className="btn-ghost px-0 disabled:bg-transparent"
        >
          {resendCooldown > 0 ? `Reenviar código (${resendCooldown}s)` : "Não recebeste? Reenviar código"}
        </button>
        <Link href="/" onClick={handleChangeEmail} className="btn-ghost px-0">
          Alterar email
        </Link>
      </div>
    </div>
  );
}
