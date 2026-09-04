begin;

create table app.listing_proposals (
  id uuid primary key default extensions.gen_random_uuid(),
  listing_id uuid not null references app.business_listings(id),
  actor_id uuid not null references app.actors(id),
  base_updated_at timestamptz not null,
  payload jsonb not null check (jsonb_typeof(payload) = 'object'),
  idempotency_key text not null unique,
  status text not null default 'pending_review' check (status in ('pending_review','approved','rejected')),
  reason text,
  decided_by uuid references app.actors(id),
  created_at timestamptz not null default statement_timestamp(),
  decided_at timestamptz
);
alter table app.listing_proposals enable row level security;
revoke all on app.listing_proposals from anon, authenticated;
create index listing_proposals_listing on app.listing_proposals(listing_id, created_at desc);

create function app.pilot_role(requested_listing_id uuid) returns text
language sql stable security definer set search_path = '' as $$
  select case when app.is_operator() then 'operator' else (
    select lp.role from app.listing_participations lp
    where lp.listing_id=requested_listing_id and lp.actor_id=app.current_actor_id()
      and lp.status='active' and (lp.starts_at is null or lp.starts_at<=statement_timestamp())
      and (lp.expires_at is null or lp.expires_at>statement_timestamp())
    order by case lp.role when 'business_owner' then 1 when 'listing_manager' then 2 when 'agency_representative' then 3 else 4 end limit 1
  ) end
$$;

create function app.pilot_account() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare actor uuid := app.current_actor_id(); result jsonb;
begin
  if actor is null then raise exception 'authentication_required'; end if;
  select jsonb_build_object(
    'listings', coalesce((select jsonb_agg(jsonb_build_object('id',bl.id,'slug',bl.current_slug,'name',bl.display_name,'city','Reno','role',app.pilot_role(bl.id))) from app.business_listings bl where bl.city_slug='reno' and app.pilot_role(bl.id) is not null),'[]'::jsonb),
    'claims',coalesce((select jsonb_agg(jsonb_build_object('id',c.id,'slug',bl.current_slug,'name',bl.display_name,'status',c.status,'reason',c.decision_reason) order by c.created_at desc) from app.claims c join app.business_listings bl on bl.id=c.listing_id where c.claimant_actor_id=actor),'[]'::jsonb),
    'canReview', app.operator_recent_auth(900) and exists(select 1 from app.operator_grants where actor_id=actor and status='active' and permissions && array['claim_review','listing_review'])
  ) into result;
  return result;
end;
$$;

create function app.pilot_workspace(requested_listing_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare role_name text := app.pilot_role(requested_listing_id);
begin
  if role_name is null then raise exception 'listing_access_forbidden'; end if;
  return jsonb_build_object('role',role_name,
    'canEdit',role_name in ('operator','business_owner','listing_manager','agency_representative'),
    'proposals',coalesce((select jsonb_agg(jsonb_build_object('id',id,'status',status,'reason',reason,'createdAt',created_at,'payload',payload) order by created_at desc) from (select * from app.listing_proposals where listing_id=requested_listing_id and role_name <> 'lead_recipient' and (role_name in ('operator','business_owner','listing_manager') or actor_id=app.current_actor_id()) order by created_at desc limit 20) p),'[]'::jsonb));
end;
$$;

create function app.submit_listing_proposal(requested_listing_id uuid, requested_payload jsonb, requested_key text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare actor uuid := app.current_actor_id(); role_name text := app.pilot_role(requested_listing_id); existing app.listing_proposals%rowtype; proposal uuid;
begin
  if role_name is null or role_name not in ('operator','business_owner','listing_manager','agency_representative') then raise exception 'listing_access_forbidden'; end if;
  if not exists(select 1 from app.business_listings where id=requested_listing_id and city_slug='reno') then raise exception 'outside_pilot'; end if;
  if requested_key is null or requested_key !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{7,199}$'
    or jsonb_typeof(requested_payload) is distinct from 'object'
    or requested_payload - array['name','description','phone','website'] <> '{}'::jsonb
    or length(coalesce(requested_payload->>'name','')) not between 2 and 200
    or length(coalesce(requested_payload->>'description','')) not between 10 and 5000
    or coalesce(requested_payload->>'phone','') !~ '^\+1[2-9][0-9]{2}[2-9][0-9]{6}$'
    or (coalesce(requested_payload->>'website','')<>'' and (requested_payload->>'website' !~ '^https://[^/@[:space:]]+(\.[^/@[:space:]]+)' or requested_payload->>'website' ~ '@'))
    then raise exception 'invalid_listing_proposal'; end if;
  perform pg_advisory_xact_lock(hashtextextended('proposal:'||requested_key,0));
  select * into existing from app.listing_proposals where idempotency_key=requested_key;
  if found then
    if existing.actor_id<>actor or existing.listing_id<>requested_listing_id or existing.payload<>requested_payload then raise exception 'idempotency_conflict'; end if;
    return jsonb_build_object('id',existing.id,'status',existing.status,'idempotent',true);
  end if;
  insert into app.listing_proposals(listing_id,actor_id,base_updated_at,payload,idempotency_key) values(requested_listing_id,actor,(select updated_at from app.business_listings where id=requested_listing_id),requested_payload,requested_key) returning id into proposal;
  insert into app.audit_events(actor_id,actor_kind,action,target_type,target_id,request_id) values(actor,role_name,'listing.proposed','listing_proposal',proposal::text,requested_key);
  insert into app.integration_outbox(destination,event_type,aggregate_type,aggregate_id,idempotency_key,payload)
    values('gohighlevel','listing.proposed','listing_proposal',proposal::text,'listing-proposal:'||requested_key,jsonb_build_object('proposal_id',proposal,'listing_id',requested_listing_id));
  return jsonb_build_object('id',proposal,'status','pending_review','idempotent',false);
end;
$$;

create function app.pilot_review_queue() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare actor uuid := app.current_actor_id(); can_claim boolean; can_listing boolean;
begin
  if not app.operator_recent_auth(900) then raise exception 'reauth_required'; end if;
  select 'claim_review'=any(permissions), 'listing_review'=any(permissions) into can_claim,can_listing from app.operator_grants where actor_id=actor and status='active';
  if not coalesce(can_claim,false) and not coalesce(can_listing,false) then raise exception 'review_forbidden'; end if;
  return jsonb_build_object(
    'claims', case when can_claim then coalesce((select jsonb_agg(jsonb_build_object('id',c.id,'name',bl.display_name,'slug',bl.current_slug,'method',c.method,'status',c.status)) from (select * from app.claims where status in ('submitted','needs_evidence') order by created_at limit 100) c join app.business_listings bl on bl.id=c.listing_id where bl.city_slug='reno'),'[]'::jsonb) else '[]'::jsonb end,
    'proposals',case when can_listing then coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'name',bl.display_name,'payload',p.payload)) from (select * from app.listing_proposals where status='pending_review' order by created_at limit 100) p join app.business_listings bl on bl.id=p.listing_id),'[]'::jsonb) else '[]'::jsonb end
  );
end;
$$;

create function app.decide_listing_proposal(requested_id uuid, requested_decision text, requested_reason text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare actor uuid := app.current_actor_id(); proposal app.listing_proposals%rowtype;
begin
  if not app.operator_recent_auth(900) or not exists(select 1 from app.operator_grants where actor_id=actor and status='active' and 'listing_review'=any(permissions)) then raise exception 'review_forbidden'; end if;
  if requested_decision is null or requested_decision not in ('approved','rejected') or length(coalesce(trim(requested_reason),'')) not between 3 and 500 then raise exception 'invalid_decision'; end if;
  select * into proposal from app.listing_proposals where id=requested_id for update;
  if not found then raise exception 'proposal_not_found'; end if;
  if proposal.status<>'pending_review' then
    if proposal.status=requested_decision and proposal.reason=trim(requested_reason) then return jsonb_build_object('status',proposal.status,'idempotent',true); end if;
    raise exception 'idempotency_conflict';
  end if;
  if requested_decision='approved' then
    perform 1 from app.business_listings where id=proposal.listing_id and updated_at=proposal.base_updated_at for update;
    if not found then raise exception 'listing_changed_since_proposal'; end if;
    update app.business_listings set display_name=proposal.payload->>'name', description=proposal.payload->>'description', phone_e164=proposal.payload->>'phone', website_url=nullif(proposal.payload->>'website',''), information_checked_at=null, information_checked_by=null, updated_at=clock_timestamp() where id=proposal.listing_id;
    update app.listing_content set about=proposal.payload->>'description', updated_by=actor, updated_at=clock_timestamp() where listing_id=proposal.listing_id and content_status='approved';
  end if;
  update app.listing_proposals set status=requested_decision,reason=trim(requested_reason),decided_by=actor,decided_at=statement_timestamp() where id=proposal.id;
  insert into app.audit_events(actor_id,actor_kind,action,target_type,target_id,reason,after_ref) values(actor,'operator','listing.proposal_'||requested_decision,'listing_proposal',proposal.id::text,trim(requested_reason),jsonb_build_object('listing_id',proposal.listing_id));
  insert into app.integration_outbox(destination,event_type,aggregate_type,aggregate_id,idempotency_key,payload) values('gohighlevel','listing.proposal_'||requested_decision,'listing',proposal.listing_id::text,'proposal-decision:'||proposal.id::text,jsonb_build_object('proposal_id',proposal.id,'listing_id',proposal.listing_id));
  return jsonb_build_object('status',requested_decision,'idempotent',false);
end;
$$;

-- Exposed wrappers are invokers. Every internal command authorizes before access.
create function public.pilot_account() returns jsonb language sql security invoker set search_path='' as $$ select app.pilot_account() $$;
create function public.pilot_workspace(requested_listing_id uuid) returns jsonb language sql security invoker set search_path='' as $$ select app.pilot_workspace(requested_listing_id) $$;
create function public.submit_listing_proposal(requested_listing_id uuid,requested_payload jsonb,requested_key text) returns jsonb language sql security invoker set search_path='' as $$ select app.submit_listing_proposal(requested_listing_id,requested_payload,requested_key) $$;
create function public.pilot_review_queue() returns jsonb language sql security invoker set search_path='' as $$ select app.pilot_review_queue() $$;
create function public.decide_listing_proposal(requested_id uuid,requested_decision text,requested_reason text) returns jsonb language sql security invoker set search_path='' as $$ select app.decide_listing_proposal(requested_id,requested_decision,requested_reason) $$;

revoke all on function app.pilot_role(uuid),app.pilot_account(),app.pilot_workspace(uuid),app.submit_listing_proposal(uuid,jsonb,text),app.pilot_review_queue(),app.decide_listing_proposal(uuid,text,text) from public,anon;
revoke all on function public.pilot_account(),public.pilot_workspace(uuid),public.submit_listing_proposal(uuid,jsonb,text),public.pilot_review_queue(),public.decide_listing_proposal(uuid,text,text) from public,anon;
grant execute on function app.pilot_account(),app.pilot_workspace(uuid),app.submit_listing_proposal(uuid,jsonb,text),app.pilot_review_queue(),app.decide_listing_proposal(uuid,text,text) to authenticated;
grant execute on function public.pilot_account(),public.pilot_workspace(uuid),public.submit_listing_proposal(uuid,jsonb,text),public.pilot_review_queue(),public.decide_listing_proposal(uuid,text,text) to authenticated;
commit;
