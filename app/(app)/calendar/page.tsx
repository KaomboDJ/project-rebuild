import { CalendarView } from "@/components/CalendarView";

// CalendarView handles the "not connected" state itself (the events API
// returns 409, which it turns into a message + link to /settings) - no
// server-side pre-check needed here, single source of truth.
export default function CalendarPage() {
  return (
    <main className="mx-auto flex h-[calc(100vh-3.5rem)] max-w-6xl flex-col px-0 py-4 md:h-[calc(100vh-3.25rem)] md:px-6 md:py-6">
      <div className="mb-2 px-4 md:px-0">
        <p className="text-sm uppercase tracking-wide text-neutral-500">Google Calendar</p>
        <h1 className="text-2xl font-semibold tracking-tight">Calendário</h1>
      </div>
      <CalendarView />
    </main>
  );
}
