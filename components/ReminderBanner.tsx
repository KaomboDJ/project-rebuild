"use client";

import { useEffect, useState } from "react";
import { localTimeHHMM } from "@/lib/date/local";
import { findDueReminder } from "@/lib/decisions/reminders";
import type { DecisionInstance } from "@/lib/decisions/types";

export function ReminderBanner({ instances }: { instances: DecisionInstance[] }) {
  const [due, setDue] = useState<DecisionInstance | null>(null);

  useEffect(() => {
    function check() {
      setDue(findDueReminder(instances, localTimeHHMM()));
    }
    check();
    const interval = setInterval(check, 30_000);
    return () => clearInterval(interval);
  }, [instances]);

  if (!due) return null;

  return (
    <div className="rounded-lg border border-amber-700 bg-amber-950/50 p-3 text-sm text-amber-200">
      Lembrete: {due.title} — {due.trigger}
    </div>
  );
}
