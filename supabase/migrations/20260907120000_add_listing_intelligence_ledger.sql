begin;

-- A current, listing-linked index over immutable raw capture and audit evidence.
-- Raw provider responses remain content-addressed in private.enrichment_raw_artifacts.
create table private.listing_intelligence_accounts (
  listing_id uuid primary key references app.business_listings(id),
  source_inventory jsonb not null default '[]'::jsonb
    check (jsonb_typeof(source_inventory) = 'array'),
  capture_status text not null default 'pending'
    check (capture_status in ('pending', 'complete', 'partial', 'blocked', 'failed')),
  seo_audit_status text not null default 'pending'
    check (seo_audit_status in ('pending', 'complete', 'partial', 'blocked', 'failed', 'not_applicable')),
  fact_status text not null default 'pending'
    check (fact_status in ('pending', 'complete', 'partial', 'blocked', 'failed')),
  latest_capture_id bigint,
  latest_seo_audit_id bigint,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp()
);

create table private.listing_source_captures (
  id bigint generated always as identity primary key,
  listing_id uuid not null references app.business_listings(id),
  idempotency_key text not null check (length(idempotency_key) between 16 and 200),
  source_url text not null check (source_url ~ '^https://'),
  source_kind text not null check (
    source_kind in ('website', 'facebook', 'yelp', 'houzz', 'directory_landing_page', 'other')
  ),
  provider text not null default 'firecrawl' check (provider = 'firecrawl'),
  provider_job_id text,
  ingestion_status text not null default 'ingesting'
    check (ingestion_status in ('ingesting', 'finalized')),
  terminal_status text not null
    check (terminal_status in ('complete', 'partial', 'blocked', 'failed')),
  completeness_basis text not null check (
    completeness_basis in ('entire_accessible_site', 'single_landing_page', 'no_accessible_pages')
  ),
  expected_page_count integer not null check (expected_page_count >= 0),
  discovered_page_count integer check (discovered_page_count is null or discovered_page_count >= 0),
  failed_page_count integer not null default 0 check (failed_page_count >= 0),
  page_limit integer not null check (page_limit > 0),
  hit_page_limit boolean not null default false,
  pagination_drained boolean not null default false,
  robots_respected boolean not null default true,
  manifest_sha256 text not null check (manifest_sha256 ~ '^[a-f0-9]{64}$'),
  crawl_config jsonb not null check (jsonb_typeof(crawl_config) = 'object'),
  completeness_blockers jsonb not null default '[]'::jsonb
    check (jsonb_typeof(completeness_blockers) = 'array'),
  credits_used numeric(12,4) check (credits_used is null or credits_used >= 0),
  started_at timestamptz not null,
  finished_at timestamptz not null,
  recorded_at timestamptz not null default statement_timestamp(),
  unique (listing_id, idempotency_key),
  unique (id, listing_id),
  check (finished_at >= started_at),
  check (
    terminal_status <> 'complete'
    or (
      expected_page_count > 0
      and discovered_page_count = expected_page_count
      and failed_page_count = 0
      and not hit_page_limit
      and pagination_drained
      and robots_respected
      and jsonb_array_length(completeness_blockers) = 0
    )
  )
);

create table private.listing_source_capture_pages (
  capture_id bigint not null references private.listing_source_captures(id),
  page_index integer not null check (page_index >= 0),
  source_url text not null check (source_url ~ '^https://'),
  canonical_url text check (canonical_url is null or canonical_url ~ '^https://'),
  title text,
  http_status integer check (http_status is null or http_status between 100 and 599),
  artifact_id bigint not null references private.enrichment_raw_artifacts(id),
  captured_at timestamptz not null,
  primary key (capture_id, page_index),
  unique (capture_id, source_url)
);

create table private.listing_source_fact_sets (
  id bigint generated always as identity primary key,
  listing_id uuid not null references app.business_listings(id),
  capture_id bigint not null references private.listing_source_captures(id),
  extractor_version text not null check (length(trim(extractor_version)) between 1 and 100),
  emails text[] not null default '{}',
  phones text[] not null default '{}',
  addresses jsonb not null default '[]'::jsonb check (jsonb_typeof(addresses) = 'array'),
  service_areas jsonb not null default '[]'::jsonb check (jsonb_typeof(service_areas) = 'array'),
  services jsonb not null default '[]'::jsonb check (jsonb_typeof(services) = 'array'),
  key_differentiators jsonb not null default '[]'::jsonb
    check (jsonb_typeof(key_differentiators) = 'array'),
  top_service_offering jsonb check (
    top_service_offering is null or jsonb_typeof(top_service_offering) = 'object'
  ),
  provenance jsonb not null check (jsonb_typeof(provenance) = 'object'),
  completeness_score numeric(5,2) not null check (completeness_score between 0 and 100),
  created_at timestamptz not null default statement_timestamp(),
  unique (capture_id, extractor_version),
  unique (id, listing_id),
  foreign key (capture_id, listing_id)
    references private.listing_source_captures(id, listing_id)
);

create table private.listing_seo_audits (
  id bigint generated always as identity primary key,
  listing_id uuid not null references app.business_listings(id),
  capture_id bigint references private.listing_source_captures(id),
  idempotency_key text not null check (length(idempotency_key) between 16 and 200),
  target_url text not null check (target_url ~ '^https://'),
  provider text not null default 'dataforseo' check (provider = 'dataforseo'),
  provider_task_id text,
  terminal_status text not null check (terminal_status in ('complete', 'partial', 'blocked', 'failed')),
  max_crawl_pages integer not null check (max_crawl_pages > 0),
  crawled_pages integer not null default 0 check (crawled_pages >= 0),
  crawl_progress text,
  onpage_score numeric(7,3),
  cost_usd numeric(12,6) check (cost_usd is null or cost_usd >= 0),
  request_config jsonb not null check (jsonb_typeof(request_config) = 'object'),
  audit_summary jsonb not null check (jsonb_typeof(audit_summary) = 'object'),
  limitations jsonb not null default '[]'::jsonb check (jsonb_typeof(limitations) = 'array'),
  started_at timestamptz not null,
  finished_at timestamptz not null,
  recorded_at timestamptz not null default statement_timestamp(),
  unique (listing_id, idempotency_key),
  unique (id, listing_id),
  foreign key (capture_id, listing_id)
    references private.listing_source_captures(id, listing_id),
  check (finished_at >= started_at),
  check (
    terminal_status <> 'complete'
    or (
      crawled_pages > 0
      and crawl_progress = 'finished'
      and jsonb_array_length(limitations) = 0
    )
  )
);

create table private.listing_seo_audit_artifacts (
  audit_id bigint not null references private.listing_seo_audits(id),
  artifact_kind text not null check (
    artifact_kind in ('task_post', 'task_status', 'summary', 'pages', 'lighthouse', 'other')
  ),
  artifact_index integer not null default 0 check (artifact_index >= 0),
  artifact_id bigint not null references private.enrichment_raw_artifacts(id),
  created_at timestamptz not null default statement_timestamp(),
  primary key (audit_id, artifact_kind, artifact_index)
);

create table app.listing_content_intelligence_candidates (
  id bigint generated always as identity primary key,
  listing_id uuid not null references app.business_listings(id),
  fact_set_id bigint not null references private.listing_source_fact_sets(id),
  seo_audit_id bigint not null references private.listing_seo_audits(id),
  generator_version text not null check (length(trim(generator_version)) between 1 and 100),
  top_service_offering text not null check (length(trim(top_service_offering)) between 2 and 200),
  local_searcher_decision_tree jsonb not null
    check (jsonb_typeof(local_searcher_decision_tree) = 'object'),
  proposed_content jsonb not null check (jsonb_typeof(proposed_content) = 'object'),
  claim_provenance jsonb not null check (jsonb_typeof(claim_provenance) = 'object'),
  uniqueness_receipt jsonb not null check (jsonb_typeof(uniqueness_receipt) = 'object'),
  review_status text not null default 'pending_review'
    check (review_status in ('pending_review', 'accepted', 'rejected', 'superseded')),
  reviewed_by uuid references app.actors(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default statement_timestamp(),
  check ((review_status = 'pending_review') = (reviewed_at is null and reviewed_by is null))
);

alter table private.listing_intelligence_accounts
  add constraint listing_intelligence_latest_capture_fk
    foreign key (latest_capture_id, listing_id)
      references private.listing_source_captures(id, listing_id),
  add constraint listing_intelligence_latest_audit_fk
    foreign key (latest_seo_audit_id, listing_id)
      references private.listing_seo_audits(id, listing_id);

alter table app.listing_content_intelligence_candidates
  add constraint listing_content_intelligence_fact_listing_fk
    foreign key (fact_set_id, listing_id)
      references private.listing_source_fact_sets(id, listing_id),
  add constraint listing_content_intelligence_audit_listing_fk
    foreign key (seo_audit_id, listing_id)
      references private.listing_seo_audits(id, listing_id);

create index listing_source_captures_listing_idx
  on private.listing_source_captures (listing_id, recorded_at desc);
create index listing_source_capture_pages_artifact_idx
  on private.listing_source_capture_pages (artifact_id);
create index listing_source_fact_sets_listing_idx
  on private.listing_source_fact_sets (listing_id, created_at desc);
create index listing_seo_audits_listing_idx
  on private.listing_seo_audits (listing_id, recorded_at desc);
create index listing_seo_audit_artifacts_artifact_idx
  on private.listing_seo_audit_artifacts (artifact_id);
create index listing_content_intelligence_review_idx
  on app.listing_content_intelligence_candidates (review_status, created_at, listing_id);

create trigger listing_source_capture_pages_append_only
before update or delete on private.listing_source_capture_pages
for each row execute function private.reject_mutation();
create trigger listing_source_fact_sets_append_only
before update or delete on private.listing_source_fact_sets
for each row execute function private.reject_mutation();
create trigger listing_seo_audits_append_only
before update or delete on private.listing_seo_audits
for each row execute function private.reject_mutation();
create trigger listing_seo_audit_artifacts_append_only
before update or delete on private.listing_seo_audit_artifacts
for each row execute function private.reject_mutation();

alter table private.listing_intelligence_accounts enable row level security;
alter table private.listing_source_captures enable row level security;
alter table private.listing_source_capture_pages enable row level security;
alter table private.listing_source_fact_sets enable row level security;
alter table private.listing_seo_audits enable row level security;
alter table private.listing_seo_audit_artifacts enable row level security;
alter table app.listing_content_intelligence_candidates enable row level security;

create policy listing_content_intelligence_operator_read
on app.listing_content_intelligence_candidates for select to authenticated
using ((select app.is_operator()));

revoke all on private.listing_intelligence_accounts,
  private.listing_source_captures,
  private.listing_source_capture_pages,
  private.listing_source_fact_sets,
  private.listing_seo_audits,
  private.listing_seo_audit_artifacts
from public, anon, authenticated, service_role;
revoke all on app.listing_content_intelligence_candidates
from public, anon, authenticated, service_role;
grant select on app.listing_content_intelligence_candidates to authenticated, service_role;

-- Every current and future Listing with a primary web source receives an account row.
create function private.ensure_listing_intelligence_account()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.website_url is not null then
    insert into private.listing_intelligence_accounts (listing_id, source_inventory)
    values (
      new.id,
      jsonb_build_array(jsonb_build_object(
        'url', new.website_url,
        'kind', case
          when new.website_url ~* '^https://([^/]+\.)?facebook\.com/' then 'facebook'
          when new.website_url ~* '^https://([^/]+\.)?yelp\.com/' then 'yelp'
          when new.website_url ~* '^https://([^/]+\.)?houzz\.com/' then 'houzz'
          else 'website'
        end,
        'isPrimary', true
      ))
    )
    on conflict (listing_id) do update
    set source_inventory = coalesce((
      select jsonb_agg(source)
      from jsonb_array_elements(private.listing_intelligence_accounts.source_inventory) source
      where coalesce((source->>'isPrimary')::boolean, false) = false
    ), '[]'::jsonb) || jsonb_build_array(jsonb_build_object(
      'url', new.website_url,
      'kind', case
        when new.website_url ~* '^https://([^/]+\.)?facebook\.com/' then 'facebook'
        when new.website_url ~* '^https://([^/]+\.)?yelp\.com/' then 'yelp'
        when new.website_url ~* '^https://([^/]+\.)?houzz\.com/' then 'houzz'
        else 'website'
      end,
      'isPrimary', true
    )),
    capture_status = case
      when private.listing_intelligence_accounts.source_inventory @>
        jsonb_build_array(jsonb_build_object('url', new.website_url, 'isPrimary', true))
        then private.listing_intelligence_accounts.capture_status
      else 'pending'
    end,
    fact_status = case
      when private.listing_intelligence_accounts.source_inventory @>
        jsonb_build_array(jsonb_build_object('url', new.website_url, 'isPrimary', true))
        then private.listing_intelligence_accounts.fact_status
      else 'pending'
    end,
    seo_audit_status = case
      when private.listing_intelligence_accounts.source_inventory @>
        jsonb_build_array(jsonb_build_object('url', new.website_url, 'isPrimary', true))
        then private.listing_intelligence_accounts.seo_audit_status
      else 'pending'
    end,
    updated_at = statement_timestamp();

    update private.listing_intelligence_accounts account set
      seo_audit_status = case
        when exists (
          select 1 from jsonb_array_elements(account.source_inventory) source
          where source->>'kind' = 'website'
        ) then case
          when account.seo_audit_status = 'not_applicable' then 'pending'
          else account.seo_audit_status
        end
        else 'not_applicable'
      end,
      updated_at = statement_timestamp()
    where listing_id = new.id;
  elsif tg_op = 'UPDATE' and old.website_url is not null then
    update private.listing_intelligence_accounts account set
      source_inventory = remaining.sources,
      capture_status = 'pending',
      fact_status = 'pending',
      seo_audit_status = case
        when exists (
          select 1 from jsonb_array_elements(remaining.sources) source
          where source->>'kind' = 'website'
        ) then 'pending'
        else 'not_applicable'
      end,
      updated_at = statement_timestamp()
    from (
      select coalesce(jsonb_agg(source), '[]'::jsonb) as sources
      from jsonb_array_elements((
        select source_inventory
        from private.listing_intelligence_accounts
        where listing_id = new.id
      )) source
      where coalesce((source->>'isPrimary')::boolean, false) = false
    ) remaining
    where account.listing_id = new.id;
  end if;
  return new;
end;
$$;

create trigger business_listing_intelligence_account
after insert or update of website_url on app.business_listings
for each row execute function private.ensure_listing_intelligence_account();

insert into private.listing_intelligence_accounts (
  listing_id, source_inventory, seo_audit_status
)
select id, jsonb_build_array(jsonb_build_object(
  'url', website_url,
  'kind', case
    when website_url ~* '^https://([^/]+\.)?facebook\.com/' then 'facebook'
    when website_url ~* '^https://([^/]+\.)?yelp\.com/' then 'yelp'
    when website_url ~* '^https://([^/]+\.)?houzz\.com/' then 'houzz'
    else 'website'
  end,
  'isPrimary', true
)), case
  when website_url ~* '^https://([^/]+\.)?(facebook|yelp|houzz)\.com/' then 'not_applicable'
  else 'pending'
end
from app.business_listings
where website_url is not null
on conflict (listing_id) do nothing;

create function public.register_listing_intelligence_sources(
  requested_listing_id uuid,
  requested_sources jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  stored_sources jsonb;
begin
  if not exists (select 1 from app.business_listings where id = requested_listing_id) then
    raise exception 'listing does not exist';
  end if;
  if jsonb_typeof(requested_sources) <> 'array'
     or jsonb_array_length(requested_sources) < 1
     or jsonb_array_length(requested_sources) > 50 then
    raise exception 'sources must contain 1 to 50 records';
  end if;
  if exists (
    select 1
    from jsonb_to_recordset(requested_sources) as source(url text, kind text, "isPrimary" boolean)
    where source.url is null
      or source.url !~ '^https://'
      or source.kind is null
      or source.kind not in ('website', 'facebook', 'yelp', 'houzz', 'directory_landing_page', 'other')
  ) then
    raise exception 'one or more sources are invalid';
  end if;

  select jsonb_agg(item order by item->>'url') into stored_sources
  from (
    select distinct on (source.url) jsonb_build_object(
      'url', source.url,
      'kind', source.kind,
      'isPrimary', coalesce(source."isPrimary", false)
    ) as item
    from jsonb_to_recordset(requested_sources) as source(url text, kind text, "isPrimary" boolean)
    order by source.url, coalesce(source."isPrimary", false) desc
  ) normalized;

  insert into private.listing_intelligence_accounts (listing_id, source_inventory)
  values (requested_listing_id, stored_sources)
  on conflict (listing_id) do update
  set source_inventory = excluded.source_inventory,
      capture_status = case
        when private.listing_intelligence_accounts.source_inventory = excluded.source_inventory
          then private.listing_intelligence_accounts.capture_status
        else 'pending'
      end,
      fact_status = case
        when private.listing_intelligence_accounts.source_inventory = excluded.source_inventory
          then private.listing_intelligence_accounts.fact_status
        else 'pending'
      end,
      seo_audit_status = case
        when not exists (
          select 1 from jsonb_array_elements(excluded.source_inventory) source
          where source->>'kind' = 'website'
        ) then 'not_applicable'
        when private.listing_intelligence_accounts.source_inventory = excluded.source_inventory
          then private.listing_intelligence_accounts.seo_audit_status
        else 'pending'
      end,
      updated_at = statement_timestamp();

  update private.listing_intelligence_accounts account set
    seo_audit_status = case
      when exists (
        select 1 from jsonb_array_elements(account.source_inventory) source
        where source->>'kind' = 'website'
      ) then account.seo_audit_status
      else 'not_applicable'
    end
  where listing_id = requested_listing_id;

  return stored_sources;
end;
$$;

create function public.begin_listing_source_capture(
  requested_listing_id uuid,
  requested_idempotency_key text,
  requested_source_url text,
  requested_source_kind text,
  requested_provider_job_id text,
  requested_terminal_status text,
  requested_completeness_basis text,
  requested_expected_page_count integer,
  requested_discovered_page_count integer,
  requested_failed_page_count integer,
  requested_page_limit integer,
  requested_hit_page_limit boolean,
  requested_pagination_drained boolean,
  requested_robots_respected boolean,
  requested_manifest_sha256 text,
  requested_crawl_config jsonb,
  requested_completeness_blockers jsonb,
  requested_credits_used numeric,
  requested_started_at timestamptz,
  requested_finished_at timestamptz
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  capture private.listing_source_captures%rowtype;
begin
  if not exists (
    select 1
    from private.listing_intelligence_accounts account
    cross join lateral jsonb_array_elements(account.source_inventory) source
    where account.listing_id = requested_listing_id
      and source->>'url' = requested_source_url
      and source->>'kind' = requested_source_kind
  ) then
    raise exception 'capture source is not registered for the listing';
  end if;
  insert into private.listing_source_captures (
    listing_id, idempotency_key, source_url, source_kind, provider_job_id,
    terminal_status, completeness_basis, expected_page_count, discovered_page_count,
    failed_page_count, page_limit, hit_page_limit, pagination_drained, robots_respected,
    manifest_sha256,
    crawl_config, completeness_blockers, credits_used, started_at, finished_at
  ) values (
    requested_listing_id, requested_idempotency_key, requested_source_url,
    requested_source_kind, nullif(trim(requested_provider_job_id), ''),
    requested_terminal_status, requested_completeness_basis, requested_expected_page_count,
    requested_discovered_page_count, requested_failed_page_count, requested_page_limit,
    requested_hit_page_limit, requested_pagination_drained, requested_robots_respected,
    requested_manifest_sha256,
    requested_crawl_config, requested_completeness_blockers, requested_credits_used,
    requested_started_at, requested_finished_at
  )
  on conflict (listing_id, idempotency_key) do nothing;

  select * into strict capture
  from private.listing_source_captures
  where listing_id = requested_listing_id and idempotency_key = requested_idempotency_key;

  if capture.manifest_sha256 <> requested_manifest_sha256
     or capture.source_url <> requested_source_url
     or capture.expected_page_count <> requested_expected_page_count
     or capture.terminal_status <> requested_terminal_status
     or capture.completeness_basis <> requested_completeness_basis
     or capture.robots_respected <> requested_robots_respected then
    raise exception 'existing capture metadata does not match';
  end if;
  return capture.id;
end;
$$;

create function public.ingest_listing_source_capture_pages(
  requested_capture_id bigint,
  requested_pages jsonb
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  inserted_count integer;
begin
  if not exists (
    select 1 from private.listing_source_captures
    where id = requested_capture_id and ingestion_status = 'ingesting'
  ) then
    raise exception 'capture is unavailable for ingestion';
  end if;
  if jsonb_typeof(requested_pages) <> 'array'
     or jsonb_array_length(requested_pages) < 1
     or jsonb_array_length(requested_pages) > 25 then
    raise exception 'pages must contain 1 to 25 records';
  end if;
  if exists (
    select 1
    from jsonb_to_recordset(requested_pages) as page(
      page_index integer, source_url text, canonical_url text, title text,
      http_status integer, content_sha256 text, byte_count bigint,
      content_type text, raw_text text, parsed_payload jsonb, captured_at timestamptz
    )
    where page.page_index < 0
      or page.source_url !~ '^https://'
      or (page.canonical_url is not null and page.canonical_url !~ '^https://')
      or page.content_sha256 !~ '^[a-f0-9]{64}$'
      or page.byte_count <> octet_length(convert_to(page.raw_text, 'UTF8'))
      or page.content_sha256 <> encode(
        extensions.digest(convert_to(page.raw_text, 'UTF8'), 'sha256'), 'hex'
      )
      or page.content_type not in ('application/json', 'application/x-ndjson')
      or (page.parsed_payload is not null and jsonb_typeof(page.parsed_payload) not in ('object', 'array'))
      or page.captured_at is null
  ) then
    raise exception 'one or more pages are invalid';
  end if;

  insert into private.enrichment_raw_artifacts (
    content_sha256, byte_count, content_type, raw_text, parsed_payload
  )
  select distinct on (page.content_sha256)
    page.content_sha256, page.byte_count, page.content_type, page.raw_text, page.parsed_payload
  from jsonb_to_recordset(requested_pages) as page(
    content_sha256 text, byte_count bigint, content_type text, raw_text text, parsed_payload jsonb
  )
  order by page.content_sha256
  on conflict (content_sha256) do nothing;

  if exists (
    select 1
    from jsonb_to_recordset(requested_pages) as requested(
      content_sha256 text, byte_count bigint, raw_text text
    )
    join private.enrichment_raw_artifacts stored
      on stored.content_sha256 = requested.content_sha256
    where stored.byte_count <> requested.byte_count or stored.raw_text <> requested.raw_text
  ) then
    raise exception 'stored raw page content does not match';
  end if;

  insert into private.listing_source_capture_pages (
    capture_id, page_index, source_url, canonical_url, title, http_status, artifact_id, captured_at
  )
  select requested_capture_id, page.page_index, page.source_url,
    nullif(trim(page.canonical_url), ''), nullif(trim(page.title), ''), page.http_status,
    artifact.id, page.captured_at
  from jsonb_to_recordset(requested_pages) as page(
    page_index integer, source_url text, canonical_url text, title text,
    http_status integer, content_sha256 text, captured_at timestamptz
  )
  join private.enrichment_raw_artifacts artifact on artifact.content_sha256 = page.content_sha256
  on conflict (capture_id, page_index) do nothing;
  get diagnostics inserted_count = row_count;

  if exists (
    select 1
    from jsonb_to_recordset(requested_pages) as requested(
      page_index integer, source_url text, content_sha256 text
    )
    join private.listing_source_capture_pages stored_page
      on stored_page.capture_id = requested_capture_id
      and stored_page.page_index = requested.page_index
    join private.enrichment_raw_artifacts stored_raw on stored_raw.id = stored_page.artifact_id
    where stored_page.source_url <> requested.source_url
       or stored_raw.content_sha256 <> requested.content_sha256
  ) then
    raise exception 'stored capture page mapping does not match';
  end if;
  return inserted_count;
end;
$$;

create function public.finalize_listing_source_capture(
  requested_capture_id bigint,
  requested_extractor_version text,
  requested_facts jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  capture private.listing_source_captures%rowtype;
  stored_page_count integer;
  fact_set_id bigint;
begin
  select * into strict capture from private.listing_source_captures where id = requested_capture_id for update;
  select count(*) into stored_page_count
  from private.listing_source_capture_pages where capture_id = requested_capture_id;
  if stored_page_count <> capture.expected_page_count then
    raise exception 'capture page count does not reconcile';
  end if;
  if jsonb_typeof(requested_facts) <> 'object'
     or jsonb_typeof(coalesce(requested_facts->'emails', '[]'::jsonb)) <> 'array'
     or jsonb_typeof(coalesce(requested_facts->'phones', '[]'::jsonb)) <> 'array'
     or jsonb_typeof(coalesce(requested_facts->'addresses', '[]'::jsonb)) <> 'array'
     or jsonb_typeof(coalesce(requested_facts->'serviceAreas', '[]'::jsonb)) <> 'array'
     or jsonb_typeof(coalesce(requested_facts->'services', '[]'::jsonb)) <> 'array'
     or jsonb_typeof(coalesce(requested_facts->'keyDifferentiators', '[]'::jsonb)) <> 'array'
     or jsonb_typeof(coalesce(requested_facts->'provenance', '{}'::jsonb)) <> 'object' then
    raise exception 'facts payload is invalid';
  end if;

  insert into private.listing_source_fact_sets (
    listing_id, capture_id, extractor_version, emails, phones, addresses,
    service_areas, services, key_differentiators, top_service_offering,
    provenance, completeness_score
  ) values (
    capture.listing_id, capture.id, requested_extractor_version,
    array(select jsonb_array_elements_text(coalesce(requested_facts->'emails', '[]'::jsonb))),
    array(select jsonb_array_elements_text(coalesce(requested_facts->'phones', '[]'::jsonb))),
    coalesce(requested_facts->'addresses', '[]'::jsonb),
    coalesce(requested_facts->'serviceAreas', '[]'::jsonb),
    coalesce(requested_facts->'services', '[]'::jsonb),
    coalesce(requested_facts->'keyDifferentiators', '[]'::jsonb),
    nullif(requested_facts->'topServiceOffering', 'null'::jsonb),
    coalesce(requested_facts->'provenance', '{}'::jsonb),
    coalesce((requested_facts->>'completenessScore')::numeric, 0)
  )
  on conflict (capture_id, extractor_version) do nothing
  returning id into fact_set_id;

  if fact_set_id is null then
    select id into strict fact_set_id
    from private.listing_source_fact_sets
    where capture_id = capture.id and extractor_version = requested_extractor_version;
  end if;

  if exists (
    select 1
    from private.listing_source_fact_sets stored
    where stored.id = fact_set_id
      and (
        stored.emails <> array(select jsonb_array_elements_text(coalesce(requested_facts->'emails', '[]'::jsonb)))
        or stored.phones <> array(select jsonb_array_elements_text(coalesce(requested_facts->'phones', '[]'::jsonb)))
        or stored.addresses <> coalesce(requested_facts->'addresses', '[]'::jsonb)
        or stored.service_areas <> coalesce(requested_facts->'serviceAreas', '[]'::jsonb)
        or stored.services <> coalesce(requested_facts->'services', '[]'::jsonb)
        or stored.key_differentiators <> coalesce(requested_facts->'keyDifferentiators', '[]'::jsonb)
        or stored.top_service_offering is distinct from nullif(requested_facts->'topServiceOffering', 'null'::jsonb)
        or stored.provenance <> coalesce(requested_facts->'provenance', '{}'::jsonb)
        or stored.completeness_score <> coalesce((requested_facts->>'completenessScore')::numeric, 0)
      )
  ) then
    raise exception 'stored fact set does not match';
  end if;

  update private.listing_source_captures set ingestion_status = 'finalized'
  where id = capture.id and ingestion_status = 'ingesting';

  insert into private.listing_intelligence_accounts (
    listing_id, source_inventory, capture_status, fact_status, latest_capture_id
  ) values (
    capture.listing_id,
    jsonb_build_array(jsonb_build_object('url', capture.source_url, 'kind', capture.source_kind)),
    capture.terminal_status,
    case
      when capture.terminal_status = 'complete'
       and coalesce((requested_facts->>'completenessScore')::numeric, 0) = 100
        then 'complete'
      else 'partial'
    end,
    capture.id
  )
  on conflict (listing_id) do update set
    fact_status = excluded.fact_status,
    latest_capture_id = excluded.latest_capture_id,
    updated_at = statement_timestamp();

  -- Account-level completeness means every registered source has a finalized,
  -- complete latest capture. One successful website must not hide a missing Yelp,
  -- Facebook, Houzz, or other landing-page record.
  update private.listing_intelligence_accounts account set
    capture_status = coverage.aggregate_status,
    updated_at = statement_timestamp()
  from (
    select
      current_account.listing_id,
      case
        when count(latest.id) = jsonb_array_length(current_account.source_inventory)
         and bool_and(coalesce(latest.terminal_status = 'complete', false))
          then 'complete'
        else 'partial'
      end as aggregate_status
    from private.listing_intelligence_accounts current_account
    cross join lateral jsonb_array_elements(current_account.source_inventory) source
    left join lateral (
      select candidate.id, candidate.terminal_status
      from private.listing_source_captures candidate
      where candidate.listing_id = current_account.listing_id
        and candidate.source_url = source->>'url'
        and candidate.ingestion_status = 'finalized'
      order by candidate.recorded_at desc, candidate.id desc
      limit 1
    ) latest on true
    where current_account.listing_id = capture.listing_id
    group by current_account.listing_id, current_account.source_inventory
  ) coverage
  where account.listing_id = coverage.listing_id;

  return jsonb_build_object(
    'captureId', capture.id,
    'factSetId', fact_set_id,
    'pageCount', stored_page_count,
    'status', capture.terminal_status,
    'accountStatus', (
      select capture_status from private.listing_intelligence_accounts
      where listing_id = capture.listing_id
    )
  );
end;
$$;

create function public.record_listing_seo_audit(
  requested_listing_id uuid,
  requested_capture_id bigint,
  requested_idempotency_key text,
  requested_target_url text,
  requested_provider_task_id text,
  requested_terminal_status text,
  requested_max_crawl_pages integer,
  requested_crawled_pages integer,
  requested_crawl_progress text,
  requested_onpage_score numeric,
  requested_cost_usd numeric,
  requested_request_config jsonb,
  requested_audit_summary jsonb,
  requested_limitations jsonb,
  requested_artifacts jsonb,
  requested_started_at timestamptz,
  requested_finished_at timestamptz
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  audit_id bigint;
begin
  if not exists (
    select 1
    from private.listing_intelligence_accounts account
    cross join lateral jsonb_array_elements(account.source_inventory) source
    where account.listing_id = requested_listing_id
      and source->>'url' = requested_target_url
      and source->>'kind' = 'website'
  ) then
    raise exception 'SEO audit target is not a registered owned website';
  end if;
  if requested_capture_id is not null and not exists (
    select 1 from private.listing_source_captures
    where id = requested_capture_id and listing_id = requested_listing_id
  ) then
    raise exception 'SEO audit capture belongs to a different listing';
  end if;
  if jsonb_typeof(requested_artifacts) <> 'array'
     or jsonb_array_length(requested_artifacts) < 1
     or jsonb_array_length(requested_artifacts) > 25 then
    raise exception 'audit artifacts must contain 1 to 25 records';
  end if;
  if requested_terminal_status = 'complete' and exists (
    select required.kind
    from unnest(array['task_post', 'task_status', 'summary', 'pages']) required(kind)
    where not exists (
      select 1
      from jsonb_to_recordset(requested_artifacts) artifact(artifact_kind text)
      where artifact.artifact_kind = required.kind
    )
  ) then
    raise exception 'complete SEO audit requires task_post, task_status, summary, and pages artifacts';
  end if;
  if exists (
    select 1
    from jsonb_to_recordset(requested_artifacts) as artifact(
      artifact_kind text, artifact_index integer, content_sha256 text,
      byte_count bigint, content_type text, raw_text text, parsed_payload jsonb
    )
    where artifact.artifact_kind not in ('task_post', 'task_status', 'summary', 'pages', 'lighthouse', 'other')
      or artifact.artifact_index < 0
      or artifact.content_sha256 !~ '^[a-f0-9]{64}$'
      or artifact.byte_count <> octet_length(convert_to(artifact.raw_text, 'UTF8'))
      or artifact.content_sha256 <> encode(
        extensions.digest(convert_to(artifact.raw_text, 'UTF8'), 'sha256'), 'hex'
      )
      or artifact.content_type not in ('application/json', 'application/x-ndjson')
  ) then
    raise exception 'one or more audit artifacts are invalid';
  end if;

  insert into private.listing_seo_audits (
    listing_id, capture_id, idempotency_key, target_url, provider_task_id,
    terminal_status, max_crawl_pages, crawled_pages, crawl_progress, onpage_score,
    cost_usd, request_config, audit_summary, limitations, started_at, finished_at
  ) values (
    requested_listing_id, requested_capture_id, requested_idempotency_key,
    requested_target_url, nullif(trim(requested_provider_task_id), ''),
    requested_terminal_status, requested_max_crawl_pages, requested_crawled_pages,
    requested_crawl_progress, requested_onpage_score, requested_cost_usd,
    requested_request_config, requested_audit_summary, requested_limitations,
    requested_started_at, requested_finished_at
  )
  on conflict (listing_id, idempotency_key) do nothing
  returning id into audit_id;

  if audit_id is null then
    select id into strict audit_id from private.listing_seo_audits existing
    where listing_id = requested_listing_id and idempotency_key = requested_idempotency_key;
    if exists (
      select 1 from private.listing_seo_audits existing
      where existing.id = audit_id
        and (
          existing.target_url <> requested_target_url
          or existing.terminal_status <> requested_terminal_status
          or existing.request_config <> requested_request_config
          or existing.audit_summary <> requested_audit_summary
        )
    ) then
      raise exception 'existing SEO audit metadata does not match';
    end if;
    update private.listing_intelligence_accounts set
      seo_audit_status = requested_terminal_status,
      latest_seo_audit_id = audit_id,
      updated_at = statement_timestamp()
    where listing_id = requested_listing_id;
    return audit_id;
  end if;

  insert into private.enrichment_raw_artifacts (
    content_sha256, byte_count, content_type, raw_text, parsed_payload
  )
  select distinct on (artifact.content_sha256)
    artifact.content_sha256, artifact.byte_count, artifact.content_type,
    artifact.raw_text, artifact.parsed_payload
  from jsonb_to_recordset(requested_artifacts) as artifact(
    content_sha256 text, byte_count bigint, content_type text, raw_text text, parsed_payload jsonb
  )
  order by artifact.content_sha256
  on conflict (content_sha256) do nothing;

  if exists (
    select 1
    from jsonb_to_recordset(requested_artifacts) as requested(
      content_sha256 text, byte_count bigint, raw_text text
    )
    join private.enrichment_raw_artifacts stored
      on stored.content_sha256 = requested.content_sha256
    where stored.byte_count <> requested.byte_count or stored.raw_text <> requested.raw_text
  ) then
    raise exception 'stored raw SEO artifact does not match';
  end if;

  insert into private.listing_seo_audit_artifacts (audit_id, artifact_kind, artifact_index, artifact_id)
  select audit_id, artifact.artifact_kind, artifact.artifact_index, raw.id
  from jsonb_to_recordset(requested_artifacts) as artifact(
    artifact_kind text, artifact_index integer, content_sha256 text
  )
  join private.enrichment_raw_artifacts raw on raw.content_sha256 = artifact.content_sha256;

  update private.listing_intelligence_accounts set
    seo_audit_status = requested_terminal_status,
    latest_seo_audit_id = audit_id,
    updated_at = statement_timestamp()
  where listing_id = requested_listing_id;

  return audit_id;
end;
$$;

create function public.record_listing_content_intelligence_candidate(
  requested_listing_id uuid,
  requested_fact_set_id bigint,
  requested_seo_audit_id bigint,
  requested_generator_version text,
  requested_top_service_offering text,
  requested_decision_tree jsonb,
  requested_proposed_content jsonb,
  requested_claim_provenance jsonb,
  requested_uniqueness_receipt jsonb
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  candidate_id bigint;
begin
  if not exists (
    select 1 from private.listing_source_fact_sets
    where id = requested_fact_set_id and listing_id = requested_listing_id
  ) or not exists (
    select 1 from private.listing_seo_audits
    where id = requested_seo_audit_id
      and listing_id = requested_listing_id
      and terminal_status in ('complete', 'partial')
  ) then
    raise exception 'content evidence does not belong to the listing';
  end if;

  insert into app.listing_content_intelligence_candidates (
    listing_id, fact_set_id, seo_audit_id, generator_version, top_service_offering,
    local_searcher_decision_tree, proposed_content, claim_provenance, uniqueness_receipt
  ) values (
    requested_listing_id, requested_fact_set_id, requested_seo_audit_id,
    requested_generator_version, requested_top_service_offering,
    requested_decision_tree, requested_proposed_content,
    requested_claim_provenance, requested_uniqueness_receipt
  )
  returning id into candidate_id;
  return candidate_id;
end;
$$;

revoke all on function private.ensure_listing_intelligence_account() from public;
revoke all on function public.register_listing_intelligence_sources(uuid, jsonb)
  from public, anon, authenticated;
revoke all on function public.begin_listing_source_capture(
  uuid, text, text, text, text, text, text, integer, integer, integer,
  integer, boolean, boolean, boolean, text, jsonb, jsonb, numeric, timestamptz, timestamptz
) from public, anon, authenticated;
revoke all on function public.ingest_listing_source_capture_pages(bigint, jsonb)
  from public, anon, authenticated;
revoke all on function public.finalize_listing_source_capture(bigint, text, jsonb)
  from public, anon, authenticated;
revoke all on function public.record_listing_seo_audit(
  uuid, bigint, text, text, text, text, integer, integer, text, numeric,
  numeric, jsonb, jsonb, jsonb, jsonb, timestamptz, timestamptz
) from public, anon, authenticated;
revoke all on function public.record_listing_content_intelligence_candidate(
  uuid, bigint, bigint, text, text, jsonb, jsonb, jsonb, jsonb
) from public, anon, authenticated;

grant execute on function public.register_listing_intelligence_sources(uuid, jsonb) to service_role;
grant execute on function public.begin_listing_source_capture(
  uuid, text, text, text, text, text, text, integer, integer, integer,
  integer, boolean, boolean, boolean, text, jsonb, jsonb, numeric, timestamptz, timestamptz
) to service_role;
grant execute on function public.ingest_listing_source_capture_pages(bigint, jsonb) to service_role;
grant execute on function public.finalize_listing_source_capture(bigint, text, jsonb) to service_role;
grant execute on function public.record_listing_seo_audit(
  uuid, bigint, text, text, text, text, integer, integer, text, numeric,
  numeric, jsonb, jsonb, jsonb, jsonb, timestamptz, timestamptz
) to service_role;
grant execute on function public.record_listing_content_intelligence_candidate(
  uuid, bigint, bigint, text, text, jsonb, jsonb, jsonb, jsonb
) to service_role;

comment on table private.listing_intelligence_accounts is
  'One current private intelligence index per Listing; raw captures and audits remain append-only children.';
comment on table private.listing_source_capture_pages is
  'Every Firecrawl page returned for a Listing source, linked to byte-preserving raw provider evidence.';
comment on table private.listing_source_fact_sets is
  'Private extracted emails, phones, addresses, service areas, services, differentiators, and provenance.';
comment on table private.listing_seo_audits is
  'Listing-linked DataForSEO OnPage audit receipts. Complete raw responses are linked through listing_seo_audit_artifacts.';
comment on table app.listing_content_intelligence_candidates is
  'Review-only content proposals; this table is not publication authority and contains claim-level provenance.';

commit;
