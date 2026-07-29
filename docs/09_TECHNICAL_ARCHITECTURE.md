# 09 — Technical Architecture

## Stack

Next.js (App Router) · TypeScript · Tailwind CSS · Supabase (Auth + Postgres + RLS) · Google Calendar API + OAuth 2.0 · Vercel · mobile-first PWA · Zod for environment/schema validation.

## Rendering model

- Server Components by default.
- Client Components only where browser interaction requires them (forms, decision-card actions, calendar-connect button, PWA install prompt).
- All third-party API calls (Supabase service-role queries, Google token exchange/refresh, calendar reads/writes, AI provider calls) happen in Route Handlers under `app/api/**`, Server Actions under `app/**/actions.ts`, or server-only modules (`import "server-only"`) — never in Client Components, never shipped to the browser bundle.

## Folder structure (as actually implemented — update this section if it drifts)

```
app/
  layout.tsx                        (existing, root layout)
  page.tsx                          (auth-aware landing: magic-link sign-in, or redirect to /today if already signed in)
  onboarding/page.tsx                (still the localStorage-based slice; Supabase migration is Milestone 2)
  auth/
    actions.ts                       — signInWithMagicLink, signOut (Server Actions)
    callback/route.ts                — exchanges the magic-link code for a session
    check-email/page.tsx             — "check your email" landing after requesting a magic link
    error/page.tsx                   — auth error landing, keyed by ?code=
  (app)/                             — route group: everything behind the authenticated shell
    layout.tsx                       — re-checks auth server-side, wraps children in <AppShell>
    today/page.tsx                   — renders <TodayExperience> (still the local-storage bridge, see below)
    history/page.tsx                 — placeholder until decision persistence lands (Milestone 4+)
    settings/page.tsx                — session info + sign out; profile/calendar settings land later
  api/
    coach/route.ts                   (existing — the standalone Decision Coach chat, kept as-is)
    google/                          (Milestone 3, not yet implemented)
      connect/route.ts
      callback/route.ts
      disconnect/route.ts
    calendar/                        (Milestone 3, not yet implemented)
      today/route.ts
      create-intervention/route.ts
    decisions/                       (Milestone 4+, not yet implemented)
      generate/route.ts
      [id]/route.ts
lib/
  env/
    public.ts                        — zod schema + safe getters for NEXT_PUBLIC_* vars; isSupabaseConfigured()
    server.ts                        — zod schema for server-only vars; requireSupabaseServerEnvironment()
  supabase/
    client.ts                        — browser client (anon key only), returns null if unconfigured
    server.ts                        — server client for Server Components/Actions (cookies-based session)
    admin.ts                         — service-role client for privileged server-only operations
    middleware.ts                    — updateSupabaseSession(), used by root middleware.ts
    database.types.ts                — hand-maintained types mirroring supabase/migrations/*.sql
  decision-engine/                   (Milestone 4+, not yet implemented — see 06_DECISION_ENGINE.md)
  google/                            (Milestone 3, not yet implemented)
  ai/provider.ts                     (existing — Decision Coach provider adapter, unrelated to the future decision-engine AIProvider)
  decisions/, date/, storage/         (existing — the local-only slice; still used by the /today bridge, retired as Supabase persistence lands)
middleware.ts                        — root middleware, delegates to lib/supabase/middleware.ts; protects /today, /history, /settings, /onboarding
supabase/
  migrations/
    202607290001_foundation.sql      — profiles, calendar_connections, daily_check_ins, decision_runs, decisions, decision_feedback + RLS (see 10_DATABASE.md)
components/
  AppShell.tsx                        — authenticated-area header/nav
  TodayExperience.tsx                 — the local-storage bridge (see below)
  CheckIn.tsx, DecisionCard.tsx, DecisionScore.tsx, ReminderBanner.tsx, OnboardingForm.tsx, CoachPanel.tsx  (existing, from the local-only slice)
public/
  manifest.webmanifest                (Milestone 8, not yet added)
```

## The local-storage bridge

`components/TodayExperience.tsx` (rendered by `app/(app)/today/page.tsx`) is intentionally still the original localStorage-based onboarding/check-in/decisions UI from the first vertical slice, running *inside* the now-Supabase-authenticated `(app)` route group. This is a deliberate Milestone 1→2 seam, not an oversight: the authenticated shell and route protection are real (Supabase), but profile/check-in/decision data is not yet persisted there. `app/onboarding/page.tsx` is the same situation. Migrating this data flow to `profiles`/`daily_check_ins`/`decisions` is Milestone 2 (onboarding) and Milestone 4+ (decisions), not Milestone 1.

## Environment variables

```
NEXT_PUBLIC_APP_URL=                # default http://localhost:3000
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=          # server-only, never NEXT_PUBLIC_
GOOGLE_CLIENT_ID=                   # server-only
GOOGLE_CLIENT_SECRET=               # server-only
GOOGLE_REDIRECT_URI=
TOKEN_ENCRYPTION_KEY=               # server-only, >=32 chars, encrypts calendar_connections tokens at rest
AI_PROVIDER=anthropic               # "anthropic" | "mock"
AI_API_KEY=                         # generic alias some routes may read instead of ANTHROPIC_API_KEY
ANTHROPIC_API_KEY=                  # used by the existing Decision Coach (lib/ai/provider.ts)
ANTHROPIC_MODEL=claude-sonnet-5
CRON_SECRET=                        # server-only, for any future scheduled regeneration route
```

Validated by `lib/env/public.ts` (zod, safe — returns `null`/`false` instead of throwing when unset, so the app degrades gracefully) and `lib/env/server.ts` (zod, throws via `requireSupabaseServerEnvironment()` only when a privileged operation actually needs the service-role key).

## Auth flow

Supabase Auth via email magic link (`supabase.auth.signInWithOtp`). `app/page.tsx` renders the sign-in form when unconfigured/unauthenticated, redirects to `/today` when a session exists. `app/auth/callback/route.ts` exchanges the code for a session. `middleware.ts` (via `lib/supabase/middleware.ts`) refreshes the session on every request and redirects unauthenticated requests to `/today`, `/history`, `/settings`, `/onboarding` back to `/`. `app/(app)/layout.tsx` re-checks auth server-side as defense in depth before rendering `<AppShell>`.

## Google token lifecycle (Milestone 3, not yet implemented)

1. `/api/google/connect` builds the OAuth consent URL (offline access, minimal calendar scope) and redirects.
2. `/api/google/callback` exchanges the code for tokens, encrypts them with `TOKEN_ENCRYPTION_KEY`, stores them in `calendar_connections` via `lib/supabase/admin.ts`.
3. A `lib/google/calendar.ts` module refreshes the access token transparently when expired.
4. `/api/google/disconnect` revokes the token with Google and deletes the stored row.

## PWA (Milestone 8, not yet implemented)

`public/manifest.webmanifest` (name, short_name, theme/background color matching the existing dark UI, icons, `display: standalone`), plus a minimal service worker for offline app-shell caching.

## Deployment

GitHub: `https://github.com/KaomboDJ/project-rebuild.git`, branch `main`, Vercel auto-deploys on push. **Production is already live** at `https://project-rebuild-chi.vercel.app` — do not treat Vercel deployment as blocked (an earlier session hit a since-resolved permission issue; see `IMPLEMENTATION_STATUS.md`). Anthropic credentials already exist locally and in Vercel. Supabase/Google environment variables above are not yet set anywhere — required before those features work in any environment.
