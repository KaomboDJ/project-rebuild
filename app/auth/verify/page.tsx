import { OtpVerifyForm } from "@/components/auth/OtpVerifyForm";

// Thin server wrapper - all of the actual state (which email is pending,
// the code input, resend cooldown) lives client-side in OtpVerifyForm
// since it's read from sessionStorage, not anything the server can see.
// Not gated by middleware (this route isn't in PROTECTED_PATH_PREFIXES):
// reaching it with no pending code is a valid, handled state
// (OtpVerifyForm's own "Pede um novo código" fallback), not an error.
export default function VerifyOtpPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-16">
      <OtpVerifyForm />
    </main>
  );
}
