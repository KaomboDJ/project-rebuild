# Project Rebuild — Current State

## Governance note — 2026-08-11 (calendar privacy boundary)

The founder authorized calendar privacy controls after asking whether the app reads event content or
only busy time. The product contract is now availability-only by default, with per-calendar opt-in
for title and location, provider-side field minimization, and a separate Google authorization for
creating Rebuild events. Descriptions, attendees and attachments remain outside the integration.
This hardening stays within the already-authorized unified-calendar scope.

## Governance note — 2026-08-03 (Phase 1 scope freeze)

The founder authorized completion and production release of Project Rebuild as
a health and decision product for busy parents/former athletes, limited to five
remaining areas: unified calendar, notifications, nutrition finish, application
guide and identity-based gamification. Sleep-aware quiet hours are a required
safety correction within that scope. Everything else is deferred and must not
expand Phase 1. The executable scope and release gates are recorded in
`docs/19_PHASE_1_HEALTH_COMPLETION.md`.

## Identity

**Sou um atleta em reconstrução.**

## Current objective

Rebuild physical capacity, reduce metabolic risk and visceral fat, move from approximately 101 kg toward the 91 kg functional milestone, and prepare for a sustainable return to martial arts without competing with family life.

## Current operating plan

- Protect three daytime training opportunities per week on remote-work days.
- Default session: approximately 30 minutes of P90X3/P90X-style training.
- Use Insanity Max:30 only when sleep and energy support it.
- Use walking or mobility on Survival days.
- Decide dinner before 18:00.
- Eat food available at home rather than ordering Uber Eats.
- Track weekly trends, not daily perfection.

## Current non-negotiable

> Mesmo num dia péssimo, janto comida que já existe em casa.

## Current experiment

Validate whether timely prompts improve these decisions:

1. Start the planned lunchtime workout.
2. Scale rather than cancel after poor sleep.
3. Decide dinner before evening fatigue.
4. Avoid unplanned takeout.
5. Close the kitchen after dinner without a late-night sweets episode.

## Governance note — 2026-07-30

The Founder Pilot (14 days, see `docs/12_ROADMAP.md`) is explicitly a usage-and-measurement period during which no new modules ship unless the pilot itself surfaces a blocking bug. On 2026-07-30 the founder proposed a pantry/shopping-list-aware Coach (full brief: "Project Rebuild — Coach UX and Pantry Intelligence Milestone"), was shown this conflict directly, and explicitly decided to override the gate for this one milestone rather than wait for pilot validation: **"Avançar já, atualizar a governance."**

This is recorded here, rather than silently building the feature or silently refusing it, so the pilot's "no new modules" rule stays meaningful for anything proposed after this: it is still the default, this was a deliberate, informed, founder-approved exception for this specific milestone, not a precedent that the rule no longer applies. See `docs/12_ROADMAP.md`'s "Founder Pilot" section for what shipped under this exception.

## Governance note — 2026-07-30 (full roadmap authorization)

Later the same day, the founder went further than the single Coach/Pantry exception above: he explicitly authorized the full remaining roadmap — Milestones 10 through 14 (release Coach UX + Pantry Intelligence; a Daily Planning Engine with multi-Google-account calendar support; the complete seven-day Nutrition Toolkit; continuous calendar sync and proactive interventions; and a privacy-conscious learning/personalization layer) — superseding the Founder Pilot's "no new modules" restriction for these specifically.

Before starting on this authorization, the founder was shown that the request was an order-of-magnitude larger scope than anything approved so far, delivered in a very different style from the rest of the conversation, and asked directly to confirm identity and preferred execution mode. He confirmed it was him and chose to proceed **milestone by milestone, with a check-in after each one** — not as one uninterrupted autonomous run through production merges and deploys. That means: each milestone (10, 11, 12, 13, 14) is built, validated, documented, and committed on its own; production migrations, branch merges, and Vercel production deploys each require a fresh explicit go-ahead, the same pattern already used for the Coach/Pantry milestone rather than a standing blanket authorization to merge/deploy unattended.

See `docs/12_ROADMAP.md`'s "Full roadmap authorization" section for the milestone list and current status, and `docs/IMPLEMENTATION_STATUS.md` for the live per-milestone tracker.

## Governance note — 2026-07-30 (standing go-ahead requirement lifted)

After Milestone 11A shipped, the founder explicitly lifted the per-milestone check-in requirement set in the note above: "please go through all of them... ignore the first order on getting a 'go ahead' from me and implement them all." This authorizes building, validating, migrating, merging, and deploying Milestones 11B through 14 continuously, without pausing for a fresh go-ahead before each production migration/merge/deploy.

This does not relax anything else in `CLAUDE.md`: the product rule (what real decision becomes easier?), the "do not build yet" list, coaching safety constraints, and the instruction to flag genuine architecture-or-scope conflicts still apply. Only the standing-authorization cadence changed — from "ask before each milestone's production step" to "proceed through the roadmap, still one coherent vertical slice at a time, still documented as it goes."

## Update rule

Update this file only when the baseline, current experiment, non-negotiable, or operating plan materially changes.
