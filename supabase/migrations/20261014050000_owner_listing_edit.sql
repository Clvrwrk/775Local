begin;

-- The claimant edits the public Reno listing they own.
-- Name, website, category, and Featured stay on the operator review path.
-- Photos stay on the business-image commands.

create table app.owned_listing_edits (
  id uuid primary key default extensions.gen_random_uuid(),
  listing_id uuid not null references app.business_listings(id),
  actor_id uuid not null references app.actors(id),
  idempotency_key text not null unique,
  description text not null,
  phone_e164 text not null,
  hours_text text not null,
  created_at timestamptz not null default statement_timestamp()
);
alter table app.owned_listing_edits enable row level security;
revoke all on app.owned_listing_edits from public, anon, authenticated, service_role;

create or replace function app.pilot_workspace(requested_listing_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare role_name text := app.pilot_role(requested_listing_id);
begin
  if role_name is null then raise exception 'listing_access_forbidden'; end if;
  return jsonb_build_object('role',role_name,
    'canEdit',app.can_propose_pilot_listing(requested_listing_id),
    'editable',(select jsonb_build_object(
      'name',bl.display_name,
      'description',coalesce((select lc.about from app.listing_content lc where lc.listing_id=bl.id and lc.content_status='approved'),bl.description,''),
      'phone',coalesce(bl.phone_e164,''),
      'hours',coalesce((select lc.hours_text from app.listing_content lc where lc.listing_id=bl.id and lc.content_status='approved'),''),
      'website',coalesce(bl.website_url,''),
      'services',coalesce((select services from app.listing_content where listing_id=bl.id and content_status='approved'),'{}'::text[]),
      'baseVersion',bl.updated_at
    ) from app.business_listings bl where bl.id=requested_listing_id),
    'proposals',coalesce((select jsonb_agg(jsonb_build_object('id',id,'status',status,'reason',reason,'createdAt',created_at,'payload',payload) order by created_at desc) from (select * from app.listing_proposals where listing_id=requested_listing_id and role_name <> 'lead_recipient' and (role_name='operator' or (role_name in ('business_owner','listing_manager') and app.can_propose_pilot_listing(requested_listing_id)) or actor_id=app.current_actor_id()) order by created_at desc limit 20) p),'[]'::jsonb));
end;
$$;

create function app.apply_owned_listing_edit(
  requested_listing_id uuid,
  requested_edit jsonb,
  requested_key text
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := app.current_actor_id();
  existing app.owned_listing_edits%rowtype;
  listing app.business_listings%rowtype;
  description_value text;
  phone_value text;
  hours_value text;
begin
  if actor is null then
    raise exception 'authentication_required';
  end if;
  if app.pilot_role(requested_listing_id) is distinct from 'business_owner' then
    raise exception 'listing_access_forbidden';
  end if;
  if requested_key is null or requested_key !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{7,199}$'
     or jsonb_typeof(requested_edit) is distinct from 'object'
     or requested_edit - array['description','phone','hours'] <> '{}'::jsonb then
    raise exception 'invalid_owned_listing_edit';
  end if;
  description_value := btrim(requested_edit->>'description');
  phone_value := btrim(requested_edit->>'phone');
  hours_value := btrim(requested_edit->>'hours');
  if length(description_value) not between 10 and 5000
     or phone_value !~ '^\+1[2-9][0-9]{2}[2-9][0-9]{6}$'
     or length(hours_value) not between 3 and 400 then
    raise exception 'invalid_owned_listing_edit';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('owned-edit:'||requested_key, 0));
  select * into existing from app.owned_listing_edits where idempotency_key = requested_key;
  if found then
    if existing.actor_id <> actor
       or existing.listing_id <> requested_listing_id
       or existing.description <> description_value
       or existing.phone_e164 <> phone_value
       or existing.hours_text <> hours_value then
      raise exception 'idempotency_conflict';
    end if;
    return jsonb_build_object('id', existing.id, 'idempotent', true);
  end if;

  select * into listing
  from app.business_listings
  where id = requested_listing_id
    and city_slug = 'reno'
    and publication_status = 'published'
  for update;
  if not found then
    raise exception 'listing_access_forbidden';
  end if;

  update app.business_listings
  set description = description_value,
      phone_e164 = phone_value,
      information_checked_at = statement_timestamp(),
      information_checked_by = actor,
      updated_at = statement_timestamp()
  where id = listing.id;

  insert into app.listing_content as content (
    listing_id, about, hours_text, content_status, updated_by
  ) values (
    listing.id, description_value, hours_value, 'approved', actor
  )
  on conflict (listing_id) do update
  set about = excluded.about,
      hours_text = excluded.hours_text,
      content_status = 'approved',
      updated_by = excluded.updated_by,
      updated_at = statement_timestamp();

  insert into app.owned_listing_edits (
    listing_id, actor_id, idempotency_key, description, phone_e164, hours_text
  ) values (
    listing.id, actor, requested_key, description_value, phone_value, hours_value
  ) returning * into existing;

  insert into app.audit_events (
    actor_id, actor_kind, action, target_type, target_id, request_id, after_ref
  ) values (
    actor,
    'business_owner',
    'listing.owner_edited',
    'business_listing',
    listing.id::text,
    requested_key,
    jsonb_build_object('edit_id', existing.id)
  );

  return jsonb_build_object('id', existing.id, 'idempotent', false);
end;
$$;

revoke all on function app.apply_owned_listing_edit(uuid, jsonb, text)
  from public, anon, authenticated, service_role;

create function public.apply_owned_listing_edit(
  requested_listing_id uuid,
  requested_edit jsonb,
  requested_key text
) returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select app.apply_owned_listing_edit(requested_listing_id, requested_edit, requested_key)
$$;

revoke all on function public.apply_owned_listing_edit(uuid, jsonb, text)
  from public, anon, service_role;
grant execute on function public.apply_owned_listing_edit(uuid, jsonb, text) to authenticated;

commit;
