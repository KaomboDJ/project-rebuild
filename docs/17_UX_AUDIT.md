# 17 — UX / UI / Accessibility Audit

Independent evaluation of the live application at `https://project-rebuild-chi.vercel.app`, conducted 2026-07-30/31 against the product vision in `FOUNDER_CONTEXT.md`, the current experiment in `PROJECT_REBUILD_STATE.md`, the UI spec in `docs/11_UI_UX_GUIDELINES.md`, and the MVP scope in `docs/05_MVP_SPEC.md`. Central test question throughout: **does this experience make the next useful decision clearer and easier?**

This is an evaluation-phase document only. No production code, migrations, database rows, or other documentation were changed while producing it. All account state observed belongs to the founder's real, already-authenticated session; all mutating controls were deliberately left unclicked (see §14 methodology note). All personal names, calendar event titles, and health specifics encountered during testing have been generalized below — none are quoted verbatim.

## 1. Executive summary

The core calendar-aware decision loop — Today screen, three ranked decisions, accept/complete/edit/skip, Google Calendar context, Decision Score — works, is visually calm and on-brand with `docs/11_UI_UX_GUIDELINES.md`'s intent, and is not overbuilt relative to the product's own "explicitly avoid" list (no charts, no dashboards, no dense tables). The Coach, pantry/shopping ledger, and 7-day nutrition planner (Milestones 10-12) are further along than a typical pre-pilot MVP and show real engineering discipline: confirm-gated mutations, a documented evidence threshold before personalization acts, and Coaching-safety-consistent replies in the one live conversation reviewed.

Against that, three categories of problem stand out. First, a genuine keyboard-accessibility defect: primary navigation (Hoje/Coach/Alimentação/Histórico/Definições) is last in the page's tab order on `/today`, after the entire calendar toolbar, every calendar event link, and all three decision cards — a keyboard-only user must tab past roughly two dozen controls before reaching any other section of the app. Second, a governance/scope gap: `/settings` has no way to edit the profile captured at onboarding, no reminder-timing control, and no account-deletion path, despite all three being named in the app's own master spec (`REBUILD_MASTER_HANDOFF.md`). Third, a cluster of small but repeated Portuguese-copy and formatting bugs (pluralization, missing spaces, untranslated option labels) that undercut the "calm, premium, trustworthy" design direction the spec explicitly asks for.

None of the above are P0 blockers. The app is usable end to end for the one real account tested, and the founder pilot (`docs/16_FOUNDER_PILOT.md`) can reasonably continue. It is not yet ready to hand to additional external testers without first fixing the profile-editing gap and the focus-order defect (see §13).

## 2. Overall UX maturity score

**6.5 / 10 — functional pre-pilot MVP with real rough edges, not yet externally shippable.**

Rubric used: 0-3 core loop broken; 4-5 core loop works but frequent confusion; 6-7 core loop is solid, secondary flows have real gaps; 8-9 polished and consistent, only minor issues; 10 no material issues found. This app sits at 6-7: the primary "look at today, act on a decision" loop is genuinely good, but `/settings`, contextual help (there is currently none — see §10), and keyboard accessibility have gaps large enough to matter to a first-time or non-founder user.

## 3. Persona-by-persona findings

Testing constraint (see §14): every persona below was evaluated by inspecting the founder's real, already-authenticated session read-only, not by creating six isolated accounts. Findings are therefore about what each persona *would* encounter, reasoned from the real screens observed, not from six independent runs. This is flagged per-persona rather than presented as if six accounts were actually run.

**Founder profile.** The screen this account actually shows — a short, confident "próxima decisão" card, week calendar with a real Google Calendar merge, a live Decision XP counter, a populated pantry and Coach history — is the strongest evidence in the whole audit. It reads exactly like the "Today" example in `REBUILD_MASTER_HANDOFF.md` §5. The one friction point for this persona specifically: because onboarding answers are permanently uneditable (§11-S1), the founder cannot revise identity/objective/tone text as the pilot's own goals evolve without engineering help.

**Low-technology former athlete.** Reasoned, not directly observed: the Today screen's copy is short and jargon-free, which suits this persona well. But there is zero first-use guidance anywhere in the product (§10) — a low-technology user's first encounter with "Decision Score," "operating state," or the calendar's "janela livre" language would have no in-app explanation to fall back on. The Evento drawer's Escape-key bug (§11-J3) and its transparent-background text overlap (§11-J3) would likely read to this persona as "the app is broken" rather than a cosmetic bug.

**Privacy-conscious professional.** The `/settings/memory` page (§8, §10) is a genuine asset for this persona — it is the one place in the app that explains what the system has inferred and lets the user mute or correct it. Working against this persona: there is no visible account-deletion or "export my data" path in Settings (§11-S3), and the Coach's tool-calling model was not independently verified against a written data-retention policy (none was found in the app itself).

**Chaotic family schedule.** Not testable end-to-end without a second calendar-connected account (see §14). From what could be observed, the multi-account Google Calendar merge (Milestone 11A) and the week/day/month/agenda view toggle are the right shape for this persona. The real calendar events visible during testing did include family-relevant items (a childcare appointment, a household admin reminder) merged correctly into the single week view, which is a good sign for this use case, though it also means the account under test already contains real family-schedule data that a genuinely fresh account would not.

**Nutrition constraints (vegetarian/lactose-intolerant).** The nutrition profile form accepts dietary constraints and allergy tags, but several allergy-tag option labels render in English on an otherwise fully Portuguese form (§11-N1) — a real, reproduced defect that would directly undercut this persona's trust that their constraint was understood and will be respected in meal suggestions.

**Difficult-day user.** The one live Coach exchange reviewed handled a stress-related, lower-capacity framing appropriately: it asked before assuming context (home vs. away), did not invent pantry contents, and suggested a scaled-down action rather than an all-or-nothing one — consistent with `CLAUDE.md`'s coaching-safety constraints. This is a real positive finding, not a guess, but it is a sample size of one conversation.

## 4. Journey scorecard

| # | Journey | Tested how | Task success | Confidence after | Cognitive load (1-5) | Notes |
|---|---|---|---|---|---|---|
| 1 | Landing / auth | Not completed this session (see §14) | Untested | — | — | Blocked by lack of test inbox and a session resource limit reached before this could be run; scope limitation, not a pass |
| 2 | Onboarding | Not testable from scratch | Untested | — | — | Founder's onboarding is already complete; app correctly redirects a completed account away from `/onboarding` |
| 3 | Google Calendar connection | Read-only, real connected account | Pass (as observed) | High | 2 | "Google Calendar ligado" status is clear; connect/disconnect flow itself not exercised (would disconnect real data) |
| 4 | Today | Read-only, real account | Pass | High | 2 | Matches `docs/11_UI_UX_GUIDELINES.md` layout closely; strongest screen in the app |
| 5 | Calendar | Read-only, real account | Pass, with issues | Medium-High | 2-3 | Evento drawer bugs (§11-J3); accessible-name inconsistency (§11-J3) |
| 6 | "Programar o meu dia" | Read-only (button not clicked — mutates real data) | Untested (interaction) | — | — | Presence, copy, and placement reviewed only |
| 7 | Nutrition profile | Read-only, real account | Pass, with issues | Medium | 2 | English allergy-tag labels (§11-N1); disclaimer copy is a positive |
| 8 | 7-day meal planner | Read-only, real account | Pass (as observed) | Medium | 3 | Generation/replace/lock actions not exercised (mutate real data) |
| 9 | Pantry | Read-only, real account | Pass, with issues | Medium | 2-3 | Count discrepancy vs. Coach (§11-N2); "0unidade" spacing bug (§11-N3) |
| 10 | Shopping list | Read-only, real account | Pass, with issues | Medium | 2 | Missing empty-state message on "to buy" section (§11-N4) |
| 11 | Coach | Read-only review of one existing conversation | Pass | High | 2 | Genuinely grounded, safety-consistent reply observed |
| 12 | History and memory | Read-only, real account | Pass | High | 2 | `/settings/memory` transparency is a strong pattern (§8, §10) |
| 13 | Settings and account control | Read-only, real account | Fail on scope | Low-Medium | 3 | No profile edit, no reminder timing, no deletion path (§11-S1–S3) |
| 14 | Returning-user experience | Read-only, real account | Pass | High | 1 | Session persistence and immediate context are good |

## 5. Route-by-route findings

**`/` (landing).** Not reachable without signing out of the real session; deferred, see §14 and §12.

**`/onboarding`.** Not independently testable; app correctly gates a completed profile away from this route, which is itself confirmation the redirect logic works, but means fresh-user copy/flow quality could not be judged this session.

**`/today`.** Matches the intended layout precisely: header, calendar context line, three decision cards, Decision Score. Real, reproduced issue: keyboard tab order is wrong (§11-J1, P1). Focus ring itself, once an element is fully scrolled into view, is a clean, high-contrast white outline against the dark card background — a genuine positive that should be preserved, not "fixed."

**`/calendar` (week/day/month/agenda views).** View-toggle buttons are all reachable and labeled. The Evento drawer has a transparent background that lets calendar-grid text show through and overlap drawer text (P2), and Escape does not close it (P2, WCAG 2.1.2-adjacent keyboard-trap-lite concern — focus is not literally trapped, but the expected dismiss key does nothing). Mini-calendar day buttons and the main grid's date cells use different accessible-naming conventions for what is conceptually the same "a day" control — not a defect on its own, but an inconsistency worth unifying.

**`/nutrition`, `/nutrition/pantry`, `/nutrition/shopping`, `/nutrition/profile`, `/nutrition/plan`.** Strongest secondary-flow evidence: the `/nutrition/plan` empty state (clear heading, one clear CTA, a helpful secondary link) is a pattern worth reusing elsewhere in the app that currently has no empty-state guidance. Real bugs found: English-language allergy-tag options on the Portuguese profile form (P2); an "item(ns)" pluralization bug appearing on the Alimentação dashboard and again in the Coach's context panel (P3, but doubled exposure raises it); a missing space in at least one pantry-item quantity display ("0unidade") (P3); and a pantry-item count that differs between the Alimentação dashboard (all rows) and what the Coach's grounding panel reports (appears to filter to quantity > 0) (P1 — this one matters specifically because the product's own promise is that the Coach never invents or misrepresents pantry stock).

**`/coach`.** Three-state UX (compact drawer / expanded drawer / full page) all present and functional as observed. Conversation history persists and loads distinct content per conversation (verified via network request, not assumed). No contextual "why did it say that" affordance exists yet (§10).

**`/history`.** Simple, ungamified list as `docs/11_UI_UX_GUIDELINES.md` specifies — correctly does *not* add charts or heatmaps.

**`/settings`, `/settings/memory`.** `/settings/memory` is genuinely good: it explains evidence thresholds and lets the founder mute or correct inferred rules in plain language, which is the closest thing already in the product to the Layer 6 "Why this?" transparency requested in §10. `/settings` itself is missing three things the product's own master spec calls for: editing the profile fields captured at onboarding, reminder-timing configuration, and a way to disconnect/delete stored data end-to-end rather than just Google Calendar disconnect.

## 6. Mobile findings

**Not produced this session; this is a tooling limitation, not a product finding.** `resize_window` was called against the live tab requesting 390×844 and, separately, other breakpoints; the tool reported success each time, but `window.innerWidth`/`innerHeight` read via JavaScript immediately after confirmed the real CSS viewport never changed (stayed at approximately 1536×647 throughout). This was verified with direct JavaScript evidence, not inferred from screenshots alone, before being accepted as a genuine environment constraint. Per this task's own instruction to report an exact limitation rather than fabricate a result: no 1280×720, 768×1024, or 390×844 screenshots or pass/fail judgments exist for this audit, and none should be assumed. A real mobile/tablet pass is one of the two items recommended before wider testing in §13.

## 7. Accessibility findings

- **Focus order (P1, confirmed, reproduced twice from two different starting points).** On `/today`, forward Tab from a fresh page focus visits, in order: the calendar toolbar (Anterior/Hoje/Seguinte/Dia/Semana/Mês/Agenda), then every calendar event link, then all three decision cards' full button sets (Aceitar/Feito/Editar/Não deu × 3 = 12 stops), then Regenerar, then Falar com o Coach — and only *after* roughly two dozen tab stops does focus reach the primary navigation (Rebuild, Hoje, Coach, Alimentação, Histórico, Definições), which sits visually first, top-left, on every screen. This is a genuine WCAG 2.4.3 (Focus Order) and 1.3.2 (Meaningful Sequence) mismatch between visual reading order and keyboard order — a keyboard-only user cannot get to Coach, Alimentação, Histórico, or Definições without first tabbing through the entire Today content, every time, from a fresh load.
- **Focus visibility (positive finding).** Once a focused element is fully scrolled into view, the default browser focus ring renders as a clean, light, clearly visible outline against the dark card backgrounds — good contrast, worth explicitly preserving rather than replacing with a custom (and possibly lower-contrast) focus style.
- **Focus-into-view clipping (P3, observed once).** In one case a newly focused button inside the scrollable right-hand decision panel was only partially brought into view by the browser's default scroll-into-view behavior, leaving it clipped at the bottom edge of the viewport until manually scrolled. Likely caused by the panel having its own internal scroll container in addition to page scroll; worth a light look, not urgent.
- **Escape does not dismiss the Evento drawer (P2).** Confirmed by direct keypress test; expected behavior for any drawer/dialog per common WCAG-adjacent practice.
- **Accessible-name inconsistency, mini-calendar vs. main grid (P2).** Both represent "a calendar day" but are named differently for assistive technology, which will read as two different kinds of control to a screen-reader user when they are conceptually the same.
- **Tooltip/contextual-help accessibility is moot for now** because there are currently no tooltips or info icons in the product to evaluate (see §10) — noted here as a forward-looking constraint for whatever Guide implementation follows this audit: any new info icon or tooltip must be reachable and dismissible by keyboard and by touch, not hover-only, from day one.

## 8. Trust and privacy findings

Positive: the nutrition profile's medical-disclaimer copy (that health/constraint data is used only for context, never for diagnosis) is exactly the tone `CLAUDE.md`'s coaching-safety section calls for, and the Coach's one observed conversation respected it in practice — it asked rather than assumed, and did not invent pantry data. `/settings/memory`'s plain-language explanation of evidence thresholds and rule-muting is the strongest existing foundation for user trust in personalization anywhere in the app.

Gap: there is no visible account-deletion or full-data-export path in `/settings`, and no in-app privacy policy or data-retention statement was found during this pass. For a product whose target user is explicitly described as privacy-conscious about health and calendar data (§3), this gap matters more than it would for a generic productivity tool.

## 9. Portuguese copy findings

- English-language allergy-tag option labels on an otherwise Portuguese nutrition-profile form (P2, §5).
- "item(ns)" literal pluralization bracket appearing in at least two places — the Alimentação dashboard and the Coach's context panel — rather than a correctly pluralized Portuguese string (P3, doubled exposure).
- A missing space in a pantry quantity string ("0unidade" instead of "0 unidade") (P3).
- No other copy issues were confirmed; the bulk of the app's Portuguese copy (Today's decision cards, History, the nutrition-plan empty state, the memory-settings explanations) reads as natural, calm, and consistent with the "premium, trustworthy" design direction.

## 10. Rebuild Guide recommendation and specification

**Recommendation: do not build the full six-layer Guide before the founder pilot's 14-day window (`docs/16_FOUNDER_PILOT.md`) concludes on 2026-08-13.** The pilot's own stated purpose is to validate the decision loop itself, not to add scope, and `docs/12_ROADMAP.md` is explicit that no new modules ship during it absent a blocking bug. None of the Guide's six layers are a blocking bug — they are a real, well-motivated gap, but building them now would repeat the exact pattern the roadmap file already flags as an exception, not a default.

What *should* happen now, cheaply, ahead of a full build: the two structural prerequisites the Guide will need are already half-present. `/settings/memory` already proves the team can write plain-language, non-invented, evidence-grounded explanatory copy — that is exactly the tone Layer 5 (Guide panel) and Layer 6 (recommendation transparency) need. Reusing that page's copy patterns will make a future Guide implementation much faster than starting from nothing.

Specification, for when the pilot concludes and this is prioritized:

1. **Inline explanation** — short in-context sentences (already present in decision-card "Reason" text; extend the same pattern to nutrition and pantry screens, which currently have none).
2. **Contextual info icons/tooltips** — for Decision Score, operating state, "busy-only" calendar mode, destination calendar, fixed/flexible event, pantry reservation, macro estimate, "Regenerar," memory confidence, and rule muting. Must be keyboard-focusable and touch-tappable, never hover-only, and dismissible with Escape (fixing the Evento-drawer Escape bug first is a direct prerequisite, since the same dismiss pattern will be reused).
3. **First-use guidance** — one short, dismissible callout per screen on first visit; never a forced multi-step tour, per the founder's own product philosophy against friction.
4. **Empty-state guidance** — the `/nutrition/plan` empty state is the reference pattern; apply the same shape (what this is, why it's empty, one clear next action) to any other screen that currently shows a blank or sparse state without one.
5. **Global Guide side panel** — route-aware, answers "what is this screen," "what happens if I click this," and basic troubleshooting. Must be strictly grounded in the actual product documentation and current screen state, never a general-purpose chatbot that could invent capabilities the app doesn't have — this is a hard safety requirement, not a style preference, given the Coach's own no-invention standard already set a precedent worth matching.
6. **Recommendation transparency ("Why this?")** — what context was and wasn't used, whether a suggestion came from a fixed rule or personalization, and how to correct it. `/settings/memory`'s existing evidence-threshold and rule-mute copy is the direct precedent and should be extended into this layer rather than rebuilt.

## 11. Complete issue inventory

| ID | Route | Severity | Confirmed? | Summary |
|---|---|---|---|---|
| J1 | `/today` | P1 | Confirmed, reproduced twice | Primary navigation is last in keyboard tab order, after all Today content |
| J3-a | `/calendar` | P2 | Confirmed | Evento drawer transparent background causes text overlap |
| J3-b | `/calendar` | P2 | Confirmed | Escape does not close the Evento drawer |
| J3-c | `/calendar` | P2 | Confirmed | Accessible-name inconsistency between mini-calendar day buttons and main grid date cells |
| N1 | `/nutrition/profile` | P2 | Confirmed | Allergy-tag option labels render in English on a Portuguese form |
| N2 | `/nutrition`, `/coach` | P1 | Confirmed | Pantry item count differs between Alimentação dashboard and Coach grounding panel |
| N3 | `/nutrition/pantry` | P3 | Confirmed | Missing space in quantity string ("0unidade") |
| N4 | `/nutrition/shopping` | P3 | Confirmed | No empty-state message for the "to buy" section |
| S1 | `/settings` | P1 | Confirmed | No way to edit onboarding-captured profile fields anywhere in the UI |
| S2 | `/settings` | P2 | Confirmed | No reminder-timing configuration |
| S3 | `/settings` | P2 | Confirmed | No account/data-deletion or export path beyond Google Calendar disconnect |
| A1 | `/today` | P3 | Observed once, not reproduced a second time | Focused button clipped at viewport edge inside a nested scroll container |
| I1 | `IMPLEMENTATION_STATUS.md` | P3 (documentation, not product) | Confirmed | Top-of-file checklist still marks Milestones 12 and 14 "Not started" while later sections in the same file document both as built and production-activated |

Items considered but explicitly **not** reported as confirmed defects, per the instruction not to report a theoretical issue as confirmed unless reproduced: a suspected Coach conversation-switching bug (a genuine distinct network request was verified for the second conversation, so the apparent similarity was most likely two genuinely similar Coach replies, not a data-loading bug); a one-time large blank-space rendering gap on `/settings/memory` that did not reproduce on a second look (most likely a transient scroll/paint timing artifact).

## 12. Top five abandonment risks

1. **Settings has no profile-editing path (S1).** Any user whose onboarding answers become stale — tone, objective, constraints — hits a permanent dead end with no in-app recovery, which is the kind of moment that ends a trial for a new user who doesn't yet trust the product enough to accept "contact support."
2. **Keyboard-only users effectively cannot reach other sections quickly (J1).** Every visit to `/today` requires tabbing past two dozen controls to reach Coach, Alimentação, Histórico, or Definições — a strong candidate for a keyboard-dependent user giving up before finding secondary features at all.
3. **The Evento drawer's Escape-key failure plus visual text overlap (J3-a/b).** A drawer that doesn't close on the expected key and visually looks broken is a classic "is this app buggy or did I do something wrong" moment that erodes trust quickly, especially on a first calendar-detail interaction.
4. **Pantry-count mismatch between the dashboard and the Coach (N2).** This one is particularly dangerous because it directly touches the product's central promise that the Coach never misrepresents real pantry state — a user who notices the discrepancy has reason to distrust every other Coach answer afterward.
5. **No contextual help anywhere (§10 gap).** A low-technology or first-time user encountering "operating state," "janela livre," or "Decision Score" language with zero explanation in-product has no graceful path to understanding except trial and error or abandoning the screen.

## 13. P0/P1 release blockers

No P0 (security/privacy/data-loss) issues were confirmed this session. Two P1s should be fixed before adding any additional external tester beyond the founder:

- **S1 — Settings profile-editing gap.** Directly named in the app's own master spec; its absence is a scope gap, not a design choice, and it blocks the founder's own ability to revise the pilot as it runs.
- **J1 — Keyboard focus order.** A confirmed, reproducible WCAG-relevant defect that would materially block or frustrate any keyboard-dependent tester from the moment they land on Today.

N2 (pantry-count mismatch) is also P1 but is scoped to a data-consistency fix rather than a UI-access blocker; it should be fixed in the same window as the two above given how directly it touches the Coach's core trust promise.

## 14. Testing methodology and scope limitations

Per the task's explicit safety constraints, no isolated test accounts were created this session. The repository was first checked for existing e2e/seed test infrastructure (none exists — confirmed via glob search for Playwright, e2e, and seed files). Fabricating an authenticated session via localStorage/cookie injection was considered and deliberately rejected: this application very likely uses cookie-based SSR sessions, all browser tabs in this environment share one cookie jar (confirmed empirically — a brand-new tab immediately showed the founder's live authenticated session), and any such injection risked disrupting the founder's real session and data, which the task explicitly prohibits.

The approach actually used instead: read-only inspection of the founder's own already-authenticated session (screenshots, accessibility-tree reads, safe non-mutating navigation) while strictly never activating any control that creates, edits, or deletes data — Aceitar/Feito/Editar/Não deu, "Programar o meu dia," any pantry adjustment or "Terminou" action, sending a new Coach message, generating or replacing a meal plan, or any Settings save/disconnect/sign-out action. This is why journeys 1, 2, 6, and portions of 8 in §4 are marked untested rather than pass/fail — this task's own instruction is to report an exact limitation rather than pretend a scenario was tested, and that instruction is being followed literally here.

Two further, tooling-driven limitations arose during testing rather than being planned: `resize_window` does not change the real rendered viewport in this environment (verified directly via JavaScript, not assumed — see §6), so no genuine responsive-breakpoint screenshots exist for this audit; and a session-level usage limit was reached before the planned sign-out-and-test-landing-page step (§4, journey 1) and further keyboard-navigation passes beyond `/today` could be completed. Both are reported here rather than silently omitted or faked.

No test data was created during this audit (see §14 above), so no cleanup is required.

## 15. Suggested automated regression tests

- A keyboard-navigation test asserting that primary navigation links are reachable within a small, fixed number of Tab presses from a fresh `/today` load (would have caught J1 directly).
- A visual/DOM assertion that the Evento drawer has an opaque background at all supported viewport widths (would have caught J3-a).
- A keyboard test asserting Escape closes the Evento drawer (would have caught J3-b).
- A data-consistency test asserting the pantry item count shown on the Alimentação dashboard and the count available to the Coach's tool-calling context are computed from the same query/filter (would have caught N2 directly and prevent regression).
- A copy-linting pass (even a simple regex check) for literal `item(ns)`-style unpluralized strings and for missing spaces between a number and its unit, run against all Portuguese-locale strings.
- A locale-completeness check that fails the build if any user-facing option label (e.g., allergy tags) is missing a Portuguese translation.

## 16. Screenshots/evidence index

Screenshots and accessibility-tree/network-request evidence were captured throughout live testing of `/today`, `/calendar` (week/day/month/agenda views and the Evento drawer), `/nutrition`, `/nutrition/pantry`, `/nutrition/shopping`, `/nutrition/profile`, `/nutrition/plan`, `/coach`, `/history`, `/settings`, and `/settings/memory`, plus a full keyboard tab-order trace of `/today` (documented in §7/§11). All personal names, calendar event titles, and health specifics visible in that evidence are described only generically in this document per the task's privacy instruction; no raw screenshots containing that data are attached to or embedded in this file.

## 17. Recommended next UX milestone

Fix the two P1s (S1 settings profile-editing, J1 keyboard focus order) and the P1 pantry-count mismatch (N2) during the remainder of the current founder pilot window, since none of the three require new product scope — they are corrections to already-specified or already-built behavior, not new modules, so they don't conflict with the pilot's "no new modules" rule. Hold the Rebuild Guide (§10) and the P2/P3 copy and drawer fixes until the pilot's 2026-08-13 end-of-pilot review, then reassess priority against whatever the pilot itself surfaces about real usage. Before inviting any tester beyond the founder, complete the still-outstanding landing/auth and true responsive-breakpoint passes that this session's tooling and usage-limit constraints prevented (§6, §14).

## 18. Resolution status — UX Hardening release

Implemented directly on branch `ux-hardening-release` following this audit, per the founder's explicit instruction to treat it as the evidence base for a focused hardening pass (not a broad redesign). Status per issue:

| ID | Status | What changed |
|---|---|---|
| S1 | **Fixed** | `components/settings/ProfileEditForm.tsx` + `app/api/profile/route.ts` (session-scoped update, never insert/upsert; RLS-backed ownership). Also surfaced the previously write-only-at-onboarding `working_hours` field, which the Decision Engine has read since Milestone 1 but no form ever exposed. |
| J1 | **Fixed** | `components/AppShell.tsx`: added a "Saltar para o conteúdo" skip link as the first focusable element and a focusable `#main-content` landmark. Primary navigation's DOM position (already before main content in current source) is now covered by a Playwright regression test (`e2e/today-keyboard.spec.ts`) rather than relying on manual re-verification. |
| N2 | **Fixed** | `lib/pantry/selectors.ts` (canonical `countTotalRegistered`/`countAvailable`/`countExpiringSoon`), applied to `/nutrition` (now shows both counts, explicitly labeled) and to the Coach's `get_inventory` tool (now filters to `quantity > 0`, matching `buildPantrySummary`/`suggest_available_meal`, so the Coach can no longer describe a zero-stock item as available). No "reserved items" selector was added — no reservation concept exists anywhere in the codebase (confirmed by search), so none was invented. |
| J3-a/J3-b | **Fixed** | New shared `components/ui/Drawer.tsx` (opaque background, Escape-to-close, focus trap, focus restoration on close), adopted by `EventDetailDrawer.tsx` and the Coach's mobile context drawer. |
| J3-c | **Fixed** | `components/MiniCalendar.tsx` day buttons now carry full-date `aria-label`s, matching the main calendar grid's naming convention. |
| N1 | **Fixed** | `lib/nutrition/options.ts`'s new `ALLERGEN_LABELS` map (Portuguese display labels; stored values unchanged, no data migration needed). |
| N3 | **Fixed** | Space added between quantity and unit in `PantryList.tsx` and `ShoppingList.tsx`. |
| N4 | **Fixed** | `ShoppingList.tsx` now shows a distinct "nada por comprar" message when everything is purchased. |
| Portuguese pluralization (`item(ns)` and similar) | **Fixed** | New `lib/format/pluralizePt` helper, applied at all four locations found (`/nutrition`, Coach context panel, `lib/coach/tools.ts`'s tool-call summaries, `CalendarWorkspace.tsx`'s plan summary). |
| A1 (nested-scroll focus clipping) | **Mitigated, not fully closed** | A `:focus-visible { scroll-margin-block: 24px }` rule was added; this helps in browsers that honor scroll-margin during focus-triggered scrolling but isn't a guaranteed fix for every browser/container combination. Left open rather than overclaimed. |
| I1 (stale Milestone 12/14 checklist) | **Fixed** | `docs/IMPLEMENTATION_STATUS.md`'s running checklist corrected. |
| Auth copy (§3 of the release brief) | **Fixed** | Landing page ("Entrar com email" + plain-language passwordless explanation), `/auth/check-email` (where it was sent, personal/non-forwardable, expected delay, what to do if it doesn't arrive/expires). No user-enumeration change was needed — `signInWithOtp`'s existing default behavior already gives the same outcome for a new or existing address. |
| Contextual help foundation (§4) | **Built, partial concept coverage** | New `components/ui/HelpTip.tsx` (keyboard-focusable, not hover-only, Escape/focus-out to close, focus restoration) applied to 6 of the 10 listed concepts: Decision Score, Regenerar, macro estimate, memory confidence, rule muting, and destination/primary calendar account. The other four (operating state, busy-only calendar, fixed/flexible event, pantry reservation) have no corresponding UI surface anywhere in the current app (confirmed by code search) — no tooltip was attached to a concept that doesn't exist in the product yet, rather than fabricating coverage. |
| "Why this?" transparency (§4) | **Built** | `DecisionEngineCard.tsx`'s new "Porquê esta sugestão?" disclosure shows source (rule/AI/hybrid), a qualitative confidence label, the schedule reason, and the related pantry item when present — all derived directly from existing `decisions` columns, nothing invented or re-asked of the AI provider. |
| First-use guidance (§4) | **Built** | New `components/ui/FirstUseCallout.tsx`, applied to all 7 named areas (Today+Calendar share one screen in this app's actual architecture, so one callout covers both; a second, distinct one covers "Programar o meu dia" specifically; Nutrition, Pantry, Shopping, and Memory each have their own). Dismissal is stored in `localStorage` (per-browser), not a new per-account DB column — a deliberate, documented scope choice for this release, not silently presented as fully per-user. |
| Account privacy readiness (§6) | **Built** | `/settings` now surfaces a "Os teus dados" explanation and a real, carefully-scoped self-service account-deletion flow (`app/api/account/route.ts` + `components/settings/DeleteAccountSection.tsx`): session-scoped only (cannot target another account, including the founder's, by construction), requires retyping the exact account email, best-effort Google token revocation, and deletion via `auth.admin.deleteUser` which cascades every user-owned row (verified against every migration file's `on delete cascade` before relying on this). Tested only against disposable Playwright-created accounts, never the founder's. Known, documented gap: no step-up/"recent authentication" re-challenge beyond an already-valid session plus retyping the email — Supabase's magic-link auth has no built-in equivalent to a password re-prompt; acceptable for the founder-pilot/invited-tester stage, flagged as a public-launch hardening item. |
| Rebuild Guide (full six-layer assistant) | **Deliberately not built** | Per the release brief's own instruction; the lightweight foundation above (HelpTip, "Why this?", first-use callouts) is the intended scope for this release. |
| Playwright suite (§5) | **CI added; Chromium/Axe run currently skips for missing secrets** | `.github/workflows/ci.yml` (commit `0675789`) runs the suite on GitHub-hosted runners (no local Chromium-download restriction there). The `static-and-unit` job (lint/typecheck/vitest/build) is confirmed green in the GitHub Actions UI. The `e2e` job installs Playwright Chromium and runs `npm run test:e2e`, but the repository currently has **zero GitHub Actions secrets configured**, so the job's preflight check finds `NEXT_PUBLIC_SUPABASE_URL`/`NEXT_PUBLIC_SUPABASE_ANON_KEY`/`SUPABASE_SERVICE_ROLE_KEY` all empty and explicitly skips with a `::warning::` annotation rather than either failing or fabricating a pass. Founder action needed: add those three as repository secrets, then re-run the workflow. |

## 19. Release status (2026-07-31)

Merged to `main` via a standard, non-force GitHub merge commit `78d573c` (PR #1, `ux-hardening-release` → `main`), after a real `git fetch` confirmed local and remote history were in sync (no force-push, nothing rewritten). Vercel Production redeployed automatically and reached Ready for `78d573c`; a read-only smoke test (no session cookie, no founder data touched) confirmed the public landing page serves the new Magic Link copy and `/onboarding` correctly redirects an unauthenticated request rather than erroring.

This is **not** the same as saying the release is fully verified end to end: the Playwright/Axe suite still hasn't executed anywhere with real Supabase credentials (see §18 above), so mobile viewports, keyboard flows, drawer focus-trap behavior, and the automated accessibility scan remain unconfirmed by an actual test run — only by source-code review and the typecheck/lint/unit-test/build pipeline, which is a materially weaker claim. Landing/auth, onboarding, and true responsive-breakpoint testing (flagged as untested in §4/§6/§14 above) are covered by the Playwright suite's source code, but "the tests exist and are wired into CI" is not the same as "the tests have run and passed" until the missing repository secrets are added.
