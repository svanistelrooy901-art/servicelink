-- New hosted projects can inherit broad Supabase default table grants.
-- A column GRANT alone does not remove inherited table-level SELECT.
-- Keep anonymous profile reads limited to the public projection.
revoke all on table public.sl_public_profiles from public, anon;
grant select (slug, profile, published_at) on public.sl_public_profiles to anon;
