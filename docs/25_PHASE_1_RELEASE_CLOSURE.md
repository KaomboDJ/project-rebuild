# Phase 1 Release Closure

Status: release candidate on `codex/phase1-release-closure`.

This document is the concise source of truth for the health-and-decisions
product requested by the founder. Historical milestone notes remain in the
repository for provenance, but they do not override this status.

## Complete product loop

- **Home and Decisions:** a sleep-aware daily agenda compiles selected calendar
  commitments, meals, training, free windows and exactly three prioritized
  decisions. External calendar changes always require explicit confirmation.
- **Unified calendar:** selected Google and read-only Outlook calendars share
  one availability model. Calendar titles and locations are opt-in per source;
  descriptions, attendees and attachments are never fetched.
- **Nutrition:** profile, pantry, seven-day plan, macros, shopping quantities,
  substitutions, execution and batch preparation form one continuous journey.
- **Guide and Coach:** the Guide explains the product; Coach reasons over the
  user's permitted context and proposes mutations for confirmation.
- **Identity:** Recomeço → Ritmo → Competidor → Atleta → Mentor uses completed
  decisions and active days, never weight or punishment.
- **Notifications:** opt-in Web Push covers the daily briefing, timed decisions
  and planned dinner preparation. A 15-minute Supabase Cron dispatcher is
  idempotent and sleep/wind-down is a hard quiet period.
- **Health bridge:** the provider-neutral server foundation and private Android
  Health Connect companion source are integrated. Health data keeps provenance,
  source-level coaching consent and user-controlled deletion.

## Operational activation

- Production Supabase contains the health bridge, companion security, timed
  notification scheduler and foreign-key performance indexes.
- `COMPANION_HMAC_KEY` and `NOTIFICATION_CRON_SECRET` are separate sensitive
  Production-only Vercel variables.
- Supabase Vault holds only the notification callback URL and matching scoped
  bearer secret; neither value is committed or printed.
- The scheduler invokes `/api/cron/notification-dispatch` every 15 minutes.
- VAPID credentials remain the Web Push transport and user opt-in remains
  mandatory per device.

## Release evidence

On the reconciled candidate tree:

- TypeScript: clean.
- ESLint: clean.
- Vitest: 492/492 passing across 59 files.
- Production build: successful (64 generated routes/pages).
- Secret scan: clean.
- Production dependency audit: zero vulnerabilities.
- Supabase security advisor: no error-level findings; four informational
  server-only tables deliberately expose no authenticated policies.
- Supabase performance advisor: all 14 missing foreign-key indexes resolved.

GitHub-hosted web E2E/Axe, Android CI, Vercel Preview and Production smoke
evidence are recorded after this branch is pushed. A signed Android APK remains
a separate distribution gate: physical-device validation, protected signing
credentials and scanning the exact signed artifact are mandatory before it is
shared with friends.

## Deliberate limits

No diagnosis, opaque ML, location tracking, social feed, food-photo recognition,
barcode scanning, full calendar replacement or direct vendor-by-vendor wearable
integration is part of this release. Xiaomi data should enter through Health
Connect when the Xiaomi app/device exposes it there.
