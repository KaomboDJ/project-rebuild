# Implementation Status

Living status tracker. Check this before assuming what already exists — `docs/` design files describe target architecture, not necessarily what's built yet. Update this file as milestones progress.

Last updated: 2026-07-29.

## Deployment (corrects an earlier, now-stale entry in this file)

- **GitHub**: `https://github.com/KaomboDJ/project-rebuild.git`, branch `main`, latest published commit `9bde8e2`. The current working tree has substantial uncommitted Milestone 1 work not yet pushed (see below).
- **Vercel**: **production is live** at `https://project-rebuild-chi.vercel.app`, auto-deploying pushes to `main`. An earlier version of this file said Vercel was blocked by a 403 permission error — that was resolved; do not treat deployment as blocked.
- **Anthropic**: credentials already exist locally (`.env.local`) and in Vercel, for the existing Decision Coach (`lib/ai/provider.ts`). Never printed, committed, or logged.

## Known external-credential gaps (block Milestones 2–3+, not Milestone 1 foundation work)

- **Supabase project** — not yet created. Auth/schema/client code is written and structurally sound but cannot run end-to-end (sign-in, migration apply, RLS verification) until `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` exist and are set locally + in Vercel.
- **Google Cloud OAuth client** — not yet created. Blocks Milestone 3 entirely (`GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET`/`GOOGLE_REDIRECT_URI`).
- **`TOKEN_ENCRYPTION_KEY`** — not yet generated; needed before `calendar_connections` can store real tokens.

## Milestone 1 — Foundation

| Item | Status | Notes |
|---|---|---|
| Inspect repository | Done | |
| Documentation (`docs/01`–`12`, this file) | Done | Corrected in this pass to match the actually-implemented schema (`calendar_connections`, `decision_runs`, `decisions` with `confidence`/`source` columns, `decision_feedback`), not an earlier invented one. |
| Next.js App Router / TypeScript / Tailwind | Validated | Existing scaffold from the first vertical slice, extended. |
| Supabase client utilities | Done | `lib/supabase/client.ts` (browser), `server.ts` (Server Components/Actions), `admin.ts` (service-role), `middleware.ts` (session refresh) — all degrade to `null`/no-op when unconfigured rather than throwing. |
| Database migrations | Done (not applied) | `supabase/migrations/202607290001_foundation.sql` — 6 tables, full RLS, indexes, `updated_at` triggers. Structurally reviewed; cannot be applied/verified against a live database without a Supabase project (see gaps above). |
| Authentication foundation | Done | Email magic-link via `app/auth/actions.ts` (`signInWithMagicLink`, `signOut`), `app/auth/callback/route.ts`, `check-email`/`error` landing pages. |
| Application shell | Done | `app/(app)/layout.tsx` (server-side auth re-check) + `components/AppShell.tsx` (nav: Hoje/Histórico/Definições). |
| Route protection | Done | Root `middleware.ts` → `lib/supabase/middleware.ts::updateSupabaseSession` redirects unauthenticated requests away from `/today`, `/history`, `/settings`, `/onboarding`. Defense in depth via the `(app)` layout's own server-side check. |
| `/today`, `/history`, `/settings` routes | Done (functionally placeholder) | `/today` renders the pre-existing local-only decision UI (`TodayExperience`) inside the new authenticated shell — a deliberate bridge, not yet Supabase-backed. `/history` and `/settings` are minimal placeholders pending Milestones 2/4+. |
| `.env.example` | Done (this pass) | Now matches `lib/env/public.ts` + `lib/env/server.ts`'s zod schemas. |
| Environment validation | Done | `lib/env/public.ts` (safe, non-throwing), `lib/env/server.ts` (throws only when a privileged op needs a missing secret). |
| Lint / format / type-check config | Done (this pass) | `eslint.config.mjs` (flat config, `eslint-config-next`), `.prettierrc.json` added — `eslint`/`eslint-config-next`/`prettier` were already devDependencies but had no config files. |
| README | Done (this pass) | Updated to describe Supabase auth setup instead of the old "no login/database yet" statement. |

## Milestones 2–8

Not started. See `12_ROADMAP.md` for scope and explicit ordering; do not begin Milestone 3 (Google Calendar) or the Nutrition Toolkit backlog before Milestone 1 is committed and Milestone 2 is underway, per `REBUILD_MASTER_HANDOFF.md`.

## What's usable today without any external credential

Everything under "Milestone 1" above is code-complete and structurally reviewed. What it cannot do without credentials: actually authenticate a user (needs a live Supabase project) or apply/verify the migration and RLS policies against a real database. The existing local-only decision UI (`/today` bridge, `/onboarding`) and Decision Coach (`/api/coach`) continue to work exactly as before, using `ANTHROPIC_API_KEY` already configured.

## Working-tree note

As of this update, `CLAUDE.md`, `package.json`/`package-lock.json`, `app/page.tsx`, and everything listed as "Done" above under Milestone 1 are **uncommitted**. Nothing has been pushed to `main` or deployed — per instruction, do not push/deploy without explicit approval.
