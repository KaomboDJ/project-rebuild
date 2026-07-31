"use client";

import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { mapOtpRequestError } from "@/lib/auth/errors";
import { GoogleIcon, MicrosoftIcon } from "./ProviderIcons";

const PENDING_OTP_KEY = "rebuild_otp_pending";

// Auth UX Hardening milestone. This is the new "Entrar no Rebuild" primary
// screen: Google first and most prominent, Microsoft only when configured,
// then email OTP as a third, equally first-class option (never a magic
// link). Submitting the email calls Supabase's signInWithOtp directly from
// the browser client (same direct-browser-client pattern already
// established by components/OnboardingForm.tsx) rather than round-tripping
// through a server action + redirect, so the transition to the code-entry
// screen is immediate and can show inline errors/loading state without a
// full navigation - the milestone explicitly calls for "clear progress and
// loading states" and controls that "prevent accidental duplicate
// submissions".
export function SignInPanel({
  next,
  microsoftEnabled,
  googleAction,
  microsoftAction,
}: {
  next: string;
  microsoftEnabled: boolean;
  googleAction: (formData: FormData) => void | Promise<void>;
  microsoftAction: (formData: FormData) => void | Promise<void>;
}) {
  const router = useRouter();
  const emailId = useId();
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSendCode(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;

    const trimmedEmail = email.trim();
    if (!trimmedEmail || !trimmedEmail.includes("@")) {
      setError("Introduz um endereço de email válido.");
      return;
    }

    const supabase = createSupabaseBrowserClient();
    if (!supabase) {
      setError("A autenticação ainda não está ligada ao Supabase.");
      return;
    }

    setSubmitting(true);
    setError(null);

    // No emailRedirectTo: this deliberately does not ask Supabase to send a
    // clickable magic link as the primary path (product decision - magic
    // links are now an undocumented technical fallback only, handled for
    // free by the existing /auth/callback route if Supabase's email
    // template happens to still include one). shouldCreateUser: true
    // preserves the existing "no enumeration" behavior - the same visible
    // outcome whether or not this address already has an account.
    const { error: otpError } = await supabase.auth.signInWithOtp({
      email: trimmedEmail,
      options: { shouldCreateUser: true },
    });

    setSubmitting(false);

    if (otpError) {
      setError(mapOtpRequestError(otpError));
      return;
    }

    if (typeof window !== "undefined") {
      window.sessionStorage.setItem(PENDING_OTP_KEY, JSON.stringify({ email: trimmedEmail, next }));
    }
    router.push("/auth/verify");
  }

  return (
    <div className="surface-card space-y-4 p-5">
      <h2 className="text-lg font-semibold tracking-tight text-neutral-100">Entrar no Rebuild</h2>

      <form action={googleAction}>
        <input type="hidden" name="next" value={next} />
        <button type="submit" className="btn-google">
          <GoogleIcon />
          Continuar com Google
        </button>
      </form>

      {microsoftEnabled && (
        <form action={microsoftAction}>
          <input type="hidden" name="next" value={next} />
          <button type="submit" className="btn-microsoft">
            <MicrosoftIcon />
            Continuar com Microsoft
          </button>
        </form>
      )}

      <div className="flex items-center gap-3 text-xs uppercase tracking-wide text-neutral-500">
        <span className="h-px flex-1 bg-white/10" aria-hidden="true" />
        Ou continuar com email
        <span className="h-px flex-1 bg-white/10" aria-hidden="true" />
      </div>

      <form onSubmit={handleSendCode} className="space-y-3" noValidate>
        <div>
          <label htmlFor={emailId} className="field-label">
            Email
          </label>
          <input
            id={emailId}
            name="email"
            type="email"
            required
            autoComplete="email"
            inputMode="email"
            placeholder="nome@exemplo.com"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="field-input mt-1"
            aria-describedby={`${emailId}-help`}
            aria-invalid={error ? true : undefined}
          />
        </div>
        <p id={`${emailId}-help`} className="text-sm text-neutral-400">
          Enviamos um código de 6 dígitos. Não precisas de abrir nenhum link.
        </p>
        {error && (
          <p role="alert" className="text-sm text-rose-400">
            {error}
          </p>
        )}
        <button type="submit" disabled={submitting} className="btn-secondary w-full py-2.5">
          {submitting ? "A enviar…" : "Enviar código"}
        </button>
      </form>
    </div>
  );
}

export { PENDING_OTP_KEY };
