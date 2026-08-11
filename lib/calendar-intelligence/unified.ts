import "server-only";

import type { CalendarEvent } from "@/lib/decision-engine/types";
import { getCalendarEventsForRange as getGoogleEventsForRange } from "@/lib/google/calendar";
import { getMicrosoftEventsForRange } from "@/lib/microsoft/calendar";
import { listCalendarSources } from "./sources";

export async function getUnifiedCalendarEventsForRange(
  userId: string,
  startDateKey: string,
  endDateKey: string,
  timezone: string
): Promise<CalendarEvent[]> {
  const [googleEvents, microsoftSources] = await Promise.all([
    getGoogleEventsForRange(userId, startDateKey, endDateKey, timezone),
    listCalendarSources(userId, "microsoft"),
  ]);

  const selectedMicrosoft = microsoftSources.filter((source) => source.selectedForContext);
  const microsoftEvents = await Promise.all(
    selectedMicrosoft.map(async (source) => {
      try {
        return await getMicrosoftEventsForRange(
          source,
          source.connectionId,
          startDateKey,
          endDateKey,
          timezone
        );
      } catch {
        return [];
      }
    })
  );

  const normalizedMicrosoft: CalendarEvent[] = microsoftEvents.flat()
    .filter((event) => event.availability !== "free")
    .map((event) => ({
      id: `microsoft:${event.sourceId}:${event.externalEventId}`,
      title: event.title || "Ocupado — Outlook",
      start: event.start,
      end: event.end,
      isAllDay: event.allDay,
      ...(event.location ? { location: event.location } : {}),
    }));

  return [...googleEvents, ...normalizedMicrosoft].sort((a, b) => a.start.localeCompare(b.start));
}

export function getUnifiedCalendarEventsForDate(
  userId: string,
  dateKey: string,
  timezone: string
): Promise<CalendarEvent[]> {
  return getUnifiedCalendarEventsForRange(userId, dateKey, dateKey, timezone);
}
