begin;
create or replace function app.pilot_workspace(requested_listing_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare role_name text := app.pilot_role(requested_listing_id);
begin
  if role_name is null then raise exception 'listing_access_forbidden'; end if;
  return jsonb_build_object('role',role_name,
    'canEdit',app.can_propose_pilot_listing(requested_listing_id),
    'editable',(select jsonb_build_object('name',bl.display_name,'description',coalesce((select lc.about from app.listing_content lc where lc.listing_id=bl.id and lc.content_status='approved'),bl.description,''),'phone',coalesce(bl.phone_e164,''),'website',coalesce(bl.website_url,''),'services',coalesce((select services from app.listing_content where listing_id=bl.id and content_status='approved'),'{}'::text[]),'baseVersion',bl.updated_at) from app.business_listings bl where bl.id=requested_listing_id),
    'proposals',coalesce((select jsonb_agg(jsonb_build_object('id',id,'status',status,'reason',reason,'createdAt',created_at,'payload',payload) order by created_at desc) from (select * from app.listing_proposals where listing_id=requested_listing_id and role_name <> 'lead_recipient' and (role_name='operator' or (role_name in ('business_owner','listing_manager') and app.can_propose_pilot_listing(requested_listing_id)) or actor_id=app.current_actor_id()) order by created_at desc limit 20) p),'[]'::jsonb));
end;
$$;

create or replace function app.submit_listing_proposal(requested_listing_id uuid, requested_payload jsonb, requested_key text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare actor uuid := app.current_actor_id(); role_name text := app.pilot_role(requested_listing_id); existing app.listing_proposals%rowtype; proposal uuid;
begin
  if not app.can_propose_pilot_listing(requested_listing_id) then raise exception 'listing_access_forbidden'; end if;
  if not exists(select 1 from app.business_listings where id=requested_listing_id and city_slug='reno') then raise exception 'outside_pilot'; end if;
  if requested_key is null or requested_key !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{7,199}$'
    or jsonb_typeof(requested_payload) is distinct from 'object'
    or requested_payload - array['name','description','phone','website','baseVersion','services'] <> '{}'::jsonb
    or coalesce(requested_payload->>'baseVersion','') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T'
    or length(coalesce(requested_payload->>'name','')) not between 2 and 200
    or length(coalesce(requested_payload->>'description','')) not between 10 and 5000
    or coalesce(requested_payload->>'phone','') !~ '^\+1[2-9][0-9]{2}[2-9][0-9]{6}$'
    or (coalesce(requested_payload->>'website','')<>'' and (requested_payload->>'website' !~ '^https://[^/@[:space:]]+(\.[^/@[:space:]]+)' or requested_payload->>'website' ~ '@'))
    then raise exception 'invalid_listing_proposal'; end if;
  if requested_payload?'services' then
    if jsonb_typeof(requested_payload->'services')<>'array' then raise exception 'invalid_listing_proposal'; end if;
    if jsonb_array_length(requested_payload->'services')>30 or exists(select 1 from jsonb_array_elements(requested_payload->'services') item where jsonb_typeof(item)<>'string' or length(trim(item#>>'{}')) not between 2 and 100) then raise exception 'invalid_listing_proposal'; end if;
  end if;
  perform pg_advisory_xact_lock(hashtextextended('proposal:'||requested_key,0));
  select * into existing from app.listing_proposals where idempotency_key=requested_key;
  if found then
    if existing.actor_id<>actor or existing.listing_id<>requested_listing_id or existing.payload<>requested_payload then raise exception 'idempotency_conflict'; end if;
    return jsonb_build_object('id',existing.id,'status',existing.status,'idempotent',true);
  end if;
  perform 1 from app.business_listings where id=requested_listing_id and updated_at=(requested_payload->>'baseVersion')::timestamptz for share;
  if not found then raise exception 'listing_changed_since_proposal'; end if;
  insert into app.listing_proposals(listing_id,actor_id,base_updated_at,payload,idempotency_key) values(requested_listing_id,actor,(requested_payload->>'baseVersion')::timestamptz,requested_payload,requested_key) returning id into proposal;
  insert into app.audit_events(actor_id,actor_kind,action,target_type,target_id,request_id) values(actor,role_name,'listing.proposed','listing_proposal',proposal::text,requested_key);
  insert into app.integration_outbox(destination,event_type,aggregate_type,aggregate_id,idempotency_key,payload)
    values('gohighlevel','listing.proposed','listing_proposal',proposal::text,'listing-proposal:'||requested_key,jsonb_build_object('proposal_id',proposal,'listing_id',requested_listing_id));
  return jsonb_build_object('id',proposal,'status','pending_review','idempotent',false);
end;
$$;

create or replace function app.decide_listing_proposal(requested_id uuid, requested_decision text, requested_reason text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare actor uuid := app.current_actor_id(); proposal app.listing_proposals%rowtype; before_values jsonb; after_values jsonb;
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
    if proposal.payload?'services' and exists(select 1 from app.listing_content where listing_id=proposal.listing_id and content_status<>'approved') then raise exception 'content_draft_requires_separate_review'; end if;
    perform 1 from app.business_listings where id=proposal.listing_id and updated_at=proposal.base_updated_at for update;
    if not found then raise exception 'listing_changed_since_proposal'; end if;
    select jsonb_build_object('listing',to_jsonb(bl),'content',(select to_jsonb(lc) from app.listing_content lc where lc.listing_id=bl.id)) into before_values from app.business_listings bl where bl.id=proposal.listing_id;
    update app.business_listings set display_name=proposal.payload->>'name', description=proposal.payload->>'description', phone_e164=proposal.payload->>'phone', website_url=nullif(proposal.payload->>'website',''), information_checked_at=null, information_checked_by=null, updated_at=clock_timestamp() where id=proposal.listing_id;
    update app.listing_content set about=proposal.payload->>'description', updated_by=actor, updated_at=clock_timestamp() where listing_id=proposal.listing_id and content_status='approved';
    if proposal.payload?'services' then
      insert into app.listing_content(listing_id,about,services,content_status,updated_by)
       values(proposal.listing_id,proposal.payload->>'description',array(select jsonb_array_elements_text(proposal.payload->'services')),'approved',actor)
       on conflict(listing_id) do update set services=excluded.services,updated_by=actor,updated_at=clock_timestamp();
    end if;
    select jsonb_build_object('listing',to_jsonb(bl),'content',(select to_jsonb(lc) from app.listing_content lc where lc.listing_id=bl.id)) into after_values from app.business_listings bl where bl.id=proposal.listing_id;
    insert into app.listing_revisions(listing_id,revision_type,before_values,after_values,reason_codes,actor_id) values(proposal.listing_id,'approved_change',before_values,after_values,array['studio-review'],actor);
  end if;
  update app.listing_proposals set status=requested_decision,reason=trim(requested_reason),decided_by=actor,decided_at=statement_timestamp() where id=proposal.id;
  insert into app.audit_events(actor_id,actor_kind,action,target_type,target_id,reason,after_ref) values(actor,'operator','listing.proposal_'||requested_decision,'listing_proposal',proposal.id::text,trim(requested_reason),jsonb_build_object('listing_id',proposal.listing_id));
  insert into app.integration_outbox(destination,event_type,aggregate_type,aggregate_id,idempotency_key,payload) values('gohighlevel','listing.proposal_'||requested_decision,'listing',proposal.listing_id::text,'proposal-decision:'||proposal.id::text,jsonb_build_object('proposal_id',proposal.id,'listing_id',proposal.listing_id));
  return jsonb_build_object('status',requested_decision,'idempotent',false);
end;
$$;

create function app.has_current_verified_owner(requested_listing_id uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from app.business_listings bl join app.listing_participations lp on lp.listing_id=bl.id join app.actors a on a.id=lp.actor_id where bl.id=requested_listing_id and bl.publication_status='published' and lp.role='business_owner' and lp.status='active' and a.status='active' and (lp.starts_at is null or lp.starts_at<=statement_timestamp()) and (lp.expires_at is null or lp.expires_at>statement_timestamp()))
$$;
revoke all on function app.has_current_verified_owner(uuid) from public;
grant execute on function app.has_current_verified_owner(uuid) to anon,authenticated,service_role;
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
  case when bl.hide_street then null else bl.street_address end as street_address,
  bl.city_slug,
  bl.region_code,
  bl.postal_code,
  bl.latitude,
  bl.longitude,
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
  ), '{}') as photo_urls
from app.business_listings bl
left join app.listing_categories lc on lc.listing_id = bl.id
left join app.categories c on c.id = lc.category_id
left join app.offers o on o.listing_id = bl.id and o.status = 'active'
left join app.listing_content content on content.listing_id = bl.id and content.content_status = 'approved'
where bl.publication_status = 'published'
group by bl.id, o.id, content.listing_id;

revoke all on public.directory_listings from public;
grant select on public.directory_listings to anon, authenticated;


commit;
