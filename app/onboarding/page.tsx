"use client";

import { useRouter } from "next/navigation";
import { OnboardingForm, type OnboardingDraft } from "@/components/OnboardingForm";
import { saveProfile } from "@/lib/storage/local";

export default function OnboardingPage() {
  const router = useRouter();

  function handleSubmit(draft: OnboardingDraft) {
    saveProfile({ ...draft, completedAt: new Date().toISOString() });
    router.replace("/");
  }

  return (
    <main className="mx-auto max-w-xl px-4 py-8">
      <p className="text-sm uppercase tracking-wide text-neutral-400">Project Rebuild</p>
      <h1 className="mb-6 text-2xl font-semibold">Vamos começar</h1>
      <OnboardingForm onSubmit={handleSubmit} />
    </main>
  );
}
