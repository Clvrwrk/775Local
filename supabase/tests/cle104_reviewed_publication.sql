begin;

create extension if not exists pgtap with schema extensions;
select extensions.plan(20);

insert into private.source_batches (
  id, source_name, source_sha256, workbook_row_count, imported_by
) values (
  '10000000-0000-4000-8000-000000000001',
  'cle104-test',
  repeat('a', 64),
  2,
  'supabase-test'
);

insert into private.source_listing_rows (
  batch_id, worksheet, source_row, row_sha256, raw_payload
) values
  (
    '10000000-0000-4000-8000-000000000001',
    'businesses-89502',
    2,
    repeat('b', 64),
    '{}'::jsonb
  ),
  (
    '10000000-0000-4000-8000-000000000001',
    'businesses-89502',
    3,
    repeat('c', 64),
    '{}'::jsonb
  );

select public.ingest_listing_candidates(
  '10000000-0000-4000-8000-000000000001',
  '[
    {
      "worksheet":"businesses-89502","source_row":2,
      "normalized_name":"CLE 104 One","proposed_slug":"cle-104-one",
      "city_slug":"reno","postal_code":"89502","launch_category_slug":"hvac",
      "active_profile_status":"active","screening_status":"eligible",
      "screening_reasons":[],"evidence":{"transform_version":"launch-candidate-v1"}
    },
    {
      "worksheet":"businesses-89502","source_row":3,
      "normalized_name":"CLE 104 Two","proposed_slug":"cle-104-two",
      "city_slug":"reno","postal_code":"89502","launch_category_slug":"hvac",
      "active_profile_status":"active","screening_status":"eligible",
      "screening_reasons":[],"evidence":{"transform_version":"launch-candidate-v1"}
    }
  ]'::jsonb
);

select extensions.ok(
  not has_function_privilege(
    'anon',
    'public.reconcile_listing_candidate_screening(uuid,jsonb,text)',
    'execute'
  ),
  'anonymous callers cannot reconcile candidate screening'
);
select extensions.ok(
  not has_function_privilege(
    'authenticated',
    'public.reconcile_listing_candidate_screening(uuid,jsonb,text)',
    'execute'
  ),
  'authenticated callers cannot reconcile candidate screening'
);
select extensions.ok(
  has_function_privilege(
    'service_role',
    'public.reconcile_listing_candidate_screening(uuid,jsonb,text)',
    'execute'
  ),
  'service role can reconcile candidate screening'
);

select extensions.ok(
  has_table_privilege('authenticated', 'app.listing_candidates', 'select'),
  'authenticated operators retain read access to the private review queue'
);
select extensions.ok(
  not has_table_privilege('authenticated', 'app.listing_candidates', 'insert'),
  'authenticated operators cannot insert listing candidates directly'
);
select extensions.ok(
  not has_table_privilege('authenticated', 'app.listing_candidates', 'update'),
  'authenticated operators cannot bypass review commands with direct updates'
);
select extensions.ok(
  not has_table_privilege('authenticated', 'app.listing_candidates', 'delete'),
  'authenticated operators cannot delete listing candidates directly'
);

select extensions.throws_ok(
  $$
    select public.reconcile_listing_candidate_screening(
      '10000000-0000-4000-8000-000000000001',
      null,
      'cle104-null-array'
    )
  $$,
  'P0001',
  'candidates must be a JSON array containing 1 to 500 records',
  'a SQL null candidate array fails closed'
);

select extensions.throws_ok(
  $$
    select public.reconcile_listing_candidate_screening(
      '10000000-0000-4000-8000-000000000001',
      '[{"worksheet":"businesses-89502","source_row":2,"launch_category_slug":"hvac","screening_status":"eligible","evidence":{}}]'::jsonb,
      'cle104-malformed'
    )
  $$,
  'P0001',
  'one or more screening candidates are invalid or missing',
  'missing screening reasons fail closed'
);

select extensions.throws_ok(
  $$
    select public.reconcile_listing_candidate_screening(
      '10000000-0000-4000-8000-000000000001',
      '[{"worksheet":"businesses-89502","source_row":2,"launch_category_slug":"hvac","screening_status":"eligible","screening_reasons":["website_missing"],"evidence":{}}]'::jsonb,
      'cle104-eligible-with-reason'
    )
  $$,
  'P0001',
  'screening status and reasons are inconsistent',
  'eligible screening cannot retain unresolved reasons'
);

select extensions.throws_ok(
  $$
    select public.reconcile_listing_candidate_screening(
      '10000000-0000-4000-8000-000000000001',
      '[{"worksheet":"businesses-89502","source_row":2,"launch_category_slug":"hvac","screening_status":"needs_review","screening_reasons":[],"evidence":{}}]'::jsonb,
      'cle104-review-without-reason'
    )
  $$,
  'P0001',
  'screening status and reasons are inconsistent',
  'needs-review screening requires an explicit reason'
);

select extensions.throws_ok(
  $$
    select public.reconcile_listing_candidate_screening(
      '10000000-0000-4000-8000-000000000001',
      '[{"worksheet":"businesses-89502","source_row":2,"launch_category_slug":"hvac","screening_status":"ineligible","screening_reasons":[],"evidence":{}}]'::jsonb,
      'cle104-ineligible-without-reason'
    )
  $$,
  'P0001',
  'screening status and reasons are inconsistent',
  'ineligible screening requires an explicit reason'
);

select extensions.throws_ok(
  $$
    select public.reconcile_listing_candidate_screening(
      '10000000-0000-4000-8000-000000000001',
      '[
        {"worksheet":"businesses-89502","source_row":2,"launch_category_slug":"hvac","screening_status":"eligible","screening_reasons":[],"evidence":{}},
        {"worksheet":"businesses-89502","source_row":2,"launch_category_slug":"electrical","screening_status":"needs_review","screening_reasons":["launch_category_ambiguity"],"evidence":{}}
      ]'::jsonb,
      'cle104-duplicate'
    )
  $$,
  'P0001',
  'candidate source rows must be unique within a request',
  'duplicate source rows fail deterministically'
);

select extensions.is(
  public.reconcile_listing_candidate_screening(
    '10000000-0000-4000-8000-000000000001',
    '[{"worksheet":"businesses-89502","source_row":2,"launch_category_slug":"electrical","screening_status":"needs_review","screening_reasons":["launch_category_ambiguity"],"evidence":{"transform_version":"launch-candidate-v2","corpus_review_risk_version":"entity-risk-v2"}}]'::jsonb,
    'cle104-current'
  ),
  1,
  'a pending private candidate is reconciled once'
);

select extensions.is(
  (
    select launch_category_slug
    from app.listing_candidates
    where proposed_slug = 'cle-104-one'
  ),
  'electrical',
  'reconciliation refreshes the pending launch category'
);

select extensions.is(
  (
    select count(*)::integer
    from app.audit_events
    where action = 'listing_candidate_screening_reconciled'
      and correlation_id = 'cle104-current'
  ),
  1,
  'reconciliation appends an attributable audit event'
);

select extensions.is(
  public.reconcile_listing_candidate_screening(
    '10000000-0000-4000-8000-000000000001',
    '[{"worksheet":"businesses-89502","source_row":2,"launch_category_slug":"electrical","screening_status":"needs_review","screening_reasons":["launch_category_ambiguity"],"evidence":{"transform_version":"launch-candidate-v2","corpus_review_risk_version":"entity-risk-v2"}}]'::jsonb,
    'cle104-current'
  ),
  0,
  'an identical reconciliation is idempotent'
);

insert into app.actors (id, workos_user_id, primary_email)
values ('20000000-0000-4000-8000-000000000001', 'cle104-reviewer', 'reviewer@example.test');

update app.listing_candidates
set review_status = 'accepted', reviewed_at = statement_timestamp()
where proposed_slug = 'cle-104-two';

select extensions.throws_ok(
  $$
    update app.listing_candidates
    set selected_for_launch = true
    where proposed_slug = 'cle-104-two'
  $$,
  '23514',
  null,
  'launch selection rejects a review with no reviewer identity'
);

update app.listing_candidates
set reviewed_by = '20000000-0000-4000-8000-000000000001'
where proposed_slug = 'cle-104-two';

select extensions.lives_ok(
  $$
    update app.listing_candidates
    set selected_for_launch = true
    where proposed_slug = 'cle-104-two'
  $$,
  'an attributable accepted clean review may be selected'
);

select extensions.throws_ok(
  $$
    select public.reconcile_listing_candidate_screening(
      '10000000-0000-4000-8000-000000000001',
      '[{"worksheet":"businesses-89502","source_row":3,"launch_category_slug":"hvac","screening_status":"needs_review","screening_reasons":["website_missing"],"evidence":{"transform_version":"launch-candidate-v2","corpus_review_risk_version":"entity-risk-v2"}}]'::jsonb,
      'cle104-reviewed'
    )
  $$,
  'P0001',
  'reviewed or selected candidates cannot be reclassified',
  'reviewed or selected candidates cannot be changed by import replay'
);

select * from extensions.finish();
rollback;
