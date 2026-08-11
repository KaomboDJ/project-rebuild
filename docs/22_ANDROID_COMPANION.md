# 22 — Android Health Connect Companion

Status: source implementation complete on `codex/health-data-bridge-foundation`;
production migrations applied and automated CI green. Requires the Production
redeploy, physical-device validation, release signing and external APK scanning
before distribution. The Production-only Sensitive HMAC secret is already set.

## Purpose

The private Android companion removes repeated manual health entry. It reads
only user-approved Health Connect record types and sends normalized observations
to Rebuild. The web product remains the control surface; the companion has no
calendar, nutrition, decision or Coach access.

Supported input: height, weight, body-fat percentage, steps, sleep duration,
resting heart rate, HRV, workout duration and SpO₂. BMI is derived by Rebuild.
Visceral fat is not imported because Health Connect has no interoperable record
for vendor-specific visceral-fat indices.

## Pairing flow

1. In Rebuild, open **Definições → Dados de saúde → Companion Android**.
2. Create a five-minute, single-use pairing code.
3. Enter it in the companion.
4. The server exchanges it atomically for a revocable 90-day device token.
5. Android encrypts that token with a non-exportable Keystore AES-GCM key.
6. The user grants individual Health Connect read permissions.
7. Manual sync is available immediately; background access is a separate,
   optional permission and schedules a network-constrained 12-hour worker.

Codes and device tokens are never stored in plaintext by the database. A device
can be revoked from the web even if the phone is unavailable.

## Android requirements

- Android 9 or later; Health Connect must report its SDK as available.
- Java 17, Android SDK 36, AGP 8.11.1 and Gradle 8.13 to build.
- `androidx.health.connect:connect-client:1.1.0`.
- Xiaomi Mi Fitness or another wearable app must write its readings to Health
  Connect. A device visible only in Xiaomi Home will not appear.

## Private distribution

Do not share a CI debug APK. Create an offline release keystore, configure a
protected release build without writing passwords to the repository, build the
minified release APK, run the release gates in `21_SECURITY_THREAT_MODEL.md`,
record its signer and SHA-256 checksum, then share APK + checksum privately.
Updates must use the same signing key; losing it prevents trusted upgrades.

The manual `Android Internal Release` workflow runs only from `main`, uses the
protected `android-internal-release` GitHub Environment and produces a
seven-day private artifact containing the signed APK, signer evidence and its
SHA-256 checksum. It does not publish a GitHub Release or distribute the APK.
When the GitHub plan supports private-repository Environment secrets, configure
these secrets in `android-internal-release`:

- `ANDROID_RELEASE_KEYSTORE_BASE64`;
- `ANDROID_RELEASE_KEYSTORE_PASSWORD`;
- `ANDROID_RELEASE_KEY_ALIAS`;
- `ANDROID_RELEASE_KEY_PASSWORD`.

Required Environment reviewers for private repositories are not available on
GitHub Free/Pro/Team, and private Environment secrets are not available on
GitHub Free. If those controls are unavailable, do **not** copy the keystore
into repository-wide secrets merely to make this workflow run. Build/sign
offline with the four `REBUILD_*` environment variables instead and keep the
keystore outside the repository and cloud CI.

The Gradle release task also refuses to run when any signing value is absent.
The workflow artifact is still only a candidate: scan that exact APK externally
and complete the physical-device checklist before sharing it.

## Required deployment configuration

1. Apply `202608110001_health_data_bridge.sql` and
   `202608110002_companion_security.sql` in order.
2. Generate `COMPANION_HMAC_KEY` with at least 32 random bytes and add it as a
   Vercel Production sensitive environment variable.
3. Redeploy Production.
4. Verify pairing, import, deduplication and revocation with a test account.

The Android source lives in `android-companion/`. CI downloads Gradle 8.13 and
uses Java 17; no generated Gradle wrapper binaries are trusted in the repo.
