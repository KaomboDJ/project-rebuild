# 20 — Health Data Bridge

Status: Milestone 16A implemented on `codex/health-data-bridge-foundation`;
database migration applied to production and verified on 2026-08-11.

## Milestone 16B update — 2026-08-11

The Android-only Health Connect companion source is now implemented together
with a one-use pairing protocol, narrowly scoped revocable device credentials,
Android Keystore protection, manual and optional background sync, device
management in the web settings, request hardening and automated security
workflows. The two production migrations were applied and verified with RLS
enabled on 2026-08-11, and the Production-only Sensitive HMAC secret was created
directly in Vercel. It is not approved for distribution until Production is
redeployed and the CI, physical-device and signed-APK gates
in `21_SECURITY_THREAT_MODEL.md` / `22_ANDROID_COMPANION.md` pass.

## Product decision

The bridge reduces repeated manual entry and gives Rebuild better context for
recovery, training and meal-timing decisions. It is not a health dashboard and
does not diagnose anything.

## Platform reality

The Next.js PWA cannot directly read Apple HealthKit or Android Health Connect.
Those stores require native platform capabilities and granular user permission.
Milestone 16 therefore has three slices:

1. **16A — server foundation (this slice):** provider-neutral source registry,
   normalized observations, deduplication, provenance, source-level coaching
   permission, export/reset/delete support and a compact user-visible summary.
2. **16B — Rebuild Companion:** small native iOS/Android bridge that reads only
   selected data types and sends idempotent batches through the authenticated
   API. It is not a second full Rebuild product.
3. **16C — decision rules:** deterministic, explainable use of data only after
   real sync quality and freshness have been measured.

Google Fit APIs are not a new integration target; Android uses Health Connect.
On iOS, Xiaomi Mi Fitness can share supported data with Apple Health. Xiaomi's
Body Composition Scale S400 is documented as Xiaomi Home-only and may not be
reachable through either aggregator, so it remains a later feasibility item.

## Canonical metrics

- height (cm)
- weight (kg)
- body-fat percentage
- device-specific visceral-fat index (always labelled as an estimate/index)
- steps
- sleep duration
- resting heart rate
- heart-rate variability
- workout duration
- blood-oxygen percentage

The API normalizes supported units and rejects unknown units or implausible
values. BMI is derived from the latest height and weight; imported BMI is not
accepted as an authoritative reading.

## Privacy and security

- Every source and observation is scoped by `user_id` and protected by RLS.
- Every observation retains source, external record id, time, originating app,
  device and optional non-sensitive metadata.
- `(health_source_id, external_record_id)` makes imports idempotent.
- The user may exclude a source from coaching while retaining it.
- Disconnecting a source deletes all of its imported observations and sync
  history by cascade.
- Health data is included in self-service account export and test-account reset.
- No HealthKit/Health Connect credential is stored in the web database.
- The Coach receives only sources explicitly enabled for coaching and is told
  not to treat BMI or any reading as a diagnosis.

## Implemented contracts

- `POST/GET /api/health/sources`
- `PATCH/DELETE /api/health/sources/:sourceId`
- `POST /api/health/observations` (maximum 500 observations per batch)
- `GET /api/health/summary`
- `/settings/health` for source controls, freshness and compact summary

## Deferred gates

Before 16B production use: native platform projects, privacy permission strings,
Apple/Google developer configuration, background-sync behavior, real-device
tests, conflict testing across multiple data sources and an updated DPIA/privacy
review. Before 16C: enough real observations to define freshness and quality
rules without guessing, plus unit tests for every health-aware decision rule.
