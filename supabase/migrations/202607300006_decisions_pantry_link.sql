-- Milestone 11D (pantry/consumption/shopping integration into planning).
--
-- Additive, nullable column only: records the exact pantry_items.name a
-- nutrition decision named (Milestone 11C's decideDinnerEarly /
-- avoidTakeawayCommitment rules, when pantry data exists). The app reads
-- this on decision completion to auto-consume that pantry item via the
-- existing apply_inventory_event RPC (202607300003_pantry_shopping.sql),
-- closing the loop between "decide to eat X" and "pantry says X is gone"
-- without the founder re-entering it manually in /nutrition/pantry or Coach.
--
-- Deliberately a plain text column, not a foreign key to pantry_items: the
-- named item may have been renamed, fully consumed, or deleted by the time
-- the decision is completed, and the auto-consume path already handles a
-- missing match as a no-op (best-effort, never blocks completing the
-- decision). No RLS change needed — decisions already has row-level
-- security scoped to auth.uid() = user_id from Milestone 4.

alter table public.decisions
  add column related_pantry_item text;
