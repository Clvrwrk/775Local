begin;

create extension if not exists pgtap with schema extensions;
select extensions.no_plan();

select extensions.has_table('private', 'listing_intelligence_accounts', 'listing account table exists');
select extensions.has_table('private', 'listing_source_captures', 'source capture table exists');
select extensions.has_table('private', 'listing_source_capture_pages', 'capture page table exists');
select extensions.has_table('private', 'listing_source_fact_sets', 'private fact set table exists');
select extensions.has_table('private', 'listing_seo_audits', 'SEO audit table exists');
select extensions.has_table('private', 'listing_seo_audit_artifacts', 'SEO raw artifact map exists');
select extensions.has_table(
  'app',
  'listing_content_intelligence_candidates',
  'review-only content candidate table exists'
);

select extensions.ok(
  (select relrowsecurity from pg_class where oid = 'private.listing_source_capture_pages'::regclass),
  'raw Listing page evidence has RLS enabled'
);
select extensions.ok(
  (select relrowsecurity from pg_class where oid = 'app.listing_content_intelligence_candidates'::regclass),
  'content intelligence candidates have RLS enabled'
);
select extensions.ok(
  not has_table_privilege('authenticated', 'private.listing_source_fact_sets', 'select'),
  'authenticated users cannot read extracted private contacts'
);
select extensions.ok(
  not has_function_privilege(
    'authenticated',
    'public.ingest_listing_source_capture_pages(bigint,jsonb)',
    'execute'
  ),
  'authenticated users cannot ingest raw pages'
);
select extensions.ok(
  has_function_privilege(
    'service_role',
    'public.ingest_listing_source_capture_pages(bigint,jsonb)',
    'execute'
  ),
  'service role can use the bounded page-ingestion command'
);

insert into app.businesses (id, canonical_name)
values ('10000000-0000-0000-0000-000000000001', 'Ledger Test Business');

insert into app.business_listings (
  id, business_id, current_slug, display_name, website_url, city_slug, postal_code
) values (
  '20000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000001',
  'ledger-test-business',
  'Ledger Test Business',
  'https://example.com/',
  'reno',
  '89502'
);

select extensions.is(
  (select count(*)::integer from private.listing_intelligence_accounts),
  1,
  'a Listing with a website automatically receives exactly one intelligence account'
);
select extensions.is(
  (
    select source_inventory->0->>'kind'
    from private.listing_intelligence_accounts
    where listing_id = '20000000-0000-0000-0000-000000000001'
  ),
  'website',
  'the primary source is classified in the account inventory'
);

select extensions.is(
  jsonb_array_length(public.register_listing_intelligence_sources(
    '20000000-0000-0000-0000-000000000001',
    '[
      {"url":"https://example.com/","kind":"website","isPrimary":true},
      {"url":"https://www.yelp.com/biz/example","kind":"yelp","isPrimary":false}
    ]'::jsonb
  )),
  2,
  'business-controlled and directory landing sources are retained together'
);

select extensions.throws_ok(
  $$select public.register_listing_intelligence_sources(
    '20000000-0000-0000-0000-000000000001',
    '[{"url":"http://insecure.example","kind":"website"}]'::jsonb
  )$$,
  'P0001',
  'one or more sources are invalid',
  'non-HTTPS evidence sources are rejected'
);

select extensions.ok(
  public.begin_listing_source_capture(
    '20000000-0000-0000-0000-000000000001',
    'capture-example-com-v1',
    'https://example.com/',
    'website',
    'fc-test-job',
    'complete',
    'entire_accessible_site',
    1,
    1,
    0,
    500,
    false,
    true,
    true,
    repeat('a', 64),
    '{"crawlEntireDomain":true,"ignoreQueryParameters":true,"allowSubdomains":false}'::jsonb,
    '[]'::jsonb,
    1,
    '2026-09-07T12:00:00Z',
    '2026-09-07T12:01:00Z'
  ) is not null,
  'a reconciliable terminal website capture begins ingestion'
);

select extensions.is(
  public.ingest_listing_source_capture_pages(
    (select id from private.listing_source_captures where idempotency_key = 'capture-example-com-v1'),
    jsonb_build_array(jsonb_build_object(
      'page_index', 0,
      'source_url', 'https://example.com/',
      'canonical_url', 'https://example.com/',
      'title', 'Ledger Test Business',
      'http_status', 200,
      'content_sha256', encode(
        extensions.digest(convert_to('{"markdown":"Call 775-555-0100"}', 'UTF8'), 'sha256'),
        'hex'
      ),
      'byte_count', octet_length(convert_to('{"markdown":"Call 775-555-0100"}', 'UTF8')),
      'content_type', 'application/json',
      'raw_text', '{"markdown":"Call 775-555-0100"}',
      'parsed_payload', '{"markdown":"Call 775-555-0100"}'::jsonb,
      'captured_at', '2026-09-07T12:01:00Z'
    ))
  ),
  1,
  'a complete raw Firecrawl page is content-addressed and linked'
);

select extensions.is(
  (
    public.finalize_listing_source_capture(
      (select id from private.listing_source_captures where idempotency_key = 'capture-example-com-v1'),
      'listing-intelligence-v1',
      '{
        "emails":["hello@example.com"],
        "phones":["+17755550100"],
        "addresses":[{"value":"1 Test Way, Reno, NV 89502","sourcePage":0}],
        "serviceAreas":[{"value":"Reno","sourcePage":0}],
        "services":[{"value":"Emergency HVAC repair","sourcePage":0}],
        "keyDifferentiators":[{"value":"24/7 response","sourcePage":0}],
        "topServiceOffering":{"value":"Emergency HVAC repair","sourcePage":0},
        "provenance":{"schemaVersion":1,"allClaimsSourceLinked":true},
        "completenessScore":100
      }'::jsonb
    )->>'status'
  ),
  'complete',
  'capture finalization stores the facts only after page-count reconciliation'
);

select extensions.is(
  (select emails[1] from private.listing_source_fact_sets),
  'hello@example.com',
  'emails are extracted into the private fact set'
);
select extensions.is(
  (select phones[1] from private.listing_source_fact_sets),
  '+17755550100',
  'phones are extracted into the private fact set'
);
select extensions.is(
  (select capture_status from private.listing_intelligence_accounts),
  'partial',
  'the Listing account stays partial until every registered source is captured'
);
select extensions.throws_ok(
  $$update private.listing_source_capture_pages set title = 'changed'$$,
  'P0001',
  'append-only record cannot be changed',
  'raw capture page mappings cannot be changed'
);

select extensions.throws_ok(
  $$select public.begin_listing_source_capture(
    '20000000-0000-0000-0000-000000000001', 'bad-complete-capture',
    'https://example.com/', 'website', null, 'complete', 'entire_accessible_site',
    1, 2, 0, 500, false, true, true, repeat('b', 64), '{}'::jsonb,
    '["page_limit_reached"]'::jsonb, 1, now(), now()
  )$$,
  '23514',
  null,
  'a page-limited or undrained crawl cannot be labeled complete'
);

select extensions.throws_ok(
  $$select public.record_listing_seo_audit(
    '20000000-0000-0000-0000-000000000001', null,
    'incomplete-dataforseo-audit', 'https://example.com/', 'dfs-incomplete',
    'complete', 500, 1, 'finished', 90, 0.0018, '{}'::jsonb, '{}'::jsonb,
    '[]'::jsonb,
    jsonb_build_array(jsonb_build_object(
      'artifact_kind', 'summary', 'artifact_index', 0,
      'content_sha256', encode(extensions.digest(convert_to('{}', 'UTF8'), 'sha256'), 'hex'),
      'byte_count', 2, 'content_type', 'application/json', 'raw_text', '{}',
      'parsed_payload', '{}'::jsonb
    )), now(), now()
  )$$,
  'P0001',
  'complete SEO audit requires task_post, task_status, summary, and pages artifacts',
  'an incomplete raw response set cannot be labeled a complete SEO audit'
);

select extensions.ok(
  public.record_listing_seo_audit(
    '20000000-0000-0000-0000-000000000001',
    (select id from private.listing_source_captures where idempotency_key = 'capture-example-com-v1'),
    'dataforseo-example-com-v1',
    'https://example.com/',
    'dfs-test-task',
    'complete',
    500,
    1,
    'finished',
    93.5,
    0.00015,
    '{"load_resources":true,"enable_javascript":true}'::jsonb,
    '{"onpage_score":93.5,"issues":{"duplicate_title":0}}'::jsonb,
    '[]'::jsonb,
    (
      select jsonb_agg(jsonb_build_object(
        'artifact_kind', evidence.kind,
        'artifact_index', 0,
        'content_sha256', encode(
          extensions.digest(convert_to(evidence.raw_text, 'UTF8'), 'sha256'), 'hex'
        ),
        'byte_count', octet_length(convert_to(evidence.raw_text, 'UTF8')),
        'content_type', 'application/json',
        'raw_text', evidence.raw_text,
        'parsed_payload', evidence.raw_text::jsonb
      ) order by evidence.kind)
      from (values
        ('task_post', '{"task":"created"}'),
        ('task_status', '{"status":"finished"}'),
        ('summary', '{"onpage_score":93.5}'),
        ('pages', '{"pages":[{"url":"https://example.com/"}]}')
      ) evidence(kind, raw_text)
    ),
    '2026-09-07T12:02:00Z',
    '2026-09-07T12:03:00Z'
  ) is not null,
  'a DataForSEO audit and its complete raw summary are recorded together'
);

select extensions.is(
  (select count(*)::integer from private.listing_seo_audit_artifacts),
  4,
  'the SEO audit retains every required content-addressed raw provider response'
);
select extensions.is(
  (select seo_audit_status from private.listing_intelligence_accounts),
  'complete',
  'the current Listing account points to the SEO audit'
);
select extensions.throws_ok(
  $$update private.listing_seo_audits set onpage_score = 100$$,
  'P0001',
  'append-only record cannot be changed',
  'SEO audit receipts cannot be rewritten'
);

select extensions.ok(
  public.record_listing_content_intelligence_candidate(
    '20000000-0000-0000-0000-000000000001',
    (select id from private.listing_source_fact_sets limit 1),
    (select id from private.listing_seo_audits limit 1),
    'listing-content-v1',
    'Emergency HVAC repair',
    '{"needNow":["availability","service area","proof","price expectations","next step"]}'::jsonb,
    '{"about":"A fact-grounded draft","faqs":[]}'::jsonb,
    '{"claims":[{"pointer":"/about","sourcePage":0}]}'::jsonb,
    '{"method":"cross-listing-similarity","maxSimilarity":0.22}'::jsonb
  ) is not null,
  'content candidates can be written only through the scoped evidence command'
);

select extensions.is(
  (select review_status from app.listing_content_intelligence_candidates),
  'pending_review',
  'generated competitive content remains pending human review'
);
select extensions.ok(
  not has_table_privilege('anon', 'app.listing_content_intelligence_candidates', 'select'),
  'anonymous visitors cannot read unpublished intelligence candidates'
);

update app.business_listings
set website_url = null
where id = '20000000-0000-0000-0000-000000000001';

select extensions.is(
  (select jsonb_array_length(source_inventory) from private.listing_intelligence_accounts),
  1,
  'clearing the primary URL removes it while retaining the registered Yelp source'
);
select extensions.is(
  (select seo_audit_status from private.listing_intelligence_accounts),
  'not_applicable',
  'a platform-only Listing has a terminal not-applicable SEO audit status'
);

select * from extensions.finish();
rollback;
