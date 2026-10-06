begin;
alter table app.listing_requests add column listing_id uuid references app.business_listings(id),add column decision_reason text,add column decided_at timestamptz,add column decided_by uuid references app.actors(id);
create table app.listing_request_receipts (
 id uuid primary key default extensions.gen_random_uuid(),
 request_id uuid not null unique references app.listing_requests(id),
 listing_id uuid references app.business_listings(id),
 reviewer_id uuid not null references app.actors(id),
 decision text not null check(decision in ('approved','rejected')),
 reason text not null,
 source_urls jsonb not null,
 source_checked_at timestamptz,
 checks jsonb not null,
 duplicate_decision text not null,
 before_values jsonb not null,
 after_values jsonb not null,
 review_scope jsonb not null,
 idempotency_key text not null unique,
 request_fingerprint text not null,
 created_at timestamptz not null default statement_timestamp()
);
alter table app.listing_request_receipts enable row level security;
revoke all on app.listing_request_receipts from public,anon,authenticated,service_role;
create trigger listing_request_receipts_append_only before update or delete on app.listing_request_receipts for each row execute function private.reject_mutation();

create function private.require_listing_request_reviewer() returns uuid
language plpgsql stable security definer set search_path='' as $$
declare actor uuid:=app.current_actor_id();
begin
 if not app.operator_recent_auth(900) then raise exception 'reauth_required'; end if;
 if actor is null or not exists(select 1 from app.operator_grants where actor_id=actor and status='active' and 'listing_review'=any(permissions)) then raise exception 'review_forbidden'; end if;
 return actor;
end $$;
-- Conservative identity aliases: HTTPS default port, trailing DNS dot and www share a review queue.
create function private.listing_website_identity(url text) returns text
language sql immutable set search_path='' as $$
 select regexp_replace(regexp_replace(regexp_replace(lower(split_part(url,'/',3)),':443$',''),'\.$',''),'^www\.','')
$$;
revoke all on function private.listing_website_identity(text) from public,anon,authenticated,service_role;
create function private.listing_request_scope(requested_id uuid) returns jsonb
language sql stable security definer set search_path='' as $$
 select jsonb_build_object('requestHash',encode(extensions.digest(r.payload::text,'sha256'),'hex'),
 'duplicates',coalesce((select jsonb_agg(jsonb_build_object('id',bl.id,'version',bl.updated_at) order by bl.id) from app.business_listings bl where bl.city_slug='reno' and (
 lower(regexp_replace(bl.display_name,'[^a-zA-Z0-9]','','g'))=lower(regexp_replace(r.payload->>'name','[^a-zA-Z0-9]','','g'))
 or bl.phone_e164=r.payload->>'phone' or (coalesce(r.payload->>'website','')<>'' and private.listing_website_identity(bl.website_url)=private.listing_website_identity(r.payload->>'website')))),'[]'::jsonb)) from app.listing_requests r where r.id=requested_id
$$;
revoke all on function private.require_listing_request_reviewer(),private.listing_request_scope(uuid) from public,anon,authenticated,service_role;

create function public.get_listing_request_review(requested_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.require_listing_request_reviewer(); r app.listing_requests%rowtype; scope jsonb;
begin
 select * into r from app.listing_requests where id=requested_id and status='pending_review';
 if not found then raise exception 'request_unavailable'; end if;
 if r.payload->>'citySlug' is distinct from 'reno' then raise exception 'outside_pilot'; end if;
 scope:=private.listing_request_scope(r.id);
 insert into app.audit_events(actor_id,actor_kind,action,target_type,target_id) values(actor,'operator','listing.request_review_accessed','listing_request',r.id::text);
 return jsonb_build_object('id',r.id,'payload',r.payload,'scope',scope,'canPublish',exists(select 1 from app.operator_grants where actor_id=actor and status='active' and 'listing_publish'=any(permissions)),'categories',(select jsonb_agg(jsonb_build_object('slug',slug,'name',name) order by name) from app.categories),
 'duplicates',coalesce((select jsonb_agg(jsonb_build_object('id',bl.id,'name',bl.display_name,'slug',bl.current_slug,'zip',bl.postal_code,'status',bl.publication_status) order by bl.id) from app.business_listings bl where exists(select 1 from jsonb_array_elements(scope->'duplicates') d where d->>'id'=bl.id::text)),'[]'::jsonb));
end $$;

create function public.decide_listing_request(requested_id uuid,requested_decision jsonb,requested_scope jsonb,requested_key text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.require_listing_request_reviewer(); r app.listing_requests%rowtype; previous app.listing_request_receipts%rowtype;
 canonical jsonb:=requested_decision->'canonical'; checks jsonb:=requested_decision->'checks'; outcome text:=requested_decision->>'outcome'; source_checked timestamptz;
 fingerprint text; category uuid; business uuid; listing uuid; slug text; receipt uuid; after_values jsonb:='{}'::jsonb; current_scope jsonb;
begin
 if requested_key is null or requested_key !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{7,199}$' or jsonb_typeof(requested_decision) is distinct from 'object'
  or requested_decision-array['outcome','reason','sourceUrls','sourceCheckedAt','checks','duplicateDecision','canonical']<>'{}'::jsonb
  or outcome is null or outcome not in ('approved','rejected') or length(coalesce(trim(requested_decision->>'reason'),'')) not between 10 and 500
  or jsonb_typeof(requested_scope) is distinct from 'object' then raise exception 'invalid_listing_review'; end if;
 fingerprint:=encode(extensions.digest(jsonb_build_array(requested_id,requested_decision,requested_scope)::text,'sha256'),'hex');
 perform pg_advisory_xact_lock(hashtextextended('listing-request-decision:'||requested_key,0));
 -- Serializes new publications; shared locks on existing records keep duplicate investigation current.
 perform pg_advisory_xact_lock(hashtextextended('listing-request-publication',0));
 select * into r from app.listing_requests where id=requested_id for update;
 if not found then raise exception 'request_unavailable'; end if;
 if r.actor_id=actor then raise exception 'self_review_forbidden'; end if;
 select * into previous from app.listing_request_receipts where idempotency_key=requested_key;
 if found then
  if previous.request_id<>r.id or previous.reviewer_id<>actor or previous.request_fingerprint<>fingerprint then raise exception 'idempotency_conflict'; end if;
  return jsonb_build_object('request_id',r.id,'status',previous.decision,'listing_id',previous.listing_id,'receipt_id',previous.id,'idempotent',true);
 end if;
 if r.status<>'pending_review' then raise exception 'request_already_decided'; end if;
 if r.payload->>'citySlug' is distinct from 'reno' then raise exception 'outside_pilot'; end if;
 perform 1 from app.business_listings where city_slug='reno' for share;
 current_scope:=private.listing_request_scope(r.id);
 if current_scope is distinct from requested_scope then raise exception 'listing_review_changed'; end if;
 if outcome='approved' then
  if not exists(select 1 from app.operator_grants where actor_id=actor and status='active' and 'listing_publish'=any(permissions)) then raise exception 'publication_forbidden'; end if;
  if jsonb_typeof(canonical) is distinct from 'object' or canonical-array['name','citySlug','categorySlug','phone','zip','description','website']<>'{}'::jsonb
   or canonical->>'citySlug' is distinct from 'reno' or length(coalesce(trim(canonical->>'name'),'')) not between 2 and 200
   or length(coalesce(trim(canonical->>'description'),'')) not between 10 and 5000 or coalesce(canonical->>'phone','') !~ '^\+1[2-9][0-9]{2}[2-9][0-9]{6}$'
   or coalesce(canonical->>'zip','') !~ '^895[0-9]{2}$' or (coalesce(canonical->>'website','')<>'' and (canonical->>'website' !~ '^https://[^/@[:space:]]+(\.[^/@[:space:]]+)' or canonical->>'website' ~ '@'))
   or exists(select 1 from jsonb_each(canonical) v where jsonb_typeof(v.value)<>'string')
   or canonical->>'name' ~ '[[:cntrl:]]' or canonical->>'description' ~ '[<>]' then raise exception 'invalid_listing_review'; end if;
  select c.id into category from app.categories c where c.slug=canonical->>'categorySlug';
  if category is null then raise exception 'invalid_listing_review'; end if;
  if checks is distinct from '{"nap":true,"activeBusiness":true,"category":true,"reno":true,"rights":true,"privacy":true,"duplicates":true}'::jsonb
   or requested_decision->>'duplicateDecision' is distinct from 'no_duplicate' then raise exception 'publication_checks_required'; end if;
  -- Both submitted AND corrected identity must be checked. Ambiguous shared identity goes to human exception, not a new public duplicate.
  if jsonb_array_length(current_scope->'duplicates')>0 or exists(select 1 from app.business_listings bl where bl.city_slug='reno' and (
    lower(regexp_replace(bl.display_name,'[^a-zA-Z0-9]','','g'))=lower(regexp_replace(canonical->>'name','[^a-zA-Z0-9]','','g')) or bl.phone_e164=canonical->>'phone'
    or (coalesce(canonical->>'website','')<>'' and private.listing_website_identity(bl.website_url)=private.listing_website_identity(canonical->>'website')))) then raise exception 'duplicate_review_required'; end if;
  if jsonb_typeof(requested_decision->'sourceUrls') is distinct from 'array' or jsonb_array_length(requested_decision->'sourceUrls') not between 1 and 5
   or exists(select 1 from jsonb_array_elements(requested_decision->'sourceUrls') u where jsonb_typeof(u)<>'string' or length(u#>>'{}')>2000 or u#>>'{}' !~ '^https://[^/@[:space:]]+(\.[^/@[:space:]]+)' or u#>>'{}' ~ '@') then raise exception 'publication_sources_required'; end if;
  begin source_checked:=(requested_decision->>'sourceCheckedAt')::timestamptz; exception when others then raise exception 'publication_sources_required'; end;
  if source_checked is null or source_checked>statement_timestamp() or source_checked<statement_timestamp()-interval '30 days' then raise exception 'publication_sources_required'; end if;
  insert into app.businesses(canonical_name,import_identity_key) values(trim(canonical->>'name'),'listing-request:'||r.id) returning id into business;
  slug:=trim(both '-' from regexp_replace(lower(left(canonical->>'name',60)),'[^a-z0-9]+','-','g'));
  slug:=coalesce(nullif(slug,''),'reno-business')||'-'||replace(r.id::text,'-','');
  insert into app.business_listings(business_id,current_slug,display_name,description,phone_e164,website_url,city_slug,postal_code,is_service_area,hide_street,publication_status,published_at,information_checked_at,information_checked_by)
   values(business,slug,trim(canonical->>'name'),trim(canonical->>'description'),canonical->>'phone',nullif(canonical->>'website',''),'reno',canonical->>'zip',true,true,'published',statement_timestamp(),source_checked,actor) returning id into listing;
  insert into app.listing_slugs(slug,listing_id) values(slug,listing);
  insert into app.listing_categories(listing_id,category_id,is_primary) values(listing,category,true);
  insert into app.listing_content(listing_id,about,content_status,updated_by) values(listing,trim(canonical->>'description'),'approved',actor);
  select jsonb_build_object('listing',to_jsonb(bl)) into after_values from app.business_listings bl where id=listing;
  insert into app.listing_revisions(listing_id,revision_type,actor_id,before_values,after_values) values(listing,'created',actor,'{}',after_values);
 end if;
 insert into app.listing_request_receipts(request_id,listing_id,reviewer_id,decision,reason,source_urls,source_checked_at,checks,duplicate_decision,before_values,after_values,review_scope,idempotency_key,request_fingerprint)
 values(r.id,listing,actor,outcome,trim(requested_decision->>'reason'),case when outcome='approved' then requested_decision->'sourceUrls' else '[]'::jsonb end,source_checked,
 case when outcome='approved' then checks else '{}'::jsonb end,case when outcome='approved' then 'no_duplicate' else 'rejected' end,r.payload,after_values,current_scope,requested_key,fingerprint) returning id into receipt;
 update app.listing_requests set status=outcome,listing_id=listing,decision_reason=trim(requested_decision->>'reason'),decided_at=statement_timestamp(),decided_by=actor where id=r.id;
 insert into app.audit_events(actor_id,actor_kind,action,target_type,target_id,reason,before_ref,after_ref,request_id) values(actor,'operator','listing.request_'||outcome,'listing_request',r.id::text,trim(requested_decision->>'reason'),jsonb_build_object('status','pending_review'),jsonb_build_object('status',outcome,'receipt_id',receipt,'listing_id',listing),requested_key);
 if outcome='approved' then
  insert into app.integration_outbox(destination,event_type,aggregate_type,aggregate_id,idempotency_key,payload) values('gohighlevel','business_listing.published','business_listing',listing::text,'request-publication:'||receipt,jsonb_build_object('listing_id',listing,'business_id',business,'request_id',r.id,'publication_receipt_id',receipt,'publication_status','published'));
 end if;
 -- This stores a projection event only; no provider worker, message or payment is activated.
 -- No participation, Claim approval, Lead Recipient or Featured entitlement is created.
 return jsonb_build_object('request_id',r.id,'status',outcome,'listing_id',listing,'slug',slug,'receipt_id',receipt,'idempotent',false);
end $$;

create function public.get_my_listing_requests() returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
 if app.current_actor_id() is null then raise exception 'authentication_required'; end if;
 return coalesce((select jsonb_agg(jsonb_build_object('id',r.id,'name',r.payload->>'name','status',r.status,'createdAt',r.created_at,'reason',r.decision_reason,'slug',bl.current_slug) order by r.created_at desc) from app.listing_requests r left join app.business_listings bl on bl.id=r.listing_id and bl.publication_status='published' where r.actor_id=app.current_actor_id()),'[]'::jsonb);
end $$;
revoke all on function public.get_listing_request_review(uuid),public.decide_listing_request(uuid,jsonb,jsonb,text),public.get_my_listing_requests() from public,anon;
grant execute on function public.get_listing_request_review(uuid),public.decide_listing_request(uuid,jsonb,jsonb,text),public.get_my_listing_requests() to authenticated;
-- Preserve the existing recent-auth, listing_publish, locks, idempotency and rollback receipts.
-- Extend eligibility only to an approved request receipt, never an unreviewed draft.
create or replace function public.transition_listing_publication_state(
  requested_listing_id uuid,
  requested_transition text,
  requested_reason_codes text[],
  requested_idempotency_key text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_actor uuid;
  target app.business_listings%rowtype;
  existing_receipt app.listing_status_transition_receipts%rowtype;
  receipt_id_value uuid;
  normalized_reason_codes text[];
  request_fingerprint_value text;
  before_values_value jsonb;
  after_values_value jsonb;
begin
  if not app.operator_recent_auth(900) then
    raise exception 'recent Operator authentication is required';
  end if;

  current_actor := app.current_actor_id();
  if current_actor is null then
    raise exception 'Operator actor projection is required';
  end if;
  if not exists (
    select 1
    from app.operator_grants grant_record
    where grant_record.actor_id = current_actor
      and grant_record.status = 'active'
      and grant_record.permissions @> array['listing_publish']
  ) then
    raise exception 'Operator listing_publish permission is required';
  end if;
  if requested_listing_id is null then
    raise exception 'listing id is required';
  end if;
  if requested_transition not in ('suspend', 'restore') then
    raise exception 'listing publication transition is invalid';
  end if;
  if requested_idempotency_key is null
     or length(btrim(requested_idempotency_key)) not between 8 and 200 then
    raise exception 'idempotency key must contain 8 to 200 characters';
  end if;

  normalized_reason_codes := array(
    select reason_code from unnest(requested_reason_codes) reason_code order by reason_code
  );
  if cardinality(normalized_reason_codes) not between 1 and 20
     or cardinality(normalized_reason_codes) <> (
       select count(distinct reason_code) from unnest(normalized_reason_codes) reason_code
     )
     or exists (
       select 1 from unnest(normalized_reason_codes) reason_code
       where reason_code !~ '^[a-z0-9_]{1,80}$'
     ) then
    raise exception 'reason codes must contain 1 to 20 unique stable codes';
  end if;

  request_fingerprint_value := encode(
    extensions.digest(
      jsonb_build_object(
        'listing_id', requested_listing_id,
        'transition', requested_transition,
        'reason_codes', normalized_reason_codes
      )::text,
      'sha256'
    ),
    'hex'
  );

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'listing-publication-transition:' || btrim(requested_idempotency_key),
      0
    )
  );

  select * into existing_receipt
  from app.listing_status_transition_receipts
  where idempotency_key = btrim(requested_idempotency_key);
  if found then
    if existing_receipt.request_fingerprint <> request_fingerprint_value then
      raise exception 'idempotency key was already used for a different listing transition';
    end if;
    return existing_receipt.id;
  end if;

  select * into target
  from app.business_listings
  where id = requested_listing_id
  for update;
  if not found or not exists (
    select 1 from app.publication_receipts receipt where receipt.listing_id = requested_listing_id
    union all select 1 from app.listing_request_receipts receipt where receipt.listing_id = requested_listing_id and receipt.decision='approved'
  ) then
    raise exception 'published launch Listing does not exist';
  end if;
  if (requested_transition = 'suspend' and target.publication_status <> 'published')
     or (requested_transition = 'restore' and target.publication_status <> 'suspended') then
    raise exception 'listing publication transition is not allowed from the current state';
  end if;

  before_values_value := jsonb_build_object(
    'publication_status', target.publication_status,
    'published_at', target.published_at
  );

  update app.business_listings listing
  set publication_status = case
        when requested_transition = 'suspend' then 'suspended'
        else 'published'
      end,
      published_at = case
        when requested_transition = 'suspend' then null
        else statement_timestamp()
      end,
      updated_at = statement_timestamp()
  where listing.id = target.id
  returning jsonb_build_object(
    'publication_status', listing.publication_status,
    'published_at', listing.published_at
  ) into after_values_value;

  insert into app.listing_revisions (
    listing_id,
    revision_type,
    before_values,
    after_values,
    reason_codes,
    actor_id
  ) values (
    target.id,
    case when requested_transition = 'suspend' then 'suspended' else 'restored' end,
    before_values_value,
    after_values_value,
    normalized_reason_codes,
    current_actor
  );

  insert into app.listing_status_transition_receipts (
    listing_id,
    idempotency_key,
    request_fingerprint,
    actor_id,
    transition,
    reason_codes,
    before_values,
    after_values
  ) values (
    target.id,
    btrim(requested_idempotency_key),
    request_fingerprint_value,
    current_actor,
    requested_transition,
    normalized_reason_codes,
    before_values_value,
    after_values_value
  ) returning id into receipt_id_value;

  insert into app.audit_events (
    actor_id,
    actor_kind,
    action,
    target_type,
    target_id,
    reason,
    before_ref,
    after_ref,
    request_id,
    correlation_id
  ) values (
    current_actor,
    'operator',
    case
      when requested_transition = 'suspend' then 'business_listing_suspended'
      else 'business_listing_restored'
    end,
    'business_listing',
    target.id::text,
    array_to_string(normalized_reason_codes, ','),
    before_values_value,
    after_values_value || jsonb_build_object('transition_receipt_id', receipt_id_value),
    btrim(requested_idempotency_key),
    receipt_id_value::text
  );

  insert into app.integration_outbox (
    destination,
    event_type,
    aggregate_type,
    aggregate_id,
    idempotency_key,
    payload
  ) values (
    'gohighlevel',
    case
      when requested_transition = 'suspend' then 'business_listing.suspended'
      else 'business_listing.restored'
    end,
    'business_listing',
    target.id::text,
    'listing-transition:' || receipt_id_value::text,
    jsonb_build_object(
      'listing_id', target.id,
      'publication_status', after_values_value ->> 'publication_status',
      'transition_receipt_id', receipt_id_value
    )
  );

  return receipt_id_value;
end;
$$;

commit;
