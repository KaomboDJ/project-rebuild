# 05 — MVP Spec

Defines the scope of the current MVP iteration. `01_FOUNDER_CONTEXT.md` / root `FOUNDER_CONTEXT.md` control product vision. `06_DECISION_ENGINE.md` and `08_AI_ARCHITECTURE.md` detail the decision engine referenced below. `IMPLEMENTATION_STATUS.md` tracks milestone progress.

## MVP objective

A working web application that:

1. Authenticates the user.
2. Connects to Google Calendar.
3. Reads today's calendar events.
4. Identifies free windows and relevant constraints.
5. Generates exactly three priority decisions for the day.
6. Allows Accept, Complete, Skip, Edit, and Add to Calendar for each decision.
7. Creates a Google Calendar intervention event with a reminder, only on explicit user action.
8. Stores decision history and user feedback.
9. Displays a simple daily Decision Score.
10. Works locally and deployed to Vercel, as a mobile-first PWA.

Hypothesis under test: using calendar context, can the system recommend timely actions that improve the user's daily decisions?

Do not build unrelated features — see `03_PRODUCT_PRINCIPLES.md`'s explicit constraints.

## Technology

- Next.js App Router, Server Components by default, Client Components only where browser interaction requires them.
- TypeScript, Tailwind CSS.
- Supabase: Auth, PostgreSQL, Row Level Security.
- Google Calendar API + Google OAuth 2.0 (official Node.js client), server-side only.
- Vercel deployment; mobile-first PWA.
- Interchangeable AI provider abstraction (`08_AI_ARCHITECTURE.md`).
- Route Handlers under `app/api` for all server-side integrations. Secrets, refresh tokens, and service-role credentials never reach the browser.

## Routes

- **`/`** — unauthenticated: product intro + sign-in. Authenticated: redirect to `/today`.
- **`/onboarding`** — collects preferred name, timezone, current identity, desired identity, primary objective, training days, preferred training time, dinner time, sleep time, constraints, tone. Objectives: rebuild fitness, lose weight, train consistently, improve nutrition, improve sleep. Persist to Supabase.
- **`/today`** — header (date, name, calendar connection state, regenerate action); minimal chronological calendar event list (not a full calendar UI); exactly three decision cards (title, reason, recommended action, recommended time, domain, impact level, confidence, status — `proposed`/`accepted`/`completed`/`skipped`/`edited`; actions Accept/Complete/Skip/Edit/Add to Calendar); simple Decision Score, no charts.
- **`/history`** — recent decisions grouped by day: decision, status, domain, recommended time, feedback. Simple list.
- **`/settings`** — profile update, connect/disconnect Google Calendar, calendar selection for interventions, timezone, default reminder minutes, delete stored Google tokens, sign out.

## Google Calendar integration

Server-side OAuth 2.0 only:

1. Request minimum calendar permissions.
2. Obtain offline access.
3. Store access/refresh tokens securely (service-role only).
4. Refresh expired access tokens.
5. Read today's events.
6. Detect busy periods.
7. Calculate free windows.
8. Create intervention events only on explicit user request.
9. Add a popup reminder to intervention events.
10. Disconnect cleanly and revoke/delete stored credentials.

Route Handlers: `/api/google/connect`, `/api/google/callback`, `/api/google/disconnect`, `/api/calendar/today`, `/api/calendar/create-intervention`.

Explicit timezone handling throughout; default `Europe/Lisbon`, user-configurable. Intervention events: clear title (e.g. `Rebuild: Treino ao almoço`), short action-oriented description, start/end time, popup reminder, metadata marking the event as app-created.

## Relationship to the previous local-only slice

The repo previously shipped a no-auth, localStorage-only vertical slice (onboarding, check-in, day-type/state-aware decisions, Decision Score, in-app reminder, mock-capable AI coach). Per instruction, do not replace working code unnecessarily:

- Decision types, prioritization concepts, and the AI-provider adapter pattern (mock/live fallback) carry forward into the decision engine.
- Storage moves from `localStorage` to Supabase — required by auth and cross-device persistence, not incidental churn.
- `/`, `/onboarding` are extended (not thrown away) to the routes above; the old `/api/coach` is superseded by the decision engine's AI integration.
