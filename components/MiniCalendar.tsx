"use client";

// Compact month-glance calendar for the sidebar (Calendar Workspace spec:
// "mini monthly calendar" + "today shortcut"). Deliberately separate from
// the main FullCalendar workspace in CalendarPanel.tsx - this is a small
// jump-to-date affordance, not a full calendar surface, so it reuses the
// existing pure grid math from lib/date/calendar-grid.ts instead of pulling
// FullCalendar in twice.

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { addMonths, getMonthGridDays } from "@/lib/date/calendar-grid";

const MONTH_YEAR = new Intl.DateTimeFormat("pt-PT", { month: "long", year: "numeric" });
const WEEKDAY_LETTERS = ["S", "T", "Q", "Q", "S", "S", "D"];

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function todayKey(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function parseDateKeyLocal(dateKey: string): Date {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(year, month - 1, day);
}

export function MiniCalendar({ selectedDate }: { selectedDate?: string }) {
  const router = useRouter();
  const today = todayKey();
  const [monthAnchor, setMonthAnchor] = useState(selectedDate ?? today);

  const days = useMemo(() => getMonthGridDays(monthAnchor), [monthAnchor]);
  const currentMonth = monthAnchor.slice(0, 7);

  function goToDate(day: string) {
    router.push(`/today?date=${day}`);
  }

  return (
    <div className="px-2 py-1">
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-xs font-medium capitalize text-neutral-400">
          {capitalize(MONTH_YEAR.format(parseDateKeyLocal(monthAnchor)))}
        </span>
        <div className="flex items-center gap-0.5">
          <button
            aria-label="Mês anterior"
            onClick={() => setMonthAnchor((current) => addMonths(current, -1))}
            className="rounded p-0.5 text-neutral-500 transition hover:bg-white/[0.06] hover:text-neutral-200"
          >
            <ChevronLeft size={13} />
          </button>
          <button
            aria-label="Hoje"
            onClick={() => {
              setMonthAnchor(today);
              goToDate(today);
            }}
            className="rounded px-1 text-[10px] font-medium text-neutral-500 transition hover:bg-white/[0.06] hover:text-neutral-200"
          >
            hoje
          </button>
          <button
            aria-label="Mês seguinte"
            onClick={() => setMonthAnchor((current) => addMonths(current, 1))}
            className="rounded p-0.5 text-neutral-500 transition hover:bg-white/[0.06] hover:text-neutral-200"
          >
            <ChevronRight size={13} />
          </button>
        </div>
      </div>
      <div className="grid grid-cols-7 gap-y-0.5 text-center">
        {WEEKDAY_LETTERS.map((letter, i) => (
          <span key={`${letter}-${i}`} className="text-[9px] font-medium text-neutral-600">
            {letter}
          </span>
        ))}
        {days.map((day) => {
          const inMonth = day.slice(0, 7) === currentMonth;
          const isToday = day === today;
          const isSelected = day === selectedDate;
          return (
            <button
              key={day}
              onClick={() => goToDate(day)}
              className={`mx-auto flex h-6 w-6 items-center justify-center rounded-full text-[11px] transition ${
                isSelected
                  ? "bg-emerald-600 font-semibold text-white"
                  : isToday
                    ? "font-semibold text-emerald-400 ring-1 ring-inset ring-emerald-500/40"
                    : inMonth
                      ? "text-neutral-300 hover:bg-white/[0.06]"
                      : "text-neutral-700 hover:bg-white/[0.04]"
              }`}
            >
              {Number(day.slice(8, 10))}
            </button>
          );
        })}
      </div>
    </div>
  );
}
