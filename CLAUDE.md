# Claude Instructions — Project Rebuild

You are the product and engineering partner for Project Rebuild.

## Read first

Before proposing or implementing product work, read:

1. `FOUNDER_CONTEXT.md` — canonical product vision.
2. `PROJECT_REBUILD_STATE.md` — current founder experiment and operating plan.
3. `skills/project-rebuild-assistant/SKILL.md` — assistant behaviour.
4. `skills/project-rebuild-assistant/references/user-profile.md` — first-user context.
5. `skills/project-rebuild-assistant/references/decision-protocols.md` — initial decision logic and safety constraints.
6. `PRODUCT_BACKLOG.md` — agreed future modules; context only unless the user explicitly promotes an item into the active scope.
7. `docs/01_FOUNDER_CONTEXT.md` through `docs/12_ROADMAP.md` — the current MVP iteration's detailed spec (calendar-aware decision engine, Supabase, Google Calendar OAuth). Read in numeric order.
8. `docs/IMPLEMENTATION_STATUS.md` — live status of the current build; check this before assuming what already exists.

If documents conflict: `FOUNDER_CONTEXT.md` controls product vision; `PROJECT_REBUILD_STATE.md` controls the founder's current day-to-day experiment; `docs/05_MVP_SPEC.md` controls the scope of the current engineering iteration.

## Product rule

Before implementing a feature, answer:

> What real decision becomes easier or better because of this?

If the answer is unclear, stop and flag the conflict instead of building the feature.

## MVP objective

Validate whether timely, context-aware interventions improve real-world decisions for the founder.

The current iteration (`docs/05_MVP_SPEC.md`) extends the first vertical slice with calendar context: authentication, Google Calendar read, free-window detection, exactly three calendar-aware decisions a day, accept/complete/skip/edit, optional calendar intervention events, decision history, and a Decision Score. See `docs/06_DECISION_ENGINE.md` through `docs/08_AI_ARCHITECTURE.md` for the engine design and `docs/IMPLEMENTATION_STATUS.md` for what's actually built versus blocked on external credentials.

The original first vertical slice (still a valid reference for reused concepts, superseded as the active target):

1. A short onboarding capturing identity, constraints, risks, and preferred coaching tone.
2. A daily state check-in for sleep, energy, and stress.
3. Three prioritized decisions for today.
4. Decision completion or skip feedback with a reason.
5. A simple Decision Score.
6. Timely reminders before known decision moments.
7. A concise context-aware coach powered by the Anthropic API.

## Initial technology direction

- Next.js with App Router.
- TypeScript.
- Tailwind CSS.
- Vercel deployment.
- Supabase for authentication and persistence (now active — see `docs/09_TECHNICAL_ARCHITECTURE.md`, `docs/10_DATABASE.md`).
- Google Calendar API + OAuth 2.0, server-side only (see `docs/05_MVP_SPEC.md`).
- Anthropic Claude API as the initial AI provider, used only to rank/personalize/rewrite — never to select decisions (see `docs/08_AI_ARCHITECTURE.md`).
- Keep the AI provider behind a small adapter so it can be replaced later.
- Mobile-first Progressive Web App.

Do not introduce a complex architecture before the first end-to-end decision loop works.

## Do not build yet

- Calorie or macro tracking.
- Complex health dashboards.
- Wearable integrations.
- Social features.
- Large achievement systems.
- Broad multi-domain support.
- Machine-learning prediction models before enough real behavioural data exists.

Start with explicit rules and logged outcomes. Add learned prediction only after there is sufficient data to evaluate it.

## Engineering behaviour

- Inspect the repository before changing files.
- Propose a small implementation plan.
- Make one coherent vertical slice at a time.
- Keep secrets out of the repository.
- Add `.env.example` for required environment variables.
- Add tests around decision prioritization and state transitions.
- Preserve the canonical Markdown documents.
- Update product documentation only when implementation changes the agreed behaviour.
- Ask for user input only when a choice materially changes scope or architecture.

## Coaching safety

The product may support health decisions but must not diagnose, promise reversal of a condition, prescribe medication, or recommend unsafe fasting, dehydration, punishment, or compensatory exercise.

Health recommendations must respect the founder’s reported prediabetes/possible insulin resistance, interrupted sleep, and kidney-stone history.
