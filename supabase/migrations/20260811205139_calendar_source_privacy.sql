-- Calendar privacy controls.
--
-- External calendar events are fetched on demand and are not persisted by
-- Rebuild. This setting controls which event fields the provider adapter is
-- allowed to request and expose to the workspace for each individual
-- calendar. The safe default is availability only.

alter table public.calendar_sources
  add column privacy_mode text not null default 'availability_only'
  check (privacy_mode in ('availability_only', 'metadata_allowed'));

comment on column public.calendar_sources.privacy_mode is
  'availability_only requests and exposes only scheduling fields; metadata_allowed may additionally expose title and location. Event descriptions, attendees and attachments are never requested for Rebuild calendar context.';
