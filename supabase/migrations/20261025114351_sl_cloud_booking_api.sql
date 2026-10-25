-- Service Link staging APIs. Review-only: never apply to AdvisorLink.
begin;
alter table public.sl_booking_settings add column revision integer not null default 0;
alter table public.sl_bookings add column provider_snapshot jsonb not null default '{}';
alter table public.sl_bookings add column buffer_minutes integer not null default 0;

create function sl_private.booking_identity() returns trigger language plpgsql security definer set search_path='' as $$
declare estimate numeric;
begin
 if new.service_snapshot->'price'<>'null'::jsonb and new.service_snapshot->>'priceBasis'<>'quote' then
 estimate:=round((new.service_snapshot->>'price')::numeric*100*(case new.service_snapshot->>'priceBasis' when 'hour' then extract(epoch from new.ends_at-new.starts_at)/3600 when 'day' then ceil(extract(epoch from new.ends_at-new.starts_at)/86400) else 1 end));
 if estimate between 0 and 10000000 then new.amount_due_cents:=estimate::int;end if;
 end if;
 select jsonb_build_object('name',profile->>'name','whatsapp',case when (profile->>'showWhatsapp')::boolean then profile->>'whatsapp' else '' end) into new.provider_snapshot from public.sl_public_profiles where user_id=new.provider_id;
 new.provider_snapshot:=coalesce(new.provider_snapshot,'{}'); return new;
end $$;
revoke all on function sl_private.booking_identity() from public,anon,authenticated;
create trigger sl_booking_identity before insert on public.sl_bookings for each row execute function sl_private.booking_identity();
create function sl_private.booking_revision() returns trigger language plpgsql security definer set search_path='' as $$
begin update public.sl_booking_settings set revision=revision+1 where user_id=coalesce(new.provider_id,old.provider_id); return null; end $$;
revoke all on function sl_private.booking_revision() from public,anon,authenticated;
create trigger sl_booking_revision after insert or update or delete on public.sl_bookings for each row execute function sl_private.booking_revision();

create function sl_private.booking_json(b public.sl_bookings) returns jsonb language sql stable security invoker set search_path='' as $$
 select jsonb_build_object('id',b.id,'reference','SL-'||upper(substr(replace(b.id::text,'-',''),1,12)),
 'requestId',b.request_id,'requestFingerprint','','accessToken','','service',b.service_snapshot,'serviceId',b.service_snapshot->>'id',
 'providerName',coalesce(b.provider_snapshot->>'name','Provider'),'providerWhatsapp',coalesce(b.provider_snapshot->>'whatsapp',''),
 'mode',b.mode,'start',b.starts_at,'end',b.ends_at,'stateId',b.state_id,'subdivisionId',b.subdivision_id,
 'customerName',b.customer_name,'customerPhone',b.customer_phone,'customerEmail',b.customer_email,'note',b.note,
 'status',case when b.status='accepted' and b.payment_deadline<=now() then 'expired' else b.status end,
 'paymentStatus',b.payment_status,'bufferMinutes',b.buffer_minutes,'amountDueCents',b.amount_due_cents,'paymentDeadline',b.payment_deadline,
 'paymentDetails',case when b.status in ('accepted','confirmed','completed') and (b.payment_deadline is null or b.payment_deadline>now() or b.status in ('confirmed','completed')) then b.payment_snapshot else null end,
 'createdAt',b.created_at,'verifiedAt',b.verified_at,'refundFollowUp',b.refund_follow_up,'source',b.source,
 'events',coalesce((select jsonb_agg(jsonb_build_object('at',e.occurred_at,'action',e.action) order by e.id) from sl_private.booking_events e where e.booking_id=b.id),'[]'::jsonb))
$$;
revoke all on function sl_private.booking_json(public.sl_bookings) from public,anon,authenticated;
create or replace function sl_private.read_customer_booking(p_id uuid,p_token_hash text) returns jsonb language sql stable security definer set search_path='' as $$
 select sl_private.booking_json(b) from public.sl_bookings b where b.id=p_id and b.customer_token_hash=p_token_hash and p_token_hash ~ '^[0-9a-f]{64}$'
$$;

create function sl_private.ensure_booking_settings() returns uuid language plpgsql security definer set search_path='' as $$
declare owner_id uuid:=auth.uid();begin
 if owner_id is null then raise exception 'Sign in required.'; end if;
 insert into public.sl_booking_settings(user_id,weekly,payment_details) values(owner_id,
 (select jsonb_agg(jsonb_build_object('day',d,'enabled',d<>0,'start','09:00','end','17:00') order by d) from generate_series(0,6) d),
 '{"bankName":"","accountName":"","accountNumber":"","instructions":"","qrPhoto":""}') on conflict do nothing;
 perform 1 from public.sl_booking_settings where user_id=owner_id for update; return owner_id;
end $$;
revoke all on function sl_private.ensure_booking_settings() from public,anon,authenticated;

create function sl_private.valid_booking_settings(p jsonb) returns boolean language plpgsql stable security invoker set search_path='' as $$
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
 if d->>'qrPhoto'<>'' and ((d->>'qrPhoto') !~ '^data:image/webp;base64,[A-Za-z0-9+/=]+$' or length(d->>'qrPhoto')>180000) then return false;end if;
 return true;exception when others then return false;end $$;
revoke all on function sl_private.valid_booking_settings(jsonb) from public,anon,authenticated;

create function sl_private.owner_workspace() returns jsonb language plpgsql security definer set search_path='' as $$
declare owner_id uuid:=sl_private.ensure_booking_settings();s public.sl_booking_settings;begin
 perform sl_private.expire_provider(owner_id); select * into s from public.sl_booking_settings where user_id=owner_id;
 return jsonb_build_object('revision',s.revision,'settings',jsonb_build_object('enabled',s.enabled,'weekly',s.weekly,'noticeMinutes',s.notice_minutes,'bufferMinutes',s.buffer_minutes,'modes',s.service_modes,'payment',s.payment_details),
 'blocks',coalesce((select jsonb_agg(jsonb_build_object('id',c.id,'start',c.starts_at,'end',c.ends_at,'note',c.private_note) order by c.starts_at) from sl_private.capacity c where c.provider_id=owner_id and c.booking_id is null),'[]'::jsonb),
 'bookings',coalesce((select jsonb_agg(sl_private.booking_json(b) order by b.starts_at) from public.sl_bookings b where b.provider_id=owner_id),'[]'::jsonb));
end $$;
revoke all on function sl_private.owner_workspace() from public,anon,authenticated;
create function public.sl_booking_workspace() returns jsonb language sql security invoker set search_path='' as $$select sl_private.owner_workspace()$$;
revoke all on function public.sl_booking_workspace() from public,anon;
grant execute on function public.sl_booking_workspace() to authenticated;
grant execute on function sl_private.owner_workspace() to authenticated;

create function sl_private.owner_write(p_action text,p_payload jsonb,p_revision integer) returns jsonb language plpgsql security definer set search_path='' as $$
declare owner_id uuid:=sl_private.ensure_booking_settings();s public.sl_booking_settings;result_id uuid;begin
 select * into s from public.sl_booking_settings where user_id=owner_id for update;
 if p_revision is null or p_revision<>s.revision then raise exception 'Bookings changed in another tab. Refresh before trying again.';end if;
 if p_payload is null or jsonb_typeof(p_payload)<>'object' or octet_length(p_payload::text)>210000 then raise exception 'Invalid booking update.';end if;
 if p_action='settings' then
  if not sl_private.valid_booking_settings(p_payload) then raise exception 'Invalid availability or payment settings.';end if;
  update public.sl_booking_settings set enabled=(p_payload->>'enabled')::boolean,weekly=p_payload->'weekly',notice_minutes=(p_payload->>'noticeMinutes')::int,buffer_minutes=(p_payload->>'bufferMinutes')::int,service_modes=p_payload->'modes',payment_details=p_payload->'payment',revision=revision+1 where user_id=owner_id;
 elsif p_action='block' then
  perform sl_private.owner_time_block((p_payload->>'start')::timestamptz,(p_payload->>'end')::timestamptz,p_payload->>'note',null);
  update public.sl_booking_settings set revision=revision+1 where user_id=owner_id;
 elsif p_action='removeBlock' then
  perform sl_private.owner_time_block(null,null,'',(p_payload->>'id')::uuid);
  update public.sl_booking_settings set revision=revision+1 where user_id=owner_id;
 elsif p_action='manual' then
  result_id:=sl_private.owner_manual_booking(p_payload->'input',p_payload->>'tokenHash',p_payload->>'fingerprint',(p_payload->'accept'->>'amountDueCents')::int,(p_payload->'accept'->>'paymentDeadline')::timestamptz);
  update public.sl_bookings set buffer_minutes=s.buffer_minutes where id=result_id;
 elsif p_action='action' then
  perform sl_private.owner_booking_action((p_payload->>'id')::uuid,p_payload->>'action',(p_payload->'accept'->>'amountDueCents')::int,(p_payload->'accept'->>'paymentDeadline')::timestamptz);
  if p_payload->>'action'='accept' then update public.sl_bookings set buffer_minutes=s.buffer_minutes where id=(p_payload->>'id')::uuid;end if;
 else raise exception 'Invalid owner action.';end if;
 return sl_private.owner_workspace();end $$;
revoke all on function sl_private.owner_write(text,jsonb,integer) from public,anon;
grant execute on function sl_private.owner_write(text,jsonb,integer) to authenticated;
create function public.sl_booking_write(p_action text,p_payload jsonb,p_revision integer) returns jsonb language sql security invoker set search_path='' as $$select sl_private.owner_write(p_action,p_payload,p_revision)$$;
revoke all on function public.sl_booking_write(text,jsonb,integer) from public,anon;
grant execute on function public.sl_booking_write(text,jsonb,integer) to authenticated;
-- Retire unversioned browser write surfaces. Internal calls run as the owning definer.
revoke execute on function public.sl_booking_owner_action(uuid,text,integer,timestamptz), public.sl_booking_time_block(timestamptz,timestamptz,text,uuid), public.sl_booking_manual_entry(jsonb,text,text,integer,timestamptz) from authenticated;
revoke execute on function sl_private.owner_booking_action(uuid,text,integer,timestamptz),sl_private.owner_time_block(timestamptz,timestamptz,text,uuid),sl_private.owner_manual_booking(jsonb,text,text,integer,timestamptz) from authenticated;

create function sl_private.public_availability(p_slug text) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare s public.sl_booking_settings;begin
 select x.* into s from public.sl_booking_settings x join public.sl_public_profiles p on p.user_id=x.user_id where p.slug=p_slug;
 if s.user_id is null then return null;end if;
 return jsonb_build_object('settings',jsonb_build_object('enabled',s.enabled,'weekly',s.weekly,'noticeMinutes',s.notice_minutes,'bufferMinutes',s.buffer_minutes,'modes',s.service_modes),
 'busy',coalesce((select jsonb_agg(jsonb_build_object('start',c.starts_at,'end',c.ends_at,'bufferMinutes',c.buffer_minutes) order by c.starts_at) from sl_private.capacity c where c.provider_id=s.user_id and c.ends_at>=now() and (c.expires_at is null or c.expires_at>now())),'[]'::jsonb));end $$;
revoke all on function sl_private.public_availability(text) from public,anon,authenticated;
create function public.sl_booking_availability(p_slug text) returns jsonb language sql stable security invoker set search_path='' as $$select sl_private.public_availability(p_slug)$$;
revoke all on function public.sl_booking_availability(text) from public,anon,authenticated;
grant execute on function public.sl_booking_availability(text),sl_private.public_availability(text) to service_role;

create table sl_private.api_limits (key text not null check(key ~ '^[0-9a-f]{64}$'),bucket bigint not null,hits integer not null,expires_at timestamptz not null,primary key(key,bucket));
alter table sl_private.api_limits enable row level security;
create index api_limits_expiry_idx on sl_private.api_limits(expires_at);
revoke all on sl_private.api_limits from public,anon,authenticated;
create function public.sl_api_limit(p_key text,p_limit integer,p_seconds integer) returns boolean language plpgsql security definer set search_path='' as $$
declare count_hits integer;b bigint:=floor(extract(epoch from now())/p_seconds);begin
 if p_key !~ '^[0-9a-f]{64}$' or p_limit not between 1 and 1000 or p_seconds not between 1 and 86400 then raise exception 'Invalid rate window.';end if;
 delete from sl_private.api_limits where (key,bucket) in(select key,bucket from sl_private.api_limits where expires_at<now() limit 1000);
 insert into sl_private.api_limits values(p_key,b,1,now()+make_interval(secs=>p_seconds*2)) on conflict(key,bucket) do update set hits=sl_private.api_limits.hits+1 returning hits into count_hits;
 return count_hits<=p_limit;end $$;
revoke all on function public.sl_api_limit(text,integer,integer) from public,anon,authenticated;
grant execute on function public.sl_api_limit(text,integer,integer) to service_role;
commit;
