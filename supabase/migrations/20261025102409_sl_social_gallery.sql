-- Service Link only. Social/gallery review preparation; no hosted migration applied.
-- Inline WebP is demo preparation only. Hosted uploads stay disabled until SL R2 is ready.
-- Bound the combined portrait/banner/gallery JSON while preserving legacy profiles and existing RLS/grants.
begin;
alter table public.sl_workspaces drop constraint sl_workspaces_draft_check;
alter table public.sl_workspaces add constraint sl_workspaces_draft_check
 check (jsonb_typeof(draft) = 'object' and octet_length(draft::text) <= 1500000);

create or replace function public.sl_valid_profile(p jsonb) returns boolean
language plpgsql stable security invoker set search_path = '' as $$
declare c jsonb; s jsonb; g jsonb; known jsonb; v_id text; v_url text;
begin
 if p is null or jsonb_typeof(p) <> 'object' or octet_length(p::text)>1500000 then return false; end if;
 if (p - array['social','gallery','banner','bannerPosition','name','slug','headline','category','bio','base','experienceYears','languages','whatsapp','showWhatsapp','photo','accent','coverage','services']) <> '{}'::jsonb then return false; end if;
 if not (p ?& array['name','slug','headline','category','bio','base','experienceYears','languages','whatsapp','showWhatsapp','photo','accent','coverage','services']) then return false; end if;
 foreach v_id in array array['name','slug','headline','category','bio','base','languages','whatsapp','photo','accent'] loop
  if jsonb_typeof(p->v_id) <> 'string' then return false; end if;
 end loop;
 if length(trim(p->>'name')) not between 1 and 80 or length(p->>'slug') not between 3 and 60 or (p->>'slug') !~ '^[a-z0-9]+(-[a-z0-9]+)*$' then return false; end if;
 if length(trim(p->>'headline')) not between 1 and 120 or length(trim(p->>'bio')) not between 1 and 1500 or length(p->>'base')>100 or length(p->>'languages')>120 then return false; end if;
 if (p->>'category') not in ('nanny','confinement','tutor','makeup','cleaning') or (p->>'accent') not in ('forest','plum','ocean') then return false; end if;
 if jsonb_typeof(p->'experienceYears')<>'number' or (p->>'experienceYears')::numeric not between 0 and 70 or mod((p->>'experienceYears')::numeric,1)<>0 then return false; end if;
 if jsonb_typeof(p->'showWhatsapp')<>'boolean' then return false; end if;
 if (p->>'showWhatsapp')::boolean then
  if (p->>'whatsapp') !~ '^601[0-9]{8,9}$' then return false; end if;
 elsif p->>'whatsapp' <> '' then return false;
 end if;
 if p->>'photo'<>'' and ((p->>'photo') !~ '^data:image/webp;base64,[A-Za-z0-9+/=]+$' or length(p->>'photo')>180000) then return false; end if;
 -- Banner fields are optional so earlier published profiles remain valid.
 if p ? 'banner' then
  if jsonb_typeof(p->'banner')<>'string' then return false; end if;
  if p->>'banner'<>'' and ((p->>'banner') !~ '^data:image/webp;base64,[A-Za-z0-9+/=]+$' or length(p->>'banner')>220000) then return false; end if;
 end if;
 if p ? 'bannerPosition' then
  if jsonb_typeof(p->'bannerPosition')<>'number' then return false; end if;
  if (p->>'bannerPosition')::numeric not between 0 and 100 or mod((p->>'bannerPosition')::numeric,1)<>0 then return false; end if;
 end if;
 -- These additions are optional for existing public snapshots.
 if p ? 'social' then
  if jsonb_typeof(p->'social')<>'object' or ((p->'social') - array['facebook','instagram','threads'])<>'{}'::jsonb or not ((p->'social') ?& array['facebook','instagram','threads']) then return false; end if;
  foreach v_id in array array['facebook','instagram','threads'] loop
   if jsonb_typeof(p->'social'->v_id)<>'string' then return false; end if;
   v_url := p->'social'->>v_id;
   if length(v_url)>500 or v_url ~ '[[:space:]\\<>]' then return false; end if;
   if v_url<>'' then
    if v_id='facebook' and v_url !~* '^https://((www[.]|m[.])?facebook[.]com|(www[.])?fb[.]com)([/?#].*)?$' then return false; end if;
    if v_id='instagram' and v_url !~* '^https://(www[.])?instagram[.]com([/?#].*)?$' then return false; end if;
    if v_id='threads' and v_url !~* '^https://(www[.])?threads[.](com|net)([/?#].*)?$' then return false; end if;
   end if;
  end loop;
 end if;
 if p ? 'gallery' then
  if jsonb_typeof(p->'gallery')<>'array' then return false; end if;
  if jsonb_array_length(p->'gallery')>8 then return false; end if;
  if (select count(distinct x->>'id') from jsonb_array_elements(p->'gallery') x)<>jsonb_array_length(p->'gallery') then return false; end if;
  for g in select * from jsonb_array_elements(p->'gallery') loop
   if jsonb_typeof(g)<>'object' or (g-array['id','src','caption'])<>'{}'::jsonb or not(g ?& array['id','src','caption']) then return false; end if;
   foreach v_id in array array['id','src','caption'] loop
    if jsonb_typeof(g->v_id)<>'string' then return false; end if;
   end loop;
   if length(g->>'id') not between 1 and 80 or length(g->>'caption')>140 or length(g->>'src')>120000 or (g->>'src') !~ '^data:image/webp;base64,[A-Za-z0-9+/=]+$' then return false; end if;
  end loop;
 end if;
 if jsonb_typeof(p->'coverage')<>'array' or jsonb_typeof(p->'services')<>'array' then return false; end if;
 if jsonb_array_length(p->'coverage') not between 1 and 16 or jsonb_array_length(p->'services') not between 1 and 20 then return false; end if;
 if (select count(distinct x->>'stateId') from jsonb_array_elements(p->'coverage') x) <> jsonb_array_length(p->'coverage') then return false; end if;
 for c in select * from jsonb_array_elements(p->'coverage') loop
  if jsonb_typeof(c)<>'object' or (c - array['stateId','wholeState','subdivisionIds'])<>'{}'::jsonb or not (c ?& array['stateId','wholeState','subdivisionIds']) then return false; end if;
  if jsonb_typeof(c->'stateId')<>'string' or jsonb_typeof(c->'wholeState')<>'boolean' or jsonb_typeof(c->'subdivisionIds')<>'array' then return false; end if;
  select subdivisions into known from public.sl_geography where id=c->>'stateId';
  if known is null then return false; end if;
  if (c->>'wholeState')::boolean then
   if jsonb_array_length(c->'subdivisionIds')<>0 then return false; end if;
  else
   if jsonb_array_length(c->'subdivisionIds')=0 then return false; end if;
   if (select count(distinct x) from jsonb_array_elements_text(c->'subdivisionIds') x)<>jsonb_array_length(c->'subdivisionIds') then return false; end if;
   for v_id in select * from jsonb_array_elements_text(c->'subdivisionIds') loop
    if not exists (select 1 from jsonb_array_elements(known) x where x->>'id'=v_id) then return false; end if;
   end loop;
  end if;
 end loop;
 if (select count(distinct x->>'id') from jsonb_array_elements(p->'services') x)<>jsonb_array_length(p->'services') then return false; end if;
 for s in select * from jsonb_array_elements(p->'services') loop
  if jsonb_typeof(s)<>'object' or (s-array['id','name','description','price','priceBasis','durationMinutes','delivery'])<>'{}'::jsonb or not(s ?& array['id','name','description','price','priceBasis','durationMinutes','delivery']) then return false; end if;
  if jsonb_typeof(s->'id')<>'string' or length(s->>'id') not between 1 and 80 or jsonb_typeof(s->'name')<>'string' or length(trim(s->>'name')) not between 1 and 100 or jsonb_typeof(s->'description')<>'string' or length(s->>'description')>600 then return false; end if;
  if jsonb_typeof(s->'priceBasis')<>'string' or jsonb_typeof(s->'delivery')<>'string' then return false; end if;
  if s->>'priceBasis' not in ('hour','session','day','package','quote') or s->>'delivery' not in ('in-person','online','both') then return false; end if;
  if s->'price'='null'::jsonb then
   if s->>'priceBasis'<>'quote' then return false; end if;
  elsif jsonb_typeof(s->'price')<>'number' or (s->>'price')::numeric not between 0 and 100000 then return false;
  end if;
  if s->'durationMinutes'<>'null'::jsonb and (jsonb_typeof(s->'durationMinutes')<>'number' or (s->>'durationMinutes')::numeric not between 15 and 43200 or mod((s->>'durationMinutes')::numeric,1)<>0) then return false; end if;
 end loop;
 return true;
exception when others then return false;
end $$;
revoke all on function public.sl_valid_profile(jsonb) from public;
grant execute on function public.sl_valid_profile(jsonb) to anon, authenticated;


commit;
