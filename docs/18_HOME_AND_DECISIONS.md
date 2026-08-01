# 18 — Home and Decisions workspace

Status: implemented on a review branch; not yet merged or deployed.

## Product decision

The application now separates two jobs that were previously mixed together:

- **Home (`/home`) plans and coordinates the day.** It compiles calendar commitments, free windows, meals, training/recovery actions and the three daily decisions into one chronological agenda.
- **Decisions (`/today`) executes and evaluates the day.** It keeps the calendar workspace, Decision XP, individual accept/edit/complete/skip actions and feedback, but no longer owns the batch “Programar o meu dia” action.

There is one underlying day plan. Home and Decisions are two views over the same decisions, calendar events and lifecycle state; they do not create competing plans.

## Why the old button was disabled

The previous batch action could only schedule decisions that already had both `recommended_start` and `recommended_end`, had no Google Calendar event yet, and were eligible for calendar insertion. Several deterministic rules produced useful actions without structured timing, so the UI correctly had nothing it could safely schedule.

This slice fixes the data model rather than merely enabling the button:

- `calendar_slot`: has a real start/end and may become a calendar event after explicit confirmation;
- `trigger_based`: belongs to a moment such as “after lunch” and is never converted into a fake appointment;
- `flexible`: can be completed during the day without a calendar reservation.

## Day-plan lifecycle

1. **Not planned** — Home offers “Planear o meu dia”.
2. **Proposed, awaiting confirmation** — the founder reviews the compiled agenda.
3. **Confirmed** — calendar-slot actions can be written to the selected writable Google Calendar; trigger/flexible actions remain local.
4. **Confirmed with conflict** — if the calendar changes, the affected action is marked stale and Home asks for review.

Every external calendar mutation still requires an explicit founder confirmation. The system may suggest a new free slot, but it cannot silently move a training session.

## Deterministic scheduling

`lib/day-plan/slot-finder.ts` ranks free windows without AI and rejects overlaps. Preferred windows are used when possible, past windows are ignored, and adjacency to an existing event is allowed. `lib/day-plan/validate-conflicts.ts` checks confirmed actions against current calendar events. The Coach receives the resulting structured timing as authoritative context and may explain it, not invent a conflicting schedule.

## Database changes

Migration `202608010001_daily_home_timing.sql` adds only:

- `decisions.timing_type` (default `flexible`);
- `decisions.trigger_label` (nullable, display-only);
- `decisions.calendar_connection_id` (nullable owner of the external event, required for safe multi-account updates);
- `decision_runs.plan_confirmed_at` (nullable).

The migration is additive and preserves all existing rows. It must be applied before the review branch can be exercised against a shared Supabase project.

## UX rules

- `Início` is the first authenticated navigation item and the post-onboarding destination.
- Home shows the next action and a chronological day from waking context to target sleep time.
- Decisions shows a compact plan-status banner linking back to Home.
- An untimed calendar-slot decision offers “Encontrar horário”; a scheduled one offers “Alterar horário”.
- Times are rendered in the founder’s configured timezone, not the server timezone.
- Empty states explain the next useful action; no disabled batch button remains on Decisions.

## Validation

- TypeScript type-check: clean.
- ESLint: clean.
- Unit tests: 317 passing after this slice’s timing/conflict coverage.
- Production build: successful when Google Fonts network access is available.
- Playwright coverage was updated for Home, Decisions, responsiveness and Axe; execution still depends on the configured disposable Supabase test environment and the new additive migration.

## Explicitly deferred

This slice does not redesign Nutrition. The custom dark dropdown and the continuous Profile → Pantry → Weekly Plan → Shopping List setup flow remain a separate follow-up so they do not destabilize the day-planning release.
