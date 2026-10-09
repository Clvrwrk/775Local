begin;

-- Expand/contract: legacy callers remain callable, but cannot bypass the new review gates.
alter table app.claims add column requested_role text not null default 'business_owner'
  check (requested_role in ('business_owner','listing_manager')),
  add column evidence_challenge uuid not null default extensions.gen_random_uuid(),
  add column challenge_expires_at timestamptz not null default statement_timestamp()+interval '24 hours',
  add column withdrawn_at timestamptz;
alter table app.listing_participations add column claim_id uuid references app.claims(id);
-- Existing approvals have no independently reviewed authority assessment; do not retroactively invent one.

create table private.claim_evidence (
  id uuid primary key default extensions.gen_random_uuid(),
  claim_id uuid not null references app.claims(id),
  reference text not null check(length(reference) between 10 and 2000),
  explanation text not null check(length(explanation) between 20 and 4000),
  idempotency_key text not null unique,
  challenge uuid not null unique,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz not null default statement_timestamp()
);
-- Text evidence is a private pointer for independent investigation, never self-verification.
-- No file upload is accepted through this channel; quarantined files cannot be read here.
create table private.claim_authority_reviews (
  id uuid primary key default extensions.gen_random_uuid(),
  evidence_id uuid not null references private.claim_evidence(id),
  listing_id uuid not null references app.business_listings(id),
  claimant_actor_id uuid not null references app.actors(id),
  reviewed_role text not null check(reviewed_role in ('business_owner','listing_manager')),
  reviewer_id uuid not null references app.actors(id),
  identity_basis text not null check(length(identity_basis) between 10 and 2000),
  authority_basis text not null check(length(authority_basis) between 10 and 2000),
  conflict_resolution text not null,
  scope_snapshot jsonb not null,
  valid_until timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz not null default statement_timestamp()
);
alter table private.claim_evidence enable row level security;
alter table private.claim_authority_reviews enable row level security;
revoke all on private.claim_evidence,private.claim_authority_reviews from public,anon,authenticated;

create function private.claim_scope_snapshot(requested_claim uuid) returns jsonb
language sql stable security definer set search_path='' as $$
  select jsonb_build_object('listingVersion',bl.updated_at,'role',c.requested_role,
    'conflicts',coalesce((select jsonb_agg(jsonb_build_object('id',other.id,'status',other.status) order by other.id) from app.claims other where other.listing_id=c.listing_id and other.id<>c.id and other.status in ('submitted','needs_evidence')),'[]'::jsonb),
    'participants',coalesce((select jsonb_agg(jsonb_build_object('id',lp.id,'status',lp.status,'expiresAt',lp.expires_at) order by lp.id) from app.listing_participations lp where lp.listing_id=c.listing_id and lp.role='business_owner' and lp.status in ('pending','active')),'[]'::jsonb))
  from app.claims c join app.business_listings bl on bl.id=c.listing_id where c.id=requested_claim
$$;
revoke all on function private.claim_scope_snapshot(uuid) from public,anon,authenticated;

create function private.require_claim_reviewer() returns uuid
language plpgsql stable security definer set search_path='' as $$
declare actor uuid:=app.current_actor_id();
begin
  if not app.operator_recent_auth(900) then raise exception 'reauth_required'; end if;
  if actor is null or not exists(select 1 from app.operator_grants where actor_id=actor and status='active' and 'claim_review'=any(permissions)) then raise exception 'review_forbidden'; end if;
  return actor;
end $$;
revoke all on function private.require_claim_reviewer() from public,anon,authenticated;

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
      'authority_active', true,
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
    'owner_authority', false,
    'authority_active', false,
    'requested_role', claim_record.requested_role,
    'challenge', case when claim_record.status in ('submitted','needs_evidence') then claim_record.evidence_challenge else null end,
    'challenge_expires_at', claim_record.challenge_expires_at,
    'evidence', coalesce((select jsonb_agg(jsonb_build_object('id',e.id,'submitted_at',e.created_at,'expires_at',e.expires_at,'reviewed',exists(select 1 from private.claim_authority_reviews r where r.evidence_id=e.id and r.valid_until>statement_timestamp() and r.revoked_at is null))) from private.claim_evidence e where e.claim_id=claim_record.id), '[]'::jsonb),
    'requires_evidence', claim_record.status = 'needs_evidence'
  );
end;
$$;

create or replace function public.submit_listing_claim(
  requested_listing_id uuid,
  requested_method text,
  requested_idempotency_key text,
  requested_role text
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
  if requested_role is null or requested_role not in ('business_owner','listing_manager')
    or requested_method is null
    or requested_listing_id is null
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

  perform pg_advisory_xact_lock(hashtextextended('claim-key:'||requested_idempotency_key,0));

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

  select * into existing_claim from app.claims where submission_idempotency_key=requested_idempotency_key;
  if found then
    if existing_claim.claimant_actor_id<>current_actor or existing_claim.listing_id<>requested_listing_id
      or existing_claim.method<>requested_method or existing_claim.requested_role<>requested_role then
      raise exception 'idempotency_conflict';
    end if;
    return jsonb_build_object('claim_id',existing_claim.id,'status',existing_claim.status,'method',existing_claim.method,'requested_role',existing_claim.requested_role,'owner_authority',false,'requires_evidence',existing_claim.status in ('submitted','needs_evidence'),'challenge',case when existing_claim.status in ('submitted','needs_evidence') then existing_claim.evidence_challenge else null end,'challenge_expires_at',existing_claim.challenge_expires_at);
  end if;
  select * into existing_claim from app.claims
    where claimant_actor_id=current_actor and listing_id=requested_listing_id and status in ('draft','submitted','needs_evidence')
    order by created_at desc limit 1;
  if found then
    if existing_claim.requested_role<>requested_role or existing_claim.method<>requested_method then raise exception 'open_claim_conflict'; end if;
    return public.get_my_listing_claim(requested_listing_id);
  end if;
  if exists(select 1 from app.listing_participations where actor_id=current_actor and listing_id=requested_listing_id and status='active'
      and (starts_at is null or starts_at<=statement_timestamp()) and (expires_at is null or expires_at>statement_timestamp())) then
    return public.get_my_listing_claim(requested_listing_id);
  end if;
  requires_evidence := true;
  claim_status := 'needs_evidence';

  insert into app.claims (
    listing_id,
    claimant_actor_id,
    method,
    status,
    submitted_at,
    submission_idempotency_key, requested_role
  ) values (
    requested_listing_id,
    current_actor,
    requested_method,
    claim_status,
    statement_timestamp(),
    requested_idempotency_key, requested_role
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
    'requested_role', requested_role,
    'challenge', created_claim.evidence_challenge,
    'challenge_expires_at', created_claim.challenge_expires_at,
    'owner_authority', false,
    'requires_evidence', requires_evidence
  );
end;
$$;

create or replace function public.submit_listing_claim(requested_listing_id uuid, requested_method text, requested_idempotency_key text) returns jsonb
language sql security definer set search_path='' as $$ select public.submit_listing_claim(requested_listing_id,requested_method,requested_idempotency_key,'business_owner') $$;

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
  authority_review private.claim_authority_reviews%rowtype;
  participation_id uuid;
begin
  if requested_claim_id is null
    or requested_decision is null
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

  perform 1 from app.business_listings where id=(select listing_id from app.claims where id=requested_claim_id) for update;

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

  if requested_decision='approved' then
    if not exists(select 1 from app.business_listings where id=claim_record.listing_id and city_slug='reno' and publication_status='published')
      or not exists(select 1 from app.actors where id=claim_record.claimant_actor_id and status='active') then raise exception 'claim_scope_invalid'; end if;
    if current_actor=claim_record.claimant_actor_id then raise exception 'self_review_forbidden'; end if;
    select r.* into authority_review from private.claim_authority_reviews r
      join private.claim_evidence e on e.id=r.evidence_id
      where e.claim_id=claim_record.id and e.expires_at>statement_timestamp() and e.revoked_at is null
        and r.valid_until>statement_timestamp() and r.revoked_at is null
        and r.reviewed_role=claim_record.requested_role and r.listing_id=claim_record.listing_id
        and r.claimant_actor_id=claim_record.claimant_actor_id
        and r.scope_snapshot=private.claim_scope_snapshot(claim_record.id)
      order by r.created_at desc limit 1;
    if not found then raise exception 'independent_authority_review_required'; end if;
  end if;

  perform pg_advisory_xact_lock(hashtextextended('listing-owners:' || claim_record.listing_id::text, 0));

  if requested_decision = 'approved' then
    select count(*)
    into owner_count
    from app.listing_participations lp
    where lp.listing_id = claim_record.listing_id
      and lp.role = claim_record.requested_role
      and lp.status in ('pending', 'active')
      and (lp.expires_at is null or lp.expires_at > statement_timestamp());

    if owner_count >= (case when claim_record.requested_role='business_owner' then 2 else 3 end) then
      raise exception 'participation_limit_reached';
    end if;

    update app.listing_participations set status='expired' where listing_id=claim_record.listing_id and status in ('active','pending') and expires_at<=statement_timestamp();
    insert into app.listing_participations (
      actor_id,
      listing_id,
      role,
      status,
      authority_scope,
      starts_at, expires_at, claim_id
    ) values (
      claim_record.claimant_actor_id,
      claim_record.listing_id,
      claim_record.requested_role,
      'active',
      jsonb_build_object(
        'listing_content', 'manage',
        'listing_identity', 'propose',
        'participants', case when claim_record.requested_role='business_owner' then 'manage' else 'none' end,
        'featured', 'manage'
      ),
      statement_timestamp(), authority_review.valid_until, claim_record.id
    )
    returning id into participation_id;

    if claim_record.requested_role='business_owner' then
      update app.business_listings set owner_verified_at=coalesce(owner_verified_at,statement_timestamp()) where id=claim_record.listing_id;
    end if;
    update private.claim_proofs set delete_after=least(coalesce(delete_after,statement_timestamp()+interval '30 days'),statement_timestamp()+interval '30 days') where claim_id=claim_record.id and deleted_at is null;
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
        'role', claim_record.requested_role
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

create function public.submit_claim_evidence(requested_claim_id uuid, requested_challenge uuid, requested_reference text, requested_explanation text, requested_key text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor uuid:=app.current_actor_id(); c app.claims%rowtype; e private.claim_evidence%rowtype;
begin
  if actor is null then raise exception 'authentication_required'; end if;
  if requested_key is null or requested_key !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{7,199}$'
    or length(coalesce(trim(requested_reference),'')) not between 10 and 2000
    or length(coalesce(trim(requested_explanation),'')) not between 20 and 4000 then raise exception 'invalid_claim_evidence'; end if;
  perform pg_advisory_xact_lock(hashtextextended('claim-evidence-key:'||requested_key,0));
  perform 1 from app.business_listings where id=(select listing_id from app.claims where id=requested_claim_id) for update;
  select * into c from app.claims where id=requested_claim_id and claimant_actor_id=actor for update;
  if not found then raise exception 'claim_access_forbidden'; end if;
  select * into e from private.claim_evidence where idempotency_key=requested_key;
  if found then
    if e.claim_id<>c.id or e.challenge is distinct from requested_challenge or e.reference<>trim(requested_reference) or e.explanation<>trim(requested_explanation) then raise exception 'idempotency_conflict'; end if;
    return jsonb_build_object('evidence_id',e.id,'status',c.status,'idempotent',true);
  end if;
  if c.status not in ('submitted','needs_evidence') then raise exception 'claim_not_open'; end if;
  if c.evidence_challenge is distinct from requested_challenge or c.challenge_expires_at<=statement_timestamp()
    or exists(select 1 from private.claim_evidence where challenge=requested_challenge) then raise exception 'challenge_expired_or_replayed'; end if;
  insert into private.claim_evidence(claim_id,reference,explanation,idempotency_key,challenge,expires_at)
    values(c.id,trim(requested_reference),trim(requested_explanation),requested_key,requested_challenge,statement_timestamp()+interval '30 days') returning * into e;
  update app.claims set status='submitted',evidence_challenge=extensions.gen_random_uuid(),challenge_expires_at=statement_timestamp()+interval '24 hours' where id=c.id;
  insert into app.audit_events(actor_id,actor_kind,action,target_type,target_id,request_id) values(actor,'claimant','claim.evidence_submitted','claim',c.id::text,requested_key);
  return jsonb_build_object('evidence_id',e.id,'status','submitted','idempotent',false);
end $$;

create function public.refresh_claim_challenge(requested_claim_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare c app.claims%rowtype;
begin
  if app.current_actor_id() is null then raise exception 'authentication_required'; end if;
  update app.claims set evidence_challenge=extensions.gen_random_uuid(),challenge_expires_at=statement_timestamp()+interval '24 hours'
    where id=requested_claim_id and claimant_actor_id=app.current_actor_id() and status in ('submitted','needs_evidence') and challenge_expires_at<=statement_timestamp() returning * into c;
  if not found then raise exception 'challenge_not_expired'; end if;
  insert into app.audit_events(actor_id,actor_kind,action,target_type,target_id) values(app.current_actor_id(),'claimant','claim.challenge_refreshed','claim',c.id::text);
  return public.get_my_listing_claim(c.listing_id);
end $$;

create function public.get_claim_review_evidence(requested_claim_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.require_claim_reviewer(); result jsonb;
begin
  if not exists(select 1 from app.claims c join app.business_listings bl on bl.id=c.listing_id where c.id=requested_claim_id and bl.city_slug='reno') then raise exception 'claim_scope_invalid'; end if;
  select coalesce(jsonb_agg(jsonb_build_object('id',e.id,'reference',e.reference,'explanation',e.explanation,'expires_at',e.expires_at,'revoked',e.revoked_at is not null) order by e.created_at desc),'[]'::jsonb) into result from private.claim_evidence e where e.claim_id=requested_claim_id;
  insert into app.audit_events(actor_id,actor_kind,action,target_type,target_id) values(actor,'operator','claim.evidence_accessed','claim',requested_claim_id::text);
  return jsonb_build_object('evidence',result,'scope',private.claim_scope_snapshot(requested_claim_id));
end $$;

create function public.review_claim_authority(requested_claim_id uuid, requested_evidence_id uuid, requested_identity_basis text, requested_authority_basis text, requested_conflict_resolution text, requested_valid_until timestamptz, requested_scope jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.require_claim_reviewer(); c app.claims%rowtype; e private.claim_evidence%rowtype; snapshot jsonb; review_id uuid;
begin
  perform 1 from app.business_listings where id=(select listing_id from app.claims where id=requested_claim_id) for update;
  select * into c from app.claims where id=requested_claim_id for update;
  if not found or c.status not in ('submitted','needs_evidence') then raise exception 'claim_not_open'; end if;
  if actor=c.claimant_actor_id then raise exception 'self_review_forbidden'; end if;
  if length(coalesce(trim(requested_identity_basis),'')) not between 10 and 2000
    or length(coalesce(trim(requested_authority_basis),'')) not between 10 and 2000
    or length(coalesce(trim(requested_conflict_resolution),'')) not between 10 and 2000
    or requested_valid_until is null or requested_valid_until<=statement_timestamp() or requested_valid_until>statement_timestamp()+interval '90 days' then raise exception 'invalid_authority_review'; end if;
  select * into e from private.claim_evidence where id=requested_evidence_id and claim_id=c.id and expires_at>statement_timestamp() and revoked_at is null;
  if not found then raise exception 'current_evidence_required'; end if;
  snapshot:=private.claim_scope_snapshot(c.id);
  if requested_scope is distinct from snapshot then raise exception 'claim_scope_changed'; end if;
  if not exists(select 1 from app.business_listings where id=c.listing_id and city_slug='reno' and publication_status='published') then raise exception 'claim_scope_invalid'; end if;
  -- A human must identify the claimant, verify the exact location and requested authority,
  -- and explicitly reconcile the current conflicting claims/participants. A domain hint or
  -- payment is not an authority assessment and is never used by this function.
  insert into private.claim_authority_reviews(evidence_id,listing_id,claimant_actor_id,reviewed_role,reviewer_id,identity_basis,authority_basis,conflict_resolution,scope_snapshot,valid_until)
    values(e.id,c.listing_id,c.claimant_actor_id,c.requested_role,actor,trim(requested_identity_basis),trim(requested_authority_basis),trim(requested_conflict_resolution),snapshot,least(requested_valid_until,e.expires_at)) returning id into review_id;
  insert into app.audit_events(actor_id,actor_kind,action,target_type,target_id,after_ref) values(actor,'operator','claim.authority_reviewed','claim',c.id::text,jsonb_build_object('review_id',review_id,'evidence_id',e.id,'role',c.requested_role));
  return jsonb_build_object('review_id',review_id,'status','human_reviewed');
end $$;

create function public.withdraw_listing_claim(requested_claim_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor uuid:=app.current_actor_id(); c app.claims%rowtype;
begin
  if actor is null then raise exception 'authentication_required'; end if;
  perform 1 from app.business_listings where id=(select listing_id from app.claims where id=requested_claim_id) for update;
  select * into c from app.claims where id=requested_claim_id and claimant_actor_id=actor for update;
  if not found then raise exception 'claim_access_forbidden'; end if;
  if c.status='withdrawn' then return jsonb_build_object('status','withdrawn','idempotent',true); end if;
  if c.status not in ('draft','submitted','needs_evidence') then raise exception 'claim_not_open'; end if;
  update app.claims set status='withdrawn',withdrawn_at=statement_timestamp() where id=c.id;
  update private.claim_evidence set revoked_at=statement_timestamp() where claim_id=c.id and revoked_at is null;
  update private.claim_proofs set delete_after=least(coalesce(delete_after,statement_timestamp()+interval '30 days'),statement_timestamp()+interval '30 days') where claim_id=c.id and deleted_at is null;
  insert into app.audit_events(actor_id,actor_kind,action,target_type,target_id) values(actor,'claimant','claim.withdrawn','claim',c.id::text);
  insert into app.integration_outbox(destination,event_type,aggregate_type,aggregate_id,idempotency_key,payload) values('gohighlevel','claim.withdrawn','claim',c.id::text,'claim-withdrawn:'||c.id,jsonb_build_object('claim_id',c.id,'listing_id',c.listing_id));
  return jsonb_build_object('status','withdrawn','idempotent',false);
end $$;

create function public.revoke_listing_authority(requested_participation_id uuid, requested_reason text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.require_claim_reviewer(); p app.listing_participations%rowtype;
begin
  if length(coalesce(trim(requested_reason),'')) not between 10 and 500 then raise exception 'invalid_revocation'; end if;
  perform 1 from app.business_listings where id=(select listing_id from app.listing_participations where id=requested_participation_id) for update;
  select * into p from app.listing_participations where id=requested_participation_id for update;
  if not found then raise exception 'participation_not_found'; end if;
  if p.status='revoked' then return jsonb_build_object('status','revoked','idempotent',true); end if;
  update app.listing_participations set status='revoked',revoked_at=statement_timestamp(),revoked_by=actor where id=p.id;
  update private.claim_authority_reviews set revoked_at=statement_timestamp() where evidence_id in(select id from private.claim_evidence where claim_id=p.claim_id) and revoked_at is null;
  update private.claim_evidence set revoked_at=statement_timestamp() where claim_id=p.claim_id and revoked_at is null;
  update app.business_listings set owner_verified_at=null where id=p.listing_id and not exists(select 1 from app.listing_participations where listing_id=p.listing_id and role='business_owner' and status='active' and (starts_at is null or starts_at<=statement_timestamp()) and (expires_at is null or expires_at>statement_timestamp()));
  insert into app.audit_events(actor_id,actor_kind,action,target_type,target_id,reason) values(actor,'operator','listing_participation.revoked','listing_participation',p.id::text,trim(requested_reason));
  insert into app.integration_outbox(destination,event_type,aggregate_type,aggregate_id,idempotency_key,payload) values('gohighlevel','listing_participation.revoked','listing_participation',p.id::text,'participation-revoked:'||p.id,jsonb_build_object('participation_id',p.id,'listing_id',p.listing_id));
  return jsonb_build_object('status','revoked','idempotent',false);
end $$;

create or replace function app.pilot_review_queue() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare actor uuid := app.current_actor_id(); can_claim boolean; can_listing boolean;
begin
  if not app.operator_recent_auth(900) then raise exception 'reauth_required'; end if;
  select 'claim_review'=any(permissions), 'listing_review'=any(permissions) into can_claim,can_listing from app.operator_grants where actor_id=actor and status='active';
  if not coalesce(can_claim,false) and not coalesce(can_listing,false) then raise exception 'review_forbidden'; end if;
  return jsonb_build_object(
    'claims', case when can_claim then coalesce((select jsonb_agg(jsonb_build_object('id',c.id,'name',bl.display_name,'slug',bl.current_slug,'method',c.method,'status',c.status,'requestedRole',c.requested_role,'readyForApproval',exists(select 1 from private.claim_authority_reviews r join private.claim_evidence e on e.id=r.evidence_id where e.claim_id=c.id and e.expires_at>statement_timestamp() and e.revoked_at is null and r.valid_until>statement_timestamp() and r.revoked_at is null and r.scope_snapshot=private.claim_scope_snapshot(c.id)),'hasEvidence',exists(select 1 from private.claim_evidence e where e.claim_id=c.id and e.revoked_at is null and e.expires_at>statement_timestamp()),'claimantEmail',(select primary_email from app.actors where id=c.claimant_actor_id),'domainMatches',case when c.method='business_domain' then app.claim_email_matches_listing(c.claimant_actor_id,c.listing_id) else false end)) from (select * from app.claims where status in ('submitted','needs_evidence') order by created_at limit 100) c join app.business_listings bl on bl.id=c.listing_id where bl.city_slug='reno'),'[]'::jsonb) else '[]'::jsonb end,
    'proposals',case when can_listing then coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'name',bl.display_name,'payload',p.payload)) from (select * from app.listing_proposals where status='pending_review' order by created_at limit 100) p join app.business_listings bl on bl.id=p.listing_id),'[]'::jsonb) else '[]'::jsonb end
  );
end;
$$;


-- No automatic approval RPC or setting is introduced.
revoke all on function public.submit_listing_claim(uuid,text,text,text),public.submit_claim_evidence(uuid,uuid,text,text,text),public.refresh_claim_challenge(uuid),public.get_claim_review_evidence(uuid),public.review_claim_authority(uuid,uuid,text,text,text,timestamptz,jsonb),public.withdraw_listing_claim(uuid),public.revoke_listing_authority(uuid,text) from public,anon;
grant execute on function public.submit_listing_claim(uuid,text,text,text),public.submit_claim_evidence(uuid,uuid,text,text,text),public.refresh_claim_challenge(uuid),public.get_claim_review_evidence(uuid),public.review_claim_authority(uuid,uuid,text,text,text,timestamptz,jsonb),public.withdraw_listing_claim(uuid),public.revoke_listing_authority(uuid,text) to authenticated;
comment on function public.decide_listing_claim(uuid,text,text,text) is 'Recent authenticated human review of current identity, exact listing and requested role. Domain match and payment never grant authority. Automatic grants remain disabled.';
commit;
