begin;

create extension if not exists pgtap with schema extensions;
select extensions.plan(57);

insert into app.actors (id, workos_user_id, primary_email, display_name)
values
  ('30000000-0000-4000-8000-000000000001', 'user_operator', 'chussey@aia4.io', 'Launch Operator'),
  ('30000000-0000-4000-8000-000000000002', 'user_nonoperator', 'person@example.test', 'Ordinary User'),
  ('30000000-0000-4000-8000-000000000003', 'user_limited_operator', 'chussey@aia4.io', 'Limited Operator'),
  ('30000000-0000-4000-8000-000000000004', 'user_publisher', 'chussey@aia4.io', 'Launch Publisher');

insert into app.operator_grants (
  actor_id,
  allowlisted_email,
  permissions,
  status,
  approved_by,
  approved_at,
  workos_organization_id
) values (
  '30000000-0000-4000-8000-000000000001',
  'chussey@aia4.io',
  array['listing_review', 'listing_publish'],
  'active',
  'cle104-test',
  statement_timestamp(),
  'org_local775'
), (
  '30000000-0000-4000-8000-000000000003',
  'chussey@aia4.io',
  '{}',
  'active',
  'cle104-test',
  statement_timestamp(),
  'org_local775'
), (
  '30000000-0000-4000-8000-000000000004',
  'chussey@aia4.io',
  array['listing_publish'],
  'active',
  'cle104-test',
  statement_timestamp(),
  'org_local775'
);

insert into private.source_batches (
  id, source_name, source_sha256, workbook_row_count, imported_by
) values (
  '30000000-0000-4000-8000-000000000010',
  'cle104-operator-publication-test',
  repeat('d', 64),
  101,
  'supabase-test'
);

insert into private.source_listing_rows (
  batch_id, worksheet, source_row, row_sha256, raw_payload
)
select
  '30000000-0000-4000-8000-000000000010',
  'cle104-publication',
  source_row,
  encode(extensions.digest('cle104-source-' || source_row::text, 'sha256'), 'hex'),
  jsonb_build_object('source_row', source_row)
from generate_series(1, 101) source_row;

insert into app.listing_candidates (
  id,
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
  evidence
)
select
  '30000000-0000-4000-8000-000000000011',
  '30000000-0000-4000-8000-000000000010',
  source.id,
  'Needs Review Business',
  'needs-review-business',
  '+17755550101',
  'hello@needs-review.example',
  'https://needs-review.example/',
  '1 Review Way',
  'reno',
  '89502',
  'cle104-review-place',
  'HVAC contractor',
  'hvac',
  'active',
  'needs_review',
  array['shared_business_domain_entity_review'],
  100,
  'needs-review.example',
  jsonb_build_object('website_host', 'needs-review.example')
from private.source_listing_rows source
where source.batch_id = '30000000-0000-4000-8000-000000000010'
  and source.source_row = 1;

with launch_matrix as (
  select
    category.slug as category_slug,
    city.city_slug,
    slot.slot,
    1 + row_number() over (
      order by category.slug, city.city_slug, slot.slot
    ) as source_row
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
  evidence
)
select
  '30000000-0000-4000-8000-000000000010',
  source.id,
  initcap(replace(matrix.category_slug, '-', ' ')) || ' ' || initcap(matrix.city_slug) || ' ' || matrix.slot,
  matrix.category_slug || '-' || matrix.city_slug || '-' || matrix.slot,
  '+1775' || lpad((5551000 + matrix.source_row)::text, 7, '0'),
  'hello@' || matrix.category_slug || '-' || matrix.city_slug || '-' || matrix.slot || '.example',
  'https://' || matrix.category_slug || '-' || matrix.city_slug || '-' || matrix.slot || '.example/',
  matrix.source_row || ' Launch Street',
  matrix.city_slug,
  case when matrix.city_slug = 'reno' then '89502' else '89431' end,
  'cle104-place-' || matrix.source_row,
  matrix.category_slug,
  matrix.category_slug,
  'active',
  'eligible',
  '{}',
  100 - matrix.slot,
  matrix.category_slug || '-' || matrix.city_slug || '-' || matrix.slot || '.example',
  jsonb_build_object(
    'website_host', matrix.category_slug || '-' || matrix.city_slug || '-' || matrix.slot || '.example'
  )
from launch_matrix matrix
join private.source_listing_rows source
  on source.batch_id = '30000000-0000-4000-8000-000000000010'
  and source.source_row = matrix.source_row;

update app.listing_candidates
set latitude = 39.529600,
    longitude = -119.813800
where batch_id = '30000000-0000-4000-8000-000000000010'
  and id <> '30000000-0000-4000-8000-000000000011';

update app.listing_candidates
set normalized_name = 'Shared HVAC Business'
where proposed_slug in ('hvac-reno-2', 'hvac-sparks-2');

insert into private.source_batches (
  id, source_name, source_sha256, workbook_row_count, imported_by
) values (
  '30000000-0000-4000-8000-000000000020',
  'cle104-stale-publication-test',
  repeat('f', 64),
  1,
  'supabase-test'
);

insert into private.source_listing_rows (
  batch_id, worksheet, source_row, row_sha256, raw_payload
) values (
  '30000000-0000-4000-8000-000000000020',
  'cle104-stale-publication',
  1,
  repeat('1', 64),
  '{"source_row":1}'::jsonb
);

insert into app.listing_candidates (
  id,
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
) values (
  '30000000-0000-4000-8000-000000000012',
  '30000000-0000-4000-8000-000000000020',
  (select id from private.source_listing_rows where batch_id = '30000000-0000-4000-8000-000000000020'),
  'Stale HVAC Business',
  'stale-hvac-reno',
  '+17755550999',
  'hello@stale-hvac.example',
  'https://stale-hvac.example/',
  '99 Stale Street',
  'reno',
  '89502',
  'cle104-stale-place',
  'HVAC contractor',
  'hvac',
  'active',
  'eligible',
  '{}',
  90,
  'stale-hvac.example',
  '{"website_host":"stale-hvac.example"}'::jsonb,
  'accepted',
  array['operator_verified_stale'],
  '30000000-0000-4000-8000-000000000001',
  statement_timestamp() - interval '31 days'
);

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
  business_identity_key,
  entity_decisions,
  reason_codes,
  before_values,
  after_values,
  reviewed_candidate,
  reviewed_candidate_fingerprint
)
select
  candidate.id,
  'cle104-stale-review-receipt',
  repeat('2', 64),
  '30000000-0000-4000-8000-000000000001',
  'accepted',
  '{}',
  jsonb_build_array(candidate.website_url),
  statement_timestamp() - interval '31 days',
  '{"nap_verified":true,"category_verified":true,"active_status_verified":true,"source_urls_current":true}'::jsonb,
  'no_duplicate',
  candidate.id::text,
  '{"branch":"not_branch","chain":"not_chain","practitioner":"not_practitioner","franchise":"not_franchise","service_area":"fixed_location"}'::jsonb,
  array['operator_verified_stale'],
  '{}'::jsonb,
  '{"review_status":"accepted"}'::jsonb,
  private.candidate_publication_snapshot(candidate),
  encode(extensions.digest(private.candidate_publication_snapshot(candidate)::text, 'sha256'), 'hex')
from app.listing_candidates candidate
where candidate.id = '30000000-0000-4000-8000-000000000012';

select extensions.ok(
  not has_function_privilege(
    'anon',
    'public.review_listing_candidate(uuid,jsonb,text)',
    'execute'
  ),
  'anonymous callers cannot review candidates'
);
select extensions.ok(
  not has_function_privilege(
    'service_role',
    'public.review_listing_candidate(uuid,jsonb,text)',
    'execute'
  ),
  'service role cannot impersonate a human candidate reviewer'
);
select extensions.ok(
  has_function_privilege(
    'authenticated',
    'public.review_listing_candidate(uuid,jsonb,text)',
    'execute'
  ),
  'authenticated callers may enter the guarded review command'
);
select extensions.ok(
  not has_function_privilege(
    'anon',
    'public.publish_launch_selection(uuid[],text)',
    'execute'
  ),
  'anonymous callers cannot publish the launch selection'
);
select extensions.ok(
  not has_function_privilege(
    'service_role',
    'public.publish_launch_selection(uuid[],text)',
    'execute'
  ),
  'service role cannot impersonate a human launch publisher'
);
select extensions.ok(
  has_function_privilege(
    'authenticated',
    'public.publish_launch_selection(uuid[],text)',
    'execute'
  ),
  'authenticated callers may enter the guarded publication command'
);
select extensions.ok(
  not has_table_privilege('service_role', 'app.candidate_review_receipts', 'insert'),
  'service role cannot fabricate candidate review receipts'
);
select extensions.ok(
  not has_table_privilege('service_role', 'app.publication_receipts', 'insert'),
  'service role cannot fabricate publication receipts'
);
select extensions.ok(
  not has_function_privilege(
    'anon',
    'public.transition_listing_publication_state(uuid,text,text[],text)',
    'execute'
  ),
  'anonymous callers cannot invoke Listing rollback transitions'
);
select extensions.ok(
  not has_function_privilege(
    'service_role',
    'public.transition_listing_publication_state(uuid,text,text[],text)',
    'execute'
  ),
  'service role cannot impersonate a human rollback Operator'
);
select extensions.ok(
  has_function_privilege(
    'authenticated',
    'public.transition_listing_publication_state(uuid,text,text[],text)',
    'execute'
  ),
  'authenticated callers may enter the guarded Listing transition command'
);

select set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'sub', 'user_operator',
    'org_id', 'org_local775',
    'auth_time', extract(epoch from statement_timestamp())::bigint - 901
  )::text,
  true
);
set local role authenticated;

select extensions.throws_ok(
  $$
    select public.review_listing_candidate(
      '30000000-0000-4000-8000-000000000011',
      '{}'::jsonb,
      'cle104-stale-review'
    )
  $$,
  'P0001',
  'recent Operator authentication is required',
  'stale Operator authentication fails closed'
);

select set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'sub', 'user_operator',
    'org_id', 'org_wrong',
    'auth_time', extract(epoch from statement_timestamp())::bigint
  )::text,
  true
);

select extensions.throws_ok(
  $$
    select public.review_listing_candidate(
      '30000000-0000-4000-8000-000000000011',
      '{}'::jsonb,
      'cle104-wrong-org-review'
    )
  $$,
  'P0001',
  'recent Operator authentication is required',
  'an Operator token for the wrong WorkOS organization cannot review'
);

select set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'sub', 'user_nonoperator',
    'org_id', 'org_local775',
    'auth_time', extract(epoch from statement_timestamp())::bigint
  )::text,
  true
);

select extensions.throws_ok(
  $$
    select public.review_listing_candidate(
      '30000000-0000-4000-8000-000000000011',
      '{}'::jsonb,
      'cle104-nonoperator-review'
    )
  $$,
  'P0001',
  'recent Operator authentication is required',
  'authentication without an Operator Grant cannot review'
);

select set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'sub', 'user_limited_operator',
    'org_id', 'org_local775',
    'auth_time', extract(epoch from statement_timestamp())::bigint
  )::text,
  true
);

select extensions.throws_ok(
  $$
    select public.review_listing_candidate(
      '30000000-0000-4000-8000-000000000011',
      '{}'::jsonb,
      'cle104-limited-review'
    )
  $$,
  'P0001',
  'Operator listing_review permission is required',
  'an Operator Grant without listing-review scope cannot review'
);

select set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'sub', 'user_operator',
    'org_id', 'org_local775',
    'auth_time', extract(epoch from statement_timestamp())::bigint
  )::text,
  true
);

select extensions.throws_ok(
  $$
    select public.review_listing_candidate(
      '30000000-0000-4000-8000-000000000011',
      jsonb_build_object(
        'outcome', 'accepted',
        'resolved_screening_reasons', '[]'::jsonb,
        'source_urls', jsonb_build_array('https://needs-review.example/'),
        'source_checked_at', statement_timestamp(),
        'checks', jsonb_build_object(
          'nap_verified', true,
          'category_verified', true,
          'active_status_verified', true,
          'source_urls_current', true
        ),
        'duplicate_decision', 'no_duplicate',
        'business_identity_key', '30000000-0000-4000-8000-000000000011',
        'entity_decisions', jsonb_build_object(
          'branch', 'not_branch',
          'chain', 'not_chain',
          'practitioner', 'not_practitioner',
          'franchise', 'not_franchise',
          'service_area', 'fixed_location'
        ),
        'reason_codes', jsonb_build_array('missing_resolution')
      ),
      'cle104-unresolved-review'
    )
  $$,
  'P0001',
  'accepted review must explicitly resolve every screening reason',
  'unresolved screening reasons cannot be accepted'
);

select extensions.throws_ok(
  $$
    select public.review_listing_candidate(
      '30000000-0000-4000-8000-000000000011',
      jsonb_build_object(
        'outcome', 'accepted',
        'resolved_screening_reasons', jsonb_build_array('shared_business_domain_entity_review'),
        'source_urls', jsonb_build_array('https://needs-review.example/'),
        'source_checked_at', statement_timestamp(),
        'checks', jsonb_build_object(
          'nap_verified', true,
          'category_verified', true,
          'active_status_verified', true,
          'source_urls_current', true
        ),
        'duplicate_decision', 'no_duplicate',
        'business_identity_key', '30000000-0000-4000-8000-000000000011',
        'entity_decisions', jsonb_build_object(
          'branch', 'national_branch',
          'chain', 'not_chain',
          'practitioner', 'not_practitioner',
          'franchise', 'not_franchise',
          'service_area', 'fixed_location'
        ),
        'reason_codes', jsonb_build_array('national_branch')
      ),
      'cle104-national-branch'
    )
  $$,
  'P0001',
  'accepted review has an ineligible duplicate or entity decision',
  'national corporate branches cannot enter the launch cohort'
);

select extensions.throws_ok(
  $$
    select public.review_listing_candidate(
      '30000000-0000-4000-8000-000000000011',
      jsonb_build_object(
        'outcome', 'accepted',
        'resolved_screening_reasons', jsonb_build_array('shared_business_domain_entity_review'),
        'source_urls', jsonb_build_array('https://needs-review.example/'),
        'source_checked_at', statement_timestamp(),
        'checks', jsonb_build_object(
          'nap_verified', true,
          'category_verified', true,
          'active_status_verified', false,
          'source_urls_current', true
        ),
        'duplicate_decision', 'no_duplicate',
        'business_identity_key', '30000000-0000-4000-8000-000000000011',
        'entity_decisions', jsonb_build_object(
          'branch', 'not_branch',
          'chain', 'not_chain',
          'practitioner', 'not_practitioner',
          'franchise', 'locally_operated_franchise',
          'service_area', 'fixed_location'
        ),
        'reason_codes', jsonb_build_array('inactive_check')
      ),
      'cle104-incomplete-checks'
    )
  $$,
  'P0001',
  'accepted review requires all publication checks',
  'an incomplete active-status check cannot be accepted'
);

select extensions.lives_ok(
  $$
    select public.review_listing_candidate(
      '30000000-0000-4000-8000-000000000011',
      jsonb_build_object(
        'outcome', 'accepted',
        'resolved_screening_reasons', jsonb_build_array('shared_business_domain_entity_review'),
        'source_urls', jsonb_build_array('https://needs-review.example/', 'https://maps.example/needs-review'),
        'source_checked_at', statement_timestamp(),
        'checks', jsonb_build_object(
          'nap_verified', true,
          'category_verified', true,
          'active_status_verified', true,
          'source_urls_current', true
        ),
        'duplicate_decision', 'no_duplicate',
        'business_identity_key', '30000000-0000-4000-8000-000000000011',
        'entity_decisions', jsonb_build_object(
          'branch', 'not_branch',
          'chain', 'not_chain',
          'practitioner', 'not_practitioner',
          'franchise', 'locally_operated_franchise',
          'service_area', 'fixed_location'
        ),
        'reason_codes', jsonb_build_array('operator_verified_local_franchise')
      ),
      'cle104-review-needs-review'
    )
  $$,
  'an eligible human decision can resolve an explicit review queue'
);

select extensions.ok(
  (
    select review_status = 'accepted'
      and screening_status = 'eligible'
      and cardinality(screening_reasons) = 0
      and reviewed_by = '30000000-0000-4000-8000-000000000001'
      and reviewed_at is not null
    from app.listing_candidates
    where id = '30000000-0000-4000-8000-000000000011'
  ),
  'accepted review is attributable and clears only the explicitly resolved queue'
);

select extensions.ok(
  (
    select outcome = 'accepted'
      and jsonb_array_length(source_urls) = 2
      and checks @> '{"nap_verified":true,"category_verified":true,"active_status_verified":true}'::jsonb
      and duplicate_decision = 'no_duplicate'
      and entity_decisions @> '{"branch":"not_branch","chain":"not_chain","practitioner":"not_practitioner","franchise":"locally_operated_franchise","service_area":"fixed_location"}'::jsonb
      and reviewed_candidate_fingerprint ~ '^[a-f0-9]{64}$'
      and reviewed_candidate ->> 'normalized_name' = 'Needs Review Business'
    from app.candidate_review_receipts
    where candidate_id = '30000000-0000-4000-8000-000000000011'
  ),
  'candidate review receipt preserves checks, orthogonal decisions, reviewer, and candidate snapshot'
);

select extensions.is(
  (
    select count(*)::integer
    from app.audit_events
    where action = 'listing_candidate_reviewed'
      and target_id = '30000000-0000-4000-8000-000000000011'
  ),
  1,
  'candidate review appends one audit event'
);

select extensions.is(
  public.review_listing_candidate(
    '30000000-0000-4000-8000-000000000011',
    jsonb_build_object(
      'outcome', 'accepted',
      'resolved_screening_reasons', jsonb_build_array('shared_business_domain_entity_review'),
      'source_urls', jsonb_build_array('https://needs-review.example/', 'https://maps.example/needs-review'),
      'source_checked_at', (
        select source_checked_at from app.candidate_review_receipts
        where candidate_id = '30000000-0000-4000-8000-000000000011'
      ),
      'checks', jsonb_build_object(
        'nap_verified', true,
        'category_verified', true,
        'active_status_verified', true,
        'source_urls_current', true
      ),
      'duplicate_decision', 'no_duplicate',
      'business_identity_key', '30000000-0000-4000-8000-000000000011',
      'entity_decisions', jsonb_build_object(
        'branch', 'not_branch',
        'chain', 'not_chain',
        'practitioner', 'not_practitioner',
        'franchise', 'locally_operated_franchise',
        'service_area', 'fixed_location'
      ),
      'reason_codes', jsonb_build_array('operator_verified_local_franchise')
    ),
    'cle104-review-needs-review'
  ),
  (
    select id from app.candidate_review_receipts
    where candidate_id = '30000000-0000-4000-8000-000000000011'
  ),
  'identical candidate review replay returns the original receipt'
);

select extensions.throws_ok(
  $$
    select public.review_listing_candidate(
      '30000000-0000-4000-8000-000000000011',
      jsonb_build_object(
        'outcome', 'rejected',
        'resolved_screening_reasons', '[]'::jsonb,
        'source_urls', jsonb_build_array('https://needs-review.example/'),
        'source_checked_at', statement_timestamp(),
        'checks', '{}'::jsonb,
        'duplicate_decision', 'duplicate_rejected',
        'business_identity_key', '30000000-0000-4000-8000-000000000011',
        'entity_decisions', jsonb_build_object(
          'branch', 'not_branch',
          'chain', 'not_chain',
          'practitioner', 'not_practitioner',
          'franchise', 'not_franchise',
          'service_area', 'fixed_location'
        ),
        'reason_codes', jsonb_build_array('changed_replay')
      ),
      'cle104-review-needs-review'
    )
  $$,
  'P0001',
  'idempotency key was already used for a different candidate review',
  'candidate review idempotency keys reject changed payloads'
);

select extensions.is(
  (
    select count(
      public.review_listing_candidate(
        candidate.id,
        jsonb_build_object(
          'outcome', 'accepted',
          'resolved_screening_reasons', '[]'::jsonb,
          'source_urls', jsonb_build_array(candidate.website_url),
          'source_checked_at', statement_timestamp(),
          'checks', jsonb_build_object(
            'nap_verified', true,
            'category_verified', true,
            'active_status_verified', true,
            'source_urls_current', true
          ),
          'duplicate_decision', case
            when candidate.proposed_slug in ('hvac-reno-2', 'hvac-sparks-2')
              then 'distinct_location'
            else 'no_duplicate'
          end,
          'business_identity_key', case
            when candidate.proposed_slug in ('hvac-reno-2', 'hvac-sparks-2')
              then 'multi-location:shared-hvac'
            else candidate.id::text
          end,
          'entity_decisions', jsonb_build_object(
            'branch', 'not_branch',
            'chain', 'not_chain',
            'practitioner', 'not_practitioner',
            'franchise', 'not_franchise',
            'service_area', case
              when candidate.proposed_slug like '%-1' then 'service_area_business'
              else 'fixed_location'
            end
          ),
          'reason_codes', jsonb_build_array('operator_verified_independent_business')
        ),
        'cle104-review-' || candidate.id::text
      )
    )::integer
    from app.listing_candidates candidate
    where candidate.batch_id = '30000000-0000-4000-8000-000000000010'
      and candidate.id <> '30000000-0000-4000-8000-000000000011'
  ),
  100,
  'Operator reviews the complete synthetic launch matrix through the command boundary'
);

select extensions.is(
  (select count(*)::integer from app.candidate_review_receipts),
  102,
  'every terminal candidate decision has one append-only review receipt'
);

reset role;
update app.listing_candidates
set normalized_name = normalized_name || ' changed after review'
where id = (
  select id
  from app.listing_candidates
  where batch_id = '30000000-0000-4000-8000-000000000010'
    and id <> '30000000-0000-4000-8000-000000000011'
  order by id
  limit 1
);
set local role authenticated;

select extensions.throws_ok(
  $$
    select public.publish_launch_selection(
      array(
        select id from app.listing_candidates
        where batch_id = '30000000-0000-4000-8000-000000000010'
          and id <> '30000000-0000-4000-8000-000000000011'
        order by id
      ),
      'cle104-mutated-after-review'
    )
  $$,
  'P0001',
  'launch selection contains an unreviewed or ineligible candidate',
  'publication refuses a candidate whose reviewed NAP and category snapshot changed'
);

reset role;
update app.listing_candidates candidate
set normalized_name = receipt.reviewed_candidate ->> 'normalized_name'
from app.candidate_review_receipts receipt
where receipt.candidate_id = candidate.id;
set local role authenticated;

select extensions.throws_ok(
  $$
    select public.publish_launch_selection(
      array(
        select candidate.id
        from app.listing_candidates candidate
        where candidate.batch_id = '30000000-0000-4000-8000-000000000010'
          and candidate.id <> '30000000-0000-4000-8000-000000000011'
          and candidate.proposed_slug <> 'hvac-reno-5'
        union all
        select '30000000-0000-4000-8000-000000000012'::uuid
      ),
      'cle104-stale-evidence-publication'
    )
  $$,
  'P0001',
  'launch selection contains an unreviewed or ineligible candidate',
  'publication refuses review evidence older than 30 days'
);

select set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'sub', 'user_operator',
    'org_id', 'org_local775',
    'auth_time', extract(epoch from statement_timestamp())::bigint - 901
  )::text,
  true
);

select extensions.throws_ok(
  $$
    select public.publish_launch_selection(
      array(
        select id from app.listing_candidates
        where batch_id = '30000000-0000-4000-8000-000000000010'
          and id <> '30000000-0000-4000-8000-000000000011'
        order by id
      ),
      'cle104-stale-publication'
    )
  $$,
  'P0001',
  'recent Operator authentication is required',
  'stale Operator authentication cannot publish'
);

select set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'sub', 'user_operator',
    'org_id', 'org_local775',
    'auth_time', extract(epoch from statement_timestamp())::bigint,
    'act', jsonb_build_object('sub', 'user_support')
  )::text,
  true
);

select extensions.throws_ok(
  $$
    select public.publish_launch_selection(
      array(
        select id from app.listing_candidates
        where batch_id = '30000000-0000-4000-8000-000000000010'
          and id <> '30000000-0000-4000-8000-000000000011'
        order by id
      ),
      'cle104-impersonated-publication'
    )
  $$,
  'P0001',
  'recent Operator authentication is required',
  'an impersonated Operator session cannot publish'
);

select set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'sub', 'user_nonoperator',
    'org_id', 'org_local775',
    'auth_time', extract(epoch from statement_timestamp())::bigint
  )::text,
  true
);

select extensions.throws_ok(
  $$
    select public.publish_launch_selection(
      array(
        select id from app.listing_candidates
        where batch_id = '30000000-0000-4000-8000-000000000010'
          and id <> '30000000-0000-4000-8000-000000000011'
        order by id
      ),
      'cle104-nonoperator-publication'
    )
  $$,
  'P0001',
  'recent Operator authentication is required',
  'authentication without an Operator Grant cannot publish'
);

select set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'sub', 'user_limited_operator',
    'org_id', 'org_local775',
    'auth_time', extract(epoch from statement_timestamp())::bigint
  )::text,
  true
);

select extensions.throws_ok(
  $$
    select public.publish_launch_selection(
      array(
        select id from app.listing_candidates
        where batch_id = '30000000-0000-4000-8000-000000000010'
          and id <> '30000000-0000-4000-8000-000000000011'
        order by id
      ),
      'cle104-limited-publication'
    )
  $$,
  'P0001',
  'Operator listing_publish permission is required',
  'an Operator Grant without listing-publish scope cannot publish'
);

select set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'sub', 'user_publisher',
    'org_id', 'org_local775',
    'auth_time', extract(epoch from statement_timestamp())::bigint
  )::text,
  true
);

select extensions.throws_ok(
  $$
    select public.publish_launch_selection(
      array(
        select id from app.listing_candidates
        where batch_id = '30000000-0000-4000-8000-000000000010'
          and id <> '30000000-0000-4000-8000-000000000011'
        order by id
        limit 99
      ),
      'cle104-short-selection'
    )
  $$,
  'P0001',
  'launch selection must contain exactly 100 candidates',
  'partial launch selections fail closed'
);

select extensions.is(
  (public.publish_launch_selection(
    array(
      select id from app.listing_candidates
      where batch_id = '30000000-0000-4000-8000-000000000010'
        and id <> '30000000-0000-4000-8000-000000000011'
      order by id desc
    ),
    'cle104-launch-publication'
  ) ->> 'listing_count')::integer,
  100,
  'one atomic command publishes the complete balanced launch selection'
);

select extensions.is(
  (select count(*)::integer from app.business_listings),
  100,
  'publication creates exactly 100 canonical Business Listings'
);

select extensions.ok(
  (select count(*) = 99 from app.businesses)
  and exists (
    select 1
    from app.businesses business
    join app.business_listings listing on listing.business_id = business.id
    where business.import_identity_key = 'multi-location:shared-hvac'
    group by business.id
    having count(*) = 2
  ),
  'two reviewed distinct locations share one canonical Business and retain separate Listings'
);

select extensions.is(
  (select count(*)::integer from public.directory_listings),
  100,
  'all and only the reviewed launch selection enters the public projection'
);

select extensions.ok(
  (
    select count(*) = 100
      and bool_and(jsonb_array_length(source_urls) > 0)
      and bool_and(checks @> '{"launch_balance_verified":true}'::jsonb)
      and bool_and(rollback_reference <> '')
      and bool_and(jsonb_typeof(entity_decisions) = 'object')
      and bool_and(reviewed_candidate_fingerprint ~ '^[a-f0-9]{64}$')
      and bool_and(outcome = 'published')
    from app.publication_receipts
  ),
  'every published Listing has a structured publication receipt'
);

select extensions.ok(
  (select bool_and(reviewer_id = '30000000-0000-4000-8000-000000000001')
     and bool_and(published_by = '30000000-0000-4000-8000-000000000004')
   from app.publication_receipts)
  and (select publisher_id = '30000000-0000-4000-8000-000000000004'
       from app.launch_publication_batches)
  and (select bool_and(information_checked_by = '30000000-0000-4000-8000-000000000001')
       from app.business_listings),
  'publication keeps the original reviewer distinct from the publishing Operator'
);

select extensions.ok(
  (
    select count(*) = 20
      and bool_and(street_address is null)
      and bool_and(latitude is null)
      and bool_and(longitude is null)
      and bool_and(hide_street)
    from app.business_listings
    where is_service_area
  ),
  'service-area Listings publish no residential street or exact coordinates'
);

select extensions.ok(
  not exists (
    select 1
    from (
      select city_slug, launch_category_slug, count(*) as cell_count
      from app.listing_candidates
      where selected_for_launch
      group by city_slug, launch_category_slug
    ) matrix
    where matrix.cell_count <> 5
  ) and (
    select count(*) = 20
    from (
      select city_slug, launch_category_slug
      from app.listing_candidates
      where selected_for_launch
      group by city_slug, launch_category_slug
    ) cells
  ),
  'the selected launch matrix contains five Listings in every category and city cell'
);

select extensions.is(
  (select count(*)::integer from app.listing_candidates where selected_for_launch),
  100,
  'publication marks exactly the published candidates as selected'
);

select extensions.is(
  (select count(*)::integer from app.listing_private_contacts),
  100,
  'private Business email stays in the private contact table'
);

select extensions.is(
  (select count(*)::integer from app.listing_revisions),
  300,
  'publication records draft, pending-review, and published revisions for every Listing'
);

select extensions.ok(
  not exists (
    select listing_id
    from app.listing_revisions
    group by listing_id
    having array_agg(revision_type order by occurred_at, id)
      <> array['created', 'proposed_change', 'approved_change']
  ),
  'every Listing proves the accepted draft to pending-review to published lifecycle'
);

select extensions.is(
  (
    select count(*)::integer
    from app.integration_outbox
    where event_type = 'business_listing.published'
      and status = 'pending'
  ),
  100,
  'publication atomically creates one durable downstream outbox event per Listing'
);

select extensions.is(
  (
    select count(*)::integer
    from app.audit_events
    where action = 'launch_listing_published'
  ),
  100,
  'publication appends an attributable audit event for every Listing'
);

select extensions.is(
  public.publish_launch_selection(
    array(
      select id from app.listing_candidates
      where batch_id = '30000000-0000-4000-8000-000000000010'
        and id <> '30000000-0000-4000-8000-000000000011'
      order by id
    ),
    'cle104-launch-publication'
  ) ->> 'publication_batch_id',
  (select id::text from app.launch_publication_batches),
  'the same publication set in a different order returns the original batch receipt'
);

select extensions.is(
  (select count(*)::integer from app.launch_publication_batches),
  1,
  'publication replay creates no duplicate batch'
);

select extensions.throws_ok(
  $$
    select public.publish_launch_selection(
      array(
        select case
          when row_number() over (order by id) = 100 then (
            select id from app.listing_candidates
            where batch_id = '30000000-0000-4000-8000-000000000010'
              and id <> '30000000-0000-4000-8000-000000000011'
            order by id
            limit 1
          )
          else id
        end
        from app.listing_candidates
        where batch_id = '30000000-0000-4000-8000-000000000010'
          and id <> '30000000-0000-4000-8000-000000000011'
        order by id
      ),
      'cle104-launch-publication'
    )
  $$,
  'P0001',
  'idempotency key was already used for a different launch selection',
  'publication idempotency keys reject changed payloads'
);

select extensions.lives_ok(
  $$
    select public.transition_listing_publication_state(
      (select listing_id from app.publication_receipts order by listing_id limit 1),
      'suspend',
      array['launch_rollback_test'],
      'cle104-suspend-listing'
    )
  $$,
  'the receipt-backed rollback command suspends a published launch Listing'
);

select extensions.ok(
  (select count(*) = 1 and bool_and(published_at is null)
   from app.business_listings where publication_status = 'suspended')
  and (select count(*) = 99 from public.directory_listings),
  'suspension removes exactly one Listing from the public projection'
);

select extensions.ok(
  (select count(*) = 1 from app.listing_status_transition_receipts where transition = 'suspend')
  and (select count(*) = 1 from app.listing_revisions where revision_type = 'suspended')
  and (select count(*) = 1 from app.audit_events where action = 'business_listing_suspended')
  and (select count(*) = 1 from app.integration_outbox where event_type = 'business_listing.suspended'),
  'suspension atomically records its receipt, revision, audit event, and outbox event'
);

select extensions.is(
  public.transition_listing_publication_state(
    (select listing_id from app.publication_receipts order by listing_id limit 1),
    'suspend',
    array['launch_rollback_test'],
    'cle104-suspend-listing'
  ),
  (select id from app.listing_status_transition_receipts where idempotency_key = 'cle104-suspend-listing'),
  'identical suspension replay returns the original transition receipt'
);

select extensions.lives_ok(
  $$
    select public.transition_listing_publication_state(
      (select listing_id from app.publication_receipts order by listing_id limit 1),
      'restore',
      array['launch_rollback_restored'],
      'cle104-restore-listing'
    )
  $$,
  'a suspended launch Listing can be restored through the guarded command'
);

select extensions.ok(
  (select count(*) = 100 from app.business_listings where publication_status = 'published')
  and (select count(*) = 100 from public.directory_listings)
  and (select count(*) = 1 from app.listing_status_transition_receipts where transition = 'restore')
  and (select count(*) = 1 from app.listing_revisions where revision_type = 'restored')
  and (select count(*) = 1 from app.audit_events where action = 'business_listing_restored')
  and (select count(*) = 1 from app.integration_outbox where event_type = 'business_listing.restored'),
  'restoration reverses suspension and retains complete transition evidence'
);

reset role;

select extensions.throws_ok(
  $$
    update app.launch_publication_batches
    set candidate_count = 99
  $$,
  'P0001',
  'append-only record cannot be changed',
  'launch publication batch receipts are append-only'
);

select * from extensions.finish();
rollback;
