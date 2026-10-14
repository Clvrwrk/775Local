begin;
create table app.listing_requests (
 id uuid primary key default extensions.gen_random_uuid(),
 actor_id uuid not null references app.actors(id),
 payload jsonb not null,
 idempotency_key text not null unique,
 status text not null default 'pending_review' check(status in ('pending_review','approved','rejected')),
 created_at timestamptz not null default statement_timestamp()
);
alter table app.listing_requests enable row level security;
revoke all on app.listing_requests from public,anon,authenticated;
create function public.request_business_listing(requested_payload jsonb,requested_key text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor uuid:=app.current_actor_id(); existing app.listing_requests%rowtype; created uuid;
begin
 if actor is null then raise exception 'authentication_required'; end if;
 if jsonb_typeof(requested_payload) is distinct from 'object' or requested_payload-array['name','citySlug','categorySlug','phone','zip','description','website']<>'{}'::jsonb
  or requested_payload->>'citySlug' is distinct from 'reno'
  or not exists(select 1 from app.categories where slug=requested_payload->>'categorySlug')
  or length(coalesce(requested_payload->>'name','')) not between 2 and 200
  or length(coalesce(requested_payload->>'description','')) not between 10 and 5000
  or coalesce(requested_payload->>'phone','') !~ '^\+1[2-9][0-9]{2}[2-9][0-9]{6}$'
  or coalesce(requested_payload->>'zip','') !~ '^895[0-9]{2}$'
  or (coalesce(requested_payload->>'website','')<>'' and (requested_payload->>'website' !~ '^https://[^/@[:space:]]+(\.[^/@[:space:]]+)' or requested_payload->>'website' ~ '@'))
  or requested_key is null or requested_key !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{7,199}$' then raise exception 'invalid_listing_request'; end if;
 perform pg_advisory_xact_lock(hashtextextended('listing-request:'||requested_key,0));
 select * into existing from app.listing_requests where idempotency_key=requested_key;
 if found then
  if existing.actor_id<>actor or existing.payload<>requested_payload then raise exception 'idempotency_conflict'; end if;
  return jsonb_build_object('id',existing.id,'status',existing.status,'idempotent',true);
 end if;
 -- A pending request creates no public Listing, participation or authority.
 insert into app.listing_requests(actor_id,payload,idempotency_key) values(actor,requested_payload,requested_key) returning id into created;
 insert into app.audit_events(actor_id,actor_kind,action,target_type,target_id,request_id) values(actor,'claimant','listing.requested','listing_request',created::text,requested_key);
 return jsonb_build_object('id',created,'status','pending_review','idempotent',false);
end $$;
revoke all on function public.request_business_listing(jsonb,text) from public,anon;
grant execute on function public.request_business_listing(jsonb,text) to authenticated;

create or replace function app.pilot_review_queue() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare actor uuid := app.current_actor_id(); can_claim boolean; can_listing boolean;
begin
  if not app.operator_recent_auth(900) then raise exception 'reauth_required'; end if;
  select 'claim_review'=any(permissions), 'listing_review'=any(permissions) into can_claim,can_listing from app.operator_grants where actor_id=actor and status='active';
  if not coalesce(can_claim,false) and not coalesce(can_listing,false) then raise exception 'review_forbidden'; end if;
  return jsonb_build_object(
    'claims', case when can_claim then coalesce((select jsonb_agg(jsonb_build_object('id',c.id,'name',bl.display_name,'slug',bl.current_slug,'method',c.method,'status',c.status,'requestedRole',c.requested_role,'readyForApproval',exists(select 1 from private.claim_authority_reviews r join private.claim_evidence e on e.id=r.evidence_id where e.claim_id=c.id and e.expires_at>statement_timestamp() and e.revoked_at is null and r.valid_until>statement_timestamp() and r.revoked_at is null and r.scope_snapshot=private.claim_scope_snapshot(c.id)),'hasEvidence',exists(select 1 from private.claim_evidence e where e.claim_id=c.id and e.revoked_at is null and e.expires_at>statement_timestamp()),'claimantEmail',(select primary_email from app.actors where id=c.claimant_actor_id),'domainMatches',case when c.method='business_domain' then app.claim_email_matches_listing(c.claimant_actor_id,c.listing_id) else false end)) from (select * from app.claims where status in ('submitted','needs_evidence') order by created_at limit 100) c join app.business_listings bl on bl.id=c.listing_id where bl.city_slug='reno'),'[]'::jsonb) else '[]'::jsonb end,
    'requests',case when can_listing then coalesce((select jsonb_agg(jsonb_build_object('id',id,'payload',payload,'createdAt',created_at)) from app.listing_requests where status='pending_review'),'[]'::jsonb) else '[]'::jsonb end,
    'proposals',case when can_listing then coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'name',bl.display_name,'payload',p.payload)) from (select * from app.listing_proposals where status='pending_review' order by created_at limit 100) p join app.business_listings bl on bl.id=p.listing_id),'[]'::jsonb) else '[]'::jsonb end
  );
end;
$$;



-- Text evidence is also private and retention controlled. Keep metadata and audit receipts
-- after removing its content. File object retention requires the separately approved worker.
alter table private.claim_evidence alter column reference drop not null,alter column explanation drop not null,
 add column delete_after timestamptz not null default statement_timestamp()+interval '30 days',
 add column deleted_at timestamptz;
alter table private.claim_evidence add constraint evidence_content_present check ((deleted_at is null and reference is not null and explanation is not null) or (deleted_at is not null and reference is null and explanation is null));
alter table private.claim_authority_reviews alter column identity_basis drop not null,alter column authority_basis drop not null,alter column conflict_resolution drop not null,
 add column delete_after timestamptz not null default statement_timestamp()+interval '30 days',
 add column redacted_at timestamptz,
 add column content_sha256 text;
create function public.purge_expired_claim_evidence() returns integer
language plpgsql security definer set search_path='' as $$
declare e private.claim_evidence%rowtype; r private.claim_authority_reviews%rowtype; removed integer:=0;
begin
 for e in select * from private.claim_evidence where deleted_at is null and delete_after<=statement_timestamp() for update skip locked loop
  update private.claim_evidence set reference=null,explanation=null,deleted_at=statement_timestamp(),revoked_at=coalesce(revoked_at,statement_timestamp()) where id=e.id;
  insert into app.audit_events(actor_kind,action,target_type,target_id,after_ref) values('system','claim.evidence_deleted','claim_evidence',e.id::text,jsonb_build_object('claim_id',e.claim_id,'deleted_at',statement_timestamp()));
  removed:=removed+1;
 end loop;
 for r in select * from private.claim_authority_reviews where redacted_at is null and delete_after<=statement_timestamp() for update skip locked loop
  update private.claim_authority_reviews set content_sha256=encode(extensions.digest(jsonb_build_array(identity_basis,authority_basis,conflict_resolution)::text,'sha256'),'hex'),identity_basis=null,authority_basis=null,conflict_resolution=null,redacted_at=statement_timestamp(),revoked_at=coalesce(revoked_at,statement_timestamp()) where id=r.id;
  insert into app.audit_events(actor_kind,action,target_type,target_id) values('system','claim.review_content_redacted','claim_authority_review',r.id::text);
  removed:=removed+1;
 end loop;
 return removed;
end $$;
create function public.get_listing_invitation(requested_token text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor uuid:=app.current_actor_id(); invite private.listing_invitations%rowtype;
begin
 if actor is null then raise exception 'authentication_required'; end if;
 if requested_token is null or requested_token !~ '^[a-f0-9]{64}$' then raise exception 'invitation_unavailable'; end if;
 select * into invite from private.listing_invitations where token_hash=encode(extensions.digest(requested_token,'sha256'),'hex') and revoked_at is null and expires_at>statement_timestamp();
 if not found or not exists(select 1 from app.actors where id=actor and email_verified and lower(primary_email)=invite.invited_email) then raise exception 'invitation_identity_mismatch'; end if;
 return (select jsonb_build_object('listing_id',bl.id,'name',bl.display_name,'slug',bl.current_slug,'city',bl.city_slug,'role',invite.role,'expires_at',invite.expires_at) from app.business_listings bl where id=invite.listing_id and city_slug='reno' and publication_status='published');
end $$;
revoke all on function public.get_listing_invitation(text) from public,anon;
grant execute on function public.get_listing_invitation(text) to authenticated;
revoke all on function public.purge_expired_claim_evidence() from public,anon,authenticated;
grant execute on function public.purge_expired_claim_evidence() to service_role;
commit;
