-- Milestone 14 — Learning and personalization.
--
-- Additive-only migration, three pieces:
--   1. decisions.rule_id — the missing join key. Outcome logging already
--      existed (decisions.status, decision_feedback.useful) but had no way
--      to attribute an outcome back to the specific rule that produced it,
--      only its domain. Nullable: pre-Milestone-14 rows stay null and are
--      simply excluded from pattern computation
--      (lib/decision-engine/patterns.ts), never backfilled with a guess.
--   2. muted_rules — the founder's own absolute opt-out of a specific rule
--      ever being suggested again (rules.ts's generateCandidates filters
--      these out before scoring runs). The "editable" half of Milestone
--      14's "user-visible/editable memory" requirement.
--   3. founder_notes — free-text notes the founder writes themselves,
--      optionally scoped to a rule_id, surfaced back to them at
--      /settings/memory and folded into the Coach's system prompt
--      (lib/ai/provider.ts). The founder can add/edit/delete these at
--      will — nothing here is system-generated or opaque.
--
-- Deliberately NOT persisted: computed insights (RuleInsight — acceptance/
-- usefulness rates, the bounded scoring adjustment). Those are cheap to
-- recompute from decisions + decision_feedback on every read
-- (lib/decision-engine/patterns.ts is pure and fast for a single founder's
-- history), so persisting a derived, potentially-stale copy would only add
-- a cache-invalidation problem with no real benefit.

alter table public.decisions
  add column rule_id text;

create table public.muted_rules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  rule_id text not null check (btrim(rule_id) <> ''),
  muted_at timestamptz not null default now(),
  unique (user_id, rule_id)
);

create table public.founder_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  -- Null = general note (surfaced to the Coach's system prompt regardless
  -- of domain/rule); set = a note the founder attached to one specific
  -- rule's insight card at /settings/memory.
  rule_id text,
  content text not null check (btrim(content) <> ''),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index muted_rules_user_id_idx on public.muted_rules(user_id);
create index founder_notes_user_id_idx on public.founder_notes(user_id, created_at desc);

create trigger founder_notes_set_updated_at
before update on public.founder_notes
for each row execute function public.set_updated_at();

alter table public.muted_rules enable row level security;
alter table public.founder_notes enable row level security;

create policy "muted_rules_select_own"
on public.muted_rules for select
to authenticated
using (auth.uid() = user_id);

create policy "muted_rules_insert_own"
on public.muted_rules for insert
to authenticated
with check (auth.uid() = user_id);

create policy "muted_rules_delete_own"
on public.muted_rules for delete
to authenticated
using (auth.uid() = user_id);

create policy "founder_notes_select_own"
on public.founder_notes for select
to authenticated
using (auth.uid() = user_id);

create policy "founder_notes_insert_own"
on public.founder_notes for insert
to authenticated
with check (auth.uid() = user_id);

create policy "founder_notes_update_own"
on public.founder_notes for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "founder_notes_delete_own"
on public.founder_notes for delete
to authenticated
using (auth.uid() = user_id);

grant select, insert, delete on table public.muted_rules to authenticated;
grant select, insert, update, delete on table public.founder_notes to authenticated;
