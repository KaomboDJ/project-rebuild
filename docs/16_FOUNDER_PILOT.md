# 16 — Founder Pilot (14 days)

Preparation only — no new product modules. Per `docs/12_ROADMAP.md`'s "Current phase: Founder Pilot" and the 2026-07-30/31 production-activation directive: with Milestones 12–14 operational (Milestone 13's cron confirmed executing successfully in production), the open question is not "what else to build" but whether the calendar-aware decision loop, meal planning, pantry/shopping tracking, and Coach actually improve real decisions for the founder. This pilot is a usage-and-measurement period.

## Window

Start: 2026-07-31. End: 2026-08-13 (14 days). Adjust in this file if the actual start slips.

## What is being validated

Each dimension below is observed, not engineered during the pilot — if the pilot itself surfaces a blocking bug, fix the bug; do not add scope.

1. **Daily Planner usage** — is "Programar o meu dia" actually used, and does it produce a day the founder follows?
2. **Meal-plan usefulness** — are the 7-day planner's suggested meals realistic given what's actually in the pantry, and are they eaten as planned?
3. **Pantry accuracy** — does the pantry's tracked inventory match what's really in the kitchen (manual entry + auto-consume on decision completion)?
4. **Shopping-list accuracy** — does the generated shopping list match what's actually needed, without major manual correction?
5. **Coach grounding** — when the founder asks the Coach something, are its answers grounded in real pantry/shopping/decision state (via its tool-calling), not generic advice?
6. **Automation usefulness** — does the daily cron-generated briefing/decisions arrive in a form the founder actually opens and acts on, given the current once-daily full-poll (no incremental sync, no push notifications) constraints?
7. **Ignored vs. completed decisions** — of the three daily decisions, how many are accepted/completed vs. skipped vs. left untouched, and is there a pattern (time of day, domain, rule) to which get ignored?
8. **Detected patterns and memory corrections** — does the Milestone 14 pattern engine's rule insights match the founder's own sense of what's working, and are founder-authored notes/mutes at `/settings/memory` actually needed and used?

## Logging

Use `/history` (decision-level accept/complete/skip + feedback, already built) as the primary record — it requires no new tooling. For the four dimensions `/history` doesn't cover directly (pantry accuracy, shopping-list accuracy, Coach grounding, meal-plan usefulness), keep informal day-to-day notes anywhere convenient (founder notes in `/settings/memory`, or outside the app); a dedicated tracking UI is explicitly not being built for this — that would be scope creep.

## End-of-pilot review

At day 14, revisit each of the 8 dimensions above against what actually happened (via `/history`, `/settings/memory` notes, and the founder's own recollection). Per `docs/12_ROADMAP.md`: if the loop demonstrates value, move to Nutrition Toolkit v0.1 items still on `PRODUCT_BACKLOG.md`; if not, improve timing/rules/relevance of the existing engine before adding anything. Learned/adaptive prediction beyond Milestone 14's bounded pattern engine stays deferred either way.
