begin;

create table private.enrichment_snapshots (
  id bigint generated always as identity primary key,
  manifest_sha256 text not null unique check (manifest_sha256 ~ '^[a-f0-9]{64}$'),
  source_root text not null check (length(trim(source_root)) between 1 and 1000),
  artifact_count integer not null check (artifact_count >= 0),
  profile_count integer not null check (profile_count >= 0),
  total_bytes bigint not null check (total_bytes >= 0),
  filter_versions text[] not null default '{}',
  captured_at timestamptz not null,
  imported_by text not null check (length(trim(imported_by)) between 1 and 200),
  notes jsonb not null default '{}'::jsonb check (jsonb_typeof(notes) = 'object'),
  imported_at timestamptz not null default statement_timestamp()
);

create table private.enrichment_raw_artifacts (
  id bigint generated always as identity primary key,
  content_sha256 text not null unique check (content_sha256 ~ '^[a-f0-9]{64}$'),
  byte_count bigint not null check (byte_count >= 0),
  content_type text not null check (content_type in ('application/json', 'application/x-ndjson')),
  raw_text text not null,
  parsed_payload jsonb,
  first_seen_at timestamptz not null default statement_timestamp(),
  check (byte_count = octet_length(convert_to(raw_text, 'UTF8'))),
  check (parsed_payload is null or jsonb_typeof(parsed_payload) in ('object', 'array'))
);

create table private.enrichment_snapshot_artifacts (
  snapshot_id bigint not null references private.enrichment_snapshots(id),
  relative_path text not null check (
    length(relative_path) between 1 and 1000
    and relative_path !~ '(^/|(^|/)\.\.(/|$))'
  ),
  artifact_id bigint not null references private.enrichment_raw_artifacts(id),
  artifact_kind text not null check (
    artifact_kind in (
      'category_queue',
      'progress',
      'provider_ledger',
      'search_receipt',
      'listing_receipt',
      'batch_summary',
      'other'
    )
  ),
  batch_slug text,
  category_priority integer check (category_priority is null or category_priority > 0),
  category_slug text check (category_slug is null or category_slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  domain text,
  source_url text check (source_url is null or source_url ~ '^https?://'),
  provider text,
  is_superseded boolean not null default false,
  created_at timestamptz not null default statement_timestamp(),
  primary key (snapshot_id, relative_path)
);

create table app.listing_enrichment_profiles (
  id bigint generated always as identity primary key,
  snapshot_id bigint not null references private.enrichment_snapshots(id),
  artifact_id bigint not null references private.enrichment_raw_artifacts(id),
  proposal_version text not null check (proposal_version ~ '^seed-profile-v[0-9]+$'),
  category_priority integer not null check (category_priority > 0),
  category_slug text not null check (category_slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  category_name text not null check (length(trim(category_name)) between 1 and 200),
  domain text not null check (domain = lower(domain) and domain !~ '[/ ]'),
  website_url text not null check (website_url ~ '^https?://'),
  serp_rank integer check (serp_rank is null or serp_rank > 0),
  filter_version text,
  filter_version_accepted boolean not null default false,
  evidence_status text not null check (
    evidence_status in ('complete', 'crawl_failed', 'invalid', 'missing', 'stale')
  ),
  normalized_title text,
  description_candidate text,
  about_source_excerpt text,
  phone_candidates text[] not null default '{}',
  email_candidates text[] not null default '{}',
  hours_evidence text,
  service_candidates jsonb not null default '[]'::jsonb check (jsonb_typeof(service_candidates) = 'array'),
  service_area_candidates jsonb not null default '[]'::jsonb check (jsonb_typeof(service_area_candidates) = 'array'),
  photo_candidates jsonb not null default '[]'::jsonb check (jsonb_typeof(photo_candidates) = 'array'),
  source_urls jsonb not null default '[]'::jsonb check (jsonb_typeof(source_urls) = 'array'),
  page_count integer not null default 0 check (page_count >= 0),
  completeness_score numeric(5,2) not null check (completeness_score between 0 and 100),
  proposal_status text not null default 'pending_review' check (
    proposal_status in ('pending_review', 'accepted', 'rejected', 'superseded')
  ),
  created_at timestamptz not null default statement_timestamp(),
  unique (snapshot_id, artifact_id)
);

create table app.listing_enrichment_photo_candidates (
  id bigint generated always as identity primary key,
  profile_id bigint not null references app.listing_enrichment_profiles(id),
  image_url text not null check (image_url ~ '^https?://'),
  source_page_url text not null check (source_page_url ~ '^https?://'),
  alt_text text,
  role_candidate text not null check (role_candidate in ('logo', 'gallery', 'unknown')),
  same_site boolean not null,
  evidence_score integer not null check (evidence_score between -100 and 200),
  review_status text not null default 'pending' check (
    review_status in ('pending', 'approved', 'rejected')
  ),
  created_at timestamptz not null default statement_timestamp(),
  unique (profile_id, image_url, source_page_url)
);

create trigger enrichment_snapshots_append_only
before update or delete on private.enrichment_snapshots
for each row execute function private.reject_mutation();

create trigger enrichment_raw_artifacts_append_only
before update or delete on private.enrichment_raw_artifacts
for each row execute function private.reject_mutation();

create trigger enrichment_snapshot_artifacts_append_only
before update or delete on private.enrichment_snapshot_artifacts
for each row execute function private.reject_mutation();

create trigger listing_enrichment_profiles_append_only
before update or delete on app.listing_enrichment_profiles
for each row execute function private.reject_mutation();

create trigger listing_enrichment_photos_append_only
before update or delete on app.listing_enrichment_photo_candidates
for each row execute function private.reject_mutation();

create index enrichment_snapshot_artifacts_artifact_idx
  on private.enrichment_snapshot_artifacts (artifact_id);
create index enrichment_snapshot_artifacts_lookup_idx
  on private.enrichment_snapshot_artifacts (snapshot_id, artifact_kind, category_priority);
create index listing_enrichment_profiles_review_idx
  on app.listing_enrichment_profiles (
    proposal_status,
    filter_version_accepted,
    evidence_status,
    category_priority,
    completeness_score desc
  );
create index listing_enrichment_profiles_domain_idx
  on app.listing_enrichment_profiles (domain, created_at desc);
create index listing_enrichment_profiles_artifact_idx
  on app.listing_enrichment_profiles (artifact_id);
create index listing_enrichment_photos_profile_score_idx
  on app.listing_enrichment_photo_candidates (profile_id, evidence_score desc);

alter table private.enrichment_snapshots enable row level security;
alter table private.enrichment_raw_artifacts enable row level security;
alter table private.enrichment_snapshot_artifacts enable row level security;
alter table app.listing_enrichment_profiles enable row level security;
alter table app.listing_enrichment_photo_candidates enable row level security;

create policy listing_enrichment_profiles_operator_read
on app.listing_enrichment_profiles for select to authenticated
using ((select app.is_operator()));

create policy listing_enrichment_photos_operator_read
on app.listing_enrichment_photo_candidates for select to authenticated
using ((select app.is_operator()));

revoke all on private.enrichment_snapshots,
  private.enrichment_raw_artifacts,
  private.enrichment_snapshot_artifacts
from public, anon, authenticated, service_role;

revoke all on app.listing_enrichment_profiles,
  app.listing_enrichment_photo_candidates
from public, anon, authenticated, service_role;

grant select on app.listing_enrichment_profiles,
  app.listing_enrichment_photo_candidates
to authenticated, service_role;

grant usage, select on sequence app.listing_enrichment_profiles_id_seq,
  app.listing_enrichment_photo_candidates_id_seq
to service_role;

create function public.register_enrichment_snapshot(
  requested_manifest_sha256 text,
  requested_source_root text,
  requested_artifact_count integer,
  requested_profile_count integer,
  requested_total_bytes bigint,
  requested_filter_versions jsonb,
  requested_captured_at timestamptz,
  requested_imported_by text,
  requested_notes jsonb default '{}'::jsonb
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  snapshot private.enrichment_snapshots%rowtype;
begin
  if requested_manifest_sha256 is null or requested_manifest_sha256 !~ '^[a-f0-9]{64}$' then
    raise exception 'manifest sha256 is invalid';
  end if;
  if requested_source_root is null or length(trim(requested_source_root)) not between 1 and 1000 then
    raise exception 'source root is invalid';
  end if;
  if requested_artifact_count < 0 or requested_profile_count < 0 or requested_total_bytes < 0 then
    raise exception 'snapshot counts are invalid';
  end if;
  if jsonb_typeof(requested_filter_versions) <> 'array'
     or jsonb_typeof(requested_notes) <> 'object' then
    raise exception 'snapshot metadata is invalid';
  end if;
  if requested_captured_at is null then
    raise exception 'captured_at is required';
  end if;
  if requested_imported_by is null or length(trim(requested_imported_by)) not between 1 and 200 then
    raise exception 'imported_by is invalid';
  end if;

  insert into private.enrichment_snapshots (
    manifest_sha256,
    source_root,
    artifact_count,
    profile_count,
    total_bytes,
    filter_versions,
    captured_at,
    imported_by,
    notes
  ) values (
    requested_manifest_sha256,
    trim(requested_source_root),
    requested_artifact_count,
    requested_profile_count,
    requested_total_bytes,
    array(select jsonb_array_elements_text(requested_filter_versions)),
    requested_captured_at,
    trim(requested_imported_by),
    requested_notes
  )
  on conflict (manifest_sha256) do nothing;

  select * into strict snapshot
  from private.enrichment_snapshots
  where manifest_sha256 = requested_manifest_sha256;

  if snapshot.source_root <> trim(requested_source_root)
     or snapshot.artifact_count <> requested_artifact_count
     or snapshot.profile_count <> requested_profile_count
     or snapshot.total_bytes <> requested_total_bytes then
    raise exception 'existing enrichment snapshot metadata does not match';
  end if;

  return snapshot.id;
end;
$$;

create function public.ingest_enrichment_artifacts(
  requested_snapshot_id bigint,
  requested_artifacts jsonb
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  inserted_count integer;
begin
  if requested_snapshot_id is null or not exists (
    select 1 from private.enrichment_snapshots where id = requested_snapshot_id
  ) then
    raise exception 'enrichment snapshot does not exist';
  end if;
  if jsonb_typeof(requested_artifacts) <> 'array'
     or jsonb_array_length(requested_artifacts) < 1
     or jsonb_array_length(requested_artifacts) > 10 then
    raise exception 'artifacts must be a JSON array containing 1 to 10 records';
  end if;

  if (
    select count(*) <> count(distinct artifact.relative_path)
    from jsonb_to_recordset(requested_artifacts) as artifact(relative_path text)
  ) then
    raise exception 'artifact paths must be unique within a request';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(requested_artifacts) as artifact(
      relative_path text,
      content_sha256 text,
      byte_count bigint,
      content_type text,
      raw_text text,
      parsed_payload jsonb,
      artifact_kind text,
      batch_slug text,
      category_priority integer,
      category_slug text,
      domain text,
      source_url text,
      provider text,
      is_superseded boolean
    )
    where artifact.relative_path is null
      or length(artifact.relative_path) not between 1 and 1000
      or artifact.relative_path ~ '(^/|(^|/)\.\.(/|$))'
      or artifact.content_sha256 !~ '^[a-f0-9]{64}$'
      or artifact.byte_count <> octet_length(convert_to(artifact.raw_text, 'UTF8'))
      or artifact.content_sha256 <> encode(
        extensions.digest(convert_to(artifact.raw_text, 'UTF8'), 'sha256'),
        'hex'
      )
      or artifact.content_type not in ('application/json', 'application/x-ndjson')
      or artifact.artifact_kind not in (
        'category_queue', 'progress', 'provider_ledger', 'search_receipt',
        'listing_receipt', 'batch_summary', 'other'
      )
      or (artifact.parsed_payload is not null and jsonb_typeof(artifact.parsed_payload) not in ('object', 'array'))
      or (artifact.category_priority is not null and artifact.category_priority < 1)
      or (artifact.category_slug is not null and artifact.category_slug !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$')
      or (artifact.source_url is not null and artifact.source_url !~ '^https?://')
  ) then
    raise exception 'one or more enrichment artifacts are invalid';
  end if;

  insert into private.enrichment_raw_artifacts (
    content_sha256,
    byte_count,
    content_type,
    raw_text,
    parsed_payload
  )
  select distinct on (artifact.content_sha256)
    artifact.content_sha256,
    artifact.byte_count,
    artifact.content_type,
    artifact.raw_text,
    artifact.parsed_payload
  from jsonb_to_recordset(requested_artifacts) as artifact(
    content_sha256 text,
    byte_count bigint,
    content_type text,
    raw_text text,
    parsed_payload jsonb
  )
  order by artifact.content_sha256
  on conflict (content_sha256) do nothing;

  if exists (
    select 1
    from jsonb_to_recordset(requested_artifacts) as requested(
      content_sha256 text,
      byte_count bigint,
      raw_text text
    )
    join private.enrichment_raw_artifacts stored
      on stored.content_sha256 = requested.content_sha256
    where stored.byte_count <> requested.byte_count
       or stored.raw_text <> requested.raw_text
  ) then
    raise exception 'stored enrichment artifact content does not match';
  end if;

  insert into private.enrichment_snapshot_artifacts (
    snapshot_id,
    relative_path,
    artifact_id,
    artifact_kind,
    batch_slug,
    category_priority,
    category_slug,
    domain,
    source_url,
    provider,
    is_superseded
  )
  select
    requested_snapshot_id,
    artifact.relative_path,
    stored.id,
    artifact.artifact_kind,
    nullif(trim(artifact.batch_slug), ''),
    artifact.category_priority,
    nullif(trim(artifact.category_slug), ''),
    nullif(lower(trim(artifact.domain)), ''),
    nullif(trim(artifact.source_url), ''),
    nullif(lower(trim(artifact.provider)), ''),
    coalesce(artifact.is_superseded, false)
  from jsonb_to_recordset(requested_artifacts) as artifact(
    relative_path text,
    content_sha256 text,
    artifact_kind text,
    batch_slug text,
    category_priority integer,
    category_slug text,
    domain text,
    source_url text,
    provider text,
    is_superseded boolean
  )
  join private.enrichment_raw_artifacts stored
    on stored.content_sha256 = artifact.content_sha256
  on conflict (snapshot_id, relative_path) do nothing;

  get diagnostics inserted_count = row_count;

  if exists (
    select 1
    from jsonb_to_recordset(requested_artifacts) as requested(
      relative_path text,
      content_sha256 text
    )
    join private.enrichment_snapshot_artifacts member
      on member.snapshot_id = requested_snapshot_id
      and member.relative_path = requested.relative_path
    join private.enrichment_raw_artifacts stored
      on stored.id = member.artifact_id
    where stored.content_sha256 <> requested.content_sha256
  ) then
    raise exception 'stored snapshot artifact mapping does not match';
  end if;

  return inserted_count;
end;
$$;

create function public.ingest_enrichment_profiles(
  requested_snapshot_id bigint,
  requested_profiles jsonb
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  inserted_count integer;
begin
  if requested_snapshot_id is null or not exists (
    select 1 from private.enrichment_snapshots where id = requested_snapshot_id
  ) then
    raise exception 'enrichment snapshot does not exist';
  end if;
  if jsonb_typeof(requested_profiles) <> 'array'
     or jsonb_array_length(requested_profiles) < 1
     or jsonb_array_length(requested_profiles) > 100 then
    raise exception 'profiles must be a JSON array containing 1 to 100 records';
  end if;

  if (
    select count(*) <> count(distinct profile.content_sha256)
    from jsonb_to_recordset(requested_profiles) as profile(content_sha256 text)
  ) then
    raise exception 'profile artifacts must be unique within a request';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(requested_profiles) as profile(
      content_sha256 text,
      proposal_version text,
      category_priority integer,
      category_slug text,
      category_name text,
      domain text,
      website_url text,
      serp_rank integer,
      filter_version text,
      filter_version_accepted boolean,
      evidence_status text,
      normalized_title text,
      description_candidate text,
      about_source_excerpt text,
      phone_candidates jsonb,
      email_candidates jsonb,
      hours_evidence text,
      service_candidates jsonb,
      service_area_candidates jsonb,
      photo_candidates jsonb,
      source_urls jsonb,
      page_count integer,
      completeness_score numeric
    )
    left join private.enrichment_raw_artifacts artifact
      on artifact.content_sha256 = profile.content_sha256
    left join private.enrichment_snapshot_artifacts member
      on member.snapshot_id = requested_snapshot_id
      and member.artifact_id = artifact.id
      and member.artifact_kind = 'listing_receipt'
    where artifact.id is null
      or member.artifact_id is null
      or profile.proposal_version !~ '^seed-profile-v[0-9]+$'
      or profile.category_priority < 1
      or profile.category_slug !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'
      or length(trim(profile.category_name)) not between 1 and 200
      or profile.domain is null
      or profile.domain <> lower(profile.domain)
      or profile.domain ~ '[/ ]'
      or profile.website_url !~ '^https?://'
      or (profile.serp_rank is not null and profile.serp_rank < 1)
      or profile.evidence_status not in ('complete', 'crawl_failed', 'invalid', 'missing', 'stale')
      or jsonb_typeof(profile.phone_candidates) <> 'array'
      or jsonb_typeof(profile.email_candidates) <> 'array'
      or jsonb_typeof(profile.service_candidates) <> 'array'
      or jsonb_typeof(profile.service_area_candidates) <> 'array'
      or jsonb_typeof(profile.photo_candidates) <> 'array'
      or jsonb_typeof(profile.source_urls) <> 'array'
      or profile.page_count < 0
      or profile.completeness_score not between 0 and 100
  ) then
    raise exception 'one or more enrichment profiles are invalid';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(requested_profiles) as profile(photo_candidates jsonb)
    cross join lateral jsonb_to_recordset(profile.photo_candidates) as photo(
      image_url text,
      source_page_url text,
      alt_text text,
      role_candidate text,
      same_site boolean,
      evidence_score integer
    )
    where photo.image_url !~ '^https?://'
      or photo.source_page_url !~ '^https?://'
      or photo.role_candidate not in ('logo', 'gallery', 'unknown')
      or photo.same_site is null
      or photo.evidence_score not between -100 and 200
  ) then
    raise exception 'one or more enrichment photos are invalid';
  end if;

  insert into app.listing_enrichment_profiles (
    snapshot_id,
    artifact_id,
    proposal_version,
    category_priority,
    category_slug,
    category_name,
    domain,
    website_url,
    serp_rank,
    filter_version,
    filter_version_accepted,
    evidence_status,
    normalized_title,
    description_candidate,
    about_source_excerpt,
    phone_candidates,
    email_candidates,
    hours_evidence,
    service_candidates,
    service_area_candidates,
    photo_candidates,
    source_urls,
    page_count,
    completeness_score
  )
  select
    requested_snapshot_id,
    artifact.id,
    profile.proposal_version,
    profile.category_priority,
    profile.category_slug,
    trim(profile.category_name),
    lower(trim(profile.domain)),
    profile.website_url,
    profile.serp_rank,
    nullif(profile.filter_version, ''),
    coalesce(profile.filter_version_accepted, false),
    profile.evidence_status,
    nullif(trim(profile.normalized_title), ''),
    nullif(trim(profile.description_candidate), ''),
    nullif(trim(profile.about_source_excerpt), ''),
    array(select jsonb_array_elements_text(profile.phone_candidates)),
    array(select jsonb_array_elements_text(profile.email_candidates)),
    nullif(trim(profile.hours_evidence), ''),
    profile.service_candidates,
    profile.service_area_candidates,
    profile.photo_candidates,
    profile.source_urls,
    profile.page_count,
    profile.completeness_score
  from jsonb_to_recordset(requested_profiles) as profile(
    content_sha256 text,
    proposal_version text,
    category_priority integer,
    category_slug text,
    category_name text,
    domain text,
    website_url text,
    serp_rank integer,
    filter_version text,
    filter_version_accepted boolean,
    evidence_status text,
    normalized_title text,
    description_candidate text,
    about_source_excerpt text,
    phone_candidates jsonb,
    email_candidates jsonb,
    hours_evidence text,
    service_candidates jsonb,
    service_area_candidates jsonb,
    photo_candidates jsonb,
    source_urls jsonb,
    page_count integer,
    completeness_score numeric
  )
  join private.enrichment_raw_artifacts artifact
    on artifact.content_sha256 = profile.content_sha256
  on conflict (snapshot_id, artifact_id) do nothing;

  get diagnostics inserted_count = row_count;

  insert into app.listing_enrichment_photo_candidates (
    profile_id,
    image_url,
    source_page_url,
    alt_text,
    role_candidate,
    same_site,
    evidence_score
  )
  select
    stored_profile.id,
    photo.image_url,
    photo.source_page_url,
    nullif(trim(photo.alt_text), ''),
    photo.role_candidate,
    photo.same_site,
    photo.evidence_score
  from jsonb_to_recordset(requested_profiles) as profile(
    content_sha256 text,
    photo_candidates jsonb
  )
  join private.enrichment_raw_artifacts artifact
    on artifact.content_sha256 = profile.content_sha256
  join app.listing_enrichment_profiles stored_profile
    on stored_profile.snapshot_id = requested_snapshot_id
    and stored_profile.artifact_id = artifact.id
  cross join lateral jsonb_to_recordset(profile.photo_candidates) as photo(
    image_url text,
    source_page_url text,
    alt_text text,
    role_candidate text,
    same_site boolean,
    evidence_score integer
  )
  on conflict (profile_id, image_url, source_page_url) do nothing;

  return inserted_count;
end;
$$;

create function public.enrichment_snapshot_status(requested_snapshot_id bigint)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with snapshot as (
    select *
    from private.enrichment_snapshots
    where id = requested_snapshot_id
  ), artifact_status as (
    select
      count(*) as artifact_count,
      coalesce(sum(raw.byte_count), 0) as total_bytes
    from private.enrichment_snapshot_artifacts member
    join private.enrichment_raw_artifacts raw on raw.id = member.artifact_id
    where member.snapshot_id = requested_snapshot_id
  ), profile_status as (
    select
      count(*) as profile_count,
      count(*) filter (where evidence_status = 'complete') as complete_profile_count,
      count(*) filter (where filter_version_accepted) as accepted_filter_profile_count
    from app.listing_enrichment_profiles
    where snapshot_id = requested_snapshot_id
  ), photo_status as (
    select count(*) as photo_count
    from app.listing_enrichment_photo_candidates photo
    join app.listing_enrichment_profiles profile on profile.id = photo.profile_id
    where profile.snapshot_id = requested_snapshot_id
  )
  select jsonb_build_object(
    'snapshot_id', snapshot.id,
    'manifest_sha256', snapshot.manifest_sha256,
    'expected_artifact_count', snapshot.artifact_count,
    'stored_artifact_count', artifact_status.artifact_count,
    'expected_profile_count', snapshot.profile_count,
    'stored_profile_count', profile_status.profile_count,
    'stored_photo_count', photo_status.photo_count,
    'expected_total_bytes', snapshot.total_bytes,
    'stored_total_bytes', artifact_status.total_bytes,
    'complete_profile_count', profile_status.complete_profile_count,
    'accepted_filter_profile_count', profile_status.accepted_filter_profile_count,
    'complete',
      artifact_status.artifact_count = snapshot.artifact_count
      and profile_status.profile_count = snapshot.profile_count
      and artifact_status.total_bytes = snapshot.total_bytes
  )
  from snapshot
  cross join artifact_status
  cross join profile_status
  cross join photo_status
$$;

revoke all on function public.register_enrichment_snapshot(
  text, text, integer, integer, bigint, jsonb, timestamptz, text, jsonb
) from public, anon, authenticated;
revoke all on function public.ingest_enrichment_artifacts(bigint, jsonb)
  from public, anon, authenticated;
revoke all on function public.ingest_enrichment_profiles(bigint, jsonb)
  from public, anon, authenticated;
revoke all on function public.enrichment_snapshot_status(bigint)
  from public, anon, authenticated;

grant execute on function public.register_enrichment_snapshot(
  text, text, integer, integer, bigint, jsonb, timestamptz, text, jsonb
) to service_role;
grant execute on function public.ingest_enrichment_artifacts(bigint, jsonb)
  to service_role;
grant execute on function public.ingest_enrichment_profiles(bigint, jsonb)
  to service_role;
grant execute on function public.enrichment_snapshot_status(bigint)
  to service_role;

comment on table private.enrichment_raw_artifacts is
  'Content-addressed, byte-preserving raw SERP and website evidence. Private and append-only.';
comment on table app.listing_enrichment_profiles is
  'Private facts-only seed profile proposals derived from raw evidence; never publication authority.';
comment on table app.listing_enrichment_photo_candidates is
  'Private website-photo references with provenance; operator approval and usage-right review are required before publication.';

commit;
