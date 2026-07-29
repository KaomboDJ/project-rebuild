# 11 — UI/UX Guidelines

## Tone

Calm, dark, minimal — matches the existing Tailwind setup (`bg-neutral-950`, `text-neutral-100`, rounded `neutral-800`-bordered cards, `emerald-600` primary action, `amber` for reminders). Mobile-first single column, `max-w-xl`. Extend this system; don't redesign it.

## Guiding rule

One next action, visible without scrolling where possible. The product should feel like it already thought ahead, not like another dashboard to manage.

## `/today` layout

1. Header: date, name, calendar connection state (small badge/icon), "regenerate decisions" as a text/icon action, not a prominent button — this is a recovery action, not the primary flow.
2. Calendar context: a short vertical list of today's events (time + title only). Not a grid, not a full calendar. If no events, show a one-line empty state, not an empty box.
3. Three decision cards, always exactly three. Each card:
   - Title (the phrased decision)
   - Reason (one line, why this, why now)
   - Recommended time
   - Domain (small label/icon — training/nutrition/sleep/recovery/work-life)
   - Impact + confidence (subtle, not the visual focus — e.g. a small dot/badge, not a chart)
   - Status-dependent actions: `proposed` → Accept, Skip, Edit; `accepted` → Complete, Skip, Add to Calendar; terminal states (`completed`/`skipped`/`edited`) → read-only summary line, same pattern as the existing `DecisionCard`'s completed/skipped display.
4. Decision Score: a single number with a max, same pattern as the existing `DecisionScoreView` — no charts, no history graph on this screen (that belongs on `/history` if ever needed, and even there: a list, not a chart).

## `/history`

A simple reverse-chronological list grouped by day: date header, then each day's decisions with status, domain, recommended time, and any feedback/skip reason. No calendar heatmap, no charts.

## `/settings`

Plain form sections, not a settings "dashboard": profile fields, calendar connection status with connect/disconnect, calendar picker, timezone, reminder minutes, a clearly-labeled destructive action for deleting stored Google tokens, sign out.

## Accessibility & PWA

- Sufficient contrast on the dark theme (already the case with `neutral-100` on `neutral-950`).
- Touch targets sized for mobile first (existing button padding is a reasonable baseline — keep it).
- PWA: standalone display, app icon, splash matches the dark theme background.

## Explicitly avoid

Complex charts/graphs, multi-tab dashboards, gamification beyond the existing Decision Score, dense data tables, anything that turns "look at today" into "manage a system."
