begin;
-- 775-3: independent of the reviewed ten-source claim forward package.
create table private.directory_feedback (
 id uuid primary key default extensions.gen_random_uuid(),
 actor_id uuid not null references app.actors(id),
 kind text not null check(kind in ('feature','bug')),
 title text not null check(length(title) between 5 and 120),
 details text not null check(length(details) between 20 and 3000),
 content_hash text not null,
 idempotency_key text not null,
 consent_version text not null default 'feedback-v1' check(consent_version='feedback-v1'),
 status text not null default 'pending_review' check(status in ('pending_review','approved','dismissed')),
 decided_by uuid references app.actors(id),
 decision_reason text,
 decided_at timestamptz,
 created_at timestamptz not null default statement_timestamp(),
 unique(actor_id,idempotency_key),
 check((status='pending_review')=(decided_at is null))
);
create index directory_feedback_actor_created on private.directory_feedback(actor_id,created_at);
create index directory_feedback_created on private.directory_feedback(created_at);
create table private.feedback_submission_receipts (
 actor_id uuid not null references app.actors(id),
 idempotency_key text not null,
 content_hash text not null,
 feedback_id uuid not null references private.directory_feedback(id),
 created_at timestamptz not null default statement_timestamp(),
 primary key(actor_id,idempotency_key)
);
create table private.feedback_linear_outbox (
 id uuid primary key default extensions.gen_random_uuid(),
 feedback_id uuid not null unique references private.directory_feedback(id),
 team_id text not null default 'f81dd6ad-8f9f-4d94-b59a-2b72cb995386' check(team_id='f81dd6ad-8f9f-4d94-b59a-2b72cb995386'),
 title text not null check(length(title) between 5 and 120),
 details text not null check(length(details) between 20 and 3000),
 status text not null default 'held' check(status='held'),
 created_at timestamptz not null default statement_timestamp()
);
alter table private.directory_feedback enable row level security;
alter table private.feedback_submission_receipts enable row level security;
alter table private.feedback_linear_outbox enable row level security;
revoke all on private.directory_feedback,private.feedback_submission_receipts,private.feedback_linear_outbox from public,anon,authenticated,service_role;

create function public.submit_directory_feedback(requested_payload jsonb,requested_key text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor uuid:=app.current_actor_id(); existing private.directory_feedback%rowtype; receipt private.feedback_submission_receipts%rowtype; created uuid; digest text; normalized jsonb;
begin
 if actor is null then raise exception 'authentication_required'; end if;
 if not exists(select 1 from app.actors where id=actor and email_verified) then raise exception 'verified_identity_required'; end if;
 if jsonb_typeof(requested_payload) is distinct from 'object' or requested_payload-array['kind','title','details','consent']<>'{}'::jsonb
  or jsonb_typeof(requested_payload->'kind') is distinct from 'string' or requested_payload->>'kind' not in ('feature','bug')
  or jsonb_typeof(requested_payload->'title') is distinct from 'string' or length(btrim(requested_payload->>'title')) not between 5 and 120
  or jsonb_typeof(requested_payload->'details') is distinct from 'string' or length(btrim(requested_payload->>'details')) not between 20 and 3000
  or requested_payload->'consent' is distinct from 'true'::jsonb
  or requested_key is null or requested_key !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{7,199}$'
  or ((requested_payload->>'title')||(requested_payload->>'details')) ~ E'[\\x01-\\x08\\x0B\\x0C\\x0E-\\x1F\\x7F]' then raise exception 'invalid_feedback'; end if;
 normalized:=jsonb_build_object('kind',requested_payload->>'kind','title',btrim(requested_payload->>'title'),'details',btrim(requested_payload->>'details'),'consent',true);
 digest:=encode(extensions.digest(normalized::text,'sha256'),'hex');
 -- Serialize budgets across actors and application instances; no network address is retained.
 perform pg_advisory_xact_lock(hashtextextended('directory-feedback-budget',0));
 select * into receipt from private.feedback_submission_receipts where actor_id=actor and idempotency_key=requested_key;
 if found then
  if receipt.content_hash<>digest then raise exception 'idempotency_conflict'; end if;
  return jsonb_build_object('id',receipt.feedback_id,'status','pending_review','duplicate',true);
 end if;
 if (select count(*) from private.feedback_submission_receipts where actor_id=actor and created_at>statement_timestamp()-interval '1 hour')>=5
  or (select count(*) from private.feedback_submission_receipts where actor_id=actor and created_at>statement_timestamp()-interval '24 hours')>=20
  or (select count(*) from private.feedback_submission_receipts where created_at>statement_timestamp()-interval '24 hours')>=100 then raise exception 'feedback_rate_limited'; end if;
 select * into existing from private.directory_feedback where actor_id=actor and content_hash=digest and created_at>statement_timestamp()-interval '24 hours' order by created_at desc limit 1;
 if found then
  insert into private.feedback_submission_receipts(actor_id,idempotency_key,content_hash,feedback_id) values(actor,requested_key,digest,existing.id);
  return jsonb_build_object('id',existing.id,'status','pending_review','duplicate',true);
 end if;
 insert into private.directory_feedback(actor_id,kind,title,details,content_hash,idempotency_key)
 values(actor,normalized->>'kind',normalized->>'title',normalized->>'details',digest,requested_key) returning id into created;
 insert into private.feedback_submission_receipts(actor_id,idempotency_key,content_hash,feedback_id) values(actor,requested_key,digest,created);
 insert into app.audit_events(actor_id,actor_kind,action,target_type,target_id,request_id) values(actor,'claimant','feedback.received','directory_feedback',created::text,requested_key);
 return jsonb_build_object('id',created,'status','pending_review','duplicate',false);
end $$;

create function private.feedback_review_allowed() returns boolean language sql stable security definer set search_path='' as $$
 select app.operator_recent_auth(900) and exists(select 1 from app.operator_grants where actor_id=app.current_actor_id() and status='active' and 'feedback_review'=any(permissions))
$$;

create function public.review_directory_feedback() returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if not private.feedback_review_allowed() then raise exception 'feedback_review_forbidden'; end if;
 return coalesce((select jsonb_agg(jsonb_build_object('id',f.id,'kind',f.kind,'title',f.title,'details',f.details,'createdAt',f.created_at)) from (select * from private.directory_feedback where status='pending_review' order by created_at limit 100)f),'[]'::jsonb);
end $$;

create function public.decide_directory_feedback(requested_id uuid,requested_outcome text,requested_reason text,requested_title text,requested_details text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor uuid:=app.current_actor_id(); f private.directory_feedback%rowtype; outbox uuid;
begin
 if not private.feedback_review_allowed() then raise exception 'feedback_review_forbidden'; end if;
 if requested_outcome is null or requested_outcome not in ('approved','dismissed') or requested_reason is null or length(btrim(requested_reason)) not between 5 and 500
  or (requested_outcome='approved' and (requested_title is null or length(btrim(requested_title)) not between 5 and 120 or requested_details is null or length(btrim(requested_details)) not between 20 and 3000))
  or (requested_outcome='dismissed' and (requested_title is not null or requested_details is not null)) then raise exception 'invalid_feedback_decision'; end if;
 select * into f from private.directory_feedback where id=requested_id for update;
 if not found then raise exception 'feedback_unavailable'; end if;
 if f.status<>'pending_review' then
  if f.status<>requested_outcome or f.decision_reason<>btrim(requested_reason) or (requested_outcome='approved' and not exists(select 1 from private.feedback_linear_outbox where feedback_id=f.id and title=btrim(requested_title) and details=btrim(requested_details))) then raise exception 'idempotency_conflict'; end if;
  return jsonb_build_object('id',f.id,'status',f.status,'delivery','held','idempotent',true);
 end if;
 if requested_outcome='approved' then
  insert into private.feedback_linear_outbox(feedback_id,title,details) values(f.id,btrim(requested_title),btrim(requested_details)) returning id into outbox;
 end if;
 update private.directory_feedback set status=requested_outcome,decided_by=actor,decision_reason=btrim(requested_reason),decided_at=statement_timestamp() where id=f.id;
 insert into app.audit_events(actor_id,actor_kind,action,target_type,target_id,after_ref) values(actor,'operator','feedback.moderated','directory_feedback',f.id::text,jsonb_build_object('status',requested_outcome,'outbox_id',outbox));
 return jsonb_build_object('id',f.id,'status',requested_outcome,'delivery','held','idempotent',false);
end $$;
revoke all on function private.feedback_review_allowed() from public,anon,authenticated,service_role;
revoke all on function public.submit_directory_feedback(jsonb,text),public.review_directory_feedback(),public.decide_directory_feedback(uuid,text,text,text,text) from public,anon,service_role;
grant execute on function public.submit_directory_feedback(jsonb,text),public.review_directory_feedback(),public.decide_directory_feedback(uuid,text,text,text,text) to authenticated;
commit;
