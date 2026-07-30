-- Coach UX and Pantry Intelligence milestone (Part 1) — Coach persistence.
--
-- Founder-approved override of the Founder Pilot "no new modules" gate
-- (docs/12_ROADMAP.md, PROJECT_REBUILD_STATE.md — see the same-day update
-- to both files). Previously the Coach (components/CoachDrawer.tsx) held
-- its conversation only in React state: a page refresh or navigating away
-- lost the whole exchange, and there was no way to build a full /coach
-- page with real history. This adds durable, per-user, RLS-scoped storage
-- for conversations and their messages, following the same ownership and
-- grant pattern as every other table in 202607290001_foundation.sql.

create table public.coach_conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default '',
  started_at timestamptz not null default now(),
  last_message_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id)
);

create table public.coach_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  conversation_id uuid not null,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  -- Proposed tool calls attached to an assistant message (Part 3: pantry
  -- tool-calling). Shape: array of
  -- { id, name, args, status: 'proposed'|'confirmed'|'declined'|'executed', result? }.
  -- The model only ever writes a proposal here; execution happens through
  -- app/api/coach/tools/confirm/route.ts after explicit user confirmation
  -- (see lib/coach/tools.ts) — never directly from the assistant turn.
  tool_calls jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint coach_messages_conversation_owner_fk
    foreign key (conversation_id, user_id)
    references public.coach_conversations(id, user_id)
    on delete cascade
);

create index coach_conversations_user_id_idx
  on public.coach_conversations(user_id, last_message_at desc);
create index coach_messages_conversation_id_idx
  on public.coach_messages(conversation_id, created_at);
create index coach_messages_user_id_idx
  on public.coach_messages(user_id);

create trigger coach_conversations_set_updated_at
before update on public.coach_conversations
for each row execute function public.set_updated_at();

create trigger coach_messages_set_updated_at
before update on public.coach_messages
for each row execute function public.set_updated_at();

create or replace function public.touch_coach_conversation()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  update public.coach_conversations
  set last_message_at = new.created_at
  where id = new.conversation_id;
  return new;
end;
$$;

create trigger coach_messages_touch_conversation
after insert on public.coach_messages
for each row execute function public.touch_coach_conversation();

alter table public.coach_conversations enable row level security;
alter table public.coach_messages enable row level security;

create policy "coach_conversations_select_own"
on public.coach_conversations for select
to authenticated
using (auth.uid() = user_id);

create policy "coach_conversations_insert_own"
on public.coach_conversations for insert
to authenticated
with check (auth.uid() = user_id);

create policy "coach_conversations_update_own"
on public.coach_conversations for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "coach_conversations_delete_own"
on public.coach_conversations for delete
to authenticated
using (auth.uid() = user_id);

create policy "coach_messages_select_own"
on public.coach_messages for select
to authenticated
using (auth.uid() = user_id);

create policy "coach_messages_insert_own"
on public.coach_messages for insert
to authenticated
with check (auth.uid() = user_id);

create policy "coach_messages_update_own"
on public.coach_messages for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "coach_messages_delete_own"
on public.coach_messages for delete
to authenticated
using (auth.uid() = user_id);

grant select, insert, update, delete on table
  public.coach_conversations,
  public.coach_messages
to authenticated;
