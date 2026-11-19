-- Accept Photography profiles and project portfolios while preserving legacy gallery rows and media ownership.

begin;

create or replace function public.sl_valid_profile(p jsonb) returns boolean
language plpgsql stable security invoker set search_path = '' as $$
declare c jsonb; s jsonb; g jsonb; project jsonb; total_pictures integer:=0; known jsonb; v_id text; v_url text;
begin
 if p is null or jsonb_typeof(p) <> 'object' or octet_length(p::text)>1500000 then return false; end if;
 if (p - array['social','gallery','portfolio','banner','bannerPosition','name','slug','headline','category','bio','base','experienceYears','languages','whatsapp','showWhatsapp','photo','accent','coverage','services']) <> '{}'::jsonb then return false; end if;
 if not (p ?& array['name','slug','headline','category','bio','base','experienceYears','languages','whatsapp','showWhatsapp','photo','accent','coverage','services']) then return false; end if;
 foreach v_id in array array['name','slug','headline','category','bio','base','languages','whatsapp','photo','accent'] loop
  if jsonb_typeof(p->v_id) <> 'string' then return false; end if;
 end loop;
 if length(trim(p->>'name')) not between 1 and 80 or length(p->>'slug') not between 3 and 60 or (p->>'slug') !~ '^[a-z0-9]+(-[a-z0-9]+)*$' then return false; end if;
 if length(trim(p->>'headline')) not between 1 and 120 or length(trim(p->>'bio')) not between 1 and 1500 or length(p->>'base')>100 or length(p->>'languages')>120 then return false; end if;
 if (p->>'category') not in ('nanny','confinement','tutor','makeup','cleaning','photography') or (p->>'accent') not in ('forest','plum','ocean') then return false; end if;
 if jsonb_typeof(p->'experienceYears')<>'number' or (p->>'experienceYears')::numeric not between 0 and 70 or mod((p->>'experienceYears')::numeric,1)<>0 then return false; end if;
 if jsonb_typeof(p->'showWhatsapp')<>'boolean' then return false; end if;
 if (p->>'showWhatsapp')::boolean then
  if (p->>'whatsapp') !~ '^601[0-9]{8,9}$' then return false; end if;
 elsif p->>'whatsapp' <> '' then return false;
 end if;
 if not public.sl_valid_image_ref(p->>'photo',180000) then return false; end if;
 -- Banner fields are optional so earlier published profiles remain valid.
 if p ? 'banner' then
  if jsonb_typeof(p->'banner')<>'string' then return false; end if;
  if not public.sl_valid_image_ref(p->>'banner',220000) then return false; end if;
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
   if length(g->>'id') not between 1 and 80 or length(g->>'caption')>140 or length(g->>'src')>120000 or not public.sl_valid_image_ref(g->>'src',120000) or g->>'src'='' then return false; end if;
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

 if p ? 'portfolio' then
  if jsonb_typeof(p->'portfolio')<>'array' or jsonb_array_length(p->'portfolio')>6
     or coalesce(jsonb_array_length(p->'gallery'),0)<>0 then return false; end if;
  if (select count(distinct x->>'id') from jsonb_array_elements(p->'portfolio') x)
     <>jsonb_array_length(p->'portfolio') then return false; end if;
  for project in select * from jsonb_array_elements(p->'portfolio') loop
   if jsonb_typeof(project)<>'object'
      or (project-array['id','title','description','serviceId','pictures'])<>'{}'::jsonb
      or not(project ?& array['id','title','description','serviceId','pictures']) then return false; end if;
   foreach v_id in array array['id','title','description','serviceId'] loop
    if jsonb_typeof(project->v_id)<>'string' then return false; end if;
   end loop;
   if length(project->>'id') not between 1 and 80 or length(trim(project->>'title')) not between 1 and 100
      or length(project->>'title')>100 or length(project->>'description')>600
      or (project->>'serviceId'<>'' and not exists (
       select 1 from jsonb_array_elements(p->'services') svc where svc->>'id'=project->>'serviceId'
      )) or jsonb_typeof(project->'pictures')<>'array' then return false; end if;
   total_pictures:=total_pictures+jsonb_array_length(project->'pictures');
   if total_pictures>24 or (select count(distinct x->>'id') from jsonb_array_elements(project->'pictures') x)
      <>jsonb_array_length(project->'pictures') then return false; end if;
   for g in select * from jsonb_array_elements(project->'pictures') loop
   if jsonb_typeof(g)<>'object' or (g-array['id','src','caption'])<>'{}'::jsonb or not(g ?& array['id','src','caption']) then return false; end if;
   foreach v_id in array array['id','src','caption'] loop
    if jsonb_typeof(g->v_id)<>'string' then return false; end if;
   end loop;
   if length(g->>'id') not between 1 and 80 or length(g->>'caption')>140 or length(g->>'src')>120000 or not public.sl_valid_image_ref(g->>'src',120000) or g->>'src'='' then return false; end if;
   end loop;
  end loop;
 end if;
 return true;
exception when others then return false;
end $$;

create function sl_private.profile_pictures(p jsonb) returns setof jsonb
language sql immutable set search_path='' as $$
 select g from jsonb_array_elements(coalesce(p->'gallery','[]'::jsonb)) g
 union all
 select picture
 from jsonb_array_elements(coalesce(p->'portfolio','[]'::jsonb)) project,
      jsonb_array_elements(coalesce(project->'pictures','[]'::jsonb)) picture
$$;
revoke all on function sl_private.profile_pictures(jsonb) from public,anon,authenticated;


create or replace function sl_private.check_profile_media() returns trigger language plpgsql security definer set search_path='' as $$
declare p jsonb;g jsonb;begin
 perform pg_advisory_xact_lock(hashtextextended(new.user_id::text,0));
 if tg_table_name='sl_workspaces' then p:=new.draft;else p:=new.profile;end if;
 if octet_length(p::text)>64000 or not sl_private.owned_media(coalesce(p->>'photo',''),new.user_id,'portrait') or not sl_private.owned_media(coalesce(p->>'banner',''),new.user_id,'banner') then raise exception 'Use your own uploaded Service Link images.';end if;
 if p ? 'portfolio' and (jsonb_typeof(p->'portfolio')<>'array' or jsonb_array_length(p->'portfolio')>6 or (select count(*) from sl_private.profile_pictures(p))>24) then raise exception 'Use up to 6 projects and 24 portfolio pictures.';end if;
 for g in select * from sl_private.profile_pictures(p) loop
 if coalesce(g->>'src','')='' or not sl_private.owned_media(g->>'src',new.user_id,'gallery') then raise exception 'Use your own uploaded gallery pictures.';end if;end loop;
 return new;end $$;

create or replace function public.sl_media_access(p_id uuid,p_owner uuid default null,p_booking uuid default null,p_token_hash text default null) returns text language plpgsql stable security definer set search_path='' as $$
declare a sl_private.media_assets;ref text:='/api/media/'||p_id::text||'.webp';begin
 select * into a from sl_private.media_assets where id=p_id and state='ready';if a.id is null then return null;end if;
 if a.owner_id=p_owner then return a.object_key;end if;
 if a.kind<>'qr' and exists(select 1 from public.sl_public_profiles p where p.user_id=a.owner_id and (p.profile->>'photo'=ref or p.profile->>'banner'=ref or exists(select 1 from sl_private.profile_pictures(p.profile) g where g->>'src'=ref))) then return a.object_key;end if;
 if a.kind='qr' and p_token_hash ~ '^[0-9a-f]{64}$' and exists(select 1 from public.sl_bookings b where b.id=p_booking and b.customer_token_hash=p_token_hash and b.payment_snapshot->>'qrPhoto'=ref and b.status in ('accepted','confirmed','completed') and (b.status in ('confirmed','completed') or b.payment_deadline>now())) then return a.object_key;end if;
 return null;end $$;

commit;
