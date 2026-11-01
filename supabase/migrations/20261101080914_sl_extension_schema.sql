-- Keep extension objects outside the API-exposed public schema.
-- Existing exclusion constraints retain their operator-class OIDs.
create schema if not exists extensions;
alter extension btree_gist set schema extensions;
-- Cover booking event lookup/deletion by its parent booking.
create index if not exists booking_events_booking_id_idx on sl_private.booking_events (booking_id);
-- Hosted default function grants can include anon independently of PUBLIC.
-- The function already rejects missing auth.uid(); remove the unnecessary route too.
revoke all on function public.sl_write_workspace(jsonb,jsonb,integer,text) from anon;
