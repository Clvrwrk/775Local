begin;
-- Explicit synthetic pipeline only. No live adapter, storage policy, bucket or scheduler is activated.
create table private.claim_file_jobs (
 id uuid primary key default extensions.gen_random_uuid(),
 claim_id uuid not null references app.claims(id),
 challenge uuid not null unique,
 idempotency_key text not null unique,
 request_fingerprint text not null,
 storage_path text not null unique,
 sha256 text not null check(sha256 ~ '^[a-f0-9]{64}$'),
 byte_size integer not null check(byte_size between 8 and 5242880),
 media_type text not null check(media_type in ('application/pdf','image/png','image/jpeg')),
 explanation text,
 mode text not null default 'synthetic' check(mode='synthetic'),
 status text not null default 'quarantined' check(status in ('quarantined','processing','synthetic_clean','unavailable','rejected','deleting','deleted')),
 scan_receipt jsonb,
 lease uuid,
 lease_until timestamptz,
 expires_at timestamptz not null default statement_timestamp()+interval '30 days',
 delete_after timestamptz not null default statement_timestamp()+interval '24 hours',
 deleted_at timestamptz,
 created_at timestamptz not null default statement_timestamp()
);
alter table private.claim_file_jobs enable row level security;
revoke all on private.claim_file_jobs from public,anon,authenticated,service_role;

create function public.reserve_synthetic_claim_proof(requested_claim_id uuid,requested_challenge uuid,requested_sha256 text,requested_size integer,requested_type text,requested_explanation text,requested_key text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor uuid:=app.current_actor_id(); c app.claims%rowtype; p private.claim_file_jobs%rowtype; fingerprint text;
begin
 if actor is null then raise exception 'authentication_required'; end if;
 if requested_sha256 is null or requested_sha256 !~ '^[a-f0-9]{64}$' or requested_size is null or requested_size not between 8 and 5242880
  or requested_type is null or requested_type not in ('application/pdf','image/png','image/jpeg')
  or length(coalesce(trim(requested_explanation),'')) not between 20 and 4000
  or requested_key is null or requested_key !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{7,199}$' then raise exception 'invalid_claim_proof'; end if;
 fingerprint:=encode(extensions.digest(jsonb_build_array(requested_claim_id,requested_challenge,requested_sha256,requested_size,requested_type,trim(requested_explanation))::text,'sha256'),'hex');
 perform pg_advisory_xact_lock(hashtextextended('claim-file-key:'||requested_key,0));
 perform 1 from app.business_listings where id=(select listing_id from app.claims where id=requested_claim_id) for update;
 select * into c from app.claims where id=requested_claim_id and claimant_actor_id=actor for update;
 if not found then raise exception 'claim_access_forbidden'; end if;
 if c.status not in ('submitted','needs_evidence') or not exists(select 1 from app.business_listings where id=c.listing_id and city_slug='reno' and publication_status='published') then raise exception 'claim_not_open'; end if;
 select * into p from private.claim_file_jobs where idempotency_key=requested_key;
 if found then
  if p.request_fingerprint<>fingerprint then raise exception 'idempotency_conflict'; end if;
  if p.status in ('rejected','deleting','deleted') or p.expires_at<=statement_timestamp() or p.delete_after<=statement_timestamp() then raise exception 'proof_unavailable'; end if;
  return jsonb_build_object('id',p.id,'status',p.status,'mode',p.mode,'idempotent',true);
 end if;
 if c.evidence_challenge is distinct from requested_challenge or c.challenge_expires_at<=statement_timestamp()
  or exists(select 1 from private.claim_evidence where challenge=requested_challenge)
  or exists(select 1 from private.claim_file_jobs where challenge=requested_challenge) then raise exception 'challenge_expired_or_replayed'; end if;
 if (select count(*) from private.claim_file_jobs where claim_id=c.id and deleted_at is null)>=5 then raise exception 'proof_limit_reached'; end if;
 insert into private.claim_file_jobs(claim_id,challenge,idempotency_key,request_fingerprint,storage_path,sha256,byte_size,media_type,explanation)
 values(c.id,requested_challenge,requested_key,fingerprint,'synthetic-claim-proof/'||extensions.gen_random_uuid(),requested_sha256,requested_size,requested_type,trim(requested_explanation)) returning * into p;
 update app.claims set evidence_challenge=extensions.gen_random_uuid(),challenge_expires_at=statement_timestamp()+interval '24 hours' where id=c.id;
 insert into app.audit_events(actor_id,actor_kind,action,target_type,target_id,request_id) values(actor,'claimant','claim.synthetic_proof_reserved','claim_file_job',p.id::text,requested_key);
 return jsonb_build_object('id',p.id,'status',p.status,'mode',p.mode,'idempotent',false);
end $$;

create function public.acquire_synthetic_claim_proof(requested_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare p private.claim_file_jobs%rowtype;
begin
 -- Listing -> Claim -> job lock order matches claim decision/reservation.
 perform 1 from app.business_listings where id=(select c.listing_id from app.claims c join private.claim_file_jobs f on f.claim_id=c.id where f.id=requested_id) for update;
 perform 1 from app.claims where id=(select claim_id from private.claim_file_jobs where id=requested_id) for update;
 select * into p from private.claim_file_jobs where id=requested_id for update;
 if not found or p.delete_after<=statement_timestamp() or p.expires_at<=statement_timestamp()
  or not exists(select 1 from app.claims c join app.actors a on a.id=c.claimant_actor_id join app.business_listings bl on bl.id=c.listing_id where c.id=p.claim_id and c.status in ('submitted','needs_evidence') and a.status='active' and bl.city_slug='reno' and bl.publication_status='published') then raise exception 'proof_unavailable'; end if;
 if p.status='synthetic_clean' then return jsonb_build_object('id',p.id,'status',p.status,'mode',p.mode,'sha256',p.sha256,'mediaType',p.media_type); end if;
 if p.status='processing' and p.lease_until>statement_timestamp() then raise exception 'proof_processing_busy'; end if;
 if p.status not in ('quarantined','processing','unavailable') then raise exception 'proof_unavailable'; end if;
 update private.claim_file_jobs set status='processing',lease=extensions.gen_random_uuid(),lease_until=statement_timestamp()+interval '2 minutes' where id=p.id returning * into p;
 return jsonb_build_object('id',p.id,'status',p.status,'mode',p.mode,'sha256',p.sha256,'mediaType',p.media_type,'path',p.storage_path,'lease',p.lease);
end $$;

create function public.finish_synthetic_claim_proof(requested_id uuid,requested_lease uuid,requested_receipt jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare p private.claim_file_jobs%rowtype; outcome text:=requested_receipt->>'status'; sig timestamptz;
begin
 perform 1 from app.business_listings where id=(select c.listing_id from app.claims c join private.claim_file_jobs f on f.claim_id=c.id where f.id=requested_id) for update;
 perform 1 from app.claims where id=(select claim_id from private.claim_file_jobs where id=requested_id) for update;
 select * into p from private.claim_file_jobs where id=requested_id for update;
 if not found or p.status<>'processing' or p.lease is distinct from requested_lease or p.lease_until<=statement_timestamp() or p.delete_after<=statement_timestamp() then raise exception 'proof_lease_expired'; end if;
 if outcome is null or outcome not in ('synthetic_clean','rejected','unavailable') then raise exception 'invalid_scan_receipt'; end if;
 if outcome='synthetic_clean' then
  if not exists(select 1 from app.claims c join app.actors a on a.id=c.claimant_actor_id join app.business_listings bl on bl.id=c.listing_id where c.id=p.claim_id and c.status in ('submitted','needs_evidence') and a.status='active' and bl.city_slug='reno' and bl.publication_status='published') then raise exception 'claim_not_open'; end if;
  if requested_receipt-array['status','sha256','engine','version','signaturesAt','decoded']<>'{}'::jsonb
   or requested_receipt->>'sha256' is distinct from p.sha256 or length(coalesce(requested_receipt->>'engine','')) not between 1 and 80
   or length(coalesce(requested_receipt->>'version','')) not between 1 and 80 or jsonb_typeof(requested_receipt->'decoded') is distinct from 'object' then raise exception 'invalid_scan_receipt'; end if;
  begin sig:=(requested_receipt->>'signaturesAt')::timestamptz; exception when others then raise exception 'invalid_scan_receipt'; end;
  if sig is null or sig>statement_timestamp()+interval '1 minute' or sig<statement_timestamp()-interval '7 days' then raise exception 'invalid_scan_receipt'; end if;
  if p.media_type='application/pdf' then
   if jsonb_typeof(requested_receipt->'decoded'->'pages') is distinct from 'number' or coalesce(requested_receipt->'decoded'->>'pages','') !~ '^[0-9]{1,2}$' or (requested_receipt->'decoded'->>'pages')::integer not between 1 and 20 or (requested_receipt->'decoded')-'pages'<>'{}'::jsonb then raise exception 'invalid_scan_receipt'; end if;
  else
   if jsonb_typeof(requested_receipt->'decoded'->'width') is distinct from 'number' or jsonb_typeof(requested_receipt->'decoded'->'height') is distinct from 'number' or coalesce(requested_receipt->'decoded'->>'width','') !~ '^[0-9]{1,4}$' or coalesce(requested_receipt->'decoded'->>'height','') !~ '^[0-9]{1,4}$'
    or (requested_receipt->'decoded'->>'width')::integer not between 1 and 8000 or (requested_receipt->'decoded'->>'height')::integer not between 1 and 8000
    or (requested_receipt->'decoded'->>'width')::integer*(requested_receipt->'decoded'->>'height')::integer>20000000 or (requested_receipt->'decoded')-array['width','height']<>'{}'::jsonb then raise exception 'invalid_scan_receipt'; end if;
  end if;
 end if;
 update private.claim_file_jobs set status=outcome,scan_receipt=case when outcome='synthetic_clean' then requested_receipt else jsonb_build_object('status',outcome) end,
 lease=null,lease_until=null,delete_after=case when outcome='synthetic_clean' then expires_at else least(delete_after,statement_timestamp()+interval '24 hours') end where id=p.id;
 -- Synthetic scan receipts never create claim_evidence, authority reviews or participation.
 insert into app.audit_events(actor_kind,action,target_type,target_id,after_ref) values('system','claim.synthetic_proof_processed','claim_file_job',p.id::text,jsonb_build_object('status',outcome,'sha256',p.sha256,'mode','synthetic'));
 return jsonb_build_object('id',p.id,'status',outcome,'mode','synthetic');
end $$;

create function public.get_my_claim_file_status(requested_claim_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
begin
 if app.current_actor_id() is null then raise exception 'authentication_required'; end if;
 if not exists(select 1 from app.claims where id=requested_claim_id and claimant_actor_id=app.current_actor_id()) then raise exception 'claim_access_forbidden'; end if;
 return coalesce((select jsonb_agg(jsonb_build_object('id',id,'status',status,'mode',mode,'createdAt',created_at,'deleteAfter',delete_after,'deletedAt',deleted_at) order by created_at) from private.claim_file_jobs where claim_id=requested_claim_id),'[]'::jsonb);
end $$;

create function public.authorize_synthetic_claim_proof_download(requested_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor uuid:=app.current_actor_id(); p private.claim_file_jobs%rowtype; claimant uuid;
begin
 if actor is null then raise exception 'authentication_required'; end if;
 select c.claimant_actor_id into claimant from app.claims c join private.claim_file_jobs f on f.claim_id=c.id where f.id=requested_id;
 if claimant is distinct from actor then perform private.require_claim_reviewer(); end if;
 if coalesce(auth.jwt()->>'auth_time','') !~ '^[0-9]+$' or extract(epoch from statement_timestamp())-(auth.jwt()->>'auth_time')::numeric not between 0 and 900 then raise exception 'reauth_required'; end if;
 select f.* into p from private.claim_file_jobs f join app.claims c on c.id=f.claim_id join app.business_listings bl on bl.id=c.listing_id
 where f.id=requested_id and bl.city_slug='reno' and bl.publication_status='published' and c.status<>'withdrawn';
 if not found or p.status<>'synthetic_clean' or p.expires_at<=statement_timestamp() or p.delete_after<=statement_timestamp() then raise exception 'proof_unavailable'; end if;
 insert into app.audit_events(actor_id,actor_kind,action,target_type,target_id) values(actor,case when claimant=actor then 'claimant' else 'operator' end,'claim.synthetic_proof_download_authorized','claim_file_job',p.id::text);
 return jsonb_build_object('id',p.id,'sha256',p.sha256,'mediaType',p.media_type,'mode',p.mode);
end $$;

create function public.describe_synthetic_claim_proof(requested_id uuid) returns jsonb
language sql security definer set search_path='' as $$
 select jsonb_build_object('id',id,'status',status,'mode',mode,'sha256',sha256,'mediaType',media_type,'path',storage_path) from private.claim_file_jobs where id=requested_id
$$;

create function public.lease_synthetic_proof_deletions() returns jsonb
language plpgsql security definer set search_path='' as $$
declare p private.claim_file_jobs%rowtype; result jsonb:='[]'::jsonb;
begin
 for p in select * from private.claim_file_jobs where deleted_at is null and delete_after<=statement_timestamp() and (lease_until is null or lease_until<=statement_timestamp()) order by delete_after limit 100 for update skip locked loop
  update private.claim_file_jobs set status='deleting',lease=extensions.gen_random_uuid(),lease_until=statement_timestamp()+interval '2 minutes' where id=p.id returning * into p;
  result:=result||jsonb_build_array(jsonb_build_object('id',p.id,'path',p.storage_path,'lease',p.lease,'mode',p.mode));
 end loop;
 return result;
end $$;

create function public.confirm_synthetic_proof_deleted(requested_id uuid,requested_lease uuid) returns boolean
language plpgsql security definer set search_path='' as $$
declare p private.claim_file_jobs%rowtype;
begin
 select * into p from private.claim_file_jobs where id=requested_id for update;
 if not found then raise exception 'proof_unavailable'; end if;
 if p.status='deleted' and p.lease=requested_lease then return true; end if;
 if p.status<>'deleting' or p.lease is distinct from requested_lease or p.lease_until<=statement_timestamp() or p.delete_after>statement_timestamp() then raise exception 'proof_lease_expired'; end if;
 update private.claim_file_jobs set status='deleted',deleted_at=statement_timestamp(),explanation=null,lease_until=null where id=p.id;
 insert into app.audit_events(actor_kind,action,target_type,target_id,after_ref) values('system','claim.synthetic_proof_deleted','claim_file_job',p.id::text,jsonb_build_object('sha256',p.sha256,'mode',p.mode));
 return true;
end $$;

create function private.schedule_synthetic_proof_retention() returns trigger language plpgsql set search_path='' as $$
begin
 if new.status in ('approved','rejected','withdrawn') and old.status is distinct from new.status then
  update private.claim_file_jobs set delete_after=case when status='synthetic_clean' then coalesce(new.decided_at,new.withdrawn_at,statement_timestamp())+interval '30 days' else least(delete_after,statement_timestamp()+interval '24 hours') end where claim_id=new.id and deleted_at is null;
 end if;
 return new;
end $$;
create trigger claims_synthetic_proof_retention after update of status on app.claims for each row execute function private.schedule_synthetic_proof_retention();
revoke all on function private.schedule_synthetic_proof_retention() from public,anon,authenticated,service_role;
revoke all on function public.reserve_synthetic_claim_proof(uuid,uuid,text,integer,text,text,text),public.get_my_claim_file_status(uuid),public.authorize_synthetic_claim_proof_download(uuid) from public,anon;
grant execute on function public.reserve_synthetic_claim_proof(uuid,uuid,text,integer,text,text,text),public.get_my_claim_file_status(uuid),public.authorize_synthetic_claim_proof_download(uuid) to authenticated;
revoke all on function public.acquire_synthetic_claim_proof(uuid),public.finish_synthetic_claim_proof(uuid,uuid,jsonb),public.describe_synthetic_claim_proof(uuid),public.lease_synthetic_proof_deletions(),public.confirm_synthetic_proof_deleted(uuid,uuid) from public,anon,authenticated;
grant execute on function public.acquire_synthetic_claim_proof(uuid),public.finish_synthetic_claim_proof(uuid,uuid,jsonb),public.describe_synthetic_claim_proof(uuid),public.lease_synthetic_proof_deletions(),public.confirm_synthetic_proof_deleted(uuid,uuid) to service_role;
commit;
