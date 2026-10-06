begin;

-- No existing contact or asset is copied into this reviewed-public projection.
create table app.listing_public_presentation (
 listing_id uuid primary key references app.business_listings(id),
 reviewed_domain text not null,
 public_email text,
 email_source_url text,
 email_checked_at timestamptz,
 media jsonb not null default '[]'::jsonb check(jsonb_typeof(media)='array'),
 reviewed_by uuid not null references app.actors(id),
 reviewed_at timestamptz not null default statement_timestamp(),
 check((public_email is null)=(email_source_url is null)),
 check((public_email is null)=(email_checked_at is null))
);
alter table app.listing_public_presentation enable row level security;
revoke all on app.listing_public_presentation from public,anon,authenticated,service_role;
grant select(listing_id,reviewed_domain,public_email,email_source_url,email_checked_at,media,reviewed_at) on app.listing_public_presentation to anon,authenticated;
create policy listing_presentation_public_read on app.listing_public_presentation for select to anon,authenticated
 using(exists(select 1 from app.business_listings b where b.id=listing_id and b.publication_status='published' and lower(regexp_replace(split_part(b.website_url,'/',3),'^www\.','','i'))=reviewed_domain));

create table private.listing_presentation_receipts (
 id uuid primary key default extensions.gen_random_uuid(),
 listing_id uuid not null references app.business_listings(id),
 actor_id uuid not null references app.actors(id),
 idempotency_key text not null unique,
 fingerprint text not null,
 before_version text not null,
 after_version text not null,
 before_values jsonb not null,
 after_values jsonb not null,
 reviewed_request jsonb not null,
 created_at timestamptz not null default statement_timestamp()
);
alter table private.listing_presentation_receipts enable row level security;
revoke all on private.listing_presentation_receipts from public,anon,authenticated,service_role;
create trigger listing_presentation_receipts_append_only before update or delete on private.listing_presentation_receipts for each row execute function private.reject_mutation();

create function private.listing_presentation_values(requested_listing_id uuid) returns jsonb
language sql volatile set search_path='' as $$
 select coalesce((select jsonb_build_object('contact',case when public_email is null then null else jsonb_build_object('email',public_email,'sourceUrl',email_source_url,'checkedAt',email_checked_at) end,'media',media,'reviewedAt',reviewed_at)
 from app.listing_public_presentation where listing_id=requested_listing_id),jsonb_build_object('contact',null,'media','[]'::jsonb,'reviewedAt',null));
$$;
create function private.listing_presentation_version(requested_listing_id uuid) returns text
language sql volatile set search_path='' as $$
 select encode(extensions.digest(jsonb_build_object('values',private.listing_presentation_values(b.id),'slug',b.current_slug,'website',b.website_url,'publication',b.publication_status,
 'assets',coalesce((select jsonb_agg(jsonb_build_object('id',m.id,'kind',m.kind,'status',m.status,'path',m.public_path,'sha256',m.sha256,'type',m.media_type,'caption',m.caption) order by m.id) from app.media_assets m where m.listing_id=b.id),'[]'::jsonb))::text,'sha256'),'hex')
 from app.business_listings b where b.id=requested_listing_id;
$$;
create function public.listing_presentation_snapshot(requested_listing_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare b app.business_listings%rowtype;
begin
 perform private.require_listing_correction_operator();
 select * into b from app.business_listings where id=requested_listing_id and publication_status='published';
 if not found then raise exception 'presentation_listing_unavailable'; end if;
 return jsonb_build_object('listingId',b.id,'slug',b.current_slug,'domain',lower(regexp_replace(split_part(b.website_url,'/',3),'^www\.','','i')),'version',private.listing_presentation_version(b.id),'values',private.listing_presentation_values(b.id));
end $$;

create function public.apply_reviewed_listing_presentation(requested_listing_id uuid,requested_presentation jsonb,requested_key text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.require_listing_correction_operator(); b app.business_listings%rowtype; prior private.listing_presentation_receipts%rowtype;
 before_value jsonb; after_value jsonb; before_version text; after_version text; fingerprint text; receipt_id uuid;
 contact jsonb; media jsonb; item jsonb; sanitized jsonb:='[]'::jsonb; media_position integer:=0; media_id uuid; asset app.media_assets%rowtype; checked timestamptz; rights_until timestamptz; host text; domain_value text; ids uuid[]:='{}';
begin
 if requested_listing_id is null or requested_key is null or requested_key !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{7,199}$'
  or jsonb_typeof(requested_presentation) is distinct from 'object' or octet_length(requested_presentation::text)>32768
  or not requested_presentation ?& array['expectedSlug','expectedDomain','expectedVersion','contact','media','reason']
  or requested_presentation-array['expectedSlug','expectedDomain','expectedVersion','contact','media','reason']<>'{}'::jsonb
  or length(coalesce(requested_presentation->>'reason','')) not between 5 and 500 then raise exception 'invalid_listing_presentation'; end if;
 fingerprint:=encode(extensions.digest(requested_presentation::text||requested_listing_id::text,'sha256'),'hex');
 perform pg_advisory_xact_lock(hashtextextended('listing-presentation:'||requested_key,0));
 select * into prior from private.listing_presentation_receipts where idempotency_key=requested_key;
 if found then
  if prior.actor_id<>actor or prior.fingerprint<>fingerprint then raise exception 'idempotency_conflict'; end if;
  return jsonb_build_object('receiptId',prior.id,'version',prior.after_version,'idempotent',true);
 end if;
 select * into b from app.business_listings where id=requested_listing_id for update;
 if not found or b.publication_status<>'published' then raise exception 'presentation_listing_unavailable'; end if;
 domain_value:=lower(regexp_replace(split_part(b.website_url,'/',3),'^www\.','','i'));
 if requested_presentation->>'expectedSlug' is distinct from b.current_slug or requested_presentation->>'expectedDomain' is distinct from domain_value then raise exception 'presentation_identity_conflict'; end if;
 perform 1 from app.media_assets where listing_id=b.id order by id for update;
 before_value:=private.listing_presentation_values(b.id); before_version:=private.listing_presentation_version(b.id);
 if requested_presentation->>'expectedVersion' is distinct from before_version then raise exception 'presentation_changed_since_review'; end if;
 contact:=requested_presentation->'contact'; media:=requested_presentation->'media';
 if contact<>'null'::jsonb then
  if jsonb_typeof(contact) is distinct from 'object' or not contact ?& array['email','sourceUrl','checkedAt','artifactSha256','publicContactConfirmed']
   or contact-array['email','sourceUrl','checkedAt','artifactSha256','publicContactConfirmed']<>'{}'::jsonb
   or contact->'publicContactConfirmed' is distinct from 'true'::jsonb
   or length(coalesce(contact->>'email',''))>254 or coalesce(contact->>'email','') !~ '^[A-Za-z0-9.!#$%&*+/=?^_`{|}~-]+@[A-Za-z0-9][A-Za-z0-9.-]*\.[A-Za-z]{2,}$'
   or coalesce(contact->>'artifactSha256','') !~ '^[a-f0-9]{64}$'
   or coalesce(contact->>'sourceUrl','') !~ '^https://[a-z0-9][a-z0-9.-]*[a-z0-9](/[a-zA-Z0-9/_.~-]*)?$' or length(contact->>'sourceUrl')>2000 then raise exception 'presentation_public_contact_evidence_required'; end if;
  host:=lower(regexp_replace(split_part(contact->>'sourceUrl','/',3),'^www\.','','i'));
  if host<>domain_value then raise exception 'presentation_source_identity_conflict'; end if;
  begin checked:=(contact->>'checkedAt')::timestamptz; exception when others then raise exception 'presentation_evidence_expired'; end;
  if checked is null or checked>statement_timestamp()+interval '5 minutes' or checked<statement_timestamp()-interval '30 days' then raise exception 'presentation_evidence_expired'; end if;
 end if;
 if jsonb_typeof(media) is distinct from 'array' or jsonb_array_length(media)>21 then raise exception 'invalid_listing_presentation'; end if;
 if jsonb_array_length(media)>4 and not exists(select 1 from app.featured_entitlements where listing_id=b.id and status='active' and (starts_at is null or starts_at<=statement_timestamp()) and (ends_at is null or ends_at>statement_timestamp())) then raise exception 'presentation_media_limit'; end if;
 for item in select value from jsonb_array_elements(media) loop
  media_position:=media_position+1;
  if jsonb_typeof(item) is distinct from 'object' or not item ?& array['mediaId','slot','sourceUrl','sourceCredit','rightsBasis','rightsEvidenceSha256','rightsValidUntil','checkedAt']
   or item-array['mediaId','slot','sourceUrl','sourceCredit','rightsBasis','rightsEvidenceSha256','rightsValidUntil','checkedAt']<>'{}'::jsonb
   or coalesce(item->>'mediaId','') !~ '^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$'
   or item->>'slot' is distinct from (case when media_position=1 then 'logo' else 'gallery' end)
   or coalesce(item->>'sourceUrl','') !~ '^https://[a-z0-9][a-z0-9.-]*[a-z0-9](/[a-zA-Z0-9/_.~-]*)?$' or length(item->>'sourceUrl')>2000
   or length(coalesce(item->>'sourceCredit','')) not between 2 and 200 or item->>'sourceCredit' ~ '[[:cntrl:]]'
   or coalesce(item->>'rightsEvidenceSha256','') !~ '^[a-f0-9]{64}$'
   or coalesce(item->>'rightsBasis','') not in ('official_company_logo','owner_permission','licensed','public_domain')
   or (media_position>1 and item->>'rightsBasis'='official_company_logo') then raise exception 'presentation_media_evidence_required'; end if;
  media_id:=(item->>'mediaId')::uuid;
  if media_id=any(ids) then raise exception 'presentation_duplicate_media'; end if;
  ids:=array_append(ids,media_id);
  select * into asset from app.media_assets where id=media_id and listing_id=b.id and status='approved';
  if not found or asset.reviewed_by is null or asset.public_path !~ '^https://[a-z0-9][a-z0-9.-]*[a-z0-9](/[a-zA-Z0-9/_.%~-]*)?$' or asset.media_type not in ('image/png','image/jpeg','image/webp','image/avif')
   or (media_position=1 and asset.kind not in ('logo','logo_horizontal','logo_vertical'))
   or (media_position>1 and asset.kind not in ('image','storefront','vehicle_wrap','project','product','owner_headshot')) then raise exception 'presentation_approved_asset_required'; end if;
  host:=lower(regexp_replace(split_part(item->>'sourceUrl','/',3),'^www\.','','i'));
  if item->>'rightsBasis'='official_company_logo' and host<>domain_value then raise exception 'presentation_source_identity_conflict'; end if;
  begin checked:=(item->>'checkedAt')::timestamptz; exception when others then raise exception 'presentation_evidence_expired'; end;
  if checked is null or checked>statement_timestamp()+interval '5 minutes' or checked<statement_timestamp()-interval '30 days' then raise exception 'presentation_evidence_expired'; end if;
  begin rights_until:=(item->>'rightsValidUntil')::timestamptz; exception when others then raise exception 'presentation_evidence_expired'; end;
  if rights_until is not null and rights_until<=statement_timestamp() then raise exception 'presentation_evidence_expired'; end if;
  sanitized:=sanitized||jsonb_build_array(jsonb_build_object('media_id',media_id,'url',asset.public_path,'sha256',asset.sha256,'asset_kind',asset.kind,'media_type',asset.media_type,'caption',coalesce(asset.caption,''),'rights_valid_until',rights_until,'slot',item->>'slot','source_url',item->>'sourceUrl','source_credit',item->>'sourceCredit'));
 end loop;
 insert into app.listing_public_presentation(listing_id,reviewed_domain,public_email,email_source_url,email_checked_at,media,reviewed_by)
 values(b.id,domain_value,contact->>'email',contact->>'sourceUrl',(contact->>'checkedAt')::timestamptz,sanitized,actor)
 on conflict(listing_id) do update set reviewed_domain=excluded.reviewed_domain,public_email=excluded.public_email,email_source_url=excluded.email_source_url,email_checked_at=excluded.email_checked_at,media=excluded.media,reviewed_by=actor,reviewed_at=clock_timestamp();
 after_value:=private.listing_presentation_values(b.id);after_version:=private.listing_presentation_version(b.id);
 insert into private.listing_presentation_receipts(listing_id,actor_id,idempotency_key,fingerprint,before_version,after_version,before_values,after_values,reviewed_request)
 values(b.id,actor,requested_key,fingerprint,before_version,after_version,before_value,after_value,requested_presentation) returning id into receipt_id;
 insert into app.listing_revisions(listing_id,revision_type,before_values,after_values,reason_codes,actor_id)
 values(b.id,'approved_change',before_value,after_value,array['reviewed-public-presentation'],actor);
 insert into app.audit_events(actor_id,actor_kind,action,target_type,target_id,request_id,reason,after_ref)
 values(actor,'operator','listing.presentation_published','listing',b.id::text,requested_key,requested_presentation->>'reason',jsonb_build_object('receipt_id',receipt_id));
 return jsonb_build_object('receiptId',receipt_id,'version',after_version,'idempotent',false);
end $$;
revoke all on function private.listing_presentation_values(uuid),private.listing_presentation_version(uuid) from public,anon,authenticated,service_role;
revoke all on function public.listing_presentation_snapshot(uuid),public.apply_reviewed_listing_presentation(uuid,jsonb,text) from public,anon,authenticated,service_role;
grant execute on function public.listing_presentation_snapshot(uuid),public.apply_reviewed_listing_presentation(uuid,jsonb,text) to authenticated;

-- Integrity checks expose no private original path or review narrative. Existing
-- media RLS still restricts anonymous reads to approved published assets.
grant select(sha256) on app.media_assets to anon,authenticated;

create view public.directory_listing_presentation with(security_invoker=true) as
select p.listing_id,p.public_email,p.email_source_url,p.email_checked_at,
 case when exists(select 1 from jsonb_array_elements(p.media) e join app.media_assets m on m.id=(e->>'media_id')::uuid and m.listing_id=p.listing_id and m.status='approved' and m.sha256=e->>'sha256' and m.public_path=e->>'url' and m.kind=e->>'asset_kind' and m.media_type=e->>'media_type' and coalesce(m.caption,'')=e->>'caption' where e->>'slot'='logo' and (e->>'rights_valid_until' is null or (e->>'rights_valid_until')::timestamptz>statement_timestamp())) then
 coalesce((select jsonb_agg(jsonb_build_object('id',m.id,'url',m.public_path,'kind',case when e.item->>'slot'='logo' then 'logo' else m.kind end,'caption',coalesce(m.caption,''),'sourceUrl',e.item->>'source_url','sourceCredit',e.item->>'source_credit') order by e.position)
 from jsonb_array_elements(p.media) with ordinality e(item,position) join app.media_assets m on m.id=(e.item->>'media_id')::uuid and m.listing_id=p.listing_id and m.status='approved' and m.sha256=e.item->>'sha256' and m.public_path=e.item->>'url' and m.kind=e.item->>'asset_kind' and m.media_type=e.item->>'media_type' and coalesce(m.caption,'')=e.item->>'caption' and (e.item->>'rights_valid_until' is null or (e.item->>'rights_valid_until')::timestamptz>statement_timestamp()) and e.position <= case when exists(select 1 from app.featured_entitlements fe where fe.listing_id=p.listing_id and fe.status='active' and (fe.starts_at is null or fe.starts_at<=statement_timestamp()) and (fe.ends_at is null or fe.ends_at>statement_timestamp())) then 21 else 4 end),'[]'::jsonb)
 else '[]'::jsonb end as media
from app.listing_public_presentation p join app.business_listings b on b.id=p.listing_id where b.publication_status='published' and p.reviewed_domain=lower(regexp_replace(split_part(b.website_url,'/',3),'^www\.','','i'));
revoke all on public.directory_listing_presentation from public;
grant select on public.directory_listing_presentation to anon,authenticated;
-- Keep the legacy public photo array consistent: logo first, reviewed assets only.
create or replace view public.directory_listings
with (security_invoker = true)
as
select
  bl.id,
  bl.stable_id,
  bl.current_slug,
  bl.display_name,
  bl.tagline,
  bl.description,
  bl.phone_e164,
  bl.website_url,
  case when bl.hide_street or bl.is_service_area then null else bl.street_address end as street_address,
  bl.city_slug,
  bl.region_code,
  case when bl.hide_street or bl.is_service_area then null else bl.postal_code end as postal_code,
  (case when bl.hide_street or bl.is_service_area then null else bl.latitude end)::numeric(9,6) as latitude,
  (case when bl.hide_street or bl.is_service_area then null else bl.longitude end)::numeric(9,6) as longitude,
  bl.is_service_area,
  bl.google_place_id,
  bl.information_checked_at,
  case when app.has_current_verified_owner(bl.id) then bl.owner_verified_at else null end as owner_verified_at,
  bl.published_at,
  coalesce(array_agg(distinct c.slug) filter (where c.slug is not null), '{}') as category_slugs,
  exists (
    select 1 from app.featured_entitlements fe
    where fe.listing_id = bl.id
      and fe.status = 'active'
      and (fe.starts_at is null or fe.starts_at <= statement_timestamp())
      and (fe.ends_at is null or fe.ends_at > statement_timestamp())
  ) as is_featured,
  o.title as offer_title,
  o.details as offer_details,
  o.redemption_code as offer_code,
  o.ends_at as offer_ends_at,
  bl.content_tier,
  max(c.slug) filter (where lc.is_primary) as primary_category_slug,
  max(c.name) filter (where lc.is_primary) as primary_category_name,
  coalesce(content.services, '{}') as services,
  coalesce(content.faqs, '[]'::jsonb) as faqs,
  coalesce((select jsonb_agg(project - 'imageUrl' - 'image_url') from jsonb_array_elements(content.projects) project where jsonb_typeof(project)='object'), '[]'::jsonb) as projects,
  coalesce((
    select array_agg(item->>'url' order by position)
    from public.directory_listing_presentation presentation,
      jsonb_array_elements(presentation.media) with ordinality entry(item,position)
    where presentation.listing_id=bl.id
  ), '{}') as photo_urls,
  content.hours_text,
  case when not bl.hide_street and not bl.is_service_area and bl.street_address is not null then content.address_locality else null end as address_locality,
  coalesce(content.service_area_names, '{}') as service_area_names
from app.business_listings bl
left join app.listing_categories lc on lc.listing_id = bl.id
left join app.categories c on c.id = lc.category_id
left join app.offers o on o.listing_id = bl.id and o.status = 'active'
left join app.listing_content content on content.listing_id = bl.id and content.content_status = 'approved'
where bl.publication_status = 'published'
group by bl.id, o.id, content.listing_id;
create or replace view public.directory_case_studies
with (security_invoker = true)
as
select
  cs.id,
  bl.stable_id as listing_stable_id,
  bl.current_slug as listing_slug,
  cs.slug,
  cs.title,
  cs.summary,
  cs.client_type,
  cs.client_location,
  cs.project_type,
  cs.started_on,
  cs.completed_on,
  cs.investment_range,
  cs.materials,
  cs.crew_size,
  cs.client_need,
  cs.approach,
  cs.results,
  cs.challenges,
  cs.timeline_note,
  cs.lessons,
  cs.future_plans,
  cs.metrics,
  cs.testimonial_quote,
  cs.testimonial_author,
  cs.testimonial_role,
  cs.testimonial_rating,
  case when exists(select 1 from public.directory_listing_presentation p, jsonb_array_elements(p.media) item where p.listing_id=cs.listing_id and item->>'id'=b.id::text) then b.public_path else null end as before_path,
  case when exists(select 1 from public.directory_listing_presentation p, jsonb_array_elements(p.media) item where p.listing_id=cs.listing_id and item->>'id'=a.id::text) then a.public_path else null end as after_path,
  cs.status,
  cs.is_featured,
  cs.published_at
from app.case_studies cs
join app.business_listings bl on bl.id = cs.listing_id and bl.publication_status = 'published'
join app.media_assets b on b.id = cs.before_media_id and b.status = 'approved'
join app.media_assets a on a.id = cs.after_media_id and a.status = 'approved'
where cs.status = 'published' or (cs.status = 'archived' and cs.is_featured);

revoke all on public.directory_case_studies from public;
grant select on public.directory_case_studies to anon, authenticated;

comment on view public.directory_case_studies is
  'Public case studies for published listings. Excludes client_name and every draft, pending, rejected or non-featured archived study.';

create or replace view public.directory_listing_assets
with (security_invoker = true)
as
select
  bl.stable_id as listing_stable_id,
  bl.current_slug as listing_slug,
  m.id,
  m.kind,
  m.public_path,
  m.media_type,
  m.caption,
  (select (position-1)::integer from public.directory_listing_presentation p, jsonb_array_elements(p.media) with ordinality e(item,position) where p.listing_id=m.listing_id and item->>'id'=m.id::text) as sort_order,
  bool_or(m.kind in ('logo','logo_horizontal','logo_vertical')) over (partition by m.listing_id) as has_logo
from app.media_assets m
join app.business_listings bl on bl.id = m.listing_id and bl.publication_status = 'published'
where m.status = 'approved' and exists(select 1 from public.directory_listing_presentation p, jsonb_array_elements(p.media) item where p.listing_id=m.listing_id and item->>'id'=m.id::text);

revoke all on public.directory_listing_assets from public;
grant select on public.directory_listing_assets to anon, authenticated;

comment on view public.directory_listing_assets is
  'Approved brand assets and gallery media for published listings; has_logo reports presence.';

notify pgrst,'reload schema';
commit;
