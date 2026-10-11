-- REVIEW PACKAGE ONLY. Do not replay the repository ledger or apply to production.
-- Requires a reconciled baseline and independent approval of constraints/bucket policies.
begin;
create table app.business_image_submissions (
  media_id uuid primary key references app.media_assets(id),
  alt_text text not null check (length(alt_text) between 3 and 200),
  rights_basis text not null check (rights_basis in ('owned','licensed')),
  source_note text not null check (length(source_note) between 3 and 500),
  rights_attested_by uuid not null references app.actors(id),
  rights_attested_at timestamptz not null default statement_timestamp(),
  sanitized_sha256 text not null check (sanitized_sha256 ~ '^[a-f0-9]{64}$'),
  width integer not null check (width between 16 and 1600),
  height integer not null check (height between 16 and 1600),
  review_reason text,
  rights_checked boolean not null default false
);
alter table app.business_image_submissions enable row level security;
revoke all on app.business_image_submissions from public,anon,authenticated;
-- Preserve existing legacy grants. Restrictive guards below protect only this
-- managed workflow and its reserved UUID/original key namespace.
-- The baseline approved-public SELECT policy exposes whole media rows. Hide this
-- workflow's rows from direct selects; scoped SECURITY DEFINER RPCs expose safe fields.
create function app.business_image_is_managed(media uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from app.business_image_submissions where media_id=media)
$$;
revoke all on function app.business_image_is_managed(uuid) from public,anon,authenticated;
grant execute on function app.business_image_is_managed(uuid) to anon,authenticated;
create policy business_image_metadata_guard on app.media_assets as restrictive for select to anon,authenticated
 using (not app.business_image_is_managed(id));
-- These guards also constrain inherited table/column grants. A reserved key must
-- never be smuggled in through another row ID or uppercase UUID spelling.
create policy business_image_media_insert_guard on app.media_assets as restrictive for insert to anon,authenticated
 with check (not app.business_image_is_managed(id) and original_path !~* '^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/original$');
create policy business_image_media_update_guard on app.media_assets as restrictive for update to anon,authenticated
 using (not app.business_image_is_managed(id)) with check (not app.business_image_is_managed(id) and original_path !~* '^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/original$');
create policy business_image_media_delete_guard on app.media_assets as restrictive for delete to anon,authenticated
 using (not app.business_image_is_managed(id));

create function app.can_upload_business_image(listing uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select (select auth.jwt()->'act') is null and (select auth.jwt()->>'impersonator_id') is null
 and app.current_actor_id() is not null and exists(select 1 from app.business_listings where id=listing and city_slug='reno') and
 (exists(select 1 from app.listing_participations where listing_id=listing and actor_id=app.current_actor_id() and status='active'
   and (starts_at is null or starts_at<=statement_timestamp()) and (expires_at is null or expires_at>statement_timestamp())
   and (role='business_owner' or (role in ('listing_manager','agency_representative') and authority_scope->>'media'='propose')))
  or (app.operator_recent_auth(900) and exists(select 1 from app.operator_grants where actor_id=app.current_actor_id() and status='active' and 'listing_review'=any(permissions))))
$$;
create function app.require_business_image_reviewer() returns void
language plpgsql stable security definer set search_path='' as $$
begin
 if not app.operator_recent_auth(900) then raise exception 'reauth_required'; end if;
 if not exists(select 1 from app.operator_grants where actor_id=app.current_actor_id() and status='active' and 'listing_review'=any(permissions)) then raise exception 'review_forbidden'; end if;
end $$;
create function app.business_image_actor_kind(listing uuid) returns text
language sql stable security definer set search_path='' as $$
 select case when app.operator_recent_auth(900) and exists(select 1 from app.operator_grants where actor_id=app.current_actor_id() and status='active' and 'listing_review'=any(permissions)) then 'operator' else
  (select role from app.listing_participations where listing_id=listing and actor_id=app.current_actor_id() and status='active'
   and (starts_at is null or starts_at<=statement_timestamp()) and (expires_at is null or expires_at>statement_timestamp())
   and (role='business_owner' or (role in ('listing_manager','agency_representative') and authority_scope->>'media'='propose'))
   order by case role when 'business_owner' then 1 else 2 end limit 1) end
$$;

create function public.begin_business_image(requested_id uuid, requested_listing_id uuid, requested_kind text,
 requested_alt text, requested_rights text, requested_source text, requested_sha text,
 requested_type text, requested_size bigint, requested_sanitized_sha text, requested_width integer, requested_height integer)
 returns jsonb language plpgsql security definer set search_path='' as $$
declare m app.media_assets%rowtype; s app.business_image_submissions%rowtype; n integer;
begin
 if not app.can_upload_business_image(requested_listing_id) then raise exception 'listing_access_forbidden'; end if;
 if requested_kind not in ('logo','image') or requested_kind is null or requested_type not in ('image/jpeg','image/png','image/webp') or requested_type is null
 or requested_size is null or requested_size not between 1 and 2097152 or requested_sha is null or requested_sha !~ '^[a-f0-9]{64}$'
 or requested_sanitized_sha is null or requested_sanitized_sha !~ '^[a-f0-9]{64}$'
 or requested_width is null or requested_width not between 16 and 1600 or requested_height is null or requested_height not between 16 and 1600
 or requested_alt is null or length(requested_alt) not between 3 and 200 or requested_source is null or length(requested_source) not between 3 and 500
 or requested_rights is null or requested_rights not in ('owned','licensed') then raise exception 'invalid_image_details'; end if;
 perform 1 from app.business_listings where id=requested_listing_id for update;
 select * into m from app.media_assets where id=requested_id;
 if found then
  select * into s from app.business_image_submissions where media_id=m.id;
  if m.created_by is distinct from app.current_actor_id() or m.listing_id<>requested_listing_id or m.kind<>requested_kind or m.sha256<>requested_sha
   or s.alt_text<>requested_alt or s.rights_basis<>requested_rights or s.source_note<>requested_source or s.sanitized_sha256<>requested_sanitized_sha then raise exception 'idempotency_conflict'; end if;
  return jsonb_build_object('id',m.id,'status',m.status);
 end if;
 select count(*) into n from app.media_assets where listing_id=requested_listing_id and kind=requested_kind and status not in ('rejected','quarantined','deleted');
 -- Small free-listing slice: one logo and three gallery images. No Featured expansion.
 if n >= (case when requested_kind='logo' then 1 else 3 end) then raise exception 'media_limit_reached'; end if;
 insert into app.media_assets(id,listing_id,kind,original_path,media_type,byte_size,sha256,created_by)
 values(requested_id,requested_listing_id,requested_kind,requested_id::text||'/original',requested_type,requested_size,requested_sha,app.current_actor_id());
 insert into app.business_image_submissions(media_id,alt_text,rights_basis,source_note,rights_attested_by,sanitized_sha256,width,height)
 values(requested_id,requested_alt,requested_rights,requested_source,app.current_actor_id(),requested_sanitized_sha,requested_width,requested_height);
 insert into app.audit_events(actor_id,actor_kind,action,target_type,target_id) values(app.current_actor_id(),app.business_image_actor_kind(requested_listing_id),'media.upload_started','media',requested_id::text);
 return jsonb_build_object('id',requested_id,'status','uploaded');
end $$;

create function public.finish_business_image(requested_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare m app.media_assets%rowtype;
begin
 select * into m from app.media_assets where id=requested_id for update;
 if not found or m.created_by is distinct from app.current_actor_id() or not app.can_upload_business_image(m.listing_id) then raise exception 'listing_access_forbidden'; end if;
 if m.status in ('pending_review','approved','rejected') then return jsonb_build_object('id',m.id,'status',m.status); end if;
 if m.status<>'uploaded' or not exists(select 1 from storage.objects where bucket_id='business-images' and name=m.original_path)
  or not exists(select 1 from storage.objects where bucket_id='business-images' and name=m.id::text||'/sanitized.webp') then raise exception 'upload_incomplete'; end if;
 update app.media_assets set status='pending_review',updated_at=statement_timestamp() where id=m.id;
 insert into app.audit_events(actor_id,actor_kind,action,target_type,target_id) values(app.current_actor_id(),app.business_image_actor_kind(m.listing_id),'media.submitted','media',m.id::text);
 return jsonb_build_object('id',m.id,'status','pending_review');
end $$;

create function public.business_image_workspace(requested_listing_id uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
 if not app.can_upload_business_image(requested_listing_id) then raise exception 'listing_access_forbidden'; end if;
 return coalesce((select jsonb_agg(jsonb_build_object('id',m.id,'listingId',m.listing_id,'kind',m.kind,'status',m.status,'alt',s.alt_text,'reason',s.review_reason,'rightsBasis',s.rights_basis,'source',s.source_note) order by m.created_at desc)
  from app.media_assets m join app.business_image_submissions s on s.media_id=m.id where m.listing_id=requested_listing_id),'[]'::jsonb);
end $$;
create function public.business_image_review_queue() returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
 perform app.require_business_image_reviewer();
 return coalesce((select jsonb_agg(to_jsonb(q)) from (select m.id,m.listing_id as "listingId",bl.display_name as "listingName",m.kind,m.status,s.alt_text as alt,s.rights_basis as "rightsBasis",s.source_note as source
  from app.media_assets m join app.business_image_submissions s on s.media_id=m.id join app.business_listings bl on bl.id=m.listing_id
  where m.status in ('uploaded','pending_review') order by m.created_at,m.id limit 5) q),'[]'::jsonb);
end $$;
create function public.inspect_business_image(requested_id uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare m app.media_assets%rowtype;
begin
 select * into m from app.media_assets where id=requested_id;
 if not found then raise exception 'image_not_found'; end if;
 if not app.can_upload_business_image(m.listing_id) then raise exception 'listing_access_forbidden'; end if;
 return (select jsonb_build_object('id',m.id,'status',m.status,'path',m.original_path,'type',m.media_type,'sha256',m.sha256,
  'byteSize',m.byte_size,'sanitizedSha',s.sanitized_sha256,'width',s.width,'height',s.height) from app.business_image_submissions s where s.media_id=m.id);
end $$;
create function public.decide_business_image(requested_id uuid, requested_decision text, requested_reason text, requested_rights_checked boolean)
returns jsonb language plpgsql security definer set search_path='' as $$
declare m app.media_assets%rowtype;
begin
 perform app.require_business_image_reviewer();
 if requested_decision is null or requested_decision not in ('approved','rejected') or requested_reason is null or length(requested_reason) not between 3 and 500 then raise exception 'invalid_decision'; end if;
 select * into m from app.media_assets where id=requested_id for update;
 if not found or not exists(select 1 from app.business_image_submissions where media_id=m.id) then raise exception 'image_not_found'; end if;
 if m.status=requested_decision then
  if not exists(select 1 from app.business_image_submissions where media_id=m.id and review_reason=requested_reason and rights_checked=requested_rights_checked) then raise exception 'idempotency_conflict'; end if;
  return jsonb_build_object('id',m.id,'status',m.status);
 end if;
 if m.status not in ('uploaded','pending_review') then raise exception 'invalid_decision'; end if;
 if requested_decision='approved' and (m.status<>'pending_review' or requested_rights_checked is distinct from true or not exists(select 1 from storage.objects where bucket_id='business-images' and name=m.id::text||'/approved.webp')) then raise exception 'review_incomplete'; end if;
 update app.media_assets set status=requested_decision,public_path=case when requested_decision='approved' then '/api/business-images/'||m.id::text end,
  reviewed_by=app.current_actor_id(),updated_at=statement_timestamp(),quarantine_until=case when requested_decision='rejected' then statement_timestamp()+interval '30 days' end where id=m.id;
 update app.business_image_submissions set review_reason=requested_reason,rights_checked=requested_rights_checked where media_id=m.id;
 if requested_decision='approved' and m.kind='logo' then
  insert into app.listing_content(listing_id,logo_media_id) values(m.listing_id,m.id) on conflict(listing_id) do update set logo_media_id=excluded.logo_media_id;
 end if;
 insert into app.audit_events(actor_id,actor_kind,action,target_type,target_id,reason) values(app.current_actor_id(),'operator','media.'||requested_decision,'media',m.id::text,requested_reason);
 return jsonb_build_object('id',m.id,'status',requested_decision);
end $$;

-- Safe public projection, deliberately not the broad PR15 presentation schema.
create function public.published_business_images(requested_listing_id uuid) returns jsonb
language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('id',m.id,'kind',m.kind,'alt',s.alt_text,'url','/api/business-images/'||m.id::text,'width',s.width,'height',s.height) order by m.created_at,m.id),'[]'::jsonb)
 from app.media_assets m join app.business_image_submissions s on s.media_id=m.id join app.business_listings bl on bl.id=m.listing_id
 where m.listing_id=requested_listing_id and m.status='approved' and s.rights_checked and bl.publication_status='published'
$$;
create function public.published_business_image(requested_id uuid) returns jsonb
language sql stable security definer set search_path='' as $$
 select jsonb_build_object('path',m.id::text||'/approved.webp') from app.media_assets m join app.business_image_submissions s on s.media_id=m.id join app.business_listings bl on bl.id=m.listing_id
 where m.id=requested_id and m.status='approved' and s.rights_checked and bl.publication_status='published'
$$;

create function app.business_image_object_allowed(object_name text, operation text) returns boolean
language plpgsql stable security definer set search_path='' as $$
declare m app.media_assets%rowtype;
begin
 if object_name !~ '^[a-f0-9-]{36}/(original|sanitized[.]webp|approved[.]webp)$' then return false; end if;
 select * into m from app.media_assets where original_path=split_part(object_name,'/',1)||'/original';
 if not found or not exists(select 1 from app.business_image_submissions where media_id=m.id) then return false; end if;
 if operation='read' then
  if object_name=m.id::text||'/approved.webp' then
   return (m.status='approved' and exists(select 1 from app.business_image_submissions where media_id=m.id and rights_checked) and exists(select 1 from app.business_listings where id=m.listing_id and publication_status='published'))
    or (app.operator_recent_auth(900) and exists(select 1 from app.operator_grants where actor_id=app.current_actor_id() and status='active' and 'listing_review'=any(permissions)));
  end if;
  return app.can_upload_business_image(m.listing_id);
 end if;
 if operation='insert' then
  if object_name=m.id::text||'/approved.webp' then
   -- Only the separately approved trusted server writer may bypass RLS for this
   -- immutable derivative. An Operator JWT cannot upload arbitrary public bytes.
   return false;
  end if;
  return m.status='uploaded' and m.created_by=app.current_actor_id() and app.can_upload_business_image(m.listing_id);
 end if;
 return false;
end $$;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
 values('business-images','business-images',false,2097152,array['image/jpeg','image/png','image/webp']);
create policy business_image_insert on storage.objects for insert to authenticated with check(bucket_id='business-images' and app.business_image_object_allowed(name,'insert'));
create policy business_image_read on storage.objects for select to anon,authenticated using(bucket_id='business-images' and app.business_image_object_allowed(name,'read'));
-- Restrictive policies prevent a broader existing bucket policy from opening this workflow.
create policy business_image_insert_guard on storage.objects as restrictive for insert to anon,authenticated with check(bucket_id<>'business-images' or app.business_image_object_allowed(name,'insert'));
create policy business_image_read_guard on storage.objects as restrictive for select to anon,authenticated using(bucket_id<>'business-images' or app.business_image_object_allowed(name,'read'));
create policy business_image_update_guard on storage.objects as restrictive for update to anon,authenticated using(bucket_id<>'business-images') with check(bucket_id<>'business-images');
create policy business_image_delete_guard on storage.objects as restrictive for delete to anon,authenticated using(bucket_id<>'business-images');

revoke all on function app.can_upload_business_image(uuid),app.require_business_image_reviewer(),app.business_image_actor_kind(uuid),app.business_image_object_allowed(text,text) from public,anon,authenticated;
grant execute on function app.business_image_object_allowed(text,text) to anon,authenticated;
revoke all on function public.begin_business_image(uuid,uuid,text,text,text,text,text,text,bigint,text,integer,integer),public.finish_business_image(uuid),public.business_image_workspace(uuid),public.business_image_review_queue(),public.inspect_business_image(uuid),public.decide_business_image(uuid,text,text,boolean),public.published_business_images(uuid),public.published_business_image(uuid) from public,anon,authenticated;
grant execute on function public.begin_business_image(uuid,uuid,text,text,text,text,text,text,bigint,text,integer,integer),public.finish_business_image(uuid),public.business_image_workspace(uuid),public.business_image_review_queue(),public.inspect_business_image(uuid),public.decide_business_image(uuid,text,text,boolean) to authenticated;
grant execute on function public.published_business_images(uuid),public.published_business_image(uuid) to anon,authenticated;
commit;
