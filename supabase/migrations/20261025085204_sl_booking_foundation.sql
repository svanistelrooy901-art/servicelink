-- Service Link M2: review-only migration; no hosted project has been changed.
-- Guest access is reserved for a future validated/rate-limited server endpoint.
create schema if not exists sl_private;
revoke all on schema sl_private from public, anon;
create extension if not exists btree_gist;

create table public.sl_booking_settings (
 user_id uuid primary key references auth.users(id) on delete cascade,
 enabled boolean not null default false,
 weekly jsonb not null check (jsonb_typeof(weekly)='array' and jsonb_array_length(weekly)=7),
 notice_minutes integer not null default 60 check (notice_minutes between 0 and 43200),
 buffer_minutes integer not null default 0 check (buffer_minutes between 0 and 180),
 service_modes jsonb not null default '{}' check (jsonb_typeof(service_modes)='object'),
 payment_details jsonb not null default '{}' check (jsonb_typeof(payment_details)='object' and octet_length(payment_details::text)<200000)
);
alter table public.sl_booking_settings enable row level security;
create policy booking_settings_owner on public.sl_booking_settings for select to authenticated using ((select auth.uid())=user_id);
revoke all on public.sl_booking_settings from public,anon,authenticated;
grant select on public.sl_booking_settings to authenticated;
revoke all on public.sl_booking_settings from anon;

create table public.sl_bookings (
 id uuid primary key default gen_random_uuid(),
 provider_id uuid not null references auth.users(id) on delete cascade,
 request_id uuid not null,
 request_fingerprint text not null check (request_fingerprint ~ '^[0-9a-f]{64}$'),
 customer_token_hash text not null check (customer_token_hash ~ '^[0-9a-f]{64}$'),
 mode text not null check (mode in ('appointment','date-range')),
 starts_at timestamptz not null,
 ends_at timestamptz not null,
 service_snapshot jsonb not null check (jsonb_typeof(service_snapshot)='object'),
 customer_name text not null check (length(trim(customer_name)) between 1 and 80),
 customer_phone text not null check (customer_phone ~ '^601[0-9]{8,9}$'),
 customer_email text not null default '' check (length(customer_email)<=254),
 state_id text not null,
 subdivision_id text not null,
 note text not null default '' check (length(note)<=600),
 status text not null default 'requested' check (status in ('requested','accepted','confirmed','completed','declined','cancelled','expired')),
 payment_status text not null default 'not_due' check (payment_status in ('not_due','unpaid','claimed','provider_verified')),
 amount_due_cents integer check (amount_due_cents between 0 and 10000000),
 payment_deadline timestamptz,
 payment_snapshot jsonb,
 verified_at timestamptz,
 refund_follow_up boolean not null default false,
 source text not null default 'customer' check (source in ('customer','provider')),
 created_at timestamptz not null default now(),
 unique(provider_id,request_id),
 check (isfinite(starts_at) and isfinite(ends_at) and ends_at>starts_at and ends_at-starts_at<=interval '90 days'),
 check (payment_deadline is null or (isfinite(payment_deadline) and payment_deadline<=starts_at)),
 check (payment_status<>'provider_verified' or verified_at is not null),
 check (status<>'accepted' or (amount_due_cents>0 and payment_deadline is not null and payment_status in ('unpaid','claimed'))),
 check (status not in ('confirmed','completed') or ((amount_due_cents=0 and payment_status='not_due') or payment_status='provider_verified'))
);
alter table public.sl_bookings enable row level security;
create policy booking_owner_read on public.sl_bookings for select to authenticated using ((select auth.uid())=provider_id);
revoke all on public.sl_bookings from public,anon,authenticated;
grant select on public.sl_bookings to authenticated;
revoke all on public.sl_bookings from anon;
create index sl_bookings_provider_status_idx on public.sl_bookings(provider_id,status,starts_at);

-- One provider-wide capacity table covers every service AND private blocks.
-- No browser role can write it. A GiST exclusion constraint is the final concurrency guard.
create table sl_private.capacity (
 id uuid primary key default gen_random_uuid(),
 provider_id uuid not null references auth.users(id) on delete cascade,
 booking_id uuid unique references public.sl_bookings(id) on delete cascade,
 starts_at timestamptz not null,
 ends_at timestamptz not null,
 buffer_minutes integer not null default 0 check (buffer_minutes between 0 and 180),
 reserved tstzrange not null,
 expires_at timestamptz,
 private_note text not null default '' check(length(private_note)<=150),
 check (isfinite(starts_at) and isfinite(ends_at) and ends_at>starts_at),
 check (not isempty(reserved) and not lower_inf(reserved) and not upper_inf(reserved)),
 exclude using gist (provider_id with =, reserved with &&)
);
alter table sl_private.capacity enable row level security;
revoke all on sl_private.capacity from public,anon,authenticated;

create table sl_private.booking_events (
 id bigint generated always as identity primary key,
 booking_id uuid not null references public.sl_bookings(id) on delete cascade,
 action text not null,
 occurred_at timestamptz not null default now()
);
alter table sl_private.booking_events enable row level security;
revoke all on sl_private.booking_events from public,anon,authenticated;

create function sl_private.expire_provider(p_provider uuid) returns void language plpgsql security invoker set search_path='' as $$
begin
 delete from sl_private.capacity where provider_id=p_provider and expires_at<=now();
 update public.sl_bookings set status='expired' where provider_id=p_provider and status='accepted' and payment_deadline<=now();
end $$;
revoke all on function sl_private.expire_provider(uuid) from public,anon,authenticated;

create function sl_private.in_schedule(p_provider uuid,p_start timestamptz,p_end timestamptz,p_mode text) returns boolean
language plpgsql stable security invoker set search_path='' as $$
declare s public.sl_booking_settings; d jsonb; local_start timestamp := p_start at time zone 'Asia/Kuala_Lumpur'; local_end timestamp := p_end at time zone 'Asia/Kuala_Lumpur';
begin
 select * into s from public.sl_booking_settings where user_id=p_provider;
 if s.user_id is null or not isfinite(p_start) or not isfinite(p_end) or p_start<=now() or p_start<now()+make_interval(mins=>s.notice_minutes) or p_end<=p_start or p_end-p_start>interval '90 days' then return false; end if;
 if p_mode='date-range' then return true; end if;
 if p_mode<>'appointment' or local_start::date<>(local_end-interval '1 microsecond')::date then return false; end if;
 select x into d from jsonb_array_elements(s.weekly) x where (x->>'day')::int=extract(dow from local_start)::int;
 return coalesce((d->>'enabled')::boolean,false) and local_start::time >= (d->>'start')::time and local_end::date=local_start::date and local_end::time <= (d->>'end')::time;
end $$;
revoke all on function sl_private.in_schedule(uuid,timestamptz,timestamptz,text) from public,anon,authenticated;

-- Server-only request insertion: resolve service & coverage from the PUBLISHED profile.
create function sl_private.create_request(p_input jsonb,p_token_hash text,p_fingerprint text) returns uuid
language plpgsql security definer set search_path='' as $$
declare p public.sl_public_profiles; s public.sl_booking_settings; svc jsonb; c jsonb; b public.sl_bookings; start_time timestamptz; end_time timestamptz; expected_mode text;
begin
 if p_input is null or p_token_hash is null or p_fingerprint is null or octet_length(p_input::text)>8000 or p_token_hash !~ '^[0-9a-f]{64}$' or p_fingerprint !~ '^[0-9a-f]{64}$' then raise exception 'Invalid booking request.'; end if;
 select * into p from public.sl_public_profiles where slug=p_input->>'slug';
 if p.user_id is null then raise exception 'Profile unavailable.'; end if;
 select * into s from public.sl_booking_settings where user_id=p.user_id for update;
 if s.user_id is null or not s.enabled then raise exception 'Booking requests are not enabled.'; end if;
 select * into b from public.sl_bookings where provider_id=p.user_id and request_id=(p_input->>'requestId')::uuid;
 if b.id is not null then
  if b.request_fingerprint<>p_fingerprint or b.customer_token_hash<>p_token_hash then raise exception 'Request key already used.'; end if;
  return b.id;
 end if;
 select x into svc from jsonb_array_elements(p.profile->'services') x where x->>'id'=p_input->>'serviceId';
 if svc is null then raise exception 'Service unavailable.'; end if;
 expected_mode=coalesce(s.service_modes->>(svc->>'id'),case when p.profile->>'category'='confinement' then 'date-range' else 'appointment' end);
 if (p_input->>'mode') is distinct from expected_mode then raise exception 'Booking mode changed.'; end if;
 start_time=(p_input->>'start')::timestamptz;end_time=(p_input->>'end')::timestamptz;
 if not sl_private.in_schedule(p.user_id,start_time,end_time,expected_mode) then raise exception 'Outside working hours or notice.'; end if;
 if expected_mode='appointment' and svc->'durationMinutes'<>'null'::jsonb and extract(epoch from end_time-start_time)<>(svc->>'durationMinutes')::integer*60 then raise exception 'Session duration changed.'; end if;
 select x into c from jsonb_array_elements(p.profile->'coverage') x where x->>'stateId'=p_input->>'stateId';
 if c is null or not exists(select 1 from public.sl_geography g, jsonb_array_elements(g.subdivisions) d where g.id=p_input->>'stateId' and d->>'id'=p_input->>'subdivisionId') or (not (c->>'wholeState')::boolean and not (c->'subdivisionIds' ? (p_input->>'subdivisionId'))) then raise exception 'Outside service coverage.'; end if;
 if p_input->'consent' is distinct from 'true'::jsonb or coalesce(length(trim(p_input->>'customerName')),0) not between 1 and 80 or coalesce(p_input->>'customerPhone','') !~ '^601[0-9]{8,9}$' then raise exception 'Customer name, mobile and consent are required.'; end if;
 if coalesce(p_input->>'customerEmail','')<>'' and (p_input->>'customerEmail') !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then raise exception 'Invalid email.'; end if;
 perform sl_private.expire_provider(p.user_id);
 if exists(select 1 from sl_private.capacity where provider_id=p.user_id and reserved && tstzrange(start_time,end_time+make_interval(mins=>s.buffer_minutes),'[)')) then raise exception 'Time unavailable.'; end if;
 insert into public.sl_bookings(provider_id,request_id,request_fingerprint,customer_token_hash,mode,starts_at,ends_at,service_snapshot,customer_name,customer_phone,customer_email,state_id,subdivision_id,note)
 values(p.user_id,(p_input->>'requestId')::uuid,p_fingerprint,p_token_hash,expected_mode,start_time,end_time,svc,trim(p_input->>'customerName'),p_input->>'customerPhone',coalesce(p_input->>'customerEmail',''),p_input->>'stateId',p_input->>'subdivisionId',coalesce(p_input->>'note','')) returning id into b.id;
 insert into sl_private.booking_events(booking_id,action) values(b.id,'Request received');return b.id;
end $$;
revoke all on function sl_private.create_request(jsonb,text,text) from public,anon,authenticated;

-- Explicit auth.uid() ownership; only this routine can accept/verify/cancel an owner booking.
create function sl_private.owner_booking_action(p_id uuid,p_action text,p_amount integer,p_deadline timestamptz) returns void
language plpgsql security definer set search_path='' as $$
declare owner_id uuid:=auth.uid();b public.sl_bookings;s public.sl_booking_settings;
begin
 if owner_id is null then raise exception 'Sign in required.'; end if;
 select * into s from public.sl_booking_settings where user_id=owner_id for update;
 if s.user_id is null then raise exception 'Booking settings unavailable.'; end if;
 perform sl_private.expire_provider(owner_id);
 select * into b from public.sl_bookings where id=p_id and provider_id=owner_id for update;
 if b.id is null then raise exception 'Booking unavailable.'; end if;
 if p_action='accept' then
  if b.status<>'requested' or p_amount is null or p_amount not between 0 and 10000000 or p_deadline is null or not isfinite(p_deadline) or p_deadline<=now() or p_deadline>b.starts_at then raise exception 'Invalid acceptance or payment deadline.'; end if;
  if not sl_private.in_schedule(owner_id,b.starts_at,b.ends_at,b.mode) then raise exception 'Outside working hours or notice.'; end if;
  if p_amount>0 and coalesce(s.payment_details->>'qrPhoto','')='' and (coalesce(trim(s.payment_details->>'bankName'),'')='' or coalesce(trim(s.payment_details->>'accountName'),'')='' or coalesce(trim(s.payment_details->>'accountNumber'),'')='') then raise exception 'Payment instructions are required.'; end if;
  insert into sl_private.capacity(provider_id,booking_id,starts_at,ends_at,buffer_minutes,reserved,expires_at) values(owner_id,b.id,b.starts_at,b.ends_at,s.buffer_minutes,tstzrange(b.starts_at,b.ends_at+make_interval(mins=>s.buffer_minutes),'[)'),case when p_amount=0 then null else p_deadline end);
  update public.sl_bookings set status=case when p_amount=0 then 'confirmed' else 'accepted' end,payment_status=case when p_amount=0 then 'not_due' else 'unpaid' end,amount_due_cents=p_amount,payment_deadline=case when p_amount=0 then null else p_deadline end,payment_snapshot=s.payment_details where id=b.id;
 elsif p_action='verify' then
  if b.status<>'accepted' or b.payment_deadline<=now() then raise exception 'Booking is not in an active payment window.'; end if;
  if not exists(select 1 from sl_private.capacity where booking_id=b.id and expires_at>now()) then raise exception 'Reservation is no longer active.'; end if;
  update public.sl_bookings set status='confirmed',payment_status='provider_verified',verified_at=now() where id=b.id;
  update sl_private.capacity set expires_at=null where booking_id=b.id;
 elsif p_action='decline' then
  if b.status<>'requested' then raise exception 'Only pending requests can be declined.'; end if;
  update public.sl_bookings set status='declined' where id=b.id;
 elsif p_action='cancel' then
  if b.status not in ('requested','accepted','confirmed') then raise exception 'Booking is already closed.'; end if;
  update public.sl_bookings set status='cancelled',refund_follow_up=(payment_status in ('claimed','provider_verified')) where id=b.id;
  delete from sl_private.capacity where booking_id=b.id;
 elsif p_action='complete' then
  if b.status<>'confirmed' or b.ends_at>now() then raise exception 'Complete a confirmed booking after it ends.'; end if;
  update public.sl_bookings set status='completed' where id=b.id;delete from sl_private.capacity where booking_id=b.id;
 else raise exception 'Invalid booking action.';
 end if;
 insert into sl_private.booking_events(booking_id,action) values(b.id,'Provider action: '||p_action);
end $$;
revoke all on function sl_private.owner_booking_action(uuid,text,integer,timestamptz) from public,anon;
grant usage on schema sl_private to authenticated;
grant execute on function sl_private.owner_booking_action(uuid,text,integer,timestamptz) to authenticated;
create function public.sl_booking_owner_action(p_id uuid,p_action text,p_amount integer default null,p_deadline timestamptz default null) returns void language sql security invoker set search_path='' as $$select sl_private.owner_booking_action(p_id,p_action,p_amount,p_deadline)$$;
revoke all on function public.sl_booking_owner_action(uuid,text,integer,timestamptz) from public,anon;
grant execute on function public.sl_booking_owner_action(uuid,text,integer,timestamptz) to authenticated;

-- No anonymous execute or direct guest reads. Edge request/status/token APIs remain to be integrated.
-- Service role grant is explicit, never a VITE_* browser key.
grant usage on schema sl_private to service_role;
grant execute on function sl_private.create_request(jsonb,text,text) to service_role;
create function public.sl_booking_create_request(p_input jsonb,p_token_hash text,p_fingerprint text) returns uuid language sql security invoker set search_path='' as $$select sl_private.create_request(p_input,p_token_hash,p_fingerprint)$$;
revoke all on function public.sl_booking_create_request(jsonb,text,text) from public,anon,authenticated;
grant execute on function public.sl_booking_create_request(jsonb,text,text) to service_role;

create function sl_private.owner_time_block(p_start timestamptz,p_end timestamptz,p_note text,p_remove uuid) returns uuid
language plpgsql security definer set search_path='' as $$
declare owner_id uuid:=auth.uid();result_id uuid;
begin
 if owner_id is null then raise exception 'Sign in required.'; end if;
 perform 1 from public.sl_booking_settings where user_id=owner_id for update;
 if not found then raise exception 'Booking settings unavailable.'; end if;
 perform sl_private.expire_provider(owner_id);
 if p_remove is not null then
  delete from sl_private.capacity where id=p_remove and provider_id=owner_id and booking_id is null returning id into result_id;
  if result_id is null then raise exception 'Block unavailable.'; end if;
 else
  if p_start is null or p_end is null or not isfinite(p_start) or not isfinite(p_end) or p_start<=now() or p_end<=p_start or p_end-p_start>interval '90 days' then raise exception 'Invalid block period.'; end if;
  insert into sl_private.capacity(provider_id,starts_at,ends_at,reserved,private_note) values(owner_id,p_start,p_end,tstzrange(p_start,p_end,'[)'),coalesce(p_note,'')) returning id into result_id;
 end if;
 return result_id;
end $$;
revoke all on function sl_private.owner_time_block(timestamptz,timestamptz,text,uuid) from public,anon;
grant execute on function sl_private.owner_time_block(timestamptz,timestamptz,text,uuid) to authenticated;
create function public.sl_booking_time_block(p_start timestamptz default null,p_end timestamptz default null,p_note text default '',p_remove uuid default null) returns uuid language sql security invoker set search_path='' as $$select sl_private.owner_time_block(p_start,p_end,p_note,p_remove)$$;
revoke all on function public.sl_booking_time_block(timestamptz,timestamptz,text,uuid) from public,anon;
grant execute on function public.sl_booking_time_block(timestamptz,timestamptz,text,uuid) to authenticated;

create function sl_private.customer_booking_action(p_id uuid,p_token_hash text,p_action text) returns void
language plpgsql security definer set search_path='' as $$
declare b public.sl_bookings; owner_id uuid;
begin
 if p_token_hash is null or p_token_hash !~ '^[0-9a-f]{64}$' then raise exception 'Booking unavailable.'; end if;
 select provider_id into owner_id from public.sl_bookings where id=p_id and customer_token_hash=p_token_hash;
 if owner_id is null then raise exception 'Booking unavailable.'; end if;
 perform 1 from public.sl_booking_settings where user_id=owner_id for update;
 perform sl_private.expire_provider(owner_id);
 select * into b from public.sl_bookings where id=p_id and customer_token_hash=p_token_hash for update;
 if p_action='claim' then
  if b.status<>'accepted' then raise exception 'No active payment window. Contact the provider if already paid.'; end if;
  update public.sl_bookings set payment_status='claimed' where id=b.id;
 elsif p_action='cancel' then
  if b.status not in ('requested','accepted') or b.payment_status='claimed' then raise exception 'Contact the provider to cancel this booking.'; end if;
  update public.sl_bookings set status='cancelled' where id=b.id;delete from sl_private.capacity where booking_id=b.id;
 else raise exception 'Invalid customer action.';
 end if;
 insert into sl_private.booking_events(booking_id,action) values(b.id,'Customer action (unverified): '||p_action);
end $$;
revoke all on function sl_private.customer_booking_action(uuid,text,text) from public,anon,authenticated;
grant execute on function sl_private.customer_booking_action(uuid,text,text) to service_role;
create function public.sl_booking_customer_action(p_id uuid,p_token_hash text,p_action text) returns void language sql security invoker set search_path='' as $$select sl_private.customer_booking_action(p_id,p_token_hash,p_action)$$;
revoke all on function public.sl_booking_customer_action(uuid,text,text) from public,anon,authenticated;
grant execute on function public.sl_booking_customer_action(uuid,text,text) to service_role;

create function sl_private.read_customer_booking(p_id uuid,p_token_hash text) returns jsonb
language sql stable security definer set search_path='' as $$
 select jsonb_build_object('id',b.id,'service',b.service_snapshot,'start',b.starts_at,'end',b.ends_at,
 'customerName',b.customer_name,'status',case when b.status='accepted' and b.payment_deadline<=now() then 'expired' else b.status end,
 'paymentStatus',b.payment_status,'amountDueCents',b.amount_due_cents,'paymentDeadline',b.payment_deadline,
 'paymentDetails',case when b.status in ('accepted','confirmed','completed') and (b.payment_deadline is null or b.payment_deadline>now() or b.status in ('confirmed','completed')) then b.payment_snapshot else null end,
 'verifiedAt',b.verified_at,'refundFollowUp',b.refund_follow_up)
 from public.sl_bookings b where b.id=p_id and b.customer_token_hash=p_token_hash and p_token_hash ~ '^[0-9a-f]{64}$'
$$;
revoke all on function sl_private.read_customer_booking(uuid,text) from public,anon,authenticated;
grant execute on function sl_private.read_customer_booking(uuid,text) to service_role;
create function public.sl_booking_customer_read(p_id uuid,p_token_hash text) returns jsonb language sql stable security invoker set search_path='' as $$select sl_private.read_customer_booking(p_id,p_token_hash)$$;
revoke all on function public.sl_booking_customer_read(uuid,text) from public,anon,authenticated;
grant execute on function public.sl_booking_customer_read(uuid,text) to service_role;

create function sl_private.owner_manual_booking(p_input jsonb,p_token_hash text,p_fingerprint text,p_amount integer,p_deadline timestamptz) returns uuid
language plpgsql security definer set search_path='' as $$
declare result_id uuid;provider uuid;b public.sl_bookings;
begin
 if auth.uid() is null then raise exception 'Sign in required.'; end if;
 select user_id into provider from public.sl_public_profiles where slug=p_input->>'slug';
 if provider is distinct from auth.uid() then raise exception 'Provider unavailable.'; end if;
 result_id=sl_private.create_request(p_input,p_token_hash,p_fingerprint);
 select * into b from public.sl_bookings where id=result_id;
 if b.status<>'requested' then
  if b.source='provider' then return result_id; end if;
  raise exception 'Existing customer booking cannot become a manual entry.';
 end if;
 update public.sl_bookings set source='provider' where id=result_id;
 perform sl_private.owner_booking_action(result_id,'accept',p_amount,p_deadline);
 return result_id;
end $$;
revoke all on function sl_private.owner_manual_booking(jsonb,text,text,integer,timestamptz) from public,anon;
grant execute on function sl_private.owner_manual_booking(jsonb,text,text,integer,timestamptz) to authenticated;
create function public.sl_booking_manual_entry(p_input jsonb,p_token_hash text,p_fingerprint text,p_amount integer,p_deadline timestamptz) returns uuid language sql security invoker set search_path='' as $$select sl_private.owner_manual_booking(p_input,p_token_hash,p_fingerprint,p_amount,p_deadline)$$;
revoke all on function public.sl_booking_manual_entry(jsonb,text,text,integer,timestamptz) from public,anon;
grant execute on function public.sl_booking_manual_entry(jsonb,text,text,integer,timestamptz) to authenticated;
