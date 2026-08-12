# 21 — Security Threat Model

Status: mandatory release gate for the Health Data Bridge and Android companion.

## Security promise

No application can honestly promise perfect protection from malware or hacking.
Rebuild instead minimizes access, contains failures, makes access revocable and
requires repeatable verification before an internal APK is shared. The baseline
is OWASP MASVS plus the existing web isolation/RLS test suite.

## Protected assets

- account identity and sessions;
- calendar contents and OAuth tokens;
- health observations and source provenance;
- dietary profile, pantry and decision history;
- server secrets, database administration keys and APK signing material.

## Trust boundaries and main threats

| Boundary | Threat | Required control |
|---|---|---|
| Browser → Vercel | CSRF, oversized/malformed bodies, session theft | SameSite Supabase cookies, origin checks on browser mutations, strict schema/body limits, private/no-store responses, security headers |
| Companion → Vercel | stolen or forged device credential, replay, excessive authority | 256-bit opaque token, only HMAC hash stored server-side, `health:write` scope only, 90-day expiry, revocation, idempotent external record ids, strict input limits |
| Pairing | guessed/reused code | 80-bit random one-use code, only HMAC hash stored, five-minute expiry, atomic database exchange |
| Vercel → Supabase | service-role compromise | service role never present in web/mobile clients, Vercel secret only, RLS plus explicit owner scoping, stable error codes without provider response bodies |
| Android device | lost/rooted phone, malware reading local data | no password/session/admin key, token encrypted with Android Keystore AES-GCM, backups and cleartext disabled, minimal exported components, immediate web revocation |
| Supply chain | malicious/vulnerable dependency or leaked secret | lockfiles, Dependabot, CodeQL, Android lint, production npm audit, tracked-file secret scan, protected signing key outside Git |
| Health data | wrong source, duplicates or unsafe interpretation | provenance, deduplication, plausibility checks, user-controlled coaching consent, derived BMI only, no diagnosis |

## Companion authority

The companion is deliberately not the Rebuild app. Its token can only register
a `health_connect` source owned by the paired user, import authorized health
observations for that user, and revoke itself. It cannot read Rebuild health
history, calendars, nutrition, decisions, profile, email, authentication session
or another user's data. It never receives a Supabase key, provider credential,
Anthropic key or `service_role` key.

Authenticated browser clients can select or delete their own device rows but
cannot update device hashes, scopes, status or expiry. Revocation-as-status is a
server-admin operation that remains explicitly constrained by the authenticated
user id; this prevents a browser client from minting or extending credentials.

## Residual risks

- A rooted/fully compromised Android device can defeat platform protections and
  submit false observations until the device is revoked.
- Side-loaded apps do not receive Play Store malware screening; only founder-
  signed release APKs with a published SHA-256 checksum may be distributed.
- `script-src 'unsafe-inline'` remains in the web CSP because the current Next.js
  bootstrap needs inline scripts. XSS prevention therefore also relies on React
  escaping, sanitized Markdown and input validation.
- Health Connect data quality depends on its originating wearable/vendor app.
- Xiaomi Home-only devices are not made compatible by this bridge.

## Release gates

An APK is not approved for friends until all of the following are evidenced:

- web lint, type-check, unit tests, production build, Playwright/Axe and
  cross-account isolation are green;
- Android unit tests, lint and release build are green on CI;
- CodeQL, tracked-file secret scan and high/critical production dependency audit
  are green;
- migrations are reviewed/applied, and `COMPANION_HMAC_KEY` exists only in
  Vercel Production;
- real-device pairing, permission denial, manual sync, background sync, token
  expiry and revocation have been tested;
- a signed, minified release APK is scanned with MobSF (or equivalent) and has no
  unresolved high/critical finding;
- the signing keystore is backed up offline and never committed;
- the APK and SHA-256 checksum are delivered through a trusted private channel.

The repository's manual release workflow is intentionally non-distributing:
it runs only from `main`, references the `android-internal-release`
Environment, fails closed without all four signing secrets, verifies the APK
signature and retains the candidate for seven days. GitHub plan limitations
must never be worked around by broadening signing-secret exposure: when private
Environment secrets/protection are unavailable, sign offline instead. A green
workflow does not replace the physical-device and external APK scan gates.

## Incident response

If a phone or APK is suspected compromised: revoke the device in Rebuild,
rotate `COMPANION_HMAC_KEY` if server-side token material may be exposed, rotate
affected provider keys, invalidate user sessions where appropriate, preserve
logs without health payloads, notify affected invited users, and do not issue a
replacement APK until the cause and blast radius are understood.
