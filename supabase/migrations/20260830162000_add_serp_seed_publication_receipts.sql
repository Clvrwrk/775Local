begin;

alter table app.business_listings alter column postal_code drop not null;
alter table app.business_listings drop constraint if exists business_listings_postal_code_check;
alter table app.business_listings add constraint business_listings_postal_code_check
  check (postal_code is null or postal_code ~ '^89[0-9]{3}$') not valid;
alter table app.business_listings validate constraint business_listings_postal_code_check;
alter table app.business_listings add constraint business_listings_location_completeness_check
  check (is_service_area or postal_code is not null) not valid;
alter table app.business_listings validate constraint business_listings_location_completeness_check;

create table app.serp_seed_publication_batches (
  id uuid primary key default extensions.gen_random_uuid(),
  receipt_sha256 text not null unique check (receipt_sha256 ~ '^[a-f0-9]{64}$'),
  payload_fingerprint text not null check (payload_fingerprint ~ '^[a-f0-9]{64}$'),
  filter_version text not null check (filter_version = 'business-controlled-domain-v10'),
  listing_count integer not null check (listing_count = 100),
  category_count integer not null check (category_count = 10),
  tier_mix jsonb not null check (
    tier_mix = '{"basic": 60, "standard": 30, "premium": 10}'::jsonb
  ),
  partial_evidence_count integer not null check (partial_evidence_count between 0 and 100),
  published_at timestamptz not null default statement_timestamp()
);

create table app.serp_seed_publication_receipts (
  id bigint generated always as identity primary key,
  batch_id uuid not null references app.serp_seed_publication_batches(id),
  listing_id uuid not null unique references app.business_listings(id),
  category_slug text not null references app.categories(slug),
  domain text not null unique,
  source_url text not null check (source_url ~ '^https://'),
  serp_rank integer not null check (serp_rank > 0),
  evidence_status text not null check (evidence_status in ('complete', 'partial')),
  tier_evidence jsonb not null check (jsonb_typeof(tier_evidence) = 'object'),
  source_urls jsonb not null check (jsonb_typeof(source_urls) = 'array'),
  source_checked_at timestamptz not null,
  published_at timestamptz not null default statement_timestamp(),
  unique (batch_id, category_slug, domain)
);

create index serp_seed_publication_receipts_category_idx
  on app.serp_seed_publication_receipts (category_slug);

alter table app.serp_seed_publication_batches enable row level security;
alter table app.serp_seed_publication_receipts enable row level security;
revoke all on app.serp_seed_publication_batches, app.serp_seed_publication_receipts
  from public, anon, authenticated;
grant all on app.serp_seed_publication_batches, app.serp_seed_publication_receipts
  to service_role;

comment on table app.serp_seed_publication_batches is
  'Append-only batch receipt for the owner-approved top-10-category SERP seed.';
comment on table app.serp_seed_publication_receipts is
  'Append-only per-listing evidence receipts. Claim and verification remain absent.';

create trigger serp_seed_publication_batches_append_only
before update or delete on app.serp_seed_publication_batches
for each row execute function private.reject_mutation();

create trigger serp_seed_publication_receipts_append_only
before update or delete on app.serp_seed_publication_receipts
for each row execute function private.reject_mutation();

create or replace function private.publish_serp_seed(seed jsonb)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, app, private, extensions
as $$
declare
  batch_id_value uuid;
  row_value jsonb;
  business_id_value uuid;
  listing_id_value uuid;
  category_id_value uuid;
  listing_count_value integer;
  category_count_value integer;
  partial_count_value integer;
  tier_mix_value jsonb;
  domain_count_value integer;
  slug_count_value integer;
  bad_category_count_value integer;
  bad_tier_count_value integer;
  receipt_sha_value text := seed ->> 'receiptSha256';
  filter_version_value text := seed ->> 'filterVersion';
  payload_fingerprint_value text := encode(
    extensions.digest((seed -> 'listings')::text, 'sha256'),
    'hex'
  );
  computed_receipt_sha_value text;
  stored_payload_fingerprint_value text;
begin
  if jsonb_typeof(seed) <> 'object'
     or jsonb_typeof(seed -> 'listings') <> 'array'
     or (seed ->> 'schemaVersion')::integer <> 1 then
    raise exception 'invalid SERP seed envelope';
  end if;
  if receipt_sha_value is null or receipt_sha_value !~ '^[a-f0-9]{64}$' then
    raise exception 'invalid SERP seed receipt hash';
  end if;
  select encode(
    extensions.digest(
      string_agg(
        concat_ws(
          '|',
          coalesce(item ->> 'domain', ''),
          coalesce(item ->> 'slug', ''),
          coalesce(item ->> 'categorySlug', ''),
          coalesce(item ->> 'serpRank', ''),
          coalesce(item ->> 'contentTier', ''),
          coalesce(item ->> 'evidenceStatus', ''),
          coalesce(item ->> 'sourceCheckedAt', '')
        ),
        E'\n' order by ordinal
      ),
      'sha256'
    ),
    'hex'
  ) into computed_receipt_sha_value
  from jsonb_array_elements(seed -> 'listings') with ordinality as listing(item, ordinal);
  if receipt_sha_value <> computed_receipt_sha_value then
    raise exception 'SERP seed receipt hash does not match its normalized Listing manifest';
  end if;
  if filter_version_value <> 'business-controlled-domain-v10' then
    raise exception 'stale SERP seed filter';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(receipt_sha_value, 0));

  select id, payload_fingerprint into batch_id_value, stored_payload_fingerprint_value
  from app.serp_seed_publication_batches
  where receipt_sha256 = receipt_sha_value;
  if batch_id_value is not null then
    if stored_payload_fingerprint_value <> payload_fingerprint_value then
      raise exception 'SERP seed receipt hash conflicts with a different payload';
    end if;
    return jsonb_build_object(
      'batchId', batch_id_value,
      'receiptSha256', receipt_sha_value,
      'listingCount', 100,
      'idempotent', true
    );
  end if;

  select
    count(*),
    count(distinct item ->> 'categorySlug'),
    count(*) filter (where item ->> 'evidenceStatus' = 'partial'),
    jsonb_build_object(
      'basic', count(*) filter (where item ->> 'contentTier' = 'basic'),
      'standard', count(*) filter (where item ->> 'contentTier' = 'standard'),
      'premium', count(*) filter (where item ->> 'contentTier' = 'premium')
    ),
    count(distinct lower(item ->> 'domain')),
    count(distinct lower(item ->> 'slug')),
    count(*) filter (where item ->> 'categorySlug' not in (
      'screen-repair', 'hvac', 'plumbing', 'electrical', 'auto-repair',
      'restaurants', 'dentists', 'handyman', 'roofing', 'veterinarians'
    )),
    count(*) filter (
      where (item ->> 'contentTier' = 'premium' and (
        coalesce((item #>> '{tierEvidence,moduleCount}')::integer, 0) < 3
        or not (
          coalesce((item #>> '{tierEvidence,modules,faqs}')::boolean, false)
          or coalesce((item #>> '{tierEvidence,modules,projects}')::boolean, false)
        )
      ))
      or (item ->> 'contentTier' = 'standard'
        and coalesce((item #>> '{tierEvidence,moduleCount}')::integer, 0) < 2)
    )
  into
    listing_count_value,
    category_count_value,
    partial_count_value,
    tier_mix_value,
    domain_count_value,
    slug_count_value,
    bad_category_count_value,
    bad_tier_count_value
  from jsonb_array_elements(seed -> 'listings') as listing(item);

  if listing_count_value <> 100 or category_count_value <> 10
     or domain_count_value <> 100 or slug_count_value <> 100 then
    raise exception 'SERP seed must contain 100 unique Listings across 10 categories';
  end if;
  if tier_mix_value <> '{"basic": 60, "standard": 30, "premium": 10}'::jsonb then
    raise exception 'SERP seed must use the exact 60/30/10 tier mix';
  end if;
  if bad_category_count_value <> 0 or bad_tier_count_value <> 0 then
    raise exception 'SERP seed contains an invalid category or overstated tier';
  end if;
  if exists (
    select 1
    from jsonb_array_elements(seed -> 'listings') as listing(item)
    where item ->> 'evidenceStatus' not in ('complete', 'partial')
       or item ->> 'websiteUrl' !~ '^https://'
       or item ->> 'domain' !~ '^[a-z0-9.-]+$'
       or item ->> 'slug' !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'
       or item ->> 'citySlug' not in ('reno', 'sparks')
       or (item ->> 'postalCode' is not null and item ->> 'postalCode' !~ '^89[0-9]{3}$')
       or jsonb_typeof(item -> 'isServiceArea') is distinct from 'boolean'
       or ((item ->> 'isServiceArea')::boolean = false
           and item ->> 'postalCode' is null)
       or jsonb_typeof(item -> 'services') <> 'array'
       or jsonb_typeof(item -> 'faqs') <> 'array'
       or jsonb_typeof(item -> 'projects') <> 'array'
       or jsonb_typeof(item -> 'sourceUrls') <> 'array'
       or jsonb_array_length(item -> 'sourceUrls') = 0
       or item ->> 'ownerVerifiedAt' is not null
       or item ->> 'informationCheckedAt' is not null
  ) then
    raise exception 'SERP seed contains an invalid or verified Listing';
  end if;
  if exists (
    select item ->> 'categorySlug'
    from jsonb_array_elements(seed -> 'listings') as listing(item)
    group by item ->> 'categorySlug'
    having count(*) <> 10
  ) then
    raise exception 'SERP seed must contain exactly 10 Listings per category';
  end if;
  if exists (
    select 1
    from jsonb_array_elements(seed -> 'listings') as listing(item)
    join app.businesses business
      on business.import_identity_key = 'serp-domain:' || lower(item ->> 'domain')
  ) then
    raise exception 'SERP seed domain conflicts with an existing Business';
  end if;

  insert into app.serp_seed_publication_batches (
    receipt_sha256,
    payload_fingerprint,
    filter_version,
    listing_count,
    category_count,
    tier_mix,
    partial_evidence_count
  ) values (
    receipt_sha_value,
    payload_fingerprint_value,
    filter_version_value,
    listing_count_value,
    category_count_value,
    tier_mix_value,
    partial_count_value
  ) returning id into batch_id_value;

  for row_value in select item from jsonb_array_elements(seed -> 'listings') as listing(item)
  loop
    select id into category_id_value
    from app.categories
    where slug = row_value ->> 'categorySlug';
    if category_id_value is null then
      raise exception 'SERP seed category does not exist';
    end if;

    insert into app.businesses (canonical_name, import_identity_key)
    values (
      left(row_value ->> 'displayName', 200),
      'serp-domain:' || lower(row_value ->> 'domain')
    ) returning id into business_id_value;

    insert into app.business_listings (
      business_id, current_slug, display_name, description, phone_e164, website_url,
      street_address, city_slug, postal_code, is_service_area, hide_street,
      publication_status, information_checked_at, owner_verified_at, published_at, content_tier
    ) values (
      business_id_value,
      row_value ->> 'slug',
      left(row_value ->> 'displayName', 200),
      nullif(row_value ->> 'description', ''),
      nullif(row_value ->> 'phoneE164', ''),
      row_value ->> 'websiteUrl',
      nullif(row_value ->> 'streetAddress', ''),
      row_value ->> 'citySlug',
      nullif(row_value ->> 'postalCode', ''),
      (row_value ->> 'isServiceArea')::boolean,
      true,
      'published', null, null, statement_timestamp(),
      row_value ->> 'contentTier'
    ) returning id into listing_id_value;

    insert into app.listing_slugs (slug, listing_id)
    values (row_value ->> 'slug', listing_id_value);
    insert into app.listing_categories (listing_id, category_id, is_primary)
    values (listing_id_value, category_id_value, true);

    insert into app.listing_content (listing_id, about, services, faqs, projects, content_status)
    values (
      listing_id_value,
      nullif(row_value ->> 'description', ''),
      array(select jsonb_array_elements_text(row_value -> 'services')),
      row_value -> 'faqs',
      row_value -> 'projects',
      'approved'
    );

    insert into app.listing_revisions (
      listing_id, revision_type, before_values, after_values, reason_codes
    ) values (
      listing_id_value,
      'created',
      '{}'::jsonb,
      jsonb_build_object(
        'publication_status', 'published',
        'content_tier', row_value ->> 'contentTier',
        'owner_verified_at', null,
        'information_checked_at', null,
        'serp_seed_receipt_sha256', receipt_sha_value
      ),
      array['owner_approved_serp_seed', 'unclaimed_unverified']
    );

    insert into app.serp_seed_publication_receipts (
      batch_id, listing_id, category_slug, domain, source_url, serp_rank,
      evidence_status, tier_evidence, source_urls, source_checked_at
    ) values (
      batch_id_value,
      listing_id_value,
      row_value ->> 'categorySlug',
      lower(row_value ->> 'domain'),
      row_value ->> 'websiteUrl',
      (row_value ->> 'serpRank')::integer,
      row_value ->> 'evidenceStatus',
      row_value -> 'tierEvidence',
      row_value -> 'sourceUrls',
      (row_value ->> 'sourceCheckedAt')::timestamptz
    );

    insert into app.audit_events (
      actor_kind, action, target_type, target_id, reason, after_ref, correlation_id
    ) values (
      'system',
      'serp_seed_listing_published',
      'business_listing',
      listing_id_value::text,
      'Owner-approved seed example; remains unclaimed and unverified.',
      jsonb_build_object(
        'content_tier', row_value ->> 'contentTier',
        'category_slug', row_value ->> 'categorySlug',
        'receipt_sha256', receipt_sha_value
      ),
      receipt_sha_value
    );
  end loop;

  return jsonb_build_object(
    'batchId', batch_id_value,
    'receiptSha256', receipt_sha_value,
    'listingCount', listing_count_value,
    'categoryCount', category_count_value,
    'tierMix', tier_mix_value,
    'partialEvidenceCount', partial_count_value,
    'idempotent', false
  );
end;
$$;

revoke all on function private.publish_serp_seed(jsonb) from public, anon, authenticated;
grant execute on function private.publish_serp_seed(jsonb) to service_role;

commit;
