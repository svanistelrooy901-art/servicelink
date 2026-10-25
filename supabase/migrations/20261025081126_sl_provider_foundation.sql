-- Service Link only. Prepared for review; not applied to any hosted project.
-- One account = one provider workspace in this foundation. No membership or payment grants.
create table public.sl_geography (
 id text primary key,
 name text not null,
 subdivisions jsonb not null check (jsonb_typeof(subdivisions) = 'array')
);
alter table public.sl_geography enable row level security;
create policy geography_read on public.sl_geography for select to anon, authenticated using (true);
grant select on public.sl_geography to anon, authenticated;

create table public.sl_workspaces (
 user_id uuid primary key references auth.users(id) on delete cascade,
 draft jsonb not null check (jsonb_typeof(draft) = 'object' and octet_length(draft::text) <= 250000),
 revision integer not null default 0 check (revision >= 0),
 saved_at timestamptz not null default now()
);
alter table public.sl_workspaces enable row level security;
create policy workspace_select on public.sl_workspaces for select to authenticated using ((select auth.uid()) = user_id);
create policy workspace_insert on public.sl_workspaces for insert to authenticated with check ((select auth.uid()) = user_id);
create policy workspace_update on public.sl_workspaces for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
grant select, insert, update on public.sl_workspaces to authenticated;
revoke all on public.sl_workspaces from anon;

-- Validate the public shape on the server as well as the client. Unknown keys are rejected.
create function public.sl_valid_profile(p jsonb) returns boolean
language plpgsql stable security invoker set search_path = '' as $$
declare c jsonb; s jsonb; known jsonb; v_id text;
begin
 if p is null or jsonb_typeof(p) <> 'object' or octet_length(p::text)>250000 then return false; end if;
 if (p - array['name','slug','headline','category','bio','base','experienceYears','languages','whatsapp','showWhatsapp','photo','accent','coverage','services']) <> '{}'::jsonb then return false; end if;
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

create table public.sl_public_profiles (
 user_id uuid primary key references auth.users(id) on delete cascade,
 slug text not null unique,
 profile jsonb not null check (public.sl_valid_profile(profile)),
 published_at timestamptz not null default now(),
 check (slug=profile->>'slug')
);
alter table public.sl_public_profiles enable row level security;
create policy published_read on public.sl_public_profiles for select to anon, authenticated using (true);
create policy published_insert on public.sl_public_profiles for insert to authenticated with check ((select auth.uid()) = user_id);
create policy published_update on public.sl_public_profiles for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy published_delete on public.sl_public_profiles for delete to authenticated using ((select auth.uid()) = user_id);
grant select (slug,profile,published_at) on public.sl_public_profiles to anon;
grant select, insert, update, delete on public.sl_public_profiles to authenticated;
create index sl_public_profiles_published_at_idx on public.sl_public_profiles (published_at desc);

-- Atomic save/publish/unpublish. Invoker privileges and RLS apply throughout.
create function public.sl_write_workspace(p_draft jsonb,p_snapshot jsonb,p_revision integer,p_action text) returns void
language plpgsql security invoker set search_path = '' as $$
declare current_revision integer; owner_id uuid := auth.uid();
begin
 if owner_id is null then raise exception 'Sign in before editing a profile.'; end if;
 if p_action not in ('save','publish','unpublish') or p_action is null or p_revision is null or p_revision<0 then raise exception 'Invalid workspace action.'; end if;
 if p_action <> 'unpublish' and (p_draft is null or jsonb_typeof(p_draft)<>'object') then raise exception 'A profile draft is required.'; end if;
 if p_action='unpublish' and not exists (select 1 from public.sl_workspaces where user_id=owner_id) then return; end if;
 insert into public.sl_workspaces (user_id,draft) values(owner_id,coalesce(p_draft,'{}'::jsonb)) on conflict do nothing;
 select revision into current_revision from public.sl_workspaces where user_id=owner_id for update;
 if current_revision<>p_revision then raise exception 'This profile changed in another tab. Reload before saving.'; end if;
 if p_action='publish' then
  if p_snapshot is null or not public.sl_valid_profile(p_snapshot) then raise exception 'Complete the required public profile fields.'; end if;
  -- The snapshot can only differ from the draft by trimming public text and hiding/normalizing WhatsApp.
  if (p_draft - array['name','headline','bio','base','languages','whatsapp','services']) <> (p_snapshot - array['name','headline','bio','base','languages','whatsapp','services']) then raise exception 'Publication must match your draft.'; end if;
  insert into public.sl_public_profiles(user_id,slug,profile,published_at) values(owner_id,p_snapshot->>'slug',p_snapshot,now())
  on conflict(user_id) do update set slug=excluded.slug,profile=excluded.profile,published_at=excluded.published_at;
 elsif p_action='unpublish' then delete from public.sl_public_profiles where user_id=owner_id;
 end if;
 update public.sl_workspaces set draft=case when p_action='unpublish' then draft else p_draft end,revision=current_revision+1,saved_at=now() where user_id=owner_id;
end $$;
revoke all on function public.sl_write_workspace(jsonb,jsonb,integer,text) from public;
grant execute on function public.sl_write_workspace(jsonb,jsonb,integer,text) to authenticated;

-- Generated from app/src/data/malaysia.json. Do not edit independently.
insert into public.sl_geography(id,name,subdivisions) values
('my-01','Johor','[{"id":"my-01-01","name":"Batu Pahat"},{"id":"my-01-02","name":"Johor Bahru"},{"id":"my-01-03","name":"Kluang"},{"id":"my-01-04","name":"Kota Tinggi"},{"id":"my-01-05","name":"Mersing"},{"id":"my-01-06","name":"Muar"},{"id":"my-01-07","name":"Pontian"},{"id":"my-01-08","name":"Segamat"},{"id":"my-01-09","name":"Kulai"},{"id":"my-01-10","name":"Tangkak"}]'),
('my-02','Kedah','[{"id":"my-02-01","name":"Baling"},{"id":"my-02-02","name":"Bandar Baharu"},{"id":"my-02-03","name":"Kota Setar"},{"id":"my-02-04","name":"Kuala Muda"},{"id":"my-02-05","name":"Kubang Pasu"},{"id":"my-02-06","name":"Kulim"},{"id":"my-02-07","name":"Langkawi"},{"id":"my-02-08","name":"Padang Terap"},{"id":"my-02-09","name":"Sik"},{"id":"my-02-10","name":"Yan"},{"id":"my-02-11","name":"Pendang"},{"id":"my-02-12","name":"Pokok Sena"}]'),
('my-03','Kelantan','[{"id":"my-03-01","name":"Bachok"},{"id":"my-03-02","name":"Kota Bharu"},{"id":"my-03-03","name":"Machang"},{"id":"my-03-04","name":"Pasir Mas"},{"id":"my-03-05","name":"Pasir Puteh"},{"id":"my-03-06","name":"Tanah Merah"},{"id":"my-03-07","name":"Tumpat"},{"id":"my-03-08","name":"Gua Musang"},{"id":"my-03-09","name":"Kuala Krai"},{"id":"my-03-10","name":"Jeli"},{"id":"my-03-11","name":"Kecil Lojing"}]'),
('my-04','Melaka','[{"id":"my-04-01","name":"Alor Gajah"},{"id":"my-04-02","name":"Jasin"},{"id":"my-04-03","name":"Melaka Tengah"}]'),
('my-05','Negeri Sembilan','[{"id":"my-05-01","name":"Jelebu"},{"id":"my-05-02","name":"Kuala Pilah"},{"id":"my-05-03","name":"Port Dickson"},{"id":"my-05-04","name":"Rembau"},{"id":"my-05-05","name":"Seremban"},{"id":"my-05-06","name":"Tampin"},{"id":"my-05-07","name":"Jempol"}]'),
('my-06','Pahang','[{"id":"my-06-01","name":"Bentong"},{"id":"my-06-02","name":"Cameron Highlands"},{"id":"my-06-03","name":"Jerantut"},{"id":"my-06-04","name":"Kuantan"},{"id":"my-06-05","name":"Lipis"},{"id":"my-06-06","name":"Pekan"},{"id":"my-06-07","name":"Raub"},{"id":"my-06-08","name":"Temerloh"},{"id":"my-06-09","name":"Rompin"},{"id":"my-06-10","name":"Maran"},{"id":"my-06-11","name":"Bera"}]'),
('my-07','Pulau Pinang','[{"id":"my-07-01","name":"Seberang Perai Tengah"},{"id":"my-07-02","name":"Seberang Perai Utara"},{"id":"my-07-03","name":"Seberang Perai Selatan"},{"id":"my-07-04","name":"Timur Laut"},{"id":"my-07-05","name":"Barat Daya"}]'),
('my-08','Perak','[{"id":"my-08-01","name":"Batang Padang"},{"id":"my-08-02","name":"Manjung"},{"id":"my-08-03","name":"Kinta"},{"id":"my-08-04","name":"Kerian"},{"id":"my-08-05","name":"Kuala Kangsar"},{"id":"my-08-06","name":"Larut dan Matang"},{"id":"my-08-07","name":"Hilir Perak"},{"id":"my-08-08","name":"Hulu Perak"},{"id":"my-08-09","name":"Perak Tengah"},{"id":"my-08-10","name":"Kampar"},{"id":"my-08-11","name":"Muallim"},{"id":"my-08-12","name":"Bagan Datuk"},{"id":"my-08-13","name":"Selama"}]'),
('my-09','Perlis','[{"id":"my-09-01","name":"Perlis"}]'),
('my-10','Selangor','[{"id":"my-10-01","name":"Gombak"},{"id":"my-10-02","name":"Klang"},{"id":"my-10-03","name":"Kuala Langat"},{"id":"my-10-04","name":"Kuala Selangor"},{"id":"my-10-05","name":"Petaling"},{"id":"my-10-06","name":"Sabak Bernam"},{"id":"my-10-07","name":"Sepang"},{"id":"my-10-08","name":"Ulu Langat"},{"id":"my-10-09","name":"Ulu Selangor"}]'),
('my-11','Terengganu','[{"id":"my-11-01","name":"Besut"},{"id":"my-11-02","name":"Dungun"},{"id":"my-11-03","name":"Kemaman"},{"id":"my-11-04","name":"Kuala Terengganu"},{"id":"my-11-05","name":"Marang"},{"id":"my-11-06","name":"Hulu Terengganu"},{"id":"my-11-07","name":"Setiu"},{"id":"my-11-08","name":"Kuala Nerus"}]'),
('my-12','Sabah','[{"id":"my-12-01","name":"Tawau"},{"id":"my-12-02","name":"Lahad Datu"},{"id":"my-12-03","name":"Semporna"},{"id":"my-12-04","name":"Sandakan"},{"id":"my-12-05","name":"Kinabatangan"},{"id":"my-12-06","name":"Beluran"},{"id":"my-12-07","name":"Kota Kinabalu"},{"id":"my-12-08","name":"Ranau"},{"id":"my-12-09","name":"Kota Belud"},{"id":"my-12-10","name":"Tuaran"},{"id":"my-12-11","name":"Penampang"},{"id":"my-12-12","name":"Papar"},{"id":"my-12-13","name":"Kudat"},{"id":"my-12-14","name":"Kota Marudu"},{"id":"my-12-15","name":"Pitas"},{"id":"my-12-16","name":"Beaufort"},{"id":"my-12-17","name":"Kuala Penyu"},{"id":"my-12-18","name":"Sipitang"},{"id":"my-12-19","name":"Tenom"},{"id":"my-12-20","name":"Nabawan"},{"id":"my-12-21","name":"Keningau"},{"id":"my-12-22","name":"Tambunan"},{"id":"my-12-23","name":"Kunak"},{"id":"my-12-24","name":"Tongod"},{"id":"my-12-25","name":"Putatan"},{"id":"my-12-26","name":"Telupid"},{"id":"my-12-27","name":"Kalabakan"}]'),
('my-13','Sarawak','[{"id":"my-13-01","name":"Kuching"},{"id":"my-13-02","name":"Bau"},{"id":"my-13-03","name":"Lundu"},{"id":"my-13-04","name":"Samarahan"},{"id":"my-13-05","name":"Serian"},{"id":"my-13-06","name":"Simunjan"},{"id":"my-13-07","name":"Sri Aman"},{"id":"my-13-08","name":"Lubok Antu"},{"id":"my-13-09","name":"Betong"},{"id":"my-13-10","name":"Saratok"},{"id":"my-13-11","name":"Sarikei"},{"id":"my-13-12","name":"Maradong"},{"id":"my-13-13","name":"Daro"},{"id":"my-13-14","name":"Julau"},{"id":"my-13-15","name":"Sibu"},{"id":"my-13-16","name":"Dalat"},{"id":"my-13-17","name":"Mukah"},{"id":"my-13-18","name":"Kanowit"},{"id":"my-13-19","name":"Bintulu"},{"id":"my-13-20","name":"Tatau"},{"id":"my-13-21","name":"Kapit"},{"id":"my-13-22","name":"Song"},{"id":"my-13-23","name":"Belaga"},{"id":"my-13-24","name":"Miri"},{"id":"my-13-25","name":"Marudi"},{"id":"my-13-26","name":"Limbang"},{"id":"my-13-27","name":"Lawas"},{"id":"my-13-28","name":"Matu"},{"id":"my-13-29","name":"Asajaya"},{"id":"my-13-30","name":"Pakan"},{"id":"my-13-31","name":"Selangau"},{"id":"my-13-32","name":"Tebedu"},{"id":"my-13-33","name":"Pusa"},{"id":"my-13-34","name":"Kabong"},{"id":"my-13-35","name":"Tanjung Manis"},{"id":"my-13-36","name":"Sebauh"},{"id":"my-13-37","name":"Bukit Mabong"},{"id":"my-13-38","name":"Subis"},{"id":"my-13-39","name":"Beluru"},{"id":"my-13-40","name":"Telang Usan"}]'),
('my-14','W.P. Kuala Lumpur','[{"id":"my-14-01","name":"W.P. Kuala Lumpur"}]'),
('my-15','W.P. Labuan','[{"id":"my-15-01","name":"W.P. Labuan"}]'),
('my-16','W.P. Putrajaya','[{"id":"my-16-01","name":"W.P. Putrajaya"}]');
