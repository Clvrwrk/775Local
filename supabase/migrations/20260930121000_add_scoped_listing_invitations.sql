begin;
create function app.invalidate_changed_email_verification() returns trigger language plpgsql set search_path='' as $$
begin if new.primary_email is distinct from old.primary_email then new.email_verified:=false; end if; return new; end $$;
-- trigger is added after the column below.
-- Verified identity comes only from the server-side WorkOS callback, never the browser.
alter table app.actors add column email_verified boolean not null default false;
create trigger actors_reset_email_verification before update of primary_email on app.actors for each row execute function app.invalidate_changed_email_verification();
create function public.sync_workos_actor(requested_workos_user_id text, requested_primary_email text, requested_display_name text, requested_email_verified boolean) returns uuid
language plpgsql security definer set search_path='' as $$
declare actor uuid;
begin
  actor:=public.sync_workos_actor(requested_workos_user_id,requested_primary_email,requested_display_name);
  update app.actors set email_verified=coalesce(requested_email_verified,false) where id=actor;
  return actor;
end $$;
revoke all on function public.sync_workos_actor(text,text,text,boolean) from public,anon,authenticated;
grant execute on function public.sync_workos_actor(text,text,text,boolean) to service_role;

create or replace function app.current_actor_id() returns uuid language sql stable security definer set search_path='' as $$
  select id from app.actors where workos_user_id=app.current_workos_user_id() and status='active'
    and (select auth.jwt()->'act') is null and (select auth.jwt()->>'impersonator_id') is null
$$;

create function private.require_people_manager(requested_listing_id uuid) returns uuid
language plpgsql stable security definer set search_path='' as $$
declare actor uuid:=app.current_actor_id(); age numeric;
begin
  if app.is_operator() then return private.require_claim_reviewer(); end if;
  if actor is null then raise exception 'authentication_required'; end if;
  if coalesce(auth.jwt()->>'auth_time','') !~ '^[0-9]+$' then raise exception 'reauth_required'; end if;
  age:=extract(epoch from statement_timestamp())-(auth.jwt()->>'auth_time')::numeric;
  if age<0 or age>900 then raise exception 'reauth_required'; end if;
  if not exists(select 1 from app.listing_participations where actor_id=actor and listing_id=requested_listing_id and role='business_owner' and authority_scope->>'participants'='manage' and status='active' and (starts_at is null or starts_at<=statement_timestamp()) and (expires_at is null or expires_at>statement_timestamp())) then raise exception 'people_management_forbidden'; end if;
  return actor;
end $$;
revoke all on function private.require_people_manager(uuid) from public,anon,authenticated;

create table private.listing_invitations (
  id uuid primary key default extensions.gen_random_uuid(),
  listing_id uuid not null references app.business_listings(id),
  invited_email text not null,
  role text not null check(role in ('business_owner','listing_manager','agency_representative')),
  inviter_id uuid not null references app.actors(id),
  source_participation_id uuid references app.listing_participations(id),
  source_grant_id uuid references app.operator_grants(id),
  source_authority_version timestamptz not null,
  check ((source_participation_id is null) <> (source_grant_id is null)),
  token_hash text not null unique,
  idempotency_key text not null unique,
  expires_at timestamptz not null,
  accepted_at timestamptz,
  accepted_by uuid references app.actors(id),
  revoked_at timestamptz,
  created_at timestamptz not null default statement_timestamp()
);
alter table private.listing_invitations enable row level security;
revoke all on private.listing_invitations from public,anon,authenticated;
alter table app.listing_participations add column invitation_id uuid references private.listing_invitations(id);

create function public.create_listing_invitation(requested_listing_id uuid, requested_email text, requested_role text, requested_token text, requested_key text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor uuid; invite private.listing_invitations%rowtype; token_hash text; source_participation uuid; source_grant uuid; source_version timestamptz; source_expiry timestamptz;
begin
  perform 1 from app.business_listings where id=requested_listing_id and city_slug='reno' and publication_status='published' for update;
  if not found then raise exception 'claim_scope_invalid'; end if;
  actor:=private.require_people_manager(requested_listing_id);
  if requested_role is null or requested_role not in ('business_owner','listing_manager','agency_representative')
    or requested_email is null or length(trim(requested_email))>254 or trim(requested_email) !~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
    or requested_token is null or requested_token !~ '^[a-f0-9]{64}$'
    or requested_key is null or requested_key !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{7,199}$' then raise exception 'invalid_invitation'; end if;
  token_hash:=encode(extensions.digest(requested_token,'sha256'),'hex');
  perform pg_advisory_xact_lock(hashtextextended('invitation-key:'||requested_key,0));
  select * into invite from private.listing_invitations where idempotency_key=requested_key;
  if found then
    if invite.listing_id<>requested_listing_id or invite.inviter_id<>actor or invite.invited_email<>lower(trim(requested_email)) or invite.role<>requested_role or invite.token_hash<>token_hash then raise exception 'idempotency_conflict'; end if;
    return jsonb_build_object('id',invite.id,'expires_at',invite.expires_at,'idempotent',true);
  end if;
  if app.is_operator() then
    select id,approved_at into source_grant,source_version from app.operator_grants where actor_id=actor and status='active';
  else
    select id,updated_at,expires_at into source_participation,source_version,source_expiry from app.listing_participations where actor_id=actor and listing_id=requested_listing_id and role='business_owner' and status='active' and (starts_at is null or starts_at<=statement_timestamp()) and (expires_at is null or expires_at>statement_timestamp());
  end if;
  insert into private.listing_invitations(listing_id,invited_email,role,inviter_id,source_participation_id,source_grant_id,source_authority_version,token_hash,idempotency_key,expires_at)
    values(requested_listing_id,lower(trim(requested_email)),requested_role,actor,source_participation,source_grant,source_version,token_hash,requested_key,least(statement_timestamp()+interval '48 hours',coalesce(source_expiry,statement_timestamp()+interval '48 hours'))) returning * into invite;
  insert into app.audit_events(actor_id,actor_kind,action,target_type,target_id,request_id,after_ref) values(actor,case when app.is_operator() then 'operator' else 'business_owner' end,'listing.invitation_created','listing_invitation',invite.id::text,requested_key,jsonb_build_object('listing_id',requested_listing_id,'role',requested_role));
  -- Link sharing is manual. No email, provider dispatch, marketing enrollment or recipient grant.
  return jsonb_build_object('id',invite.id,'expires_at',invite.expires_at,'idempotent',false);
end $$;

create function public.accept_listing_invitation(requested_token text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor uuid:=app.current_actor_id(); invite private.listing_invitations%rowtype; participation uuid; seats integer; inviter_allowed boolean; authority_expiry timestamptz;
begin
  if actor is null then raise exception 'authentication_required'; end if;
  if coalesce(auth.jwt()->>'auth_time','') !~ '^[0-9]+$' or extract(epoch from statement_timestamp())-(auth.jwt()->>'auth_time')::numeric not between 0 and 900 then raise exception 'reauth_required'; end if;
  if requested_token is null or requested_token !~ '^[a-f0-9]{64}$' then raise exception 'invitation_unavailable'; end if;
  select * into invite from private.listing_invitations where token_hash=encode(extensions.digest(requested_token,'sha256'),'hex');
  if not found then raise exception 'invitation_unavailable'; end if;
  perform 1 from app.business_listings where id=invite.listing_id and city_slug='reno' and publication_status='published' for update;
  if not found then raise exception 'invitation_unavailable'; end if;
  select * into invite from private.listing_invitations where id=invite.id for update;
  if not exists(select 1 from app.actors where id=actor and email_verified and lower(primary_email)=invite.invited_email) then raise exception 'invitation_identity_mismatch'; end if;
  if invite.revoked_at is not null or invite.expires_at<=statement_timestamp() then raise exception 'invitation_unavailable'; end if;
  if invite.accepted_at is not null then
    if invite.accepted_by<>actor then raise exception 'invitation_unavailable'; end if;
    -- A consumed link never reactivates a revoked or expired participation.
    select id into participation from app.listing_participations where invitation_id=invite.id and actor_id=actor and status='active' and (starts_at is null or starts_at<=statement_timestamp()) and (expires_at is null or expires_at>statement_timestamp());
    if not found then raise exception 'invitation_unavailable'; end if;
    return jsonb_build_object('listing_id',invite.listing_id,'role',invite.role,'participation_id',participation,'idempotent',true);
  end if;
  select exists(select 1 from app.listing_participations lp join app.actors a on a.id=lp.actor_id where lp.id=invite.source_participation_id and lp.updated_at=invite.source_authority_version and lp.actor_id=invite.inviter_id and a.status='active' and lp.listing_id=invite.listing_id and lp.role='business_owner' and lp.status='active' and lp.authority_scope->>'participants'='manage' and (lp.starts_at is null or lp.starts_at<=statement_timestamp()) and (lp.expires_at is null or lp.expires_at>statement_timestamp()))
    or exists(select 1 from app.operator_grants og join app.actors a on a.id=og.actor_id where og.id=invite.source_grant_id and og.approved_at=invite.source_authority_version and og.actor_id=invite.inviter_id and a.status='active' and og.status='active' and 'claim_review'=any(og.permissions) and lower(a.primary_email)=og.allowlisted_email) into inviter_allowed;
  if not inviter_allowed then raise exception 'invitation_unavailable'; end if;
  if exists(select 1 from app.claims where listing_id=invite.listing_id and status in ('submitted','needs_evidence') and requested_role='business_owner') then raise exception 'ownership_conflict_review_required'; end if;
  update app.listing_participations set status='expired' where listing_id=invite.listing_id and status in ('active','pending') and expires_at<=statement_timestamp();
  select count(*) into seats from app.listing_participations where listing_id=invite.listing_id and role=invite.role and status in ('active','pending');
  if seats >= (case when invite.role='business_owner' then 2 else 3 end) then raise exception 'participation_limit_reached'; end if;
  if exists(select 1 from app.listing_participations where listing_id=invite.listing_id and actor_id=actor and role=invite.role and status in ('active','pending')) then raise exception 'participation_exists'; end if;
  select least(coalesce(expires_at,statement_timestamp()+interval '90 days'),statement_timestamp()+interval '90 days') into authority_expiry from app.listing_participations where id=invite.source_participation_id and listing_id=invite.listing_id and actor_id=invite.inviter_id and role='business_owner' and status='active';
  authority_expiry:=coalesce(authority_expiry,statement_timestamp()+interval '90 days');
  insert into app.listing_participations(actor_id,listing_id,role,status,authority_scope,starts_at,expires_at,invitation_id)
    values(actor,invite.listing_id,invite.role,'active',jsonb_build_object('listing_content',case when invite.role='agency_representative' then 'propose' else 'manage' end,'listing_identity','propose','participants',case when invite.role='business_owner' then 'manage' else 'none' end,'featured',case when invite.role='agency_representative' then 'propose' else 'manage' end),statement_timestamp(),authority_expiry,invite.id) returning id into participation;
  update private.listing_invitations set accepted_at=statement_timestamp(),accepted_by=actor where id=invite.id;
  if invite.role='business_owner' then update app.business_listings set owner_verified_at=coalesce(owner_verified_at,statement_timestamp()) where id=invite.listing_id; end if;
  insert into app.audit_events(actor_id,actor_kind,action,target_type,target_id,after_ref) values(actor,invite.role,'listing.invitation_accepted','listing_invitation',invite.id::text,jsonb_build_object('participation_id',participation));
  insert into app.integration_outbox(destination,event_type,aggregate_type,aggregate_id,idempotency_key,payload) values('gohighlevel','listing_participation.activated','listing_participation',participation::text,'invitation-accepted:'||invite.id,jsonb_build_object('participation_id',participation,'listing_id',invite.listing_id,'role',invite.role));
  return jsonb_build_object('listing_id',invite.listing_id,'role',invite.role,'participation_id',participation,'idempotent',false);
end $$;

create function public.get_listing_people(requested_listing_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.require_people_manager(requested_listing_id);
begin
  return jsonb_build_object('participants',coalesce((select jsonb_agg(jsonb_build_object('id',lp.id,'name',a.display_name,'role',lp.role,'status',case when lp.expires_at<=statement_timestamp() and lp.status='active' then 'expired' else lp.status end,'expires_at',lp.expires_at) order by lp.created_at) from app.listing_participations lp join app.actors a on a.id=lp.actor_id where lp.listing_id=requested_listing_id),'[]'::jsonb),
    'invitations',coalesce((select jsonb_agg(jsonb_build_object('id',id,'email',invited_email,'role',role,'expires_at',expires_at,'accepted',accepted_at is not null,'revoked',revoked_at is not null) order by created_at) from private.listing_invitations where listing_id=requested_listing_id),'[]'::jsonb));
end $$;

create function public.revoke_listing_invitation(requested_invitation_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare invite private.listing_invitations%rowtype; actor uuid;
begin
  select * into invite from private.listing_invitations where id=requested_invitation_id;
  if not found then raise exception 'invitation_unavailable'; end if;
  perform 1 from app.business_listings where id=invite.listing_id for update;
  actor:=private.require_people_manager(invite.listing_id);
  update private.listing_invitations set revoked_at=statement_timestamp() where id=invite.id and revoked_at is null;
  if found then insert into app.audit_events(actor_id,actor_kind,action,target_type,target_id) values(actor,case when app.is_operator() then 'operator' else 'business_owner' end,'listing.invitation_revoked','listing_invitation',invite.id::text); end if;
  return jsonb_build_object('status','revoked');
end $$;
create or replace function public.revoke_listing_authority(requested_participation_id uuid, requested_reason text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor uuid; p app.listing_participations%rowtype; child app.listing_participations%rowtype;
begin
  if length(coalesce(trim(requested_reason),'')) not between 10 and 500 then raise exception 'invalid_revocation'; end if;
  perform 1 from app.business_listings where id=(select listing_id from app.listing_participations where id=requested_participation_id) for update;
  select * into p from app.listing_participations where id=requested_participation_id for update;
  if not found then raise exception 'participation_not_found'; end if;
  actor:=private.require_people_manager(p.listing_id);
  if not app.is_operator() and p.role='business_owner' and not exists(
    with recursive dependents as (
      select lp.id,lp.actor_id from app.listing_participations lp join private.listing_invitations i on i.id=lp.invitation_id where i.source_participation_id=p.id and i.listing_id=p.listing_id and lp.status='active'
      union select lp.id,lp.actor_id from app.listing_participations lp join private.listing_invitations i on i.id=lp.invitation_id join dependents d on d.id=i.source_participation_id where i.listing_id=p.listing_id and lp.status='active'
    ) select 1 from app.listing_participations where listing_id=p.listing_id and id<>p.id and id not in(select id from dependents) and role='business_owner' and status='active' and (starts_at is null or starts_at<=statement_timestamp()) and (expires_at is null or expires_at>statement_timestamp())
  ) then raise exception 'last_owner_protected'; end if;
  if p.status='revoked' then return jsonb_build_object('status','revoked','idempotent',true); end if;
  update app.listing_participations set status='revoked',revoked_at=statement_timestamp(),revoked_by=actor where id=p.id;
  for child in with recursive dependents as (
    select lp.id,lp.actor_id from app.listing_participations lp join private.listing_invitations i on i.id=lp.invitation_id where i.source_participation_id=p.id and i.listing_id=p.listing_id and lp.status='active'
    union
    select lp.id,lp.actor_id from app.listing_participations lp join private.listing_invitations i on i.id=lp.invitation_id join dependents d on d.id=i.source_participation_id where i.listing_id=p.listing_id and lp.status='active'
  ) select lp.* from app.listing_participations lp join dependents d on d.id=lp.id loop
    update app.listing_participations set status='revoked',revoked_at=statement_timestamp(),revoked_by=actor where id=child.id;
    update private.listing_invitations set revoked_at=statement_timestamp() where listing_id=child.listing_id and source_participation_id=child.id and revoked_at is null;
    insert into app.audit_events(actor_id,actor_kind,action,target_type,target_id,reason) values(actor,case when app.is_operator() then 'operator' else 'business_owner' end,'listing_participation.revoked','listing_participation',child.id::text,'Delegating authority revoked');
    insert into app.integration_outbox(destination,event_type,aggregate_type,aggregate_id,idempotency_key,payload) values('gohighlevel','listing_participation.revoked','listing_participation',child.id::text,'participation-revoked:'||child.id,jsonb_build_object('participation_id',child.id,'listing_id',child.listing_id));
  end loop;
  update private.listing_invitations set revoked_at=statement_timestamp() where listing_id=p.listing_id and source_participation_id=p.id and revoked_at is null;
  update private.claim_authority_reviews set revoked_at=statement_timestamp() where evidence_id in(select id from private.claim_evidence where claim_id=p.claim_id) and revoked_at is null;
  update private.claim_evidence set revoked_at=statement_timestamp() where claim_id=p.claim_id and revoked_at is null;
  update app.business_listings set owner_verified_at=null where id=p.listing_id and not exists(select 1 from app.listing_participations where listing_id=p.listing_id and role='business_owner' and status='active' and (starts_at is null or starts_at<=statement_timestamp()) and (expires_at is null or expires_at>statement_timestamp()));
  insert into app.audit_events(actor_id,actor_kind,action,target_type,target_id,reason) values(actor,case when app.is_operator() then 'operator' else 'business_owner' end,'listing_participation.revoked','listing_participation',p.id::text,trim(requested_reason));
  insert into app.integration_outbox(destination,event_type,aggregate_type,aggregate_id,idempotency_key,payload) values('gohighlevel','listing_participation.revoked','listing_participation',p.id::text,'participation-revoked:'||p.id,jsonb_build_object('participation_id',p.id,'listing_id',p.listing_id));
  return jsonb_build_object('status','revoked','idempotent',false);
end $$;


revoke all on function public.create_listing_invitation(uuid,text,text,text,text),public.accept_listing_invitation(text),public.get_listing_people(uuid),public.revoke_listing_invitation(uuid) from public,anon;
grant execute on function public.create_listing_invitation(uuid,text,text,text,text),public.accept_listing_invitation(text),public.get_listing_people(uuid),public.revoke_listing_invitation(uuid) to authenticated;
commit;
