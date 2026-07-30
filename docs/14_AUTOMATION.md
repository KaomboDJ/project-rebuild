# 14 — Automation and Continuous Synchronization (Milestone 13)

Implements `docs/12_ROADMAP.md`'s Milestone 13: "incremental Calendar sync,
proactive interventions, replanning, daily briefings."

## What shipped

1. **Shared generation pipeline** (`lib/decision-engine/run.ts`) — the
   context-build → generate → persist logic previously inline in
   `app/api/decisions/generate/route.ts` is now a single
   `runDecisionGeneration(supabase, userId)` function, callable with either
   the interactive route's session-scoped client or the cron route's admin
   client. Prevents the two paths from silently drifting apart.
2. **Scheduled proactive generation** (`app/api/cron/daily-sync/route.ts`,
   `vercel.json`) — a cron-triggered route, protected by `CRON_SECRET`
   (already anticipated in `.env.example`), that for every onboarded founder:
   generates today's three decisions before they ever open the app if none
   exist yet, and otherwise checks whether the calendar has drifted.
3. **Drift detection** (`lib/decision-engine/drift.ts`) — pure, synchronous
   comparison of today's current free-window shape against what was true
   when decisions were last generated (`decision_runs.context_snapshot`).
   Flags `decisions_stale` without ever silently replacing the founder's
   existing decisions — the product principle "recommend, then confirm"
   applies to replanning exactly as it does everywhere else in the app.
4. **Daily briefings** (`daily_briefings` table) — one row per
   `(user_id, date)`, upserted by the cron job: event count, free minutes,
   whether decisions were proactively generated, whether they're now stale,
   and a short Portuguese summary line. Surfaced on `/today`
   (`components/CalendarWorkspace.tsx`) as a small card above the decisions
   list, with a one-click "Regenerar decisões de hoje" button when stale.

## Explicitly simplified (documented, not silently dropped)

- **"Incremental Calendar sync" is a scheduled full poll, not Google's
  sync-token protocol.** Implementing Google Calendar's `syncToken`-based
  incremental sync from memory, with no live Google API access available to
  verify the request/response contract in this environment, was judged too
  risky for a feature that sits on top of the working, already-shipped
  Milestone 3 calendar read path — a subtle mistake there could regress core
  calendar functionality. What shipped instead is genuinely incremental in
  the product sense (the app's picture of the calendar refreshes on a
  schedule, not only when the founder opens the page) without touching the
  proven event-fetching code in `lib/google/calendar.ts`. True sync-token
  support remains a candidate for a future, narrowly-scoped follow-up once
  it can be tested against a live connection.
- **Once-daily cron, not continuous intraday polling.** The Vercel project
  is on the Hobby (free) plan, which limits cron trigger frequency; `vercel.json`
  schedules a single daily run (06:30 UTC, a fixed-offset approximation of
  an early morning in `Europe/Lisbon` — it does not shift for DST). Moving to
  more frequent runs is a one-line schedule change if the project moves to a
  paid Vercel plan.
- **Drift detection is aggregate, not per-decision.** `detectFreeWindowDrift`
  compares total free-window count/duration rather than re-checking each of
  today's three persisted decisions individually against the new calendar
  state (that would require re-deriving rule-internal fields —
  `requiresFreeWindow`, `minWindowMinutes` — that aren't persisted on the
  `decisions` row). The coarser heuristic still catches the cases that
  matter (a meeting added, cancelled, or moved) and never overclaims
  precision it doesn't have.
- **No push/email notifications.** "Proactive" here means "ready and visibly
  flagged the next time the founder opens the app," not a phone
  notification — there is no push subscription or email-sending
  infrastructure in this project, and building one was out of scope for this
  slice per CLAUDE.md's "do not introduce a complex architecture before the
  first loop works."

## Schema

`supabase/migrations/202607300008_automation_sync.sql`: one new table,
`daily_briefings`, RLS-scoped to `auth.uid() = user_id` for `select`/`insert`/`update`
(insert/update are only ever performed by the cron route's admin client,
which bypasses RLS — the policies exist for defense in depth). No changes to
any existing table.
