# Project Rebuild

An AI-powered Decision Operating System. See `FOUNDER_CONTEXT.md`, `PROJECT_REBUILD_STATE.md`, and `REBUILD_MASTER_HANDOFF.md` for product context, and `docs/` for the current MVP's detailed spec — read `docs/IMPLEMENTATION_STATUS.md` first to see what's actually built versus planned.

## Current state (Milestone 1 — Foundation)

- Supabase Auth (email magic link), route protection via middleware, an authenticated app shell (`/today`, `/history`, `/settings`).
- A database migration with full Row Level Security (`profiles`, `calendar_connections`, `daily_check_ins`, `decision_runs`, `decisions`, `decision_feedback`).
- The original local-only vertical slice (onboarding, check-in, day-type-aware decisions, Decision Score, in-app reminder, mock-capable Decision Coach) still runs inside the new authenticated shell as a bridge — profile/check-in/decision data isn't Supabase-persisted yet (Milestones 2/4+).
- Google Calendar integration is not yet implemented (Milestone 3).

## Setup

```
npm install
cp .env.example .env.local
npm run dev
```

Without any Supabase environment variables set, `/` shows a "foundation ready to connect" message instead of the sign-in form, and `/today`/`/history`/`/settings` are inaccessible (middleware has nothing to authenticate against). To exercise auth locally, create a Supabase project and set:

- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- Apply `supabase/migrations/202607290001_foundation.sql` (Supabase CLI `db push`, or paste into the SQL editor)

The Decision Coach (`/api/coach`) works independently of Supabase — set `ANTHROPIC_API_KEY` to get live responses; without it, it falls back to a mock response.

## Tests

```
npm test
```

## Lint, format, type-check

```
npm run lint
npm run typecheck
npm run format:check   # or `npm run format` to fix
```

## Deploying

GitHub: `KaomboDJ/project-rebuild`, branch `main`. Vercel auto-deploys pushes to `main` — production is live at `https://project-rebuild-chi.vercel.app`. Set the same environment variables listed above (plus Google OAuth vars once Milestone 3 lands) in the Vercel project settings.
