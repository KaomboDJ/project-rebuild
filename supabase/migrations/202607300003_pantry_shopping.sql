-- Coach UX and Pantry Intelligence milestone (Part 2) — pantry + shopping
-- schema. Founder-approved override of the Founder Pilot gate (see
-- 202607300002_coach_persistence.sql header and the same-day update to
-- docs/12_ROADMAP.md / PROJECT_REBUILD_STATE.md).
--
-- Design: pantry_items holds current on-hand quantity for fast reads.
-- inventory_events is an append-only ledger recording every change
-- (purchase/consume/adjust/waste) with the resulting quantity snapshotted
-- at write time, so pantry_items.quantity is always derived from the same
-- source of truth an audit trail can reconstruct, rather than a value the
-- app or the Coach can drift out of sync by writing directly.

create table public.pantry_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (btrim(name) <> ''),
  category text not null default 'other'
    check (category in ('produce', 'protein', 'dairy', 'grain', 'pantry', 'frozen', 'beverage', 'other')),
  unit text not null default 'unidade'
    check (unit in ('unidade', 'g', 'kg', 'ml', 'l')),
  quantity numeric(10, 2) not null default 0 check (quantity >= 0),
  -- Feeds the Coach's "good to take to work" vs. "good to cook at home"
  -- reasoning (Part 3/4) — e.g. a banana is portable, a pot of soup isn't.
  portable boolean not null default true,
  perishable boolean not null default true,
  expires_on date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id)
);

create table public.inventory_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  pantry_item_id uuid not null,
  event_type text not null check (event_type in ('purchase', 'consume', 'adjust', 'waste')),
  -- Signed change applied by this event (positive for purchase/adjust-up,
  -- negative for consume/waste/adjust-down).
  quantity_delta numeric(10, 2) not null check (quantity_delta <> 0),
  -- Snapshot of pantry_items.quantity immediately after this event, so the
  -- ledger is self-consistent even if pantry_items is ever rebuilt from it.
  resulting_quantity numeric(10, 2) not null check (resulting_quantity >= 0),
  source text not null default 'manual' check (source in ('manual', 'coach', 'shopping')),
  note text,
  created_at timestamptz not null default now(),
  constraint inventory_events_item_owner_fk
    foreign key (pantry_item_id, user_id)
    references public.pantry_items(id, user_id)
    on delete cascade
);

create table public.shopping_lists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null default 'Lista de compras',
  status text not null default 'open' check (status in ('open', 'completed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id)
);

create table public.shopping_list_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  shopping_list_id uuid not null,
  -- Nullable: set once the item is matched to (or, on purchase, creates) a
  -- pantry_items row. Kept as a plain FK (not the owner-composite pattern
  -- used elsewhere) because it's optional and "on delete set null" cannot
  -- target a composite key that also includes the NOT NULL user_id column.
  pantry_item_id uuid references public.pantry_items(id) on delete set null,
  name text not null check (btrim(name) <> ''),
  quantity numeric(10, 2) not null default 1 check (quantity >= 0),
  unit text not null default 'unidade'
    check (unit in ('unidade', 'g', 'kg', 'ml', 'l')),
  purchased boolean not null default false,
  purchased_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint shopping_list_items_list_owner_fk
    foreign key (shopping_list_id, user_id)
    references public.shopping_lists(id, user_id)
    on delete cascade
);

create index pantry_items_user_id_idx on public.pantry_items(user_id, name);
create index inventory_events_item_id_idx on public.inventory_events(pantry_item_id, created_at desc);
create index inventory_events_user_id_idx on public.inventory_events(user_id, created_at desc);
create index shopping_lists_user_id_idx on public.shopping_lists(user_id, status);
create index shopping_list_items_list_id_idx on public.shopping_list_items(shopping_list_id, purchased);
create index shopping_list_items_pantry_item_id_idx on public.shopping_list_items(pantry_item_id);

create trigger pantry_items_set_updated_at
before update on public.pantry_items
for each row execute function public.set_updated_at();

create trigger shopping_lists_set_updated_at
before update on public.shopping_lists
for each row execute function public.set_updated_at();

create trigger shopping_list_items_set_updated_at
before update on public.shopping_list_items
for each row execute function public.set_updated_at();

alter table public.pantry_items enable row level security;
alter table public.inventory_events enable row level security;
alter table public.shopping_lists enable row level security;
alter table public.shopping_list_items enable row level security;

create policy "pantry_items_select_own"
on public.pantry_items for select
to authenticated
using (auth.uid() = user_id);

create policy "pantry_items_insert_own"
on public.pantry_items for insert
to authenticated
with check (auth.uid() = user_id);

create policy "pantry_items_update_own"
on public.pantry_items for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "pantry_items_delete_own"
on public.pantry_items for delete
to authenticated
using (auth.uid() = user_id);

-- inventory_events is append-only by design: select + insert only, no
-- update/delete policy or grant, so the ledger can't be edited after the
-- fact even by the owning user (mirrors "quantity corrections happen via a
-- new 'adjust' event, never by rewriting history").
create policy "inventory_events_select_own"
on public.inventory_events for select
to authenticated
using (auth.uid() = user_id);

create policy "inventory_events_insert_own"
on public.inventory_events for insert
to authenticated
with check (auth.uid() = user_id);

create policy "shopping_lists_select_own"
on public.shopping_lists for select
to authenticated
using (auth.uid() = user_id);

create policy "shopping_lists_insert_own"
on public.shopping_lists for insert
to authenticated
with check (auth.uid() = user_id);

create policy "shopping_lists_update_own"
on public.shopping_lists for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "shopping_lists_delete_own"
on public.shopping_lists for delete
to authenticated
using (auth.uid() = user_id);

create policy "shopping_list_items_select_own"
on public.shopping_list_items for select
to authenticated
using (auth.uid() = user_id);

create policy "shopping_list_items_insert_own"
on public.shopping_list_items for insert
to authenticated
with check (auth.uid() = user_id);

create policy "shopping_list_items_update_own"
on public.shopping_list_items for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "shopping_list_items_delete_own"
on public.shopping_list_items for delete
to authenticated
using (auth.uid() = user_id);

grant select, insert, update, delete on table
  public.pantry_items,
  public.shopping_lists,
  public.shopping_list_items
to authenticated;

grant select, insert on table public.inventory_events to authenticated;

-- Atomic inventory mutation used by every write path (manual UI, the
-- shopping-purchase flow, and the Coach's confirmed tool calls in
-- lib/coach/tools.ts) instead of app code doing a read-then-write against
-- pantry_items.quantity, which would race under concurrent updates.
-- SECURITY INVOKER (the default) — runs as the calling authenticated role,
-- so the row-level security policies above still apply; it has no elevated
-- privileges over what the calling user already has.
create or replace function public.apply_inventory_event(
  p_pantry_item_id uuid,
  p_event_type text,
  p_quantity_delta numeric,
  p_source text default 'manual',
  p_note text default null
)
returns public.inventory_events
language plpgsql
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_new_quantity numeric(10, 2);
  v_event public.inventory_events;
begin
  if v_user_id is null then
    raise exception 'not_authenticated';
  end if;

  update public.pantry_items
  set quantity = quantity + p_quantity_delta
  where id = p_pantry_item_id and user_id = v_user_id
  returning quantity into v_new_quantity;

  if v_new_quantity is null then
    raise exception 'pantry_item_not_found';
  end if;

  insert into public.inventory_events (
    user_id, pantry_item_id, event_type, quantity_delta, resulting_quantity, source, note
  ) values (
    v_user_id, p_pantry_item_id, p_event_type, p_quantity_delta, v_new_quantity, p_source, p_note
  )
  returning * into v_event;

  return v_event;
end;
$$;

grant execute on function public.apply_inventory_event(uuid, text, numeric, text, text) to authenticated;

-- Idempotent purchase -> pantry flow (Part 2's "quick inventory actions").
-- Marks a shopping-list item purchased and, in the same transaction,
-- either tops up its matched pantry_items row or creates a new one, then
-- records the corresponding inventory_events row via apply_inventory_event
-- above. Calling this twice on an already-purchased item is a no-op (it
-- returns the existing item unchanged) rather than double-crediting stock.
create or replace function public.mark_shopping_item_purchased(
  p_shopping_list_item_id uuid,
  p_actual_quantity numeric default null
)
returns public.shopping_list_items
language plpgsql
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_item public.shopping_list_items;
  v_pantry_item_id uuid;
  v_quantity numeric(10, 2);
begin
  if v_user_id is null then
    raise exception 'not_authenticated';
  end if;

  select * into v_item
  from public.shopping_list_items
  where id = p_shopping_list_item_id and user_id = v_user_id
  for update;

  if v_item.id is null then
    raise exception 'shopping_list_item_not_found';
  end if;

  if v_item.purchased then
    return v_item;
  end if;

  v_quantity := coalesce(p_actual_quantity, v_item.quantity);
  v_pantry_item_id := v_item.pantry_item_id;

  if v_pantry_item_id is null then
    insert into public.pantry_items (user_id, name, unit, quantity)
    values (v_user_id, v_item.name, v_item.unit, 0)
    returning id into v_pantry_item_id;
  end if;

  perform public.apply_inventory_event(
    v_pantry_item_id, 'purchase', v_quantity, 'shopping', 'Comprado via lista de compras'
  );

  update public.shopping_list_items
  set purchased = true,
      purchased_at = now(),
      pantry_item_id = v_pantry_item_id,
      quantity = v_quantity
  where id = p_shopping_list_item_id
  returning * into v_item;

  return v_item;
end;
$$;

grant execute on function public.mark_shopping_item_purchased(uuid, numeric) to authenticated;
