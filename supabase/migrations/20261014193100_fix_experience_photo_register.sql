-- The first register function named its local variable sort_order, which is also
-- the column. Postgres then refused the insert with "column reference sort_order
-- is ambiguous", so the file landed in storage and the public page had no photo.

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

revoke all on function public.register_experience_photo(uuid, text) from public, anon;
grant execute on function public.register_experience_photo(uuid, text) to authenticated;
