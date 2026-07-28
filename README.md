# Project Rebuild

Decision Operating System — first end-to-end vertical slice. See `FOUNDER_CONTEXT.md` and `PROJECT_REBUILD_STATE.md` for product context.

## Scope of this slice

- One-time onboarding (identity, constraints, coaching tone).
- Daily check-in (sleep, energy, stress, recovery flag) → derives an operating state.
- Three prioritized decisions per day, seeded from the founder's real decision moments.
- Complete/skip with a reason.
- A simple Decision Score.
- One in-app reminder (lunchtime training).
- A Decision Coach backed by the Anthropic API behind a provider adapter (`lib/ai/provider.ts`), with a mock fallback when `ANTHROPIC_API_KEY` isn't set.

No login/database yet — state lives in the browser's `localStorage`. Supabase is deferred until multi-device or server persistence is actually needed.

## Setup

```
npm install
cp .env.example .env.local   # add ANTHROPIC_API_KEY
npm run dev
```

Open http://localhost:3000 — first load redirects to `/onboarding`.

## Tests

```
npm test
```

Covers operating-state derivation, decision prioritization, and the Decision Score.

## Deploying

Push to a Git repo connected to Vercel, or run `vercel`. Set `ANTHROPIC_API_KEY` (and optionally `ANTHROPIC_MODEL`, default `claude-sonnet-5`) as a Vercel environment variable — without it, the coach falls back to a mock response so the rest of the app still works.
