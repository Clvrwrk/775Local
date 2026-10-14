-- Local Member profiles and neighbor experiences.
-- A review never grants listing authority and never changes owner verification.

begin;

create table if not exists app.local_members (
  actor_id uuid primary key references app.actors (id),
  display_name text not null,
  handle text not null,
  town text not null default 'Reno',
  bio text not null default '',
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  constraint local_members_display_name_check check (
    char_length(display_name) between 2 and 40
    and position('@' in display_name) = 0
    and display_name !~* 'https?://'
  ),
  constraint local_members_handle_check check (
    handle ~ '^[a-z0-9](?:[a-z0-9-]{1,22}[a-z0-9])$'
  ),
  constraint local_members_town_check check (char_length(town) between 2 and 40),
  constraint local_members_bio_check check (char_length(bio) <= 280)
);

create unique index if not exists local_members_handle_key on app.local_members (handle);

create table if not exists app.experience_reviews (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references app.business_listings (id),
  member_actor_id uuid not null references app.local_members (actor_id),
  rating smallint not null,
  body text not null,
  status text not null default 'published',
  submission_idempotency_key text not null,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  constraint experience_reviews_rating_check check (rating between 1 and 5),
  constraint experience_reviews_body_check check (char_length(body) between 20 and 2000),
  constraint experience_reviews_status_check check (status in ('published', 'withdrawn')),
  constraint experience_reviews_key_check check (
    submission_idempotency_key ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{7,199}$'
  ),
  unique (listing_id, member_actor_id),
  unique (member_actor_id, submission_idempotency_key)
);

create table if not exists app.experience_photos (
  id uuid primary key default gen_random_uuid(),
  review_id uuid not null references app.experience_reviews (id) on delete cascade,
  storage_path text not null,
  sort_order smallint not null,
  created_at timestamptz not null default statement_timestamp(),
  constraint experience_photos_sort_check check (sort_order between 0 and 3),
  constraint experience_photos_path_check check (
    storage_path ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}/[0-3]\.(jpg|png|webp)$'
  ),
  unique (review_id, sort_order)
);

alter table app.local_members enable row level security;
alter table app.experience_reviews enable row level security;
alter table app.experience_photos enable row level security;

revoke all on app.local_members from public, anon, authenticated;
revoke all on app.experience_reviews from public, anon, authenticated;
revoke all on app.experience_photos from public, anon, authenticated;

insert into storage.buckets (
  id, name, public, file_size_limit, allowed_mime_types, type, versioning_status
)
values (
  'member-photos',
  'member-photos',
  true,
  900000,
  array['image/jpeg', 'image/png', 'image/webp'],
  'STANDARD',
  'DISABLED'
)
on conflict (id) do nothing;

create or replace function app.local_member_payload(member app.local_members)
returns jsonb
language sql
stable
security definer
set search_path = app, public
as $$
  select jsonb_build_object(
    'displayName', member.display_name,
    'handle', member.handle,
    'town', member.town,
    'bio', member.bio,
    'memberSince', member.created_at
  );
$$;

revoke all on function app.local_member_payload(app.local_members) from public, anon, authenticated;

create or replace function app.experience_payload(review_row app.experience_reviews)
returns jsonb
language sql
stable
security definer
set search_path = app, public
as $$
  select jsonb_build_object(
    'reviewId', review_row.id,
    'listingId', review_row.listing_id,
    'listingSlug', listing.current_slug,
    'listingName', listing.display_name,
    'rating', review_row.rating,
    'body', review_row.body,
    'status', review_row.status,
    'createdAt', review_row.created_at,
    'photoPaths', coalesce(
      (
        select jsonb_agg(photo.storage_path order by photo.sort_order)
        from app.experience_photos photo
        where photo.review_id = review_row.id
      ),
      '[]'::jsonb
    )
  )
  from app.business_listings listing
  where listing.id = review_row.listing_id;
$$;

revoke all on function app.experience_payload(app.experience_reviews) from public, anon, authenticated;

create or replace function public.save_local_member(
  requested_display_name text,
  requested_handle text,
  requested_town text,
  requested_bio text
) returns jsonb
language plpgsql
security definer
set search_path = app, public
as $$
declare
  actor uuid := app.current_actor_id();
  clean_name text := trim(requested_display_name);
  clean_handle text := lower(trim(requested_handle));
  clean_town text := trim(requested_town);
  clean_bio text := trim(coalesce(requested_bio, ''));
  saved app.local_members;
begin
  if actor is null then
    raise exception 'authenticated actor projection is required';
  end if;
  if clean_name is null
    or char_length(clean_name) < 2
    or char_length(clean_name) > 40
    or position('@' in clean_name) > 0
    or clean_name ~* 'https?://'
    or clean_handle !~ '^[a-z0-9](?:[a-z0-9-]{1,22}[a-z0-9])$'
    or char_length(clean_town) < 2
    or char_length(clean_town) > 40
    or char_length(clean_bio) > 280
  then
    raise exception 'invalid local member profile';
  end if;

  insert into app.local_members (actor_id, display_name, handle, town, bio)
  values (actor, clean_name, clean_handle, clean_town, clean_bio)
  on conflict (actor_id) do update
    set display_name = excluded.display_name,
        handle = excluded.handle,
        town = excluded.town,
        bio = excluded.bio,
        updated_at = statement_timestamp()
  returning * into saved;

  return app.local_member_payload(saved);
exception
  when unique_violation then
    raise exception 'local member handle is taken';
end;
$$;

create or replace function public.get_my_local_member()
returns jsonb
language plpgsql
stable
security definer
set search_path = app, public
as $$
declare
  actor uuid := app.current_actor_id();
  member app.local_members;
  experiences jsonb;
begin
  if actor is null then
    raise exception 'authenticated actor projection is required';
  end if;
  select * into member from app.local_members where actor_id = actor;
  select coalesce(jsonb_agg(app.experience_payload(review_row) order by review_row.created_at desc), '[]'::jsonb)
    into experiences
  from app.experience_reviews review_row
  where review_row.member_actor_id = actor
    and review_row.status = 'published';
  return jsonb_build_object(
    'profile', case when member.actor_id is null then null else app.local_member_payload(member) end,
    'experiences', experiences
  );
end;
$$;

create or replace function public.local_member_page(requested_handle text)
returns jsonb
language plpgsql
stable
security definer
set search_path = app, public
as $$
declare
  member app.local_members;
  experiences jsonb;
begin
  if requested_handle !~ '^[a-z0-9](?:[a-z0-9-]{1,22}[a-z0-9])$' then
    return null;
  end if;
  select * into member from app.local_members where handle = requested_handle;
  if member.actor_id is null then
    return null;
  end if;
  select coalesce(jsonb_agg(app.experience_payload(review_row) order by review_row.created_at desc), '[]'::jsonb)
    into experiences
  from app.experience_reviews review_row
  where review_row.member_actor_id = member.actor_id
    and review_row.status = 'published';
  return app.local_member_payload(member) || jsonb_build_object('experiences', experiences);
end;
$$;

create or replace function public.listing_experiences(requested_slug text)
returns jsonb
language plpgsql
stable
security definer
set search_path = app, public
as $$
declare
  experiences jsonb;
begin
  if requested_slug !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' then
    return '[]'::jsonb;
  end if;
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', review_row.id,
        'author', member.display_name,
        'handle', member.handle,
        'town', member.town,
        'rating', review_row.rating,
        'body', review_row.body,
        'createdAt', review_row.created_at,
        'photoPaths', coalesce(
          (
            select jsonb_agg(photo.storage_path order by photo.sort_order)
            from app.experience_photos photo
            where photo.review_id = review_row.id
          ),
          '[]'::jsonb
        )
      )
      order by review_row.created_at desc
    ),
    '[]'::jsonb
  )
    into experiences
  from app.experience_reviews review_row
  join app.local_members member on member.actor_id = review_row.member_actor_id
  join app.business_listings listing on listing.id = review_row.listing_id
  where listing.current_slug = requested_slug
    and listing.publication_status = 'published'
    and review_row.status = 'published';
  return experiences;
end;
$$;

create or replace function public.submit_experience(
  requested_listing_id uuid,
  requested_rating integer,
  requested_body text,
  requested_idempotency_key text
) returns jsonb
language plpgsql
security definer
set search_path = app, public
as $$
declare
  actor uuid := app.current_actor_id();
  clean_body text := trim(requested_body);
  existing app.experience_reviews;
  saved app.experience_reviews;
  listing_ok boolean;
begin
  if actor is null then
    raise exception 'authenticated actor projection is required';
  end if;
  if not exists (select 1 from app.local_members where actor_id = actor) then
    raise exception 'local member profile is required';
  end if;
  if requested_rating is null or requested_rating < 1 or requested_rating > 5
    or clean_body is null
    or char_length(clean_body) < 20
    or char_length(clean_body) > 2000
    or requested_idempotency_key !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{7,199}$'
  then
    raise exception 'invalid experience';
  end if;

  select true into listing_ok
  from app.business_listings
  where id = requested_listing_id
    and publication_status = 'published';
  if listing_ok is not true then
    raise exception 'listing is not open for experiences';
  end if;

  select * into existing
  from app.experience_reviews
  where listing_id = requested_listing_id
    and member_actor_id = actor;

  if existing.id is not null
    and existing.submission_idempotency_key = requested_idempotency_key
  then
    if existing.rating = requested_rating
      and existing.body = clean_body
      and existing.status = 'published'
    then
      return app.experience_payload(existing) || jsonb_build_object('idempotent', true);
    end if;
    raise exception 'experience idempotency conflict';
  end if;

  if existing.id is null then
    insert into app.experience_reviews (
      listing_id, member_actor_id, rating, body, status, submission_idempotency_key
    )
    values (requested_listing_id, actor, requested_rating, clean_body, 'published', requested_idempotency_key)
    returning * into saved;
  else
    update app.experience_reviews
      set rating = requested_rating,
          body = clean_body,
          status = 'published',
          submission_idempotency_key = requested_idempotency_key,
          updated_at = statement_timestamp()
      where id = existing.id
      returning * into saved;
  end if;

  insert into app.audit_events (actor_id, actor_kind, action, target_type, target_id, reason)
  values (
    actor,
    'resident',
    'experience.submitted',
    'experience_review',
    saved.id::text,
    'Local Member published an experience'
  );

  return app.experience_payload(saved) || jsonb_build_object('idempotent', false);
end;
$$;

create or replace function public.withdraw_experience(requested_listing_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = app, public
as $$
declare
  actor uuid := app.current_actor_id();
  saved app.experience_reviews;
begin
  if actor is null then
    raise exception 'authenticated actor projection is required';
  end if;
  update app.experience_reviews
    set status = 'withdrawn',
        updated_at = statement_timestamp()
    where listing_id = requested_listing_id
      and member_actor_id = actor
      and status = 'published'
    returning * into saved;
  if saved.id is null then
    raise exception 'experience was not found';
  end if;
  insert into app.audit_events (actor_id, actor_kind, action, target_type, target_id, reason)
  values (
    actor,
    'resident',
    'experience.withdrawn',
    'experience_review',
    saved.id::text,
    'Local Member withdrew an experience'
  );
  return jsonb_build_object('reviewId', saved.id, 'status', saved.status);
end;
$$;

create or replace function public.prepare_experience_photo(
  requested_review_id uuid,
  requested_sort integer,
  requested_ext text
) returns text
language plpgsql
security definer
set search_path = app, public
as $$
declare
  actor uuid := app.current_actor_id();
  owned uuid;
begin
  if actor is null then
    raise exception 'authenticated actor projection is required';
  end if;
  if requested_sort is null or requested_sort < 0 or requested_sort > 3
    or requested_ext not in ('jpg', 'png', 'webp')
  then
    raise exception 'invalid experience photo';
  end if;
  select id into owned
  from app.experience_reviews
  where id = requested_review_id
    and member_actor_id = actor
    and status = 'published';
  if owned is null then
    raise exception 'experience was not found';
  end if;
  return actor::text || '/' || owned::text || '/' || requested_sort::text || '.' || requested_ext;
end;
$$;

create or replace function public.register_experience_photo(
  requested_review_id uuid,
  requested_path text
) returns jsonb
language plpgsql
security definer
set search_path = app, public
as $$
declare
  actor uuid := app.current_actor_id();
  expected_prefix text;
  photo_sort integer;
  saved_path text;
begin
  if actor is null then
    raise exception 'authenticated actor projection is required';
  end if;
  if not exists (
    select 1 from app.experience_reviews
    where id = requested_review_id
      and member_actor_id = actor
      and status = 'published'
  ) then
    raise exception 'experience was not found';
  end if;
  expected_prefix := actor::text || '/' || requested_review_id::text || '/';
  if requested_path !~ '^[0-9a-f-]{36}/[0-9a-f-]{36}/[0-3]\.(jpg|png|webp)$'
    or left(requested_path, char_length(expected_prefix)) <> expected_prefix
  then
    raise exception 'invalid experience photo';
  end if;
  photo_sort := substring(requested_path from '/([0-3])\.')::integer;
  insert into app.experience_photos (review_id, storage_path, sort_order)
  values (requested_review_id, requested_path, photo_sort)
  on conflict (review_id, sort_order) do update
    set storage_path = excluded.storage_path
  returning storage_path into saved_path;
  return jsonb_build_object('storagePath', saved_path, 'sortOrder', photo_sort);
end;
$$;

revoke all on function public.save_local_member(text, text, text, text) from public, anon;
revoke all on function public.get_my_local_member() from public, anon;
revoke all on function public.submit_experience(uuid, integer, text, text) from public, anon;
revoke all on function public.withdraw_experience(uuid) from public, anon;
revoke all on function public.prepare_experience_photo(uuid, integer, text) from public, anon;
revoke all on function public.register_experience_photo(uuid, text) from public, anon;
revoke all on function public.local_member_page(text) from public;
revoke all on function public.listing_experiences(text) from public;

grant execute on function public.save_local_member(text, text, text, text) to authenticated;
grant execute on function public.get_my_local_member() to authenticated;
grant execute on function public.submit_experience(uuid, integer, text, text) to authenticated;
grant execute on function public.withdraw_experience(uuid) to authenticated;
grant execute on function public.prepare_experience_photo(uuid, integer, text) to authenticated;
grant execute on function public.register_experience_photo(uuid, text) to authenticated;
grant execute on function public.local_member_page(text) to anon, authenticated;
grant execute on function public.listing_experiences(text) to anon, authenticated;

commit;
