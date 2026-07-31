"use client";

// Milestone 14 — /settings/memory: the "user-visible/editable memory"
// surface (docs/12_ROADMAP.md). Shows, per rule, the plain-language pattern
// (patterns.ts's describeRuleInsight, computed live via
// GET /api/personalization/insights — nothing here is cached/opaque) and
// lets the founder mute a rule outright or attach a free-text note, general
// or rule-scoped. Client-rendered since every action here is an immediate,
// interactive edit rather than a page navigation.

import { useEffect, useState } from "react";
import type { RuleInsight } from "@/lib/decision-engine/patterns";
import { HelpTip } from "@/components/ui/HelpTip";

interface InsightRow {
  ruleId: string;
  label: string;
  muted: boolean;
  insight: RuleInsight;
  description: string;
}

interface FounderNote {
  id: string;
  rule_id: string | null;
  content: string;
  created_at: string;
  updated_at: string;
}

export function MemoryManager() {
  const [rows, setRows] = useState<InsightRow[] | null>(null);
  const [notes, setNotes] = useState<FounderNote[] | null>(null);
  const [minEvidenceCount, setMinEvidenceCount] = useState(5);
  const [error, setError] = useState<string | null>(null);
  const [newNote, setNewNote] = useState("");
  const [savingNote, setSavingNote] = useState(false);
  const [pendingRuleId, setPendingRuleId] = useState<string | null>(null);

  async function refresh() {
    try {
      const [insightsRes, notesRes] = await Promise.all([
        fetch("/api/personalization/insights"),
        fetch("/api/personalization/notes"),
      ]);
      if (!insightsRes.ok || !notesRes.ok) throw new Error();
      const insightsJson = await insightsRes.json();
      const notesJson = await notesRes.json();
      setRows(insightsJson.rows);
      setMinEvidenceCount(insightsJson.minEvidenceCount ?? 5);
      setNotes(notesJson.notes);
    } catch {
      setError("Não foi possível carregar a memória. Tenta novamente.");
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  async function toggleMute(ruleId: string, muted: boolean) {
    setPendingRuleId(ruleId);
    try {
      const response = await fetch("/api/personalization/mute", {
        method: muted ? "DELETE" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ruleId }),
      });
      if (!response.ok) throw new Error();
      await refresh();
    } catch {
      setError("Não foi possível atualizar esta regra.");
    } finally {
      setPendingRuleId(null);
    }
  }

  async function addNote(ruleId: string | null) {
    if (!newNote.trim()) return;
    setSavingNote(true);
    try {
      const response = await fetch("/api/personalization/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: newNote.trim(), ruleId }),
      });
      if (!response.ok) throw new Error();
      setNewNote("");
      await refresh();
    } catch {
      setError("Não foi possível guardar a nota.");
    } finally {
      setSavingNote(false);
    }
  }

  async function deleteNote(id: string) {
    try {
      const response = await fetch(`/api/personalization/notes/${id}`, { method: "DELETE" });
      if (!response.ok) throw new Error();
      await refresh();
    } catch {
      setError("Não foi possível remover a nota.");
    }
  }

  const generalNotes = (notes ?? []).filter((n) => n.rule_id === null);

  return (
    <div className="space-y-6">
      {error && <p className="text-sm text-amber-400">{error}</p>}

      <section className="surface-card space-y-4 p-5">
        <div>
          <h2 className="font-medium">Notas gerais</h2>
          <p className="mt-1 text-sm text-neutral-400">
            Texto livre que o Coach tem sempre em conta, independentemente do tipo de decisão.
          </p>
        </div>
        <div className="space-y-2">
          {generalNotes.map((note) => (
            <div key={note.id} className="flex items-start justify-between gap-3 rounded-xl bg-white/[0.03] px-3 py-2.5">
              <p className="text-sm text-neutral-200">{note.content}</p>
              <button className="btn-ghost shrink-0 text-xs" onClick={() => deleteNote(note.id)}>
                Remover
              </button>
            </div>
          ))}
          {generalNotes.length === 0 && <p className="text-sm text-neutral-500">Ainda sem notas gerais.</p>}
        </div>
        <div className="flex gap-2">
          <input
            className="field-input flex-1"
            placeholder="Ex.: Prefiro sugestões mais diretas de manhã."
            value={newNote}
            onChange={(e) => setNewNote(e.target.value)}
          />
          <button className="btn-secondary shrink-0" disabled={savingNote} onClick={() => addNote(null)}>
            Adicionar
          </button>
        </div>
      </section>

      <section className="surface-card space-y-4 p-5">
        <div>
          <h2 className="flex items-center gap-1.5 font-medium">
            Padrões por regra
            <HelpTip heading="Confiança da memória e silenciar regras">
              O Rebuild só personaliza uma regra depois de ver evidência suficiente (ver texto abaixo) — antes
              disso mostra sempre o comportamento por omissão. &quot;Silenciar&quot; desliga uma regra por completo,
              sem apagar o que já foi aprendido, e podes reativá-la a qualquer momento.
            </HelpTip>
          </h2>
          <p className="mt-1 text-sm text-neutral-400">
            Cada regra precisa de pelo menos {minEvidenceCount} sugestões para ter um ajuste — sem histórico
            suficiente, o comportamento é o mesmo de sempre. Podes silenciar qualquer regra a qualquer momento.
          </p>
        </div>
        <div className="space-y-2">
          {(rows ?? []).map((row) => (
            <div key={row.ruleId} className="rounded-xl bg-white/[0.03] px-3 py-2.5">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-medium text-neutral-200">{row.label}</p>
                <button
                  className={row.muted ? "btn-secondary text-xs" : "btn-ghost text-xs"}
                  disabled={pendingRuleId === row.ruleId}
                  onClick={() => toggleMute(row.ruleId, row.muted)}
                >
                  {row.muted ? "Reativar" : "Silenciar"}
                </button>
              </div>
              <p className="mt-1 text-sm text-neutral-400">{row.description}</p>
            </div>
          ))}
          {rows === null && <p className="text-sm text-neutral-500">A carregar…</p>}
        </div>
      </section>
    </div>
  );
}
