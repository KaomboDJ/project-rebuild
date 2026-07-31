import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { MemoryManager } from "@/components/settings/MemoryManager";
import { FirstUseCallout } from "@/components/ui/FirstUseCallout";

export default function MemoryPage() {
  return (
    <main className="mx-auto max-w-2xl space-y-6 px-4 py-8">
      <div>
        <Link href="/settings" className="inline-flex items-center gap-1 text-sm text-neutral-400 hover:text-neutral-200">
          <ChevronLeft size={14} />
          Definições
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">Memória e personalização</h1>
        <p className="mt-1 text-sm text-neutral-400">
          O que o motor de decisões aprendeu contigo, sempre visível e editável.
        </p>
      </div>
      <FirstUseCallout id="memory">
        Esta página é totalmente tua: vê exatamente o que o motor de decisões aprendeu, corrige-o com notas,
        ou silencia qualquer regra que não faça sentido para ti.
      </FirstUseCallout>
      <MemoryManager />
    </main>
  );
}
