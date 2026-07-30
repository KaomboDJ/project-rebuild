# Project Rebuild

An AI-powered Decision Operating System. See `FOUNDER_CONTEXT.md`, `PROJECT_REBUILD_STATE.md`, and `REBUILD_MASTER_HANDOFF.md` for product context, and `docs/` for the MVP's detailed spec — read `docs/IMPLEMENTATION_STATUS.md` first to see exactly what's built.

## Current state — MVP complete, in Founder Pilot

All eight MVP milestones (`docs/12_ROADMAP.md`) are built, validated, and deployed:

- Supabase Auth (email magic link), route protection, onboarding that persists to `profiles`.
- Google Calendar OAuth connect/disconnect, encrypted token storage, timezone-aware event reads.
- A deterministic decision engine (14-rule catalog + AI refinement) that generates exactly three calendar-aware decisions a day, with accept/edit/complete/skip and explicit "Útil / Não útil" feedback.
- "Adicionar ao calendário" for accepted decisions, a day/week/month `/calendar` view, and a real `/history` page.
- Installable as a PWA (manifest, icons, service worker).

The app is now in a 14-day Founder Pilot: real daily usage by the founder to validate whether it measurably improves decisions, before any new module is built. See `PROJECT_REBUILD_STATE.md` for the pilot protocol and `docs/IMPLEMENTATION_STATUS.md` for full build/validation history.

**Founder-approved exception (2026-07-30):** a Coach UX rework and a pantry/shopping-list module shipped mid-pilot on branch `calendar-workspace` — a deliberate, one-off override of the pilot's "no new modules" rule, not a resumption of general feature work. See `docs/12_ROADMAP.md`'s "Founder Pilot" section and `docs/IMPLEMENTATION_STATUS.md`'s "Coach UX + Pantry Intelligence milestone" section for what shipped: a three-state Coach (compact drawer / expanded drawer / full `/coach` page) with persisted history and Markdown rendering, and pantry/shopping tracking (`/nutrition`) the Coach can read and propose changes to — every proposed change requires explicit confirmation before it executes.

## Setup

```
npm install
cp .env.example .env.local
npm run dev
```

Without any Supabase environment variables set, `/` shows a "foundation ready to connect" message instead of the sign-in form, and `/today`/`/history`/`/settings`/`/calendar` are inaccessible (middleware has nothing to authenticate against). To run the full app locally:

- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` — create a Supabase project and apply `supabase/migrations/*.sql` in order (Supabase CLI `db push`, or paste each into the SQL editor).
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI` — a Google Cloud OAuth client with the `calendar.events` scope, for Google Calendar integration.
- `TOKEN_ENCRYPTION_KEY` — a base64 string decoding to exactly 32 bytes (`node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`), used to encrypt calendar tokens at rest.
- `ANTHROPIC_API_KEY` — powers both the Decision Coach (`/api/coach`) and the decision engine's AI refinement step. Without it, the Coach falls back to a mock response and the engine falls back to its deterministic rule output — the app still works fully either way.

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

GitHub: `KaomboDJ/project-rebuild`, branch `main`. Vercel auto-deploys pushes to `main` — production is live at `https://project-rebuild-chi.vercel.app`. Set the same environment variables listed above in the Vercel project settings (Production + Preview).
