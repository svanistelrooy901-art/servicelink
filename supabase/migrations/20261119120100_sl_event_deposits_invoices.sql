-- Keep booking acceptance, invoice issuance and capacity reservation in one transaction.

begin;

alter table public.sl_booking_settings add column invoice_template jsonb not null default '{}';
alter table public.sl_bookings
 drop constraint sl_bookings_mode_check,
 add constraint sl_bookings_mode_check check (mode in ('appointment','date-range','event')),
 add column event_request jsonb,
 add column requested_date date,
 add column total_price_cents integer check(total_price_cents between 0 and 10000000),
 add column agreed_scope text not null default '' check(length(agreed_scope)<=600),
 add column invoice_snapshot jsonb,
 add constraint sl_deposit_within_total check(total_price_cents is null or amount_due_cents between 0 and total_price_cents),
 add constraint sl_event_request_shape check ((mode='event')=(event_request is not null and requested_date is not null));

create function sl_private.valid_invoice(p jsonb, p_owner uuid) returns boolean
language plpgsql volatile security invoker set search_path='' as $$
declare field text;
begin
 if jsonb_typeof(p) is distinct from 'object'
    or not(p ?& array['businessName','registration','contact','address','logo','note'])
    or (p-array['businessName','registration','contact','address','logo','note'])<>'{}'::jsonb then return false; end if;
 foreach field in array array['businessName','registration','contact','address','logo','note'] loop
  if jsonb_typeof(p->field) is distinct from 'string' then return false; end if;
 end loop;
 return length(p->>'businessName')<=120 and length(p->>'registration')<=60 and length(p->>'contact')<=160
   and length(p->>'address')<=300 and length(p->>'note')<=600 and sl_private.owned_media(p->>'logo',p_owner,'portrait');
end $$;
revoke all on function sl_private.valid_invoice(jsonb,uuid) from public,anon,authenticated;


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
 if exists(select 1 from jsonb_each(p->'modes') e where length(e.key) not between 1 and 80 or jsonb_typeof(e.value)<>'string' or e.value#>>'{}' not in ('appointment','date-range','event')) then return false; end if;
 d:=p->'payment';
 if (d-array['bankName','accountName','accountNumber','instructions','qrPhoto'])<>'{}'::jsonb or not(d ?& array['bankName','accountName','accountNumber','instructions','qrPhoto']) then return false; end if;
 foreach v in array array['bankName','accountName','accountNumber','instructions','qrPhoto'] loop if jsonb_typeof(d->v)<>'string' then return false; end if;end loop;
 if length(d->>'bankName')>80 or length(d->>'accountName')>120 or length(d->>'accountNumber')>40 or length(d->>'instructions')>600 then return false; end if;
 if not public.sl_valid_image_ref(d->>'qrPhoto',180000) then return false;end if;
 return true;exception when others then return false;end $$;

create or replace function sl_private.in_schedule(p_provider uuid,p_start timestamptz,p_end timestamptz,p_mode text) returns boolean
language plpgsql stable security invoker set search_path='' as $$
declare s public.sl_booking_settings; d jsonb; local_start timestamp := p_start at time zone 'Asia/Kuala_Lumpur'; local_end timestamp := p_end at time zone 'Asia/Kuala_Lumpur';
begin
 select * into s from public.sl_booking_settings where user_id=p_provider;
 if s.user_id is null or not isfinite(p_start) or not isfinite(p_end) or p_start<=now() or p_start<now()+make_interval(mins=>s.notice_minutes) or p_end<=p_start or p_end-p_start>interval '90 days' then return false; end if;
 if p_mode in ('date-range','event') then return true; end if;
 if p_mode<>'appointment' or local_start::date<>(local_end-interval '1 microsecond')::date then return false; end if;
 select x into d from jsonb_array_elements(s.weekly) x where (x->>'day')::int=extract(dow from local_start)::int;
 return coalesce((d->>'enabled')::boolean,false) and local_start::time >= (d->>'start')::time and local_end::date=local_start::date and local_end::time <= (d->>'end')::time;
end $$;

create or replace function sl_private.booking_identity() returns trigger language plpgsql security definer set search_path='' as $$
declare estimate numeric;
begin
 if new.mode<>'event' and new.service_snapshot->'price'<>'null'::jsonb and new.service_snapshot->>'priceBasis'<>'quote' then
 estimate:=round((new.service_snapshot->>'price')::numeric*100*(case new.service_snapshot->>'priceBasis' when 'hour' then extract(epoch from new.ends_at-new.starts_at)/3600 when 'day' then ceil(extract(epoch from new.ends_at-new.starts_at)/86400) else 1 end));
 if estimate between 0 and 10000000 then new.amount_due_cents:=estimate::int;end if;
 end if;
 select jsonb_build_object('name',profile->>'name','whatsapp',case when (profile->>'showWhatsapp')::boolean then profile->>'whatsapp' else '' end) into new.provider_snapshot from public.sl_public_profiles where user_id=new.provider_id;
 new.provider_snapshot:=coalesce(new.provider_snapshot,'{}'); return new;
end $$;

create or replace function sl_private.create_request(p_input jsonb,p_token_hash text,p_fingerprint text) returns uuid
language plpgsql security definer set search_path='' as $$
declare p public.sl_public_profiles; s public.sl_booking_settings; svc jsonb; c jsonb; b public.sl_bookings; start_time timestamptz; end_time timestamptz; expected_mode text; event_info jsonb; event_date date;
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
 expected_mode=coalesce(s.service_modes->>(svc->>'id'),case when p.profile->>'category'='confinement' then 'date-range' when p.profile->>'category'='photography' then 'event' else 'appointment' end);
 if (p_input->>'mode') is distinct from expected_mode then raise exception 'Booking mode changed.'; end if;
 start_time=(p_input->>'start')::timestamptz;end_time=(p_input->>'end')::timestamptz;
 if expected_mode='event' then
  event_info:=p_input->'event';
  event_date:=(start_time at time zone 'Asia/Kuala_Lumpur')::date;
  if start_time is null or end_time is null or not isfinite(start_time) or not isfinite(end_time)
     or (start_time at time zone 'Asia/Kuala_Lumpur')::time<>time '00:00'
     or end_time-start_time<>interval '24 hours'
     or end_time<=now()+make_interval(mins=>s.notice_minutes) then
   raise exception 'Choose an event date that fits the provider’s minimum notice.';
  end if;
  if jsonb_typeof(event_info) is distinct from 'object'
     or (event_info-array['venue','preferredTime'])<>'{}'::jsonb
     or jsonb_typeof(event_info->'venue') is distinct from 'string'
     or length(trim(event_info->>'venue')) not between 1 and 200
     or jsonb_typeof(event_info->'preferredTime') is distinct from 'string'
     or (event_info->>'preferredTime'<>'' and (event_info->>'preferredTime') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$') then
   raise exception 'Enter a venue and a valid preferred time, if known.';
  end if;
  event_info:=jsonb_build_object('venue',trim(event_info->>'venue'),'preferredTime',event_info->>'preferredTime');
 elsif not sl_private.in_schedule(p.user_id,start_time,end_time,expected_mode) then
  raise exception 'Outside working hours or notice.';
 end if;
 if expected_mode='appointment' and svc->'durationMinutes'<>'null'::jsonb and extract(epoch from end_time-start_time)<>(svc->>'durationMinutes')::integer*60 then raise exception 'Session duration changed.'; end if;
 select x into c from jsonb_array_elements(p.profile->'coverage') x where x->>'stateId'=p_input->>'stateId';
 if c is null or not exists(select 1 from public.sl_geography g, jsonb_array_elements(g.subdivisions) d where g.id=p_input->>'stateId' and d->>'id'=p_input->>'subdivisionId') or (not (c->>'wholeState')::boolean and not (c->'subdivisionIds' ? (p_input->>'subdivisionId'))) then raise exception 'Outside service coverage.'; end if;
 if p_input->'consent' is distinct from 'true'::jsonb or coalesce(length(trim(p_input->>'customerName')),0) not between 1 and 80 or coalesce(p_input->>'customerPhone','') !~ '^601[0-9]{8,9}$' then raise exception 'Customer name, mobile and consent are required.'; end if;
 if coalesce(p_input->>'customerEmail','')<>'' and (p_input->>'customerEmail') !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then raise exception 'Invalid email.'; end if;
 perform sl_private.expire_provider(p.user_id);
 if expected_mode<>'event' and exists(select 1 from sl_private.capacity where provider_id=p.user_id and reserved && tstzrange(start_time,end_time+make_interval(mins=>s.buffer_minutes),'[)')) then raise exception 'Time unavailable.'; end if;
 insert into public.sl_bookings(provider_id,request_id,request_fingerprint,customer_token_hash,mode,starts_at,ends_at,service_snapshot,customer_name,customer_phone,customer_email,state_id,subdivision_id,note,event_request,requested_date)
 values(p.user_id,(p_input->>'requestId')::uuid,p_fingerprint,p_token_hash,expected_mode,start_time,end_time,svc,trim(p_input->>'customerName'),p_input->>'customerPhone',coalesce(p_input->>'customerEmail',''),p_input->>'stateId',p_input->>'subdivisionId',coalesce(p_input->>'note',''),event_info,event_date) returning id into b.id;
 insert into sl_private.booking_events(booking_id,action) values(b.id,'Request received');return b.id;
end $$;

create or replace function sl_private.booking_json(b public.sl_bookings) returns jsonb language sql stable security invoker set search_path='' as $$
 select jsonb_build_object('id',b.id,'reference','SL-'||upper(substr(replace(b.id::text,'-',''),1,12)),
 'requestId',b.request_id,'requestFingerprint','','accessToken','','service',b.service_snapshot,'serviceId',b.service_snapshot->>'id',
 'providerName',coalesce(b.provider_snapshot->>'name','Provider'),'providerWhatsapp',coalesce(b.provider_snapshot->>'whatsapp',''),
 'mode',b.mode,'start',b.starts_at,'end',b.ends_at,'stateId',b.state_id,'subdivisionId',b.subdivision_id,
 'event',b.event_request,'requestedDate',b.requested_date,'agreedScope',b.agreed_scope,
 'totalPriceCents',b.total_price_cents,'invoice',b.invoice_snapshot,
 'customerName',b.customer_name,'customerPhone',b.customer_phone,'customerEmail',b.customer_email,'note',b.note,
 'status',case when b.status='accepted' and b.payment_deadline<=now() then 'expired' else b.status end,
 'paymentStatus',b.payment_status,'bufferMinutes',b.buffer_minutes,'amountDueCents',b.amount_due_cents,'paymentDeadline',b.payment_deadline,
 'paymentDetails',case when b.status in ('accepted','confirmed','completed') and (b.payment_deadline is null or b.payment_deadline>now() or b.status in ('confirmed','completed')) then b.payment_snapshot else null end,
 'createdAt',b.created_at,'verifiedAt',b.verified_at,'refundFollowUp',b.refund_follow_up,'source',b.source,
 'events',coalesce((select jsonb_agg(jsonb_build_object('at',e.occurred_at,'action',e.action) order by e.id) from sl_private.booking_events e where e.booking_id=b.id),'[]'::jsonb))
$$;

create or replace function sl_private.owner_workspace() returns jsonb language plpgsql security definer set search_path='' as $$
declare owner_id uuid:=sl_private.ensure_booking_settings();s public.sl_booking_settings;begin
 perform sl_private.expire_provider(owner_id); select * into s from public.sl_booking_settings where user_id=owner_id;
 return jsonb_build_object('revision',s.revision,'settings',jsonb_build_object('enabled',s.enabled,'weekly',s.weekly,'noticeMinutes',s.notice_minutes,'bufferMinutes',s.buffer_minutes,'modes',s.service_modes,'payment',s.payment_details,'invoice',case when s.invoice_template='{}'::jsonb then null else s.invoice_template end),
 'blocks',coalesce((select jsonb_agg(jsonb_build_object('id',c.id,'start',c.starts_at,'end',c.ends_at,'note',c.private_note) order by c.starts_at) from sl_private.capacity c where c.provider_id=owner_id and c.booking_id is null),'[]'::jsonb),
 'bookings',coalesce((select jsonb_agg(sl_private.booking_json(b) order by b.starts_at) from public.sl_bookings b where b.provider_id=owner_id),'[]'::jsonb));
end $$;

create or replace function sl_private.owner_booking_action(p_id uuid,p_action text,p_accept jsonb) returns void
language plpgsql security definer set search_path='' as $$
declare owner_id uuid:=auth.uid();b public.sl_bookings;s public.sl_booking_settings;
 p_amount integer; p_total integer; p_deadline timestamptz; p_scope text;
 final_start timestamptz; final_end timestamptz; template jsonb;
begin
 if owner_id is null then raise exception 'Sign in required.'; end if;
 select * into s from public.sl_booking_settings where user_id=owner_id for update;
 if s.user_id is null then raise exception 'Booking settings unavailable.'; end if;
 perform sl_private.expire_provider(owner_id);
 select * into b from public.sl_bookings where id=p_id and provider_id=owner_id for update;
 if b.id is null then raise exception 'Booking unavailable.'; end if;
 if p_action='accept' then
  if b.status<>'requested' or jsonb_typeof(p_accept) is distinct from 'object'
     or (p_accept-array['amountDueCents','totalPriceCents','paymentDeadline','agreedScope','start','end'])<>'{}'::jsonb
     or jsonb_typeof(p_accept->'amountDueCents') is distinct from 'number'
     or (p_accept->>'amountDueCents') !~ '^[0-9]{1,8}$' then
   raise exception 'Invalid acceptance or payment deadline.';
  end if;
  p_amount:=(p_accept->>'amountDueCents')::integer;
  if p_accept ? 'totalPriceCents' and (jsonb_typeof(p_accept->'totalPriceCents') is distinct from 'number'
     or (p_accept->>'totalPriceCents') !~ '^[0-9]{1,8}$') then
   raise exception 'The deposit must be between RM0 and the total price.';
  end if;
  p_total:=coalesce((p_accept->>'totalPriceCents')::integer,p_amount);
  if p_total>10000000 or p_amount>p_total then raise exception 'The deposit must be between RM0 and the total price.'; end if;
  p_scope:=trim(coalesce(p_accept->>'agreedScope',''));
  if (p_accept ? 'agreedScope' and jsonb_typeof(p_accept->'agreedScope')<>'string')
     or length(p_scope)>600 or (b.mode='event' and p_scope='') then
   raise exception 'Enter the agreed scope (up to 600 characters).';
  end if;
  final_start:=b.starts_at;
  final_end:=b.ends_at;
  if b.mode='event' then
   final_start:=(p_accept->>'start')::timestamptz;
   final_end:=(p_accept->>'end')::timestamptz;
   if final_start is null or final_end is null or not isfinite(final_start) or not isfinite(final_end)
      or (final_start at time zone 'Asia/Kuala_Lumpur')::date<>b.requested_date
      or final_end<=final_start or final_end-final_start>interval '24 hours' then
    raise exception 'Set the final event times on the requested date, for up to 24 hours.';
   end if;
  end if;
  if p_amount>0 then
   p_deadline:=(p_accept->>'paymentDeadline')::timestamptz;
   if p_deadline is null or not isfinite(p_deadline) or p_deadline<=now() or p_deadline>final_start then
    raise exception 'Invalid acceptance or payment deadline.';
   end if;
  end if;
  if not sl_private.in_schedule(owner_id,final_start,final_end,b.mode) then raise exception 'Outside working hours or notice.'; end if;
  if p_amount>0 and coalesce(s.payment_details->>'qrPhoto','')='' and (coalesce(trim(s.payment_details->>'bankName'),'')='' or coalesce(trim(s.payment_details->>'accountName'),'')='' or coalesce(trim(s.payment_details->>'accountNumber'),'')='') then raise exception 'Payment instructions are required.'; end if;
  insert into sl_private.capacity(provider_id,booking_id,starts_at,ends_at,buffer_minutes,reserved,expires_at) values(owner_id,b.id,final_start,final_end,s.buffer_minutes,tstzrange(final_start,final_end+make_interval(mins=>s.buffer_minutes),'[)'),case when p_amount=0 then null else p_deadline end);
  template:=s.invoice_template || jsonb_build_object(
   'businessName',coalesce(nullif(trim(s.invoice_template->>'businessName'),''),b.provider_snapshot->>'name','Provider'),
   'issuedAt',now());
  update public.sl_bookings set starts_at=final_start,ends_at=final_end,buffer_minutes=s.buffer_minutes,
   total_price_cents=p_total,agreed_scope=p_scope,invoice_snapshot=template,
   status=case when p_amount=0 then 'confirmed' else 'accepted' end,payment_status=case when p_amount=0 then 'not_due' else 'unpaid' end,amount_due_cents=p_amount,payment_deadline=case when p_amount=0 then null else p_deadline end,payment_snapshot=case when p_amount>0 then s.payment_details else null end where id=b.id;
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

revoke all on function sl_private.owner_booking_action(uuid,text,jsonb) from public,anon,authenticated;

create or replace function sl_private.owner_booking_action(p_id uuid,p_action text,p_amount integer,p_deadline timestamptz) returns void
language sql security definer set search_path='' as $$
 select sl_private.owner_booking_action(p_id,p_action,jsonb_build_object('amountDueCents',p_amount,'paymentDeadline',p_deadline))
$$;

create or replace function sl_private.owner_manual_booking(p_input jsonb,p_token_hash text,p_fingerprint text,p_accept jsonb) returns uuid
language plpgsql security definer set search_path='' as $$
declare result_id uuid;provider uuid;
begin
 if auth.uid() is null then raise exception 'Sign in required.'; end if;
 select user_id into provider from public.sl_public_profiles where slug=p_input->>'slug';
 if provider is distinct from auth.uid() then raise exception 'Provider unavailable.'; end if;
 if exists (select 1 from public.sl_bookings where provider_id=provider and request_id=(p_input->>'requestId')::uuid) then
  raise exception 'Request key already used.';
 end if;
 result_id:=sl_private.create_request(p_input,p_token_hash,p_fingerprint);
 update public.sl_bookings set source='provider' where id=result_id;
 perform sl_private.owner_booking_action(result_id,'accept',p_accept);
 return result_id;
end $$;

revoke all on function sl_private.owner_manual_booking(jsonb,text,text,jsonb) from public,anon,authenticated;

create or replace function sl_private.owner_write(p_action text,p_payload jsonb,p_revision integer) returns jsonb language plpgsql security definer set search_path='' as $$
declare owner_id uuid:=sl_private.ensure_booking_settings();s public.sl_booking_settings;begin
 select * into s from public.sl_booking_settings where user_id=owner_id for update;
 if p_revision is null or p_revision<>s.revision then raise exception 'Bookings changed in another tab. Refresh before trying again.';end if;
 if p_payload is null or jsonb_typeof(p_payload)<>'object' or octet_length(p_payload::text)>210000 then raise exception 'Invalid booking update.';end if;
 if p_action='settings' then
  if not sl_private.valid_booking_settings(p_payload-'invoice') or (p_payload ? 'invoice' and p_payload->'invoice'<>'null'::jsonb and not sl_private.valid_invoice(p_payload->'invoice',owner_id)) then raise exception 'Invalid availability or payment settings.';end if;
  update public.sl_booking_settings set enabled=(p_payload->>'enabled')::boolean,weekly=p_payload->'weekly',notice_minutes=(p_payload->>'noticeMinutes')::int,buffer_minutes=(p_payload->>'bufferMinutes')::int,service_modes=p_payload->'modes',payment_details=p_payload->'payment',invoice_template=coalesce(nullif(p_payload->'invoice','null'::jsonb),invoice_template),revision=revision+1 where user_id=owner_id;
 elsif p_action='block' then
  perform sl_private.owner_time_block((p_payload->>'start')::timestamptz,(p_payload->>'end')::timestamptz,p_payload->>'note',null);
  update public.sl_booking_settings set revision=revision+1 where user_id=owner_id;
 elsif p_action='removeBlock' then
  perform sl_private.owner_time_block(null,null,'',(p_payload->>'id')::uuid);
  update public.sl_booking_settings set revision=revision+1 where user_id=owner_id;
 elsif p_action='manual' then
  perform sl_private.owner_manual_booking(p_payload->'input',p_payload->>'tokenHash',p_payload->>'fingerprint',p_payload->'accept');
 elsif p_action='action' then
  perform sl_private.owner_booking_action((p_payload->>'id')::uuid,p_payload->>'action',p_payload->'accept');
 else raise exception 'Invalid owner action.';end if;
 return sl_private.owner_workspace();end $$;

create or replace function public.sl_media_access(p_id uuid,p_owner uuid default null,p_booking uuid default null,p_token_hash text default null) returns text language plpgsql stable security definer set search_path='' as $$
declare a sl_private.media_assets;ref text:='/api/media/'||p_id::text||'.webp';begin
 select * into a from sl_private.media_assets where id=p_id and state='ready';if a.id is null then return null;end if;
 if a.owner_id=p_owner then return a.object_key;end if;
 if a.kind<>'qr' and exists(select 1 from public.sl_public_profiles p where p.user_id=a.owner_id and (p.profile->>'photo'=ref or p.profile->>'banner'=ref or exists(select 1 from sl_private.profile_pictures(p.profile) g where g->>'src'=ref))) then return a.object_key;end if;
 if a.kind='portrait' and p_token_hash ~ '^[0-9a-f]{64}$' and exists(
  select 1 from public.sl_bookings b where b.id=p_booking and b.provider_id=a.owner_id
   and b.customer_token_hash=p_token_hash and b.invoice_snapshot->>'logo'=ref
 ) then return a.object_key; end if;
 if a.kind='qr' and p_token_hash ~ '^[0-9a-f]{64}$' and exists(select 1 from public.sl_bookings b where b.id=p_booking and b.customer_token_hash=p_token_hash and b.payment_snapshot->>'qrPhoto'=ref and b.status in ('accepted','confirmed','completed') and (b.status in ('confirmed','completed') or b.payment_deadline>now())) then return a.object_key;end if;
 return null;end $$;

create or replace function public.sl_media_gc(p_owner uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare ids uuid[];begin
 perform pg_advisory_xact_lock(hashtextextended(p_owner::text,0));
 select array_agg(a.id) into ids from sl_private.media_assets a where a.owner_id=p_owner and (a.state='deleting' or a.created_at<now()-interval '7 days')
 and not exists(select 1 from public.sl_workspaces w where w.user_id=p_owner and position('/api/media/'||a.id::text||'.webp' in w.draft::text)>0)
 and not exists(select 1 from public.sl_public_profiles p where p.user_id=p_owner and position('/api/media/'||a.id::text||'.webp' in p.profile::text)>0)
 and not exists(select 1 from public.sl_booking_settings s where s.user_id=p_owner and position('/api/media/'||a.id::text||'.webp' in (s.payment_details || s.invoice_template)::text)>0)
 and not exists(select 1 from public.sl_bookings b where b.provider_id=p_owner and position('/api/media/'||a.id::text||'.webp' in (coalesce(b.payment_snapshot,'{}'::jsonb) || coalesce(b.invoice_snapshot,'{}'::jsonb))::text)>0);
 update sl_private.media_assets set state='deleting' where id=any(ids);
 return coalesce((select jsonb_agg(jsonb_build_object('id',id,'key',object_key)) from sl_private.media_assets where id=any(ids)),'[]'::jsonb);end $$;

commit;
