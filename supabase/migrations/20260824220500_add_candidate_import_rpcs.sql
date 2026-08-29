begin;

create function public.ingest_listing_candidates(
  requested_batch_id uuid,
  requested_candidates jsonb
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  inserted_count integer;
begin
  if requested_batch_id is null or not exists (
    select 1 from private.source_batches where id = requested_batch_id
  ) then
    raise exception 'source batch does not exist';
  end if;
  if jsonb_typeof(requested_candidates) <> 'array'
     or jsonb_array_length(requested_candidates) < 1
     or jsonb_array_length(requested_candidates) > 500 then
    raise exception 'candidates must be a JSON array containing 1 to 500 records';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(requested_candidates) as candidate(
      worksheet text,
      source_row integer,
      normalized_name text,
      proposed_slug text,
      phone_e164 text,
      business_email text,
      website_url text,
      street_address text,
      city_slug text,
      postal_code text,
      latitude numeric,
      longitude numeric,
      google_place_id text,
      source_category text,
      launch_category_slug text,
      active_profile_status text,
      screening_status text,
      screening_reasons jsonb,
      quality_score numeric,
      diversity_key text,
      evidence jsonb
    )
    left join private.source_listing_rows source
      on source.batch_id = requested_batch_id
      and source.worksheet = candidate.worksheet
      and source.source_row = candidate.source_row
    where source.id is null
      or jsonb_typeof(candidate.screening_reasons) <> 'array'
      or jsonb_typeof(candidate.evidence) <> 'object'
  ) then
    raise exception 'one or more candidates are invalid or lack a source row';
  end if;

  insert into app.listing_candidates (
    batch_id,
    source_row_id,
    source_business_id,
    normalized_name,
    proposed_slug,
    phone_e164,
    business_email,
    website_url,
    street_address,
    city_slug,
    postal_code,
    latitude,
    longitude,
    google_place_id,
    source_category,
    launch_category_slug,
    active_profile_status,
    screening_status,
    screening_reasons,
    quality_score,
    diversity_key,
    evidence
  )
  select
    requested_batch_id,
    source.id,
    source.source_business_id,
    trim(candidate.normalized_name),
    candidate.proposed_slug,
    nullif(candidate.phone_e164, ''),
    nullif(lower(candidate.business_email), ''),
    nullif(candidate.website_url, ''),
    nullif(candidate.street_address, ''),
    candidate.city_slug,
    candidate.postal_code,
    candidate.latitude,
    candidate.longitude,
    nullif(candidate.google_place_id, ''),
    nullif(candidate.source_category, ''),
    candidate.launch_category_slug,
    candidate.active_profile_status,
    candidate.screening_status,
    array(select jsonb_array_elements_text(candidate.screening_reasons)),
    candidate.quality_score,
    nullif(candidate.diversity_key, ''),
    candidate.evidence
  from jsonb_to_recordset(requested_candidates) as candidate(
    worksheet text,
    source_row integer,
    normalized_name text,
    proposed_slug text,
    phone_e164 text,
    business_email text,
    website_url text,
    street_address text,
    city_slug text,
    postal_code text,
    latitude numeric,
    longitude numeric,
    google_place_id text,
    source_category text,
    launch_category_slug text,
    active_profile_status text,
    screening_status text,
    screening_reasons jsonb,
    quality_score numeric,
    diversity_key text,
    evidence jsonb
  )
  join private.source_listing_rows source
    on source.batch_id = requested_batch_id
    and source.worksheet = candidate.worksheet
    and source.source_row = candidate.source_row
  on conflict (batch_id, source_row_id) do nothing;

  get diagnostics inserted_count = row_count;
  return inserted_count;
end;
$$;

create function public.listing_candidate_batch_status(requested_batch_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'batch_id', requested_batch_id,
    'candidate_count', coalesce(sum(grouped.candidate_count), 0),
    'eligible_count', coalesce(sum(grouped.eligible_count), 0),
    'needs_review_count', coalesce(sum(grouped.needs_review_count), 0),
    'selected_count', coalesce(sum(grouped.selected_count), 0),
    'matrix', coalesce(
      jsonb_agg(
        jsonb_build_object(
          'city', grouped.city_slug,
          'category', grouped.launch_category_slug,
          'candidate_count', grouped.candidate_count,
          'eligible_count', grouped.eligible_count,
          'needs_review_count', grouped.needs_review_count,
          'selected_count', grouped.selected_count
        ) order by grouped.city_slug, grouped.launch_category_slug
      ) filter (where grouped.city_slug is not null),
      '[]'::jsonb
    )
  )
  from (
    select
      city_slug,
      launch_category_slug,
      count(*) as candidate_count,
      count(*) filter (where screening_status = 'eligible') as eligible_count,
      count(*) filter (where screening_status = 'needs_review') as needs_review_count,
      count(*) filter (where selected_for_launch) as selected_count
    from app.listing_candidates
    where batch_id = requested_batch_id
    group by city_slug, launch_category_slug
  ) grouped
$$;

revoke all on function public.ingest_listing_candidates(uuid, jsonb)
  from public, anon, authenticated;
revoke all on function public.listing_candidate_batch_status(uuid)
  from public, anon, authenticated;
grant execute on function public.ingest_listing_candidates(uuid, jsonb) to service_role;
grant execute on function public.listing_candidate_batch_status(uuid) to service_role;

comment on function public.ingest_listing_candidates(uuid, jsonb) is
  'Service-role-only deterministic transformation into a private operator review queue.';
comment on function public.listing_candidate_batch_status(uuid) is
  'Service-role-only aggregate receipt; returns no Business or contact data.';

commit;
