-- SL-only staging media registry. R2 objects remain private; the Worker authorizes reads.
begin;
create table sl_private.media_assets (
 id uuid primary key, owner_id uuid not null references auth.users(id) on delete cascade,
 kind text not null check(kind in ('portrait','banner','gallery','qr')),
 object_key text not null unique,bytes integer not null check(bytes between 1 and 170000),
 state text not null check(state in ('pending','ready','failed','deleting')),created_at timestamptz not null default now()
);
alter table sl_private.media_assets enable row level security;
revoke all on sl_private.media_assets from public,anon,authenticated;
create index media_owner_idx on sl_private.media_assets(owner_id,state);
create index media_created_idx on sl_private.media_assets(created_at);
create function public.sl_media_reserve(p_id uuid,p_owner uuid,p_kind text,p_bytes integer) returns text language plpgsql security definer set search_path='' as $$
declare result_key text:=p_owner::text||'/'||p_id::text||'.webp';begin
 perform pg_advisory_xact_lock(hashtextextended(p_owner::text,0));
 if p_kind not in ('portrait','banner','gallery','qr') or (p_bytes<1 or p_bytes>(case p_kind when 'gallery' then 90000 when 'banner' then 165000 else 135000 end)) then raise exception 'Invalid media size.';end if;
 if (select count(*) from sl_private.media_assets where owner_id=p_owner and state in ('pending','ready'))>=32 or coalesce((select sum(bytes) from sl_private.media_assets where owner_id=p_owner and state in ('pending','ready')),0)+p_bytes>5000000 then raise exception 'Media quota reached.';end if;
 insert into sl_private.media_assets(id,owner_id,kind,object_key,bytes,state) values(p_id,p_owner,p_kind,result_key,p_bytes,'pending');return result_key;end $$;
revoke all on function public.sl_media_reserve(uuid,uuid,text,integer) from public,anon,authenticated;
grant execute on function public.sl_media_reserve(uuid,uuid,text,integer) to service_role;
create function public.sl_media_finish(p_id uuid,p_owner uuid,p_state text) returns void language plpgsql security definer set search_path='' as $$
begin
 if p_state not in ('ready','failed') then raise exception 'Invalid media state.';end if;
 update sl_private.media_assets set state=p_state where id=p_id and owner_id=p_owner and state='pending';
 if not found then raise exception 'Media upload unavailable.';end if;end $$;
revoke all on function public.sl_media_finish(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.sl_media_finish(uuid,uuid,text) to service_role;
create function public.sl_media_access(p_id uuid,p_owner uuid default null,p_booking uuid default null,p_token_hash text default null) returns text language plpgsql stable security definer set search_path='' as $$
declare a sl_private.media_assets;ref text:='/api/media/'||p_id::text||'.webp';begin
 select * into a from sl_private.media_assets where id=p_id and state='ready';if a.id is null then return null;end if;
 if a.owner_id=p_owner then return a.object_key;end if;
 if a.kind<>'qr' and exists(select 1 from public.sl_public_profiles p where p.user_id=a.owner_id and (p.profile->>'photo'=ref or p.profile->>'banner'=ref or exists(select 1 from jsonb_array_elements(coalesce(p.profile->'gallery','[]'::jsonb)) g where g->>'src'=ref))) then return a.object_key;end if;
 if a.kind='qr' and p_token_hash ~ '^[0-9a-f]{64}$' and exists(select 1 from public.sl_bookings b where b.id=p_booking and b.customer_token_hash=p_token_hash and b.payment_snapshot->>'qrPhoto'=ref and b.status in ('accepted','confirmed','completed') and (b.status in ('confirmed','completed') or b.payment_deadline>now())) then return a.object_key;end if;
 return null;end $$;
revoke all on function public.sl_media_access(uuid,uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.sl_media_access(uuid,uuid,uuid,text) to service_role;

create function public.sl_valid_image_ref(p_value text,p_limit integer) returns boolean language sql immutable security invoker set search_path='' as $$
 select p_value='' or (p_value ~ '^data:image/webp;base64,[A-Za-z0-9+/=]+$' and length(p_value)<=p_limit) or p_value ~ '^/api/media/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}[.]webp$'
$$;
revoke all on function public.sl_valid_image_ref(text,integer) from public;
grant execute on function public.sl_valid_image_ref(text,integer) to anon,authenticated;
create function sl_private.owned_media(p_ref text,p_owner uuid,p_kind text) returns boolean language sql volatile security definer set search_path='' as $$
 select p_ref='' or exists(select 1 from sl_private.media_assets a where '/api/media/'||a.id::text||'.webp'=p_ref and a.owner_id=p_owner and a.kind=p_kind and a.state='ready')
$$;
revoke all on function sl_private.owned_media(text,uuid,text) from public,anon,authenticated;
create function sl_private.check_profile_media() returns trigger language plpgsql security definer set search_path='' as $$
declare p jsonb;g jsonb;begin
 perform pg_advisory_xact_lock(hashtextextended(new.user_id::text,0));
 if tg_table_name='sl_workspaces' then p:=new.draft;else p:=new.profile;end if;
 if octet_length(p::text)>64000 or not sl_private.owned_media(coalesce(p->>'photo',''),new.user_id,'portrait') or not sl_private.owned_media(coalesce(p->>'banner',''),new.user_id,'banner') then raise exception 'Use your own uploaded Service Link images.';end if;
 for g in select * from jsonb_array_elements(coalesce(p->'gallery','[]'::jsonb)) loop
 if not sl_private.owned_media(g->>'src',new.user_id,'gallery') then raise exception 'Use your own uploaded gallery pictures.';end if;end loop;
 return new;end $$;
revoke all on function sl_private.check_profile_media() from public,anon,authenticated;
create trigger sl_workspace_media before insert or update on public.sl_workspaces for each row execute function sl_private.check_profile_media();
create trigger sl_public_media before insert or update on public.sl_public_profiles for each row execute function sl_private.check_profile_media();
create function sl_private.check_payment_media() returns trigger language plpgsql security definer set search_path='' as $$
begin perform pg_advisory_xact_lock(hashtextextended(new.user_id::text,0)); if not sl_private.owned_media(coalesce(new.payment_details->>'qrPhoto',''),new.user_id,'qr') then raise exception 'Use your own uploaded payment QR.';end if;return new;end $$;
revoke all on function sl_private.check_payment_media() from public,anon,authenticated;
create trigger sl_payment_media before insert or update of payment_details on public.sl_booking_settings for each row execute function sl_private.check_payment_media();

-- Only unreferenced uploads older than seven days can be removed. Marking first prevents a racing save.
create function public.sl_media_gc(p_owner uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare ids uuid[];begin
 perform pg_advisory_xact_lock(hashtextextended(p_owner::text,0));
 select array_agg(a.id) into ids from sl_private.media_assets a where a.owner_id=p_owner and (a.state='deleting' or a.created_at<now()-interval '7 days')
 and not exists(select 1 from public.sl_workspaces w where w.user_id=p_owner and position('/api/media/'||a.id::text||'.webp' in w.draft::text)>0)
 and not exists(select 1 from public.sl_public_profiles p where p.user_id=p_owner and position('/api/media/'||a.id::text||'.webp' in p.profile::text)>0)
 and not exists(select 1 from public.sl_booking_settings s where s.user_id=p_owner and position('/api/media/'||a.id::text||'.webp' in s.payment_details::text)>0)
 and not exists(select 1 from public.sl_bookings b where b.provider_id=p_owner and position('/api/media/'||a.id::text||'.webp' in coalesce(b.payment_snapshot::text,''))>0);
 update sl_private.media_assets set state='deleting' where id=any(ids);
 return coalesce((select jsonb_agg(jsonb_build_object('id',id,'key',object_key)) from sl_private.media_assets where id=any(ids)),'[]'::jsonb);end $$;
revoke all on function public.sl_media_gc(uuid) from public,anon,authenticated;
grant execute on function public.sl_media_gc(uuid) to service_role;
create function public.sl_media_deleted(p_id uuid,p_owner uuid) returns void language sql security definer set search_path='' as $$delete from sl_private.media_assets where id=p_id and owner_id=p_owner and state='deleting'$$;
revoke all on function public.sl_media_deleted(uuid,uuid) from public,anon,authenticated;
grant execute on function public.sl_media_deleted(uuid,uuid) to service_role;

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
 return true;
exception when others then return false;
end $$;
revoke all on function public.sl_valid_profile(jsonb) from public;
grant execute on function public.sl_valid_profile(jsonb) to anon, authenticated;

create or replace function sl_private.valid_booking_settings(p jsonb) returns boolean language plpgsql stable security invoker set search_path='' as $$
declare d jsonb;v text;begin
 if p is null or jsonb_typeof(p)<>'object' or octet_length(p::text)>200000 or
 (p-array['enabled','weekly','noticeMinutes','bufferMinutes','modes','payment'])<>'{}'::jsonb or not(p ?& array['enabled','weekly','noticeMinutes','bufferMinutes','modes','payment']) then return false; end if;
 if jsonb_typeof(p->'enabled')<>'boolean' or jsonb_typeof(p->'weekly')<>'array' or jsonb_array_length(p->'weekly')<>7 or jsonb_typeof(p->'modes')<>'object' or jsonb_typeof(p->'payment')<>'object' then return false; end if;
 if jsonb_typeof(p->'noticeMinutes')<>'number' or (p->>'noticeMinutes')::numeric not between 0 and 43200 or mod((p->>'noticeMinutes')::numeric,1)<>0 or jsonb_typeof(p->'bufferMinutes')<>'number' or (p->>'bufferMinutes')::numeric not between 0 and 180 or mod((p->>'bufferMinutes')::numeric,1)<>0 then return false; end if;
 if (select count(distinct x->>'day') from jsonb_array_elements(p->'weekly') x)<>7 then return false; end if;
 for d in select * from jsonb_array_elements(p->'weekly') loop
 if (d-array['day','enabled','start','end'])<>'{}'::jsonb or not(d ?& array['day','enabled','start','end']) or jsonb_typeof(d->'day')<>'number' or (d->>'day')::int not between 0 and 6 or mod((d->>'day')::numeric,1)<>0 or jsonb_typeof(d->'enabled')<>'boolean' or jsonb_typeof(d->'start')<>'string' or jsonb_typeof(d->'end')<>'string' or (d->>'start') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' or (d->>'end') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' or d->>'start'>=d->>'end' then return false; end if;
 end loop;
 if (select count(*) from jsonb_each(p->'modes'))>20 then return false; end if;
 if exists(select 1 from jsonb_each(p->'modes') e where length(e.key) not between 1 and 80 or jsonb_typeof(e.value)<>'string' or e.value#>>'{}' not in ('appointment','date-range')) then return false; end if;
 d:=p->'payment';
 if (d-array['bankName','accountName','accountNumber','instructions','qrPhoto'])<>'{}'::jsonb or not(d ?& array['bankName','accountName','accountNumber','instructions','qrPhoto']) then return false; end if;
 foreach v in array array['bankName','accountName','accountNumber','instructions','qrPhoto'] loop if jsonb_typeof(d->v)<>'string' then return false; end if;end loop;
 if length(d->>'bankName')>80 or length(d->>'accountName')>120 or length(d->>'accountNumber')>40 or length(d->>'instructions')>600 then return false; end if;
 if not public.sl_valid_image_ref(d->>'qrPhoto',180000) then return false;end if;
 return true;exception when others then return false;end $$;
revoke all on function sl_private.valid_booking_settings(jsonb) from public,anon,authenticated;


commit;
