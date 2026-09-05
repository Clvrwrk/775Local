begin;

alter table app.claims
  add column submission_idempotency_key text,
  add column decision_idempotency_key text;

create unique index claims_submission_idempotency_unique
  on app.claims (submission_idempotency_key)
  where submission_idempotency_key is not null;

create unique index claims_decision_idempotency_unique
  on app.claims (decision_idempotency_key)
  where decision_idempotency_key is not null;

alter table app.listing_participations
  drop constraint listing_participations_role_check;

alter table app.listing_participations
  add constraint listing_participations_role_check
  check (role in ('business_owner', 'listing_manager', 'agency_representative', 'lead_recipient'));

alter table app.audit_events
  drop constraint audit_events_actor_kind_check;

alter table app.audit_events
  add constraint audit_events_actor_kind_check
  check (actor_kind in (
    'resident',
    'claimant',
    'business_owner',
    'listing_manager',
    'agency_representative',
    'operator',
    'system',
    'provider'
  ));

alter table private.claim_proofs
  add column scan_status text not null default 'quarantined' check(scan_status in ('quarantined','clean','rejected')),
  add column validated_at timestamptz;

drop policy if exists claims_create_self on app.claims;
drop policy if exists claims_update_self_draft on app.claims;
revoke insert, update on app.claims from authenticated;

create or replace function app.claim_email_matches_listing(
  requested_actor_id uuid,
  requested_listing_id uuid
)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  actor_email text;
  actor_domain text;
  listing_host text;
  listing_email_domain text;
begin
  select lower(trim(primary_email))
  into actor_email
  from app.actors
  where id = requested_actor_id
    and status = 'active';

  actor_domain := lower(split_part(coalesce(actor_email, ''), '@', 2));
  if actor_domain = '' or actor_domain = any (array[
    'gmail.com', 'googlemail.com', 'yahoo.com', 'outlook.com', 'hotmail.com',
    'live.com', 'icloud.com', 'me.com', 'aol.com', 'proton.me', 'protonmail.com'
  ]) then
    return false;
  end if;

  select
    regexp_replace(
      lower(split_part(regexp_replace(coalesce(bl.website_url, ''), '^https?://', '', 'i'), '/', 1)),
      '^www\.',
      ''
    ),
    lower(split_part(coalesce(lpc.business_email, ''), '@', 2))
  into listing_host, listing_email_domain
  from app.business_listings bl
  left join app.listing_private_contacts lpc on lpc.listing_id = bl.id
  where bl.id = requested_listing_id;

  return actor_domain <> '' and (
    actor_domain = listing_host
    or actor_domain = listing_email_domain
    or (listing_host <> '' and actor_domain like '%.' || listing_host)
  );
end;
$$;

revoke all on function app.claim_email_matches_listing(uuid, uuid) from public;
grant execute on function app.claim_email_matches_listing(uuid, uuid) to service_role;

create or replace function public.submit_listing_claim(
  requested_listing_id uuid,
  requested_method text,
  requested_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_actor uuid;
  listing_record app.business_listings%rowtype;
  existing_claim app.claims%rowtype;
  created_claim app.claims%rowtype;
  claim_status text;
  requires_evidence boolean;
begin
  if requested_listing_id is null
    or requested_method not in ('business_domain', 'document', 'storefront', 'vehicle')
    or requested_idempotency_key is null
    or length(requested_idempotency_key) not between 8 and 200
    or requested_idempotency_key !~ '^[A-Za-z0-9][A-Za-z0-9._:-]*$' then
    raise exception 'invalid claim command';
  end if;

  current_actor := app.current_actor_id();
  if current_actor is null then
    raise exception 'authenticated actor projection is required';
  end if;

  select *
  into listing_record
  from app.business_listings
  where id = requested_listing_id
    and publication_status = 'published'
    and city_slug = 'reno'
  for update;

  if not found then
    raise exception 'listing is not claimable';
  end if;

  if exists (
    select 1
    from app.listing_participations lp
    where lp.actor_id = current_actor
      and lp.listing_id = requested_listing_id
      and lp.role = 'business_owner'
      and lp.status = 'active'
      and (lp.starts_at is null or lp.starts_at <= statement_timestamp())
      and (lp.expires_at is null or lp.expires_at > statement_timestamp())
  ) then
    return jsonb_build_object(
      'status', 'approved',
      'role', 'business_owner',
      'owner_authority', true,
      'requires_evidence', false
    );
  end if;

  select *
  into existing_claim
  from app.claims
  where claimant_actor_id = current_actor
    and listing_id = requested_listing_id
    and status in ('draft', 'submitted', 'needs_evidence', 'approved')
  order by created_at desc
  limit 1;

  if found then
    return jsonb_build_object(
      'claim_id', existing_claim.id,
      'status', existing_claim.status,
      'method', existing_claim.method,
      'owner_authority', existing_claim.status = 'approved',
      'requires_evidence', existing_claim.status = 'needs_evidence'
    );
  end if;

  if listing_record.owner_verified_at is not null then
    raise exception 'additional listing access requires an invitation';
  end if;

  if requested_method = 'business_domain'
    and not app.claim_email_matches_listing(current_actor, requested_listing_id) then
    raise exception 'business domain evidence was not established';
  end if;

  requires_evidence := requested_method <> 'business_domain';
  claim_status := case when requires_evidence then 'needs_evidence' else 'submitted' end;

  insert into app.claims (
    listing_id,
    claimant_actor_id,
    method,
    status,
    submitted_at,
    submission_idempotency_key
  ) values (
    requested_listing_id,
    current_actor,
    requested_method,
    claim_status,
    statement_timestamp(),
    requested_idempotency_key
  )
  returning * into created_claim;

  insert into app.audit_events (
    actor_id,
    actor_kind,
    action,
    target_type,
    target_id,
    reason,
    after_ref,
    request_id,
    correlation_id
  ) values (
    current_actor,
    'claimant',
    'claim.submitted',
    'claim',
    created_claim.id::text,
    requested_method,
    jsonb_build_object(
      'listing_id', requested_listing_id,
      'status', claim_status,
      'requires_evidence', requires_evidence
    ),
    requested_idempotency_key,
    created_claim.id::text
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
    'claim.submitted',
    'claim',
    created_claim.id::text,
    'claim-submitted:' || requested_idempotency_key,
    jsonb_build_object(
      'claim_id', created_claim.id,
      'listing_id', requested_listing_id,
      'actor_id', current_actor,
      'status', claim_status,
      'method', requested_method
    )
  );

  return jsonb_build_object(
    'claim_id', created_claim.id,
    'status', claim_status,
    'method', requested_method,
    'owner_authority', false,
    'requires_evidence', requires_evidence
  );
end;
$$;

create or replace function public.get_my_listing_claim(
  requested_listing_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  current_actor uuid;
  participation_record app.listing_participations%rowtype;
  claim_record app.claims%rowtype;
begin
  current_actor := app.current_actor_id();
  if current_actor is null then
    raise exception 'authenticated actor projection is required';
  end if;

  if app.is_operator() then
    return jsonb_build_object(
      'status', 'approved',
      'role', 'operator',
      'owner_authority', false,
      'requires_evidence', false
    );
  end if;

  select *
  into participation_record
  from app.listing_participations lp
  where lp.actor_id = current_actor
    and lp.listing_id = requested_listing_id
    and lp.status = 'active'
    and (lp.starts_at is null or lp.starts_at <= statement_timestamp())
    and (lp.expires_at is null or lp.expires_at > statement_timestamp())
  order by case lp.role
    when 'business_owner' then 1
    when 'listing_manager' then 2
    when 'agency_representative' then 3
    when 'lead_recipient' then 4
    else 5
  end
  limit 1;

  if found then
    return jsonb_build_object(
      'status', 'approved',
      'role', participation_record.role,
      'owner_authority', participation_record.role = 'business_owner',
      'requires_evidence', false
    );
  end if;

  select *
  into claim_record
  from app.claims
  where claimant_actor_id = current_actor
    and listing_id = requested_listing_id
  order by created_at desc
  limit 1;

  if not found then
    return null;
  end if;

  return jsonb_build_object(
    'claim_id', claim_record.id,
    'status', claim_record.status,
    'method', claim_record.method,
    'owner_authority', claim_record.status = 'approved',
    'requires_evidence', claim_record.status = 'needs_evidence'
  );
end;
$$;

create or replace function public.decide_listing_claim(
  requested_claim_id uuid,
  requested_decision text,
  requested_reason text,
  requested_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_actor uuid;
  claim_record app.claims%rowtype;
  owner_count integer;
  participation_id uuid;
begin
  if requested_claim_id is null
    or requested_decision not in ('approved', 'rejected')
    or requested_reason is null
    or length(trim(requested_reason)) not between 3 and 500
    or requested_idempotency_key is null
    or length(requested_idempotency_key) not between 8 and 200
    or requested_idempotency_key !~ '^[A-Za-z0-9][A-Za-z0-9._:-]*$' then
    raise exception 'invalid Claim decision command';
  end if;

  if not app.operator_recent_auth(900) then
    raise exception 'recent Operator authentication is required';
  end if;

  current_actor := app.current_actor_id();
  if current_actor is null or not exists (
    select 1
    from app.operator_grants og
    where og.actor_id = current_actor
      and og.status = 'active'
      and 'claim_review' = any (og.permissions)
  ) then
    raise exception 'Operator claim_review permission is required';
  end if;

  select *
  into claim_record
  from app.claims
  where id = requested_claim_id
  for update;

  if not found then
    raise exception 'Claim was not found';
  end if;

  if claim_record.status in ('approved', 'rejected') then
    if claim_record.decision_idempotency_key = requested_idempotency_key
      and claim_record.status = requested_decision
      and claim_record.decision_reason = trim(requested_reason) then
      return jsonb_build_object(
        'claim_id', claim_record.id,
        'listing_id', claim_record.listing_id,
        'status', claim_record.status,
        'idempotent', true
      );
    end if;
    raise exception 'Claim already has a terminal decision';
  end if;

  if claim_record.status not in ('submitted', 'needs_evidence') then
    raise exception 'Claim is not ready for a decision';
  end if;

  if requested_decision = 'approved' and claim_record.method = 'business_domain'
    and not app.claim_email_matches_listing(claim_record.claimant_actor_id, claim_record.listing_id) then
    raise exception 'business domain evidence is no longer established';
  end if;

  if requested_decision = 'approved'
    and claim_record.method <> 'business_domain'
    and not exists (
      select 1
      from private.claim_proofs cp
      where cp.claim_id = claim_record.id
        and cp.deleted_at is null
        and cp.scan_status = 'clean' and cp.validated_at is not null
        and cp.delete_after > statement_timestamp()
    ) then
    raise exception 'Claim Proof is required before approval';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('listing-owners:' || claim_record.listing_id::text, 0));

  if requested_decision = 'approved' then
    select count(*)
    into owner_count
    from app.listing_participations lp
    where lp.listing_id = claim_record.listing_id
      and lp.role = 'business_owner'
      and lp.status in ('pending', 'active')
      and (lp.expires_at is null or lp.expires_at > statement_timestamp());

    if owner_count >= 2 then
      raise exception 'Business Owner limit reached';
    end if;

    insert into app.listing_participations (
      actor_id,
      listing_id,
      role,
      status,
      authority_scope,
      starts_at
    ) values (
      claim_record.claimant_actor_id,
      claim_record.listing_id,
      'business_owner',
      'active',
      jsonb_build_object(
        'listing_content', 'manage',
        'listing_identity', 'propose',
        'participants', 'manage',
        'leads', 'manage',
        'featured', 'manage'
      ),
      statement_timestamp()
    )
    returning id into participation_id;

    update app.business_listings
    set owner_verified_at = coalesce(owner_verified_at, statement_timestamp())
    where id = claim_record.listing_id;
  end if;

  update app.claims
  set status = requested_decision,
      decision_reason = trim(requested_reason),
      decided_at = statement_timestamp(),
      decided_by = current_actor,
      decision_idempotency_key = requested_idempotency_key
  where id = claim_record.id;

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
    'claim.' || requested_decision,
    'claim',
    claim_record.id::text,
    trim(requested_reason),
    jsonb_build_object('status', claim_record.status),
    jsonb_build_object(
      'status', requested_decision,
      'listing_id', claim_record.listing_id,
      'participation_id', participation_id
    ),
    requested_idempotency_key,
    claim_record.id::text
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
    'claim.' || requested_decision,
    'claim',
    claim_record.id::text,
    'claim-decision:' || requested_idempotency_key,
    jsonb_build_object(
      'claim_id', claim_record.id,
      'listing_id', claim_record.listing_id,
      'actor_id', claim_record.claimant_actor_id,
      'status', requested_decision,
      'participation_id', participation_id
    )
  );

  if requested_decision = 'approved' then
    insert into app.integration_outbox (
      destination,
      event_type,
      aggregate_type,
      aggregate_id,
      idempotency_key,
      payload
    ) values (
      'gohighlevel',
      'listing_participation.activated',
      'listing_participation',
      participation_id::text,
      'participation-activated:' || requested_idempotency_key,
      jsonb_build_object(
        'participation_id', participation_id,
        'listing_id', claim_record.listing_id,
        'actor_id', claim_record.claimant_actor_id,
        'role', 'business_owner'
      )
    );
  end if;

  return jsonb_build_object(
    'claim_id', claim_record.id,
    'listing_id', claim_record.listing_id,
    'status', requested_decision,
    'participation_id', participation_id,
    'idempotent', false
  );
end;
$$;

revoke all on function public.submit_listing_claim(uuid, text, text) from public, anon;
revoke all on function public.get_my_listing_claim(uuid) from public, anon;
revoke all on function public.decide_listing_claim(uuid, text, text, text) from public, anon;

grant execute on function public.submit_listing_claim(uuid, text, text) to authenticated;
grant execute on function public.get_my_listing_claim(uuid) to authenticated;
grant execute on function public.decide_listing_claim(uuid, text, text, text) to authenticated;

comment on function public.submit_listing_claim(uuid, text, text) is
  'Authenticated, idempotent Claim submission. It never grants Listing authority or Lead delivery.';

comment on function public.get_my_listing_claim(uuid) is
  'Returns only the current Actor Claim or active participation status for one Listing.';

comment on function public.decide_listing_claim(uuid, text, text, text) is
  'Recent-authenticated Operator decision command. Approval creates one capped Business Owner participation and durable projection events.';

commit;
