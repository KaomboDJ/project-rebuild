# Phase 1 — Health and Decision Product Completion

Status: implemented on `codex/phase1-health-completion`.

This document is the scope boundary for the first complete product phase of
Project Rebuild. The product is a health and decision system for busy parents
and former athletes. Phase 1 is complete when the five capabilities below are
available as one coherent experience. Work outside these capabilities is
future scope.

## 1. Unified calendar

- Google and Microsoft/Outlook events are normalized into one read-only
  availability model.
- A user can include or ignore individual calendars in Settings.
- Decisions, daily planning, free-window discovery, replanning and Coach
  context use the selected calendars together.
- A conflicting training or meal suggestion is never moved silently. Rebuild
  proposes a free slot and requires explicit confirmation before writing a
  Google Calendar event.
- Outlook remains read-only. Google remains the explicit calendar-write path.

Operational dependency: Outlook activation requires a Microsoft Entra app and
the four `MICROSOFT_*` environment variables. Without them, the Outlook option
stays dormant and Google continues to work normally.

## 2. Notifications and timely intervention

- Web Push is opt-in per device and never requested automatically.
- Notification preferences cover daily briefing, decisions and nutrition.
- The daily automation can send an idempotent briefing through Web Push.
- Timed accepted decisions retain their Google Calendar reminders; the app
  also keeps its in-app due reminder.
- Wind-down and habitual sleep windows are hard quiet hours. Rebuild does not
  send stimulating prompts or suggest walking/training during those windows.
- iPhone copy explains that Web Push requires the installed home-screen PWA.

Operational dependency: Web Push requires `VAPID_PUBLIC_KEY`,
`VAPID_PRIVATE_KEY` and `VAPID_SUBJECT` in the deployment environment. The
existing Vercel Hobby cron runs once daily; more frequent server-side delivery
requires an external scheduler invoking the protected cron endpoint.

## 3. Nutrition finish

- The nutrition journey remains one low-friction scroll: profile, pantry,
  weekly plan and shopping list, with clear progress and next actions.
- Planning supports 2, 3 or 4 meals per day.
- Modes: Decide for me, Simple rotation and Flexible week.
- Shopping quantities are recalculated for the linked seven-day plan and
  updated after meal replacement or execution.
- Pantry consumption, meal execution, macro estimates and Coach context remain
  connected.
- The weekly plan surfaces a deterministic batch-preparation order so the user
  can prepare the highest-leverage items first.

## 4. Rebuild Guide

- A global `?` assistant explains the current screen, the next useful action
  and relevant destinations.
- It is deliberately separate from Coach: the Guide explains the product;
  Coach helps with a personal decision.
- It is keyboard accessible, closes with Escape and includes first-use help.

## 5. Identity progression

- The identity path is Recomeço → Ritmo → Competidor → Atleta → Mentor.
- Progress uses completed-decision XP and distinct active days, not body weight.
- Skipping a decision never removes XP and never creates fake progress.
- Home shows the compact next-level view; History shows the fuller progression.

## Sleep-aware decision safety

Onboarding and Settings capture habitual weekday and optional weekend wake and
sleep times, wind-down length and regular/shift schedule type. The Decision
Engine, Home timeline and Coach share this model.

At 02:00, a regular-schedule user is offered a sleep/close-the-day action, not
a walk. Shift workers are evaluated against their own configured sleep window.
The product may explain that a consistent earlier bedtime (for example before
23:00 when compatible with the user's life) can be a useful target, but it
must not present 23:00 as a universal medical rule.

## Explicitly outside Phase 1

Native mobile apps, wearables, location tracking, social/community features,
food-photo recognition, barcode scanning, a full calendar replacement and
opaque predictive ML are not part of this phase. They must not delay or expand
the release described here.

## Release gates

Before merge and production activation:

1. lint and TypeScript pass;
2. all unit tests pass;
3. production build passes;
4. additive database migrations are applied;
5. required VAPID secrets are configured without being committed;
6. CI and production smoke tests are green;
7. Outlook is labelled dormant until real Microsoft credentials exist.
