begin;

-- Forward only: existing rows retain unknown physical locality/service areas.
alter table app.listing_content
  add column address_locality text check (address_locality is null or address_locality in ('Reno','Sparks')),
  add column service_area_names text[] not null default '{}';

create table app.reviewed_listing_correction_receipts (
  id uuid primary key default extensions.gen_random_uuid(),
  listing_id uuid not null references app.business_listings(id),
  actor_id uuid not null references app.actors(id),
  idempotency_key text not null unique,
  request_fingerprint text not null,
  before_version text not null,
  after_version text not null,
  before_values jsonb not null,
  after_values jsonb not null,
  field_provenance jsonb not null,
  reason text not null,
  reverts_receipt_id uuid unique references app.reviewed_listing_correction_receipts(id),
  created_at timestamptz not null default statement_timestamp()
);
create index reviewed_listing_correction_listing_idx on app.reviewed_listing_correction_receipts(listing_id,created_at desc);
create trigger reviewed_listing_corrections_append_only before update or delete
  on app.reviewed_listing_correction_receipts for each row execute function private.reject_mutation();
alter table app.reviewed_listing_correction_receipts enable row level security;
revoke all on app.reviewed_listing_correction_receipts from public,anon,authenticated,service_role;
grant select on app.reviewed_listing_correction_receipts to authenticated,service_role;
create policy correction_operator_read on app.reviewed_listing_correction_receipts
  for select to authenticated using (app.is_operator());

create function private.require_listing_correction_operator() returns uuid
language plpgsql security definer set search_path='' as $$
declare actor uuid := app.current_actor_id();
begin
  if not app.operator_recent_auth(900) then raise exception 'reauth_required'; end if;
  if actor is null or not exists(select 1 from app.operator_grants
    where actor_id=actor and status='active' and permissions @> array['listing_review','listing_publish'])
    then raise exception 'correction_forbidden'; end if;
  return actor;
end;
$$;

create function private.listing_correction_values(requested_listing_id uuid) returns jsonb
language sql volatile set search_path='' as $$
 select jsonb_build_object(
   'display_name',bl.display_name,'description',bl.description,'phone_e164',bl.phone_e164,
   'street_address',bl.street_address,'postal_code',bl.postal_code,
   'latitude',bl.latitude,'longitude',bl.longitude,
   'hide_street',bl.hide_street,'is_service_area',bl.is_service_area,
   'hours_text',lc.hours_text,'content_about',lc.about,'services',to_jsonb(lc.services),
   'address_locality',lc.address_locality,'service_area_names',to_jsonb(lc.service_area_names))
 from app.business_listings bl join app.listing_content lc on lc.listing_id=bl.id
 where bl.id=requested_listing_id and bl.publication_status='published' and lc.content_status='approved';
$$;

create function private.listing_correction_version(requested_listing_id uuid) returns text
language sql volatile set search_path='' as $$
 select encode(extensions.digest(jsonb_build_object('values',private.listing_correction_values(bl.id),
   'listing_updated_at',bl.updated_at,'content_updated_at',lc.updated_at,
   'publication_status',bl.publication_status,'content_status',lc.content_status,
   'content_tier',bl.content_tier,'owner_verified_at',bl.owner_verified_at,
   'information_checked_at',bl.information_checked_at)::text,'sha256'),'hex')
 from app.business_listings bl join app.listing_content lc on lc.listing_id=bl.id where bl.id=requested_listing_id;
$$;

create function public.listing_correction_snapshot(requested_listing_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
  perform private.require_listing_correction_operator();
  select jsonb_build_object('listing_id',bl.id,'slug',bl.current_slug,
    'domain',lower(regexp_replace(split_part(bl.website_url,'/',3),'^www\.','','i')),
    'version',private.listing_correction_version(bl.id),'values',private.listing_correction_values(bl.id))
    into result from app.business_listings bl where bl.id=requested_listing_id
      and bl.city_slug in ('reno','sparks') and private.listing_correction_values(bl.id) is not null;
  if result is null then raise exception 'correction_listing_unavailable'; end if;
  return result;
end;
$$;

create function private.apply_listing_correction(
  requested_listing_id uuid, requested_correction jsonb, requested_key text,
  requested_revert_id uuid default null
) returns jsonb language plpgsql security definer set search_path='' as $$
declare
  actor uuid := private.require_listing_correction_operator();
  bl app.business_listings%rowtype;
  receipt app.reviewed_listing_correction_receipts%rowtype;
  prior app.reviewed_listing_correction_receipts%rowtype;
  fingerprint text; before_value jsonb; after_value jsonb; changes jsonb;
  provenance jsonb; evidence jsonb; field_name text; checked timestamptz;
  before_version text; after_version text; receipt_id uuid;
  domain_value text; source_host text; identity_changed boolean; location_changed boolean;
  allowed_fields text[] := array['display_name','description','phone_e164','street_address','postal_code','hide_street','is_service_area','hours_text','services','address_locality','service_area_names'];
begin
  if requested_listing_id is null or requested_key is null or requested_key !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{7,199}$'
    or jsonb_typeof(requested_correction) is distinct from 'object' or octet_length(requested_correction::text)>32768 then raise exception 'invalid_listing_correction'; end if;
  fingerprint := encode(extensions.digest(jsonb_build_object('listing',requested_listing_id,
    'correction',requested_correction,'revert',requested_revert_id)::text,'sha256'),'hex');
  perform pg_advisory_xact_lock(hashtextextended('listing-correction:'||requested_key,0));
  select * into receipt from app.reviewed_listing_correction_receipts where idempotency_key=requested_key;
  if found then
    if receipt.actor_id<>actor or receipt.request_fingerprint<>fingerprint then raise exception 'idempotency_conflict'; end if;
    return jsonb_build_object('receiptId',receipt.id,'version',receipt.after_version,'idempotent',true);
  end if;
  select * into bl from app.business_listings where id=requested_listing_id for update;
  if not found or bl.city_slug not in ('reno','sparks') or bl.publication_status<>'published'
    then raise exception 'correction_listing_unavailable'; end if;
  perform 1 from app.listing_content where listing_id=bl.id and content_status='approved' for update;
  if not found then raise exception 'correction_listing_unavailable'; end if;
  before_value := private.listing_correction_values(bl.id);
  before_version := private.listing_correction_version(bl.id);
  domain_value := lower(regexp_replace(split_part(bl.website_url,'/',3),'^www\.','','i'));
  if requested_revert_id is not null then
    if requested_correction - array['expectedVersion','reason'] <> '{}'::jsonb then raise exception 'invalid_listing_correction'; end if;
    select * into prior from app.reviewed_listing_correction_receipts where id=requested_revert_id and listing_id=bl.id;
    if not found then raise exception 'correction_receipt_unavailable'; end if;
    if prior.reverts_receipt_id is not null or exists(select 1 from app.reviewed_listing_correction_receipts where reverts_receipt_id=prior.id)
      then raise exception 'correction_already_rolled_back'; end if;
    if before_version<>prior.after_version then raise exception 'listing_changed_since_correction'; end if;
    changes := prior.before_values;
    provenance := jsonb_build_object('rollbackReceiptId',prior.id);
  else
    if not requested_correction ?& array['expectedVersion','expectedSlug','expectedDomain','changes','fieldProvenance','reason']
      or requested_correction - array['expectedVersion','expectedSlug','expectedDomain','changes','fieldProvenance','reason'] <> '{}'::jsonb
      then raise exception 'invalid_listing_correction'; end if;
    if requested_correction->>'expectedSlug' is distinct from bl.current_slug or requested_correction->>'expectedDomain' is distinct from domain_value
      then raise exception 'correction_identity_conflict'; end if;
    changes := requested_correction->'changes'; provenance := requested_correction->'fieldProvenance';
    if jsonb_typeof(changes) is distinct from 'object' or changes='{}'::jsonb or jsonb_typeof(provenance) is distinct from 'object'
      or changes - allowed_fields <> '{}'::jsonb or provenance - array(select jsonb_object_keys(changes)) <> '{}'::jsonb
      then raise exception 'invalid_listing_correction'; end if;
    for field_name in select jsonb_object_keys(changes) loop
      evidence := provenance->field_name;
      if jsonb_typeof(evidence) is distinct from 'object'
        or not evidence ?& array['state','url','artifactSha256','checkedAt','reason']
        or evidence - array['state','url','artifactSha256','checkedAt','reason'] <> '{}'::jsonb
        or coalesce(evidence->>'state','') not in ('verified','unknown')
        or coalesce(evidence->>'artifactSha256','') !~ '^[a-f0-9]{64}$'
        or jsonb_typeof(evidence->'checkedAt') is distinct from 'string'
        or length(coalesce(evidence->>'reason','')) not between 3 and 500
        or length(coalesce(evidence->>'url',''))>2000
        or coalesce(evidence->>'url','') !~ '^https://[a-z0-9][a-z0-9.-]*[a-z0-9](/[a-zA-Z0-9/_.~-]*)?$'
        then raise exception 'invalid_correction_provenance'; end if;
      source_host := lower(regexp_replace(split_part(evidence->>'url','/',3),'^www\.','','i'));
      if source_host<>domain_value then raise exception 'correction_source_identity_conflict'; end if;
      begin checked := (evidence->>'checkedAt')::timestamptz;
      exception when others then raise exception 'invalid_correction_provenance'; end;
      if checked>statement_timestamp()+interval '5 minutes' or checked<statement_timestamp()-interval '30 days'
        then raise exception 'correction_evidence_expired'; end if;
      if evidence->>'state'='unknown' and changes->field_name<>'null'::jsonb
        and not(field_name='service_area_names' and changes->field_name='[]'::jsonb)
        then raise exception 'invalid_correction_unknown'; end if;
      if evidence->>'state'='verified' and changes->field_name='null'::jsonb then raise exception 'invalid_correction_unknown'; end if;
    end loop;
  end if;
  if requested_correction->>'expectedVersion' is distinct from before_version then raise exception 'listing_changed_since_correction'; end if;
  if length(coalesce(requested_correction->>'reason','')) not between 3 and 500 or requested_correction->>'reason' ~ '[[:cntrl:]]'
    then raise exception 'invalid_listing_correction'; end if;
  after_value := before_value || changes;
  if jsonb_typeof(after_value->'display_name') is distinct from 'string' or length(btrim(after_value->>'display_name')) not between 2 and 200
    or (after_value->>'display_name') ~ '[[:cntrl:]]'
    or (after_value->'description'<>'null'::jsonb and (jsonb_typeof(after_value->'description')<>'string' or length(after_value->>'description') not between 10 and 5000))
    or (after_value->'phone_e164'<>'null'::jsonb and (jsonb_typeof(after_value->'phone_e164')<>'string' or after_value->>'phone_e164' !~ '^\+1[2-9][0-9]{2}[2-9][0-9]{6}$'))
    or jsonb_typeof(after_value->'hide_street') is distinct from 'boolean' or jsonb_typeof(after_value->'is_service_area') is distinct from 'boolean'
    or (after_value->'street_address'<>'null'::jsonb and (jsonb_typeof(after_value->'street_address')<>'string' or length(after_value->>'street_address') not between 2 and 300 or after_value->>'street_address' ~ '[[:cntrl:]]'))
    or (after_value->'postal_code'<>'null'::jsonb and (jsonb_typeof(after_value->'postal_code')<>'string' or after_value->>'postal_code' !~ '^89[0-9]{3}$'))
    or (after_value->'hours_text'<>'null'::jsonb and (jsonb_typeof(after_value->'hours_text')<>'string' or length(btrim(after_value->>'hours_text')) not between 1 and 300 or after_value->>'hours_text' ~ '[[:cntrl:]]'))
    or (after_value->'address_locality'<>'null'::jsonb and after_value->>'address_locality' not in ('Reno','Sparks'))
    or jsonb_typeof(after_value->'services') is distinct from 'array' or jsonb_typeof(after_value->'service_area_names') is distinct from 'array'
    then raise exception 'invalid_listing_correction'; end if;
  if jsonb_array_length(after_value->'services')>20 or exists(select 1 from jsonb_array_elements(after_value->'services') v where jsonb_typeof(v)<>'string' or length(v#>>'{}') not between 2 and 100 or v#>>'{}' ~ '[[:cntrl:]]')
    or jsonb_array_length(after_value->'service_area_names')>20 or exists(select 1 from jsonb_array_elements(after_value->'service_area_names') v where jsonb_typeof(v)<>'string' or length(v#>>'{}') not between 2 and 100 or v#>>'{}' ~ '[[:cntrl:]]')
    then raise exception 'invalid_listing_correction'; end if;
  if (after_value->>'hide_street')::boolean or (after_value->>'is_service_area')::boolean or after_value->'street_address'='null'::jsonb then
    if after_value->'address_locality'<>'null'::jsonb then raise exception 'correction_address_not_public'; end if;
  end if;
  if requested_revert_id is null
    and (bl.hide_street or (bl.is_service_area and not(after_value->>'is_service_area')::boolean))
    and not(after_value->>'hide_street')::boolean
    and not changes ?& array['street_address','postal_code','address_locality'] then raise exception 'correction_address_evidence_required'; end if;
  select exists(select 1 from unnest(array['display_name','phone_e164','street_address','postal_code','hide_street','address_locality']) f where before_value->f is distinct from after_value->f) into identity_changed;
  -- Coordinates have no independent reviewed-evidence input in this command.
  -- Any address/privacy-mode change invalidates them, including rollback. Retain
  -- old coordinates only in the private receipt, never republish from a receipt.
  select exists(select 1 from unnest(array['street_address','postal_code','address_locality','hide_street','is_service_area']) f where before_value->f is distinct from after_value->f) into location_changed;
  update app.business_listings set display_name=after_value->>'display_name',description=after_value->>'description',phone_e164=after_value->>'phone_e164',
    street_address=after_value->>'street_address',postal_code=after_value->>'postal_code',hide_street=(after_value->>'hide_street')::boolean,is_service_area=(after_value->>'is_service_area')::boolean,
    latitude=case when location_changed then null else latitude end,
    longitude=case when location_changed then null else longitude end,
    information_checked_at=case when identity_changed then null else information_checked_at end,
    information_checked_by=case when identity_changed then null else information_checked_by end,
    updated_at=clock_timestamp() where id=bl.id;
  update app.listing_content set about=case when requested_revert_id is not null then after_value->>'content_about' when changes ? 'description' then after_value->>'description' else about end,hours_text=after_value->>'hours_text',address_locality=after_value->>'address_locality',
    services=array(select jsonb_array_elements_text(after_value->'services')),service_area_names=array(select jsonb_array_elements_text(after_value->'service_area_names')),
    updated_by=actor,updated_at=clock_timestamp() where listing_id=bl.id;
  after_value := private.listing_correction_values(bl.id);
  after_version := private.listing_correction_version(bl.id);
  insert into app.reviewed_listing_correction_receipts(listing_id,actor_id,idempotency_key,request_fingerprint,before_version,after_version,before_values,after_values,field_provenance,reason,reverts_receipt_id)
    values(bl.id,actor,requested_key,fingerprint,before_version,after_version,before_value,after_value,provenance,requested_correction->>'reason',requested_revert_id) returning id into receipt_id;
  insert into app.listing_revisions(listing_id,revision_type,before_values,after_values,reason_codes,actor_id)
    values(bl.id,'approved_change',before_value,after_value,array[case when requested_revert_id is null then 'reviewed-correction' else 'reviewed-correction-rollback' end],actor);
  insert into app.audit_events(actor_id,actor_kind,action,target_type,target_id,request_id,reason,after_ref)
    values(actor,'operator',case when requested_revert_id is null then 'listing.corrected' else 'listing.correction_rolled_back' end,'listing',bl.id::text,requested_key,requested_correction->>'reason',jsonb_build_object('receipt_id',receipt_id));
  -- No external-delivery event: provider projection remains held until separately accepted.
  return jsonb_build_object('receiptId',receipt_id,'version',after_version,'idempotent',false);
end;
$$;

create function public.apply_reviewed_listing_correction(requested_listing_id uuid,requested_correction jsonb,requested_key text)
returns jsonb language sql security definer set search_path='' as $$ select private.apply_listing_correction(requested_listing_id,requested_correction,requested_key) $$;
create function public.rollback_reviewed_listing_correction(requested_listing_id uuid,requested_receipt_id uuid,requested_expected_version text,requested_reason text,requested_key text)
returns jsonb language sql security definer set search_path='' as $$ select private.apply_listing_correction(requested_listing_id,jsonb_build_object('expectedVersion',requested_expected_version,'reason',requested_reason),requested_key,requested_receipt_id) $$;

revoke all on function private.require_listing_correction_operator(),private.listing_correction_values(uuid),private.listing_correction_version(uuid),private.apply_listing_correction(uuid,jsonb,text,uuid) from public,anon,authenticated,service_role;
revoke all on function public.listing_correction_snapshot(uuid),public.apply_reviewed_listing_correction(uuid,jsonb,text),public.rollback_reviewed_listing_correction(uuid,uuid,text,text,text) from public,anon,authenticated,service_role;
grant execute on function public.listing_correction_snapshot(uuid),public.apply_reviewed_listing_correction(uuid,jsonb,text),public.rollback_reviewed_listing_correction(uuid,uuid,text,text,text) to authenticated;

-- Preserve projection order/ACL/security-invoker; append only reviewed fields.
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
  coalesce(content.projects, '[]'::jsonb) as projects,
  coalesce((
    select array_agg(ma.public_path order by ma.created_at)
    from app.media_assets ma
    where ma.listing_id = bl.id and ma.status = 'approved' and ma.kind = 'image'
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




notify pgrst,'reload schema';
commit;
