\set ON_ERROR_STOP on

begin;

insert into app.actors (id, workos_user_id, primary_email, display_name)
values
  ('50000000-0000-4000-8000-000000000001', 'user_http_reviewer', 'reviewer@example.test', 'HTTP Reviewer'),
  ('50000000-0000-4000-8000-000000000002', 'user_http_publisher', 'chussey@aia4.io', 'HTTP Publisher');

insert into app.operator_grants (
  actor_id,
  allowlisted_email,
  permissions,
  status,
  approved_by,
  approved_at,
  workos_organization_id
) values (
  '50000000-0000-4000-8000-000000000002',
  'chussey@aia4.io',
  array['listing_publish'],
  'active',
  'cle104-http-contract',
  statement_timestamp(),
  'org_local775_http'
);

insert into private.source_batches (
  id,
  source_name,
  source_sha256,
  workbook_row_count,
  imported_by
) values (
  '50000000-0000-4000-8000-000000000010',
  'cle104-http-contract',
  repeat('e', 64),
  100,
  'cle104-http-contract'
);

insert into private.source_listing_rows (
  batch_id,
  worksheet,
  source_row,
  row_sha256,
  raw_payload
)
select
  '50000000-0000-4000-8000-000000000010',
  'cle104-http-contract',
  source_row,
  encode(extensions.digest('cle104-http-source-' || source_row::text, 'sha256'), 'hex'),
  jsonb_build_object('source_row', source_row)
from generate_series(1, 100) source_row;

with launch_matrix as (
  select
    category.slug as category_slug,
    city.city_slug,
    slot.slot,
    row_number() over (order by category.slug, city.city_slug, slot.slot) as source_row
  from app.categories category
  cross join (values ('reno'), ('sparks')) city(city_slug)
  cross join generate_series(1, 5) slot(slot)
  where category.is_launch_category
)
insert into app.listing_candidates (
  batch_id,
  source_row_id,
  normalized_name,
  proposed_slug,
  phone_e164,
  business_email,
  website_url,
  street_address,
  city_slug,
  postal_code,
  google_place_id,
  source_category,
  launch_category_slug,
  active_profile_status,
  screening_status,
  screening_reasons,
  quality_score,
  diversity_key,
  evidence,
  review_status,
  review_reason_codes,
  reviewed_by,
  reviewed_at
)
select
  '50000000-0000-4000-8000-000000000010',
  source.id,
  'HTTP ' || initcap(replace(matrix.category_slug, '-', ' ')) || ' ' || initcap(matrix.city_slug) || ' ' || matrix.slot,
  'http-' || matrix.category_slug || '-' || matrix.city_slug || '-' || matrix.slot,
  '+1775' || lpad((5560000 + matrix.source_row)::text, 7, '0'),
  'hello@http-' || matrix.category_slug || '-' || matrix.city_slug || '-' || matrix.slot || '.example',
  'https://http-' || matrix.category_slug || '-' || matrix.city_slug || '-' || matrix.slot || '.example/',
  matrix.source_row || ' HTTP Street',
  matrix.city_slug,
  case when matrix.city_slug = 'reno' then '89502' else '89431' end,
  'cle104-http-place-' || matrix.source_row,
  matrix.category_slug,
  matrix.category_slug,
  'active',
  'eligible',
  '{}',
  100 - matrix.slot,
  'http-' || matrix.category_slug || '-' || matrix.city_slug || '-' || matrix.slot || '.example',
  jsonb_build_object('http_contract', true),
  'accepted',
  array['http_operator_reviewed'],
  '50000000-0000-4000-8000-000000000001',
  statement_timestamp()
from launch_matrix matrix
join private.source_listing_rows source
  on source.batch_id = '50000000-0000-4000-8000-000000000010'
  and source.source_row = matrix.source_row;

insert into app.candidate_review_receipts (
  candidate_id,
  idempotency_key,
  request_fingerprint,
  reviewer_id,
  outcome,
  resolved_screening_reasons,
  source_urls,
  source_checked_at,
  checks,
  duplicate_decision,
  entity_decisions,
  reason_codes,
  before_values,
  after_values,
  reviewed_candidate,
  reviewed_candidate_fingerprint
)
select
  candidate.id,
  'cle104-http-review-' || candidate.id::text,
  encode(extensions.digest('cle104-http-review-' || candidate.id::text, 'sha256'), 'hex'),
  '50000000-0000-4000-8000-000000000001',
  'accepted',
  '{}',
  jsonb_build_array(candidate.website_url),
  statement_timestamp(),
  jsonb_build_object(
    'nap_verified', true,
    'category_verified', true,
    'active_status_verified', true,
    'source_urls_current', true
  ),
  'no_duplicate',
  jsonb_build_object(
    'branch', 'not_branch',
    'chain', 'not_chain',
    'practitioner', 'not_practitioner',
    'franchise', 'not_franchise',
    'service_area', 'fixed_location'
  ),
  array['http_operator_reviewed'],
  '{}'::jsonb,
  jsonb_build_object(
    'review_status', 'accepted',
    'reviewed_by', '50000000-0000-4000-8000-000000000001'
  ),
  private.candidate_publication_snapshot(candidate),
  encode(
    extensions.digest(private.candidate_publication_snapshot(candidate)::text, 'sha256'),
    'hex'
  )
from app.listing_candidates candidate
where candidate.batch_id = '50000000-0000-4000-8000-000000000010';

commit;
