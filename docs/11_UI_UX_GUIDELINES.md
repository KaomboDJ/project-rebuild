# 11 — UI/UX Guidelines

## Tone

Calm, dark, minimal — matches the existing Tailwind setup (`bg-neutral-950`, `text-neutral-100`, rounded `neutral-800`-bordered cards, `emerald-600` primary action, `amber` for reminders). Mobile-first single column, `max-w-xl`. Extend this system; don't redesign it.

## Guiding rule

One next action, visible without scrolling where possible. The product should feel like it already thought ahead, not like another dashboard to manage.

## `/home` layout

`/home` is the authenticated landing page and the planning surface. It compiles the whole day into one chronological agenda: fixed calendar events, free windows, planned meals, training/recovery actions and the three decisions. It owns “Planear o meu dia”, review, confirmation and conflict recovery. Show one next action near the top; do not make the founder reconstruct the day across modules.

## `/today` layout

`/today` is the Decisions execution/evaluation surface, not a second planner. It may show calendar context and the same three decisions, but batch plan creation and confirmation belong to `/home`. A compact plan-status banner links back to Home when review is needed.

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
- Every authenticated page includes a visually-hidden-until-focused "Saltar para o conteúdo" skip link (see `components/AppShell.tsx`) as the first focusable element, and DOM/tab order must match visual reading order — primary navigation before page content, not after (docs/17_UX_AUDIT.md, J1).
- Any slide-over/drawer must use the shared `components/ui/Drawer.tsx` shell: opaque background (never `surface-card`'s translucent treatment for a drawer panel), closes on Escape, traps focus while open, restores focus to its trigger on close (docs/17_UX_AUDIT.md, J3-a/J3-b).
- Any count or label reused across screens (e.g. pantry size) must come from one named, shared selector (`lib/pantry/selectors.ts` is the existing example) rather than each screen re-deriving a similar-but-not-quite filter — don't force one number when the underlying concepts genuinely differ, but do name and share the selector once they're pinned down (docs/17_UX_AUDIT.md, N2).
- Portuguese counts must use real singular/plural text (`lib/format/pluralizePt`), never a literal "item(ns)"-style bracket.

## Contextual help (lightweight foundation only)

Added in the UX Hardening release (docs/17_UX_AUDIT.md, §4/§10) as a deliberately small foundation — not the full six-layer "Rebuild Guide" that file specifies for a later release.

- `components/ui/HelpTip.tsx`: a small info-icon popover for a genuinely unfamiliar concept (Decision Score, Regenerar, macro estimates, memory confidence, rule muting, destination/primary calendar account so far). Keyboard-focusable, opens on click/Enter (never hover-only), closes on Escape or on focus leaving it, restores focus to its trigger. Do not add one next to every field — only where a first-time user would otherwise have to guess.
- `components/ui/FirstUseCallout.tsx`: one short, dismissible callout per complex screen (Today/Calendar, Programar o meu dia, Nutrition, Pantry, Shopping, Memory so far), never a forced multi-step tour. Dismissal persists in `localStorage` per browser for now — a deliberate scope choice, not yet true per-account persistence.
- "Porquê esta sugestão?" on each decision card (`DecisionEngineCard.tsx`): a plain-language disclosure built only from data already on the `decisions` row (source, confidence, schedule reason, related pantry item) — never invented, never a re-ask of the AI provider for a justification.

## Explicitly avoid

Complex charts/graphs, multi-tab dashboards, gamification beyond the existing Decision Score, dense data tables, anything that turns "look at today" into "manage a system."
