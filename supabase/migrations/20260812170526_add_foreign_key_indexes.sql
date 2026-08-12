-- Cover every foreign key reported by the Supabase performance advisor.
-- These indexes are additive and improve cascade deletes, joins and FK
-- checks as the invited-alpha dataset grows.

create index if not exists coach_messages_conversation_owner_idx
  on public.coach_messages (conversation_id, user_id);
create index if not exists decision_feedback_owner_idx
  on public.decision_feedback (decision_id, user_id);
create index if not exists decisions_calendar_connection_idx
  on public.decisions (calendar_connection_id);
create index if not exists decisions_run_owner_idx
  on public.decisions (decision_run_id, user_id);
create index if not exists health_observations_source_owner_idx
  on public.health_observations (health_source_id, user_id);
create index if not exists health_sync_runs_source_owner_idx
  on public.health_sync_runs (health_source_id, user_id);
create index if not exists health_sync_runs_user_idx
  on public.health_sync_runs (user_id);
create index if not exists inventory_events_item_owner_idx
  on public.inventory_events (pantry_item_id, user_id);
create index if not exists meal_plan_items_plan_owner_idx
  on public.meal_plan_items (meal_plan_id, user_id);
create index if not exists meal_plan_items_recipe_idx
  on public.meal_plan_items (recipe_id);
create index if not exists shopping_list_items_list_owner_idx
  on public.shopping_list_items (shopping_list_id, user_id);
create index if not exists shopping_list_items_user_idx
  on public.shopping_list_items (user_id);
create index if not exists training_plan_items_plan_owner_idx
  on public.training_plan_items (training_plan_id, user_id);
create index if not exists training_plan_items_session_idx
  on public.training_plan_items (session_id);
