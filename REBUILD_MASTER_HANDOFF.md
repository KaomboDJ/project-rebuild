# REBUILD OS — MASTER PROJECT HANDOFF

## Purpose of this document

This document is the main project handoff for Rebuild.

It contains the product vision, founder context, MVP scope, technical direction and implementation priorities.

Coding agents must treat this document as the source of truth, together with:

- `FOUNDER_CONTEXT.md`
- `CLAUDE.md`
- `AGENTS.md`
- the files inside `/docs`

Do not only discuss or propose solutions. Make concrete changes directly in the repository.

---

# 1. Product name

Working brand:

**Rebuild**

Internal descriptions:

- Rebuild OS
- Decision OS
- Decision Engine

“Rebuild” represents the transformation experienced by the user.

“Decision OS” describes the product category.

“Decision Engine” describes the core technology.

---

# 2. Founder context

The founder is the first user.

Relevant profile:

- 39 years old
- 1.78 m
- approximately 101 kg
- former athlete
- former Brazilian Jiu-Jitsu practitioner and competitor
- wants to regain physical capability and athletic identity
- has a demanding professional life
- has a son called Isaac
- has limited time
- usually sleeps approximately 5–6 hours
- can potentially train during lunch
- uses a Xiaomi scale and Mi Band

The founder already understands the basics of health, training and nutrition.

The problem is not lack of information.

The problem is making the correct decision under real-world constraints.

Recurring problems include:

- ordering Uber Eats when tired
- eating sweets at night
- oversized portions
- cancelling training when conditions are not ideal
- working too late
- insufficient sleep
- failing to prepare meals
- failing to protect useful free windows
- knowing what to do but not acting at the correct moment

The founder wants a personal operating system that helps with:

- health
- routines
- agenda management
- daily planning
- work-life balance
- accountability
- decision support

The original idea was an intelligent Notion-like agenda that organised the day and helped the user make better decisions.

The idea later expanded into health, nutrition and AI coaching.

These are not separate products.

They are different domains of the same contextual Decision Operating System.

---

# 3. Product vision

Rebuild is an AI-powered Decision Operating System.

It understands the user’s context, identifies the decisions that matter most and intervenes at the right moment.

It is not primarily:

- a fitness tracker
- a calorie counter
- a habit tracker
- a calendar replacement
- a task manager
- a generic chatbot
- a motivational app

The core product loop is:

**Context → Decision → Intervention → Response → Learning**

The unit of the product is a decision.

Not a task.

Not a habit.

Not a workout.

Not a calorie.

A decision.

The main hypothesis is:

> If an AI system understands the user’s daily context and intervenes before critical moments, it can improve the quality and consistency of the user’s decisions.

---

# 4. Product promise

Long-form promise:

> Rebuild helps busy former athletes regain their physical and mental identity by making better decisions at the moments that matter.

Concise explanation:

> Most people already know what they should do. The problem is making the right decision at the right moment. Rebuild uses context and AI to anticipate those moments and recommend the next best action.

Key statement:

> We do not help people track more. We help them decide better.

Potential positioning:

> Become an athlete again, one decision at a time.

---

# 5. Initial target user

The initial audience is:

- men aged approximately 30–50
- former athletes
- busy professionals
- fathers or people with major family responsibilities
- people who understand training and nutrition
- people who have lost consistency
- people who want to regain identity, capability and confidence

Their real objective is not simply weight loss.

They want to feel like athletes again, adapted to their current life.

The founder is User #1.

The MVP must first solve the founder’s real recurring decisions before generalising to a broader market.

---

# 6. Product principles

## Decision first

Every feature must answer:

> What decision does this improve?

If there is no clear answer, do not build it.

## Identity before outcomes

The product should reinforce the identity the user wants to rebuild.

It should not use guilt as a primary mechanism.

## Context before metrics

Schedule, sleep, energy, stress and previous behaviour are more useful than isolated numbers.

## Reduce cognitive load

The system should think, filter and prioritise.

The user should not need to manage a complex dashboard.

## Infer before asking

Do not ask the user for information the system can reasonably infer.

## Recommend, then confirm

The system should recommend actions.

The user remains in control.

## Progress over perfection

When the ideal plan is impossible, recommend the smallest useful alternative.

Poor conditions should not automatically lead to cancellation.

## Proactivity over passive tracking

The system should intervene before decisions instead of merely recording them afterwards.

## Calm and concise

Interventions must be short, contextual and actionable.

Avoid long motivational speeches.

## Explicit consent

The initial MVP must never create calendar events or reminders without explicit user action.

---

# 7. Main product experience

The primary screen is a daily operating interface.

It should feel like an intelligent agenda, but it should not attempt to replace Google Calendar.

Example:

## Today

Calendar context:

- 09:00 — Client meeting
- 10:30 — Internal meeting
- 12:00–13:00 — Free
- 13:00 — Project review
- 17:30 — Final meeting

Recommended decision:

> Train between 12:05 and 12:45. This is the best available window today.

Later intervention:

> Your afternoon is full. Decide dinner now to avoid ordering takeaway when tired.

Evening intervention:

> Tomorrow starts early. Begin shutting down at 22:30.

The main screen hierarchy should be:

1. next important decision
2. remaining decisions today
3. calendar context
4. daily Decision Score

---

# 8. MVP objective

The first MVP must prove:

> Can calendar context generate useful and timely decisions that cause the founder to act differently?

The first complete product loop is:

1. The user authenticates.
2. The user completes onboarding.
3. The user connects Google Calendar.
4. The application reads today’s schedule.
5. The application identifies busy periods and free windows.
6. The application generates exactly three priority decisions.
7. The user accepts, edits, skips or completes a decision.
8. The user can explicitly add an accepted decision to Google Calendar.
9. Google Calendar sends its normal reminder.
10. The application records the outcome.
11. Future recommendations use the stored history.

---

# 9. Required MVP features

Build:

- authentication
- onboarding
- profile persistence
- Google Calendar OAuth
- reading today’s calendar
- free-window calculation
- optional daily check-in
- exactly three daily decisions
- deterministic decision rules
- decision ranking
- decision cards
- Accept action
- Edit action
- Skip action
- Complete action
- Add to Calendar action
- Google Calendar reminders
- decision history
- simple Decision XP
- usefulness feedback
- Supabase persistence
- mobile-first interface
- installable PWA
- Vercel deployment

---

# 10. Explicitly excluded from the MVP

Do not build:

- calorie counting
- macro tracking
- food databases
- recipe generation
- food photo recognition
- barcode scanning
- complex health dashboards
- social features
- community features
- complex achievements
- a complete calendar replacement
- Apple Health integration
- Garmin integration
- Xiaomi integration
- Fitbit integration
- location tracking
- automatic calendar event creation
- advanced predictive machine learning
- native Android application
- native iOS application

Nutrition is a future domain inside Rebuild.

It is not the initial product.

---

# 11. Application routes

## `/`

Unauthenticated landing page.

Include:

- concise product explanation
- sign-in action
- explanation that calendar context is used to prepare the day

Authenticated users should be redirected to `/today`.

## `/onboarding`

Collect:

- preferred name
- timezone
- current identity
- desired identity
- primary objective
- preferred training days
- preferred training time
- typical dinner time
- target sleep time
- working hours
- major constraints
- preferred intervention tone

Initial objectives:

- rebuild fitness
- lose weight
- train consistently
- improve nutrition
- improve sleep

Keep onboarding short.

## `/today`

Display:

- date
- user name
- Google Calendar connection state
- regenerate action
- optional check-in
- today’s calendar context
- exactly three decisions
- next recommended decision prominently
- daily XP
- completed decisions out of three

Decision statuses:

- proposed
- accepted
- edited
- completed
- skipped

Decision actions:

- Accept
- Edit
- Complete
- Skip
- Add to Calendar
- Useful / Not useful

## `/history`

Display decisions grouped by date.

Include:

- title
- domain
- recommended time
- status
- feedback

## `/settings`

Include:

- profile editing
- timezone
- reminder timing
- intervention tone
- selected calendar
- connect Google Calendar
- disconnect Google Calendar
- sign out
- delete stored integration credentials

---

# 12. Daily check-in

The check-in is optional.

Ask:

- Sleep quality: 1–5
- Energy: 1–5
- Stress: 1–5
- Physical limitation today?
- Anything important the system should know?

Use this context when generating decisions.

The application must still work without a check-in.

---

# 13. Decision Engine architecture

Use a hybrid architecture.

## Stage 1 — Context Builder

Build a normalized context from:

- profile
- timezone
- current date
- calendar events
- busy periods
- free windows
- daily check-in
- recent decisions
- previous completion patterns
- previous skip patterns

Suggested type:

```ts
type DailyContext = {
  date: string;
  timezone: string;
  profile: UserProfile;
  calendarEvents: CalendarEvent[];
  freeWindows: FreeWindow[];
  recentDecisions: DecisionHistory[];
  userCheckIn?: DailyCheckIn;
};Stage 2 — Deterministic candidate generation
Rules produce candidate decisions.
Basic product functionality must not depend on an LLM.
Stage 3 — Candidate scoring
Score candidates based on:
expected impact
urgency
available opportunity
user preferences
historical adherence
confidence
calendar conflict
recency
diversity across domains
Stage 4 — Selection
Return exactly three decisions.
Requirements:
decisions must not overlap
decisions must not conflict with calendar events
decisions must not all solve the same problem
decisions should represent the highest-value opportunities or risks
Stage 5 — AI refinement
AI may:
rank close candidates
personalise wording
shorten explanations
adapt tone
identify relevant historical patterns
AI must not:
invent calendar events
invent user data
schedule inside busy windows
return unvalidated output
become a single point of failure
Use structured output and schema validation.
If the AI provider fails, the deterministic engine must still return useful decisions.
Stage 6 — Feedback
Store:
accepted
edited
completed
skipped
useful
not useful
optional feedback
optional skip reason
Use this information in future decision generation.
Suggested structure:
src/lib/decision-engine/
  types.ts
  context-builder.ts
  rules.ts
  scorer.ts
  selector.ts
  generator.ts
  prompts.ts
  validation.ts
14. Initial Decision Catalog
Training decisions
Lunch training
Conditions:
preferred training day
free lunch window of at least 35 minutes
no calendar conflict
Example intervention:
Train between 12:05 and 12:45. This is the best available window today.

Reduced training
Conditions:
overloaded day
low energy
poor sleep
useful window shorter than ideal
Example intervention:
Do 20 minutes today. The objective is consistency, not maximum performance.

Mobility instead of cancellation
Conditions:
physical limitation
poor recovery
no appropriate full training window
Example intervention:
Replace the full session with 15 minutes of mobility.

Prepare training equipment
Conditions:
training planned later
preparation friction is a known risk
Example intervention:
Prepare your training clothes now.

Nutrition decisions
Decide dinner early
Conditions:
busy evening
approaching takeaway-risk period
no dinner decision recorded
Example intervention:
Decide dinner now, before the evening fatigue window.

Defrost ingredients
Conditions:
home meal requires preparation
enough preparation time remains
Example intervention:
Take the chicken out of the freezer now.

Prepare tomorrow’s lunch
Conditions:
tomorrow’s calendar is busy
lunch preparation is likely to fail later
Example intervention:
Prepare tomorrow’s lunch after dinner.

Avoid takeaway commitment
Conditions:
high-risk evening
repeated takeaway pattern
Example intervention:
Commit to tonight’s meal before opening a delivery app.

Sleep decisions
Shutdown routine
Conditions:
target sleep time approaching
work or computer use is likely to continue
Example intervention:
Begin shutting down at 22:30.

Earlier sleep for tomorrow
Conditions:
early calendar event tomorrow
recent poor sleep
Example intervention:
Tomorrow starts early. Protect tonight’s sleep.

Prepare the next day
Conditions:
dense morning schedule
Example intervention:
Prepare clothes and essential items before bed.

Planning and recovery decisions
Protect a free window
Conditions:
only meaningful free period remaining
Example intervention:
Keep this window free. It is today’s best recovery opportunity.

Short walk
Conditions:
high stress
sedentary schedule
insufficient workout time
Example intervention:
Take a 15-minute walk between meetings.

Move low-priority work
Conditions:
overloaded calendar
no meal, exercise or recovery window
Example intervention:
Move one low-priority task and protect 30 minutes.

15. Decision Score
Use simple initial scoring:
completed high-impact decision: +15 XP
completed medium-impact decision: +10 XP
completed low-impact decision: +5 XP
accepted but not completed: +2 XP
skipped: 0 XP
Display:
total XP today
completed decisions out of three
Do not implement streaks in the first MVP.
Possible future identity progression:
Restart
Momentum
Competitor
Athlete
Mentor
Do not prioritise identity levels before the core loop works.
16. Google Calendar integration
Google Calendar is:
the first external context source;
the initial notification channel.
Required capabilities:
Connect using Google OAuth 2.0.
Request the minimum necessary permissions.
Obtain offline access where required.
Store credentials securely.
Refresh expired access tokens.
Read today’s events.
Normalise events into busy periods.
Calculate free windows.
Create an intervention event only after explicit user confirmation.
Add a popup reminder.
Store the created event ID.
Prevent duplicate intervention events.
Allow clean disconnection.
Delete stored credentials on disconnection.
Suggested API routes:
/api/google/connect
/api/google/callback
/api/google/disconnect
/api/calendar/today
/api/calendar/create-intervention
Default timezone:
Europe/Lisbon
Timezone must be configurable.
Example event title:
Rebuild: Treino ao almoço
Example event description:
Tens uma janela livre hoje. Faz um treino de 35 minutos. O objetivo é manter consistência, não maximizar intensidade.
Use Google Calendar reminders in the MVP.
Do not build custom push-notification infrastructure yet.
17. Technical stack
Use:
Next.js
App Router
TypeScript
Tailwind CSS
Supabase
Supabase Auth
PostgreSQL
Google Calendar API
Google OAuth 2.0
Vercel
PWA configuration
interchangeable AI provider interface
Use stable versions compatible with the existing repository.
Use:
Server Components by default
Client Components only when browser interaction requires them
Route Handlers for server-side integrations
strict TypeScript
environment variable validation
schema validation for API and AI output
Never expose these values to the browser:
Google refresh tokens
Supabase service-role key
AI API keys
token-encryption key
18. Database model
Create Supabase migrations.
profiles
Fields:
id
user_id
preferred_name
timezone
current_identity
desired_identity
primary_objective
preferred_training_days
preferred_training_time
typical_dinner_time
target_sleep_time
working_hours
current_constraints
intervention_tone
onboarding_completed
created_at
updated_at
calendar_connections
Fields:
id
user_id
provider
encrypted_access_token
encrypted_refresh_token
expires_at
scopes
calendar_id
created_at
updated_at
daily_check_ins
Fields:
id
user_id
date
sleep_quality
energy_level
stress_level
physical_limitation
notes
created_at
updated_at
Use a unique constraint per user and date.
decision_runs
Fields:
id
user_id
date
context_snapshot
engine_version
generated_at
decisions
Fields:
id
user_id
decision_run_id
date
title
reason
recommended_action
recommended_start
recommended_end
domain
impact
confidence
source
status
calendar_event_id
completed_at
skipped_reason
created_at
updated_at
Domains:
training
nutrition
sleep
recovery
planning
Sources:
rule
ai
hybrid
decision_feedback
Fields:
id
user_id
decision_id
useful
feedback
created_at
Implement:
Row Level Security
user ownership policies
foreign keys
indexes
unique constraints
updated timestamp handling
Users must only access their own data.
19. Security and privacy
Calendar data is private.
Requirements:
least-privilege OAuth scopes
encrypted stored OAuth tokens
no secrets in browser bundles
no token values in logs
Row Level Security
server-side authorisation checks
input validation
safe errors
explicit consent before calendar creation
clean integration deletion
Prefer sending normalized context to the AI provider:
event time
busy or free
duration
optional category
Avoid sending full private event descriptions unless clearly necessary.
20. Design direction
The product should feel:
calm
focused
premium
concise
mobile-first
practical
trustworthy
Avoid:
fitness clichés
bodybuilding imagery
excessive gradients
crowded dashboards
generic chatbot layouts
excessive motivational copy
childish gamification
too many statistics
too many simultaneous actions
Display no more than three primary decisions.
Only one action should visually dominate at a time.
The interface should resemble a calm personal operating system, not a traditional fitness application.
21. PWA
Configure:
web application manifest
application icon placeholders
theme metadata
installable behaviour
mobile-safe layout
basic offline shell where reasonable
Do not implement custom push notifications in the first milestone.
22. AI provider architecture
Create an interchangeable AI provider interface.
Example:
interface AIProvider {
  refineDecisions(
    context: DailyContext,
    candidates: GeneratedDecision[]
  ): Promise<GeneratedDecision[]>;
}
The product layer must not be tightly coupled to OpenAI, Anthropic or another vendor.
Requirements:
structured output
schema validation
timeout handling
safe retries where appropriate
deterministic fallback
no fabricated context
prompt versioning
privacy-safe logging
23. Environment variables
Maintain .env.example.
Expected variables may include:
NEXT_PUBLIC_APP_URL
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET
GOOGLE_REDIRECT_URI
TOKEN_ENCRYPTION_KEY
AI_PROVIDER
AI_API_KEY
CRON_SECRET
Never commit real secret values.
Use:
.env.local locally
Vercel environment variables in production
24. Testing requirements
At minimum, test:
free-window calculation
timezone boundaries
overlapping calendar events
all-day events
calendar event normalisation
deterministic decision rules
candidate ranking
exactly three selected decisions
non-overlapping recommendations
score calculation
calendar intervention payload
duplicate event prevention
unauthorised API access
AI-provider failure fallback
Create at least one end-to-end happy path using mocked external services:
sign in
complete onboarding
connect mocked Google Calendar
load calendar context
generate decisions
accept a decision
add it to calendar
complete it
update the score
25. Repository documentation
Maintain or create:
AGENTS.md
CLAUDE.md
REBUILD_MASTER_HANDOFF.md

docs/
  01_FOUNDER_CONTEXT.md
  02_PRODUCT_VISION.md
  03_PRODUCT_PRINCIPLES.md
  04_USER_PERSONA.md
  05_MVP_SPEC.md
  06_DECISION_ENGINE.md
  07_DECISION_CATALOG.md
  08_AI_ARCHITECTURE.md
  09_TECHNICAL_ARCHITECTURE.md
  10_DATABASE.md
  11_UI_UX_GUIDELINES.md
  12_ROADMAP.md
  IMPLEMENTATION_STATUS.md
The repository becomes the long-term source of truth.
Do not duplicate this document blindly across every file.
Split and organise the information appropriately.
AGENTS.md must instruct Work or Codex to:
read this handoff
read relevant documentation
work directly in the repository
implement rather than only advise
keep documentation and code aligned
run tests before stopping
report blockers precisely
never commit secrets
CLAUDE.md must instruct Claude to:
read relevant documentation
protect product principles
implement directly
avoid asking for approval for minor decisions
run lint, type-check and tests
update implementation status
document important architectural decisions
stop only for credentials, irreversible actions or major conflicts
26. Implementation milestones
Milestone 1 — Foundation
inspect the repository
identify the existing architecture
update documentation
validate Next.js App Router
validate TypeScript
validate Tailwind
configure Supabase client utilities
configure Supabase server utilities
create database migrations
establish authentication foundation
create application shell
maintain .env.example
add environment validation
update implementation status
Milestone 2 — Onboarding
onboarding interface
profile persistence
timezone handling
settings basics
redirect logic
Milestone 3 — Google Calendar
OAuth connection
callback route
secure token storage
token refresh
calendar selection
today’s events
normalisation
free-window calculation
calendar context interface
disconnection
Milestone 4 — Deterministic Decision Engine
context builder
rule generation
scoring
diversity constraints
conflict prevention
exactly three decisions
persistence
regeneration
duplicate-run prevention
Milestone 5 — Decision interaction
decision cards
accept
edit
complete
skip
feedback
history
XP
Milestone 6 — Calendar intervention
Add to Calendar action
event creation
popup reminder
event metadata
duplicate prevention
calendar event ID persistence
Milestone 7 — AI refinement
provider abstraction
structured output
ranking and rewriting
concise explanation
deterministic fallback
prompt versioning
Milestone 8 — PWA and Vercel
manifest
responsive mobile layout
production configuration
OAuth callback documentation
deployment validation
error handling
final tests
27. Implementation process
For every milestone:
Inspect the relevant code.
Create a concise implementation plan.
Implement directly.
Run formatting.
Run lint.
Run TypeScript checks.
Run tests.
Fix failures.
Update README.md.
Update docs/IMPLEMENTATION_STATUS.md.
Commit with a clear message if Git access is available.
Do not stop after producing a plan.
Do not ask for approval for normal implementation decisions.
Only stop when:
external credentials are required
an irreversible external action is required
a security-sensitive decision requires founder approval
the existing architecture fundamentally conflicts with this direction
a major ambiguity cannot be resolved from repository context
When credentials are required, explain exactly:
which service is required
which values are needed
where to obtain them
where to save them
how to verify the connection
28. Current priority
Begin or continue Milestone 1.
Immediate actions:
Inspect the complete repository.
Identify what already exists.
Identify missing or conflicting foundations.
Review AGENTS.md.
Review CLAUDE.md.
Review the existing /docs folder.
Create or update docs/IMPLEMENTATION_STATUS.md.
Validate Next.js, TypeScript and Tailwind.
Validate Supabase foundations.
Run lint, type-check and tests.
Continue implementation until external credentials are genuinely required.
Do not only create documentation.
Documentation and implementation must progress together.
29. First validation criterion
The MVP is not validated because the interface looks polished.
The first meaningful validation is:
The application reads a real calendar day, identifies a useful opportunity or risk, recommends a relevant action, creates a user-approved reminder and causes the founder to make a better decision.

Example:
Google Calendar contains a free lunch window.
Rebuild recommends a 35-minute workout.
The founder accepts the decision.
The founder adds it to Google Calendar.
Google Calendar sends a reminder.
The founder trains.
The founder marks the decision complete.
The result is stored.
Future decisions use that history.
This is the first complete Decision OS loop.