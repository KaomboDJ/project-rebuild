# Phase 1 Release Closure

Status: released to production from merge commit `f0fe3a1` on 12 August 2026.

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

Release evidence from PR #11 and production:

- GitHub CI lint, typecheck, unit tests and production build: successful.
- GitHub Android companion lint, unit tests and debug build: successful.
- GitHub web dependency scan, secret scan and CodeQL analysis: successful.
- Vercel Preview: Ready; landing page, privacy page and protected cron route
  were smoke-tested without touching founder data.
- Vercel Production deployment `dpl_2LyiBaU451AGJauNTFPXwHVuziV3`: Ready;
  canonical alias `project-rebuild-chi.vercel.app` active.
- Production cron endpoint rejects missing credentials with `401`, while the
  Preview (which deliberately lacks the Production-only secret) fails closed.
- The first post-deploy Supabase Cron execution at `2026-08-12 17:30 UTC`
  succeeded and its HTTP callback returned `200`, confirming that the
  Production Vercel secret and Supabase Vault secret match.

The current PR workflow deliberately skipped Playwright/Axe because the
production Supabase `service_role` key is not stored as a GitHub repository
secret. This is a security-preserving exception, not a claimed test pass. The
same browser suite was green on the preceding production baseline, while this
release's new behavior is covered by unit, Android, build, security and manual
Preview/Production checks. Future destructive E2E should use a dedicated test
Supabase project rather than reintroducing a production administrative key.

A signed Android APK remains a separate distribution gate: physical-device
validation, protected signing credentials and scanning the exact signed
artifact are mandatory before it is shared with friends.

## Deliberate limits

No diagnosis, opaque ML, location tracking, social feed, food-photo recognition,
barcode scanning, full calendar replacement or direct vendor-by-vendor wearable
integration is part of this release. Xiaomi data should enter through Health
Connect when the Xiaomi app/device exposes it there.
