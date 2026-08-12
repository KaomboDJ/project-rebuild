# Consumer UX & Visual Maturity

Status: implementation complete on `codex/consumer-ux-visual-maturity`; awaiting visual approval and Preview validation before merge.

## Why this release exists

The product logic was already substantially more mature than its presentation. The interface still read as an internal dashboard: flat surfaces, dense information, too many equally weighted navigation choices and weak emotional feedback. That mismatch made the app feel harder and less rewarding than the decisions it was designed to simplify.

Foodvisor and other polished consumer-health products were used as a quality benchmark, not as assets or layouts to copy. Rebuild keeps its own dark identity and Decision OS proposition while adopting the useful category conventions: immediate daily focus, warm progress feedback, visible momentum, visual hierarchy and touch-first navigation.

## Product principles applied

1. **One next action first.** Home leads with the next best decision instead of a dashboard of equal-priority cards.
2. **The whole day remains visible.** Calendar, meals, training and decisions form one visual timeline.
3. **Progress feels human.** XP, identity and completion progress are visible without punishment, streak anxiety or weight-based status.
4. **Mobile navigation is deliberately small.** The four most frequent destinations remain one tap away; secondary destinations live in an accessible “Mais” sheet.
5. **Nutrition is one journey.** Profile, pantry, weekly plan and shopping list remain four sections of a continuous workspace rather than disconnected dead ends.
6. **No copied product identity.** No Foodvisor branding, illustrations, copy, screenshots or proprietary interaction patterns are reproduced.

## What changed

- richer dark design tokens, depth, gradients, larger radii and consistent interactive states;
- redesigned desktop sidebar with clearer active state and identity progress;
- five-slot mobile dock: Início, Hoje, Coach, Alimentação and Mais;
- accessible secondary mobile menu for Treino, Histórico and Definições;
- new reusable accessible progress-ring component;
- Home rebuilt as a consumer-grade daily mission control with:
  - greeting and operating state;
  - next best decision;
  - decision progress;
  - agenda timeline;
  - calendar, nutrition and free-window summaries;
  - direct Coach, Nutrition and Training shortcuts;
- Nutrition landing rebuilt around one visible four-step journey and useful counts;
- richer identity progression card and completion feedback.

## Deliberate non-goals

- no changes to Decision Engine rules, health recommendations or scoring;
- no database migrations or new personal-data collection;
- no food-photo estimation, barcode scanning, social feed or forced streaks;
- no merge to Production before the founder reviews the Vercel Preview.

## Acceptance evidence

- TypeScript: clean.
- ESLint: clean.
- Vitest: 468/468 passing.
- Production build: successful.
- New Playwright coverage: consumer Home hierarchy, continuous Nutrition journey, mobile dock and keyboard-operated “Mais” sheet.
- Final GitHub-hosted Playwright/Axe and Vercel Preview evidence must be recorded before merge.
