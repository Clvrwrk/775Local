begin;
-- Private destinations are provisioned only through a separately verified operator workflow.
create table private.lead_destinations (
  id uuid primary key default extensions.gen_random_uuid(),
  listing_id uuid not null references app.business_listings(id),
  participation_id uuid not null references app.listing_participations(id),
  email text not null,
  verified_at timestamptz not null,
  verification_ref text not null check(length(verification_ref) between 8 and 500),
  revoked_at timestamptz,
  created_at timestamptz not null default statement_timestamp()
);
create unique index lead_destination_active on private.lead_destinations(listing_id) where revoked_at is null;
alter table private.lead_destinations enable row level security;
revoke all on private.lead_destinations from public,anon,authenticated;
-- No client can self-certify a recipient. Only reviewed service-side provisioning has access.
grant select,insert,update on private.lead_destinations to service_role;
alter table app.leads add column destination_id uuid references private.lead_destinations(id);
alter table app.leads add column abuse_key text;
alter table app.leads add column request_fingerprint text;
revoke select on app.leads from authenticated;
grant select (id, listing_id, idempotency_key, resident_name, resident_phone_e164, resident_email, resident_postal_code, request_text, contact_consent_at, source_path, source_context, status, duplicate_of_id, submitted_at, deleted_at, updated_at) on app.leads to authenticated;
create index leads_duplicate_window on app.leads(request_fingerprint,submitted_at desc);
create index leads_abuse_window on app.leads(abuse_key,submitted_at desc);

create table private.inquiry_request_keys (idempotency_key text primary key, payload_hash text not null, lead_id uuid not null references app.leads(id));
alter table private.inquiry_request_keys enable row level security;
revoke all on private.inquiry_request_keys from public,anon,authenticated;

create function private.intake_reno_inquiry(requested_listing_id uuid, requested_payload jsonb, requested_key text, requested_abuse_key text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare destination uuid; existing app.leads%rowtype; new_lead_id uuid; fingerprint text; payload_hash text; prior_key private.inquiry_request_keys%rowtype;
begin
  if jsonb_typeof(requested_payload) is distinct from 'object'
    or requested_payload - array['name','email','phone','zip','message','consent'] <> '{}'::jsonb
    or requested_payload->'consent' is distinct from 'true'::jsonb
    or length(trim(coalesce(requested_payload->>'name',''))) not between 2 and 120
    or length(trim(coalesce(requested_payload->>'message',''))) not between 10 and 3000
    or coalesce(requested_payload->>'zip','') !~ '^895[0-9]{2}$'
    or coalesce(requested_payload->>'email','') !~ '^[^@[:space:]]{1,64}@[^@[:space:]]{1,189}\.[A-Za-z]{2,}$'
    or (coalesce(requested_payload->>'phone','')<>'' and requested_payload->>'phone' !~ '^\+1[2-9][0-9]{2}[2-9][0-9]{6}$')
    or requested_key is null or requested_key !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{7,199}$'
    or requested_abuse_key is null or requested_abuse_key !~ '^[a-f0-9]{64}$'
  then raise exception 'invalid_inquiry'; end if;
  perform pg_advisory_xact_lock(hashtextextended('inquiry-key:'||requested_key,0));
  payload_hash := encode(extensions.digest(jsonb_build_array(requested_listing_id,requested_payload)::text,'sha256'),'hex');
  select * into prior_key from private.inquiry_request_keys where idempotency_key=requested_key;
  if found then
    if prior_key.payload_hash<>payload_hash then raise exception 'idempotency_conflict'; end if;
    return jsonb_build_object('id',prior_key.lead_id,'status','received','idempotent',true);
  end if;
  select * into existing from app.leads where idempotency_key=requested_key;
  if found then
    if existing.listing_id<>requested_listing_id or existing.resident_name<>trim(requested_payload->>'name') or existing.resident_email<>lower(requested_payload->>'email') or coalesce(existing.resident_phone_e164,'')<>coalesce(requested_payload->>'phone','') or existing.resident_postal_code<>requested_payload->>'zip' or existing.request_text<>trim(requested_payload->>'message') then raise exception 'idempotency_conflict'; end if;
    return jsonb_build_object('id',existing.id,'status','received','idempotent',true);
  end if;
  fingerprint := encode(extensions.digest(jsonb_build_array(requested_listing_id,lower(requested_payload->>'email'),regexp_replace(lower(trim(requested_payload->>'message')),'[[:space:]]+',' ','g'))::text,'sha256'),'hex');
  perform pg_advisory_xact_lock(hashtextextended('inquiry-fingerprint:'||fingerprint,0));
  select * into existing from app.leads where request_fingerprint=fingerprint and submitted_at>statement_timestamp()-interval '7 days' order by submitted_at desc limit 1;
  if found then
    insert into private.inquiry_request_keys values(requested_key,payload_hash,existing.id);
    return jsonb_build_object('id',existing.id,'status','received','idempotent',true,'duplicate',true);
  end if;
  perform pg_advisory_xact_lock(hashtextextended('inquiry-rate:'||requested_abuse_key,0));
  if (select count(*) from app.leads where abuse_key=requested_abuse_key and submitted_at>statement_timestamp()-interval '1 hour')>=5 then raise exception 'inquiry_rate_limited'; end if;
  select d.id into destination from private.lead_destinations d
    join app.listing_participations lp on lp.id=d.participation_id and lp.listing_id=d.listing_id
    join app.business_listings bl on bl.id=d.listing_id
    where d.listing_id=requested_listing_id and d.revoked_at is null
      and lp.role='lead_recipient' and lp.status='active'
      and (lp.starts_at is null or lp.starts_at<=statement_timestamp())
      and (lp.expires_at is null or lp.expires_at>statement_timestamp())
      and bl.city_slug='reno' and bl.publication_status='published' and bl.owner_verified_at is not null and exists(select 1 from app.listing_participations owner_lp where owner_lp.listing_id=bl.id and owner_lp.role='business_owner' and owner_lp.status='active' and (owner_lp.starts_at is null or owner_lp.starts_at<=statement_timestamp()) and (owner_lp.expires_at is null or owner_lp.expires_at>statement_timestamp()))
    for share of d,lp,bl;
  if destination is null then raise exception 'inquiries_unavailable'; end if;
  insert into app.leads(listing_id,idempotency_key,resident_name,resident_email,resident_phone_e164,resident_postal_code,request_text,contact_consent_at,source_path,source_context,destination_id,abuse_key,request_fingerprint)
  values(requested_listing_id,requested_key,trim(requested_payload->>'name'),lower(requested_payload->>'email'),nullif(requested_payload->>'phone',''),requested_payload->>'zip',trim(requested_payload->>'message'),statement_timestamp(),'/biz/'||(select current_slug from app.business_listings where id=requested_listing_id),'reno-inquiry-v1',destination,requested_abuse_key,fingerprint) returning id into new_lead_id;
  insert into private.inquiry_request_keys values(requested_key,payload_hash,new_lead_id);
  insert into app.lead_events(lead_id,event_type,evidence) values(new_lead_id,'submitted',jsonb_build_object('consent_version','reno-inquiry-v1'));
  insert into app.integration_outbox(destination,event_type,aggregate_type,aggregate_id,idempotency_key,payload) values('gohighlevel','lead.submitted','lead',new_lead_id::text,'lead:'||requested_key,jsonb_build_object('lead_id',new_lead_id,'listing_id',requested_listing_id,'destination_id',destination));
  return jsonb_build_object('id',new_lead_id,'status','received','idempotent',false);
end;
$$;
create function public.intake_reno_inquiry(requested_listing_id uuid,requested_payload jsonb,requested_key text,requested_abuse_key text) returns jsonb language sql security invoker set search_path='' as $$ select private.intake_reno_inquiry(requested_listing_id,requested_payload,requested_key,requested_abuse_key) $$;
revoke all on function private.intake_reno_inquiry(uuid,jsonb,text,text),public.intake_reno_inquiry(uuid,jsonb,text,text) from public,anon,authenticated;
grant execute on function private.intake_reno_inquiry(uuid,jsonb,text,text),public.intake_reno_inquiry(uuid,jsonb,text,text) to service_role;
-- Replace broad manager/agency access to resident PII with owner/operator or exact recipient assignment.
create function app.can_read_pilot_lead(requested_lead_id uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from app.leads l where l.id=requested_lead_id and (exists(select 1 from app.listing_participations lp where lp.actor_id=app.current_actor_id() and lp.listing_id=l.listing_id and lp.status='active' and (lp.starts_at is null or lp.starts_at<=statement_timestamp()) and (lp.expires_at is null or lp.expires_at>statement_timestamp()) and (lp.role='business_owner' or (lp.role='lead_recipient' and exists(select 1 from private.lead_destinations d where d.id=l.destination_id and d.participation_id=lp.id and d.revoked_at is null))))))
$$;
drop policy leads_read_authorized on app.leads;
drop policy lead_events_read_authorized on app.lead_events;
create policy leads_read_authorized on app.leads for select to authenticated using(app.can_read_pilot_lead(id));
create policy lead_events_read_authorized on app.lead_events for select to authenticated using(app.can_read_pilot_lead(lead_id));
revoke all on function app.can_read_pilot_lead(uuid) from public,anon;
grant execute on function app.can_read_pilot_lead(uuid) to authenticated;
create function public.reno_inquiry_available(requested_listing_id uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from private.lead_destinations d join app.listing_participations lp on lp.id=d.participation_id and lp.listing_id=d.listing_id join app.business_listings bl on bl.id=d.listing_id where bl.id=requested_listing_id and bl.city_slug='reno' and bl.publication_status='published' and bl.owner_verified_at is not null and exists(select 1 from app.listing_participations owner_lp where owner_lp.listing_id=bl.id and owner_lp.role='business_owner' and owner_lp.status='active' and (owner_lp.starts_at is null or owner_lp.starts_at<=statement_timestamp()) and (owner_lp.expires_at is null or owner_lp.expires_at>statement_timestamp())) and d.revoked_at is null and lp.role='lead_recipient' and lp.status='active' and (lp.starts_at is null or lp.starts_at<=statement_timestamp()) and (lp.expires_at is null or lp.expires_at>statement_timestamp()))
$$;
revoke all on function public.reno_inquiry_available(uuid) from public;
grant execute on function public.reno_inquiry_available(uuid) to anon,authenticated,service_role;
commit;
