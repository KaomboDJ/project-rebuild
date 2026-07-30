import { redirect } from "next/navigation";

// The Calendar Workspace merged the standalone day/week/month calendar into
// /today (see components/CalendarWorkspace.tsx + CalendarPanel.tsx, built on
// FullCalendar rather than the retired hand-built grid in CalendarView.tsx).
// This is an interpretation of the "Calendar Workspace & Visual Rebuild"
// spec's mockup, not an explicit instruction — flagged for founder review
// alongside the rest of this branch; keeping /calendar as a redirect avoids
// a dead nav item and two divergent calendar surfaces in the meantime.
export default function CalendarPage() {
  redirect("/today");
}
