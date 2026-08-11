# Calendar privacy and least privilege

Status: implemented in the calendar privacy hardening slice.

## User-facing contract

- Every discovered Google or Outlook calendar defaults to `availability_only`.
- In that mode the provider request is field-minimized to timing/availability data.
- The user may opt a specific calendar into `metadata_allowed`, which permits only title and location.
- Descriptions, attendees and attachments are never requested.
- Events marked private, personal or confidential never expose metadata, even after calendar-level opt-in.
- External calendar events are fetched on demand and are not persisted in the Rebuild database.
- Raw calendar titles are not included in the AI Coach context.

## Google authorization model

Initial connection requests read-only event access plus read-only calendar-list access. Creating or
moving Rebuild events requires a separate, explicit authorization upgrade. Server-side write helpers
also verify the stored scopes, so a read-only connection cannot be used as a write destination even
if a client sends its id manually.

Existing connections that already granted write access remain compatible and are displayed as able
to add events. A user can disconnect any account at any time from Settings.

## Storage

`calendar_sources.privacy_mode` is the user-controlled per-calendar boundary. Its allowed values are
`availability_only` and `metadata_allowed`; the database default is the safer first value.

The application stores encrypted OAuth tokens and calendar-source preferences, not copies of
external calendar events.
