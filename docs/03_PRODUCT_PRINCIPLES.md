# 03 — Product Principles

## Canonical product rule

Before implementing any feature, ask: **what real decision becomes easier or better because of this?** If the answer is unclear, do not build it.

## Core principles

1. **Decision First** — every feature must improve a real decision.
2. **One Next Action** — never overwhelm the user with a long list. Exactly three decisions a day, not more.
3. **Context Beats Data** — recommendations must reflect the user's current state (calendar, sleep, energy, constraints), not raw numbers alone.
4. **Identity Before Goals** — reinforce who the user is rebuilding, not only numeric targets.
5. **Systems Over Motivation** — reduce dependence on willpower.
6. **Automatic Before Manual** — automate repeated context and timing wherever practical (this is why calendar integration exists).
7. **Minimum Friction** — actions should take seconds, not become administrative work.
8. **Adaptive Intelligence** — learn which contexts, interventions, and language produce action, over time and with enough data.
9. **No Shame** — diagnose system failures; never punish the user. Skipped decisions are data, not failure.
10. **Sustainable in Real Life** — the system must work on difficult days, not only ideal ones.

## Product philosophy

- **Identity before outcomes** — people want to become someone they recognize again, not just hit a number.
- **Decision before habit** — habits are the result; decisions are the cause.
- **Reduce cognitive load** — the product should simplify life, not add another system to manage.
- **Progress over perfection** — missing one action is acceptable; abandoning the next aligned decision is not. Redirect without punishing or demanding compensation.
- **Family and sustainability** — the system must work after poor sleep, during demanding workdays, and around real family priorities. A reduced action is better than a cancelled identity.

## Explicit engineering constraints (current MVP)

- Deterministic rules decide *which* decisions to show; AI is used only to rank, personalize, and rewrite — never to invent facts, times, or actions the rules didn't produce.
- The app must continue working if the AI provider fails (fallback to rule-generated plain text).
- Never create calendar events without explicit user action.
- Never expose OAuth tokens or secrets to the browser.
- Row Level Security on all user data.
- Do not build: calorie/macro tracking, complex dashboards, wearable integrations, social features, large achievement systems, nutrition/recipes, or ML-based prediction before there is enough logged behavioral data to evaluate it.
