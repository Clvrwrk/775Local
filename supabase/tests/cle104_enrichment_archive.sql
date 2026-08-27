begin;

create extension if not exists pgtap with schema extensions;
select extensions.plan(30);

select extensions.has_table('private', 'enrichment_snapshots', 'snapshot table exists');
select extensions.has_table('private', 'enrichment_raw_artifacts', 'raw artifact table exists');
select extensions.has_table(
  'private',
  'enrichment_snapshot_artifacts',
  'snapshot membership table exists'
);
select extensions.has_table(
  'app',
  'listing_enrichment_profiles',
  'private seed profile proposal table exists'
);
select extensions.has_table(
  'app',
  'listing_enrichment_photo_candidates',
  'photo review candidate table exists'
);

select extensions.ok(
  (select relrowsecurity from pg_class where oid = 'private.enrichment_raw_artifacts'::regclass),
  'raw enrichment evidence has RLS defense in depth'
);
select extensions.ok(
  (select relrowsecurity from pg_class where oid = 'app.listing_enrichment_profiles'::regclass),
  'profile proposals have RLS enabled'
);

select extensions.ok(
  not has_function_privilege(
    'anon',
    'public.register_enrichment_snapshot(text,text,integer,integer,bigint,jsonb,timestamptz,text,jsonb)',
    'execute'
  ),
  'anonymous callers cannot register enrichment snapshots'
);
select extensions.ok(
  not has_function_privilege(
    'authenticated',
    'public.register_enrichment_snapshot(text,text,integer,integer,bigint,jsonb,timestamptz,text,jsonb)',
    'execute'
  ),
  'authenticated callers cannot register enrichment snapshots'
);
select extensions.ok(
  has_function_privilege(
    'service_role',
    'public.register_enrichment_snapshot(text,text,integer,integer,bigint,jsonb,timestamptz,text,jsonb)',
    'execute'
  ),
  'service role can use the scoped enrichment snapshot command'
);
select extensions.ok(
  not has_table_privilege('authenticated', 'private.enrichment_raw_artifacts', 'select'),
  'authenticated callers cannot read raw enrichment artifacts directly'
);
select extensions.ok(
  not has_table_privilege('service_role', 'private.enrichment_raw_artifacts', 'insert'),
  'service role cannot bypass the raw artifact command'
);
select extensions.ok(
  has_table_privilege('authenticated', 'app.listing_enrichment_profiles', 'select'),
  'authenticated Operators may reach profile proposals through RLS'
);
select extensions.ok(
  not has_table_privilege('service_role', 'app.listing_enrichment_profiles', 'insert'),
  'service role cannot bypass the profile proposal command'
);

select extensions.ok(
  public.register_enrichment_snapshot(
    repeat('a', 64),
    '/private/local775/enrichment',
    1,
    1,
    19,
    '["business-controlled-domain-v3"]'::jsonb,
    '2026-08-26T20:00:00Z'::timestamptz,
    'supabase-test',
    '{"publicationWrites":false}'::jsonb
  ) is not null,
  'a valid snapshot registers'
);

select extensions.is(
  public.ingest_enrichment_artifacts(
    (select id from private.enrichment_snapshots where manifest_sha256 = repeat('a', 64)),
    jsonb_build_array(
      jsonb_build_object(
        'relative_path', 'batch-01/listings/hvac--acme.example.json',
        'content_sha256', encode(
          extensions.digest(convert_to('{"schemaVersion":1}', 'UTF8'), 'sha256'),
          'hex'
        ),
        'byte_count', 19,
        'content_type', 'application/json',
        'raw_text', '{"schemaVersion":1}',
        'parsed_payload', '{"schemaVersion":1}'::jsonb,
        'artifact_kind', 'listing_receipt',
        'batch_slug', 'batch-01',
        'category_priority', 1,
        'category_slug', 'hvac',
        'domain', 'acme.example',
        'source_url', 'https://acme.example/',
        'provider', 'firecrawl',
        'is_superseded', false
      )
    )
  ),
  1,
  'a valid raw artifact is linked to the snapshot'
);

select extensions.is(
  public.ingest_enrichment_artifacts(
    (select id from private.enrichment_snapshots where manifest_sha256 = repeat('a', 64)),
    jsonb_build_array(
      jsonb_build_object(
        'relative_path', 'batch-01/listings/hvac--acme.example.json',
        'content_sha256', encode(
          extensions.digest(convert_to('{"schemaVersion":1}', 'UTF8'), 'sha256'),
          'hex'
        ),
        'byte_count', 19,
        'content_type', 'application/json',
        'raw_text', '{"schemaVersion":1}',
        'parsed_payload', '{"schemaVersion":1}'::jsonb,
        'artifact_kind', 'listing_receipt',
        'batch_slug', 'batch-01',
        'category_priority', 1,
        'category_slug', 'hvac',
        'domain', 'acme.example',
        'source_url', 'https://acme.example/',
        'provider', 'firecrawl',
        'is_superseded', false
      )
    )
  ),
  0,
  'raw artifact ingestion is idempotent'
);

select extensions.is(
  (select raw_text from private.enrichment_raw_artifacts limit 1),
  '{"schemaVersion":1}',
  'raw text remains byte-for-byte accessible'
);
select extensions.is(
  (
    select count(*)::integer
    from private.enrichment_snapshot_artifacts
    where snapshot_id = (
      select id from private.enrichment_snapshots where manifest_sha256 = repeat('a', 64)
    )
  ),
  1,
  'snapshot membership reconciles exactly'
);

select extensions.throws_ok(
  $$
    select public.ingest_enrichment_artifacts(
      (select id from private.enrichment_snapshots where manifest_sha256 = repeat('a', 64)),
      '[{
        "relative_path":"bad.json",
        "content_sha256":"bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
        "byte_count":2,
        "content_type":"application/json",
        "raw_text":"{}",
        "parsed_payload":{},
        "artifact_kind":"other"
      }]'::jsonb
    )
  $$,
  'P0001',
  'one or more enrichment artifacts are invalid',
  'a mismatched raw content hash fails closed'
);

select extensions.is(
  public.ingest_enrichment_profiles(
    (select id from private.enrichment_snapshots where manifest_sha256 = repeat('a', 64)),
    jsonb_build_array(
      jsonb_build_object(
        'content_sha256', encode(
          extensions.digest(convert_to('{"schemaVersion":1}', 'UTF8'), 'sha256'),
          'hex'
        ),
        'proposal_version', 'seed-profile-v1',
        'category_priority', 1,
        'category_slug', 'hvac',
        'category_name', 'HVAC',
        'domain', 'acme.example',
        'website_url', 'https://acme.example/',
        'serp_rank', 1,
        'filter_version', 'business-controlled-domain-v3',
        'filter_version_accepted', true,
        'evidence_status', 'complete',
        'normalized_title', 'Acme Heating',
        'description_candidate', 'Acme Heating provides furnace repair in Reno.',
        'about_source_excerpt', 'Acme Heating has served Reno since 1985.',
        'phone_candidates', '["775-555-0100"]'::jsonb,
        'email_candidates', '["service@acme.example"]'::jsonb,
        'hours_evidence', 'Monday 8am-5pm',
        'service_candidates', '["Furnace repair"]'::jsonb,
        'service_area_candidates', '["Reno"]'::jsonb,
        'photo_candidates', '[{
          "image_url":"https://acme.example/uploads/project.jpg",
          "source_page_url":"https://acme.example/gallery",
          "alt_text":"Completed project",
          "role_candidate":"gallery",
          "same_site":true,
          "evidence_score":100
        }]'::jsonb,
        'source_urls', '["https://acme.example/"]'::jsonb,
        'page_count', 5,
        'completeness_score', 100
      )
    )
  ),
  1,
  'a robust private profile proposal is inserted'
);

select extensions.is(
  (select normalized_title from app.listing_enrichment_profiles limit 1),
  'Acme Heating',
  'profile facts remain queryable without reading the raw payload'
);
select extensions.is(
  (select count(*)::integer from app.listing_enrichment_photo_candidates),
  1,
  'website photo provenance is normalized into a review queue'
);
select extensions.is(
  public.ingest_enrichment_profiles(
    (select id from private.enrichment_snapshots where manifest_sha256 = repeat('a', 64)),
    jsonb_build_array(
      jsonb_build_object(
        'content_sha256', encode(
          extensions.digest(convert_to('{"schemaVersion":1}', 'UTF8'), 'sha256'),
          'hex'
        ),
        'proposal_version', 'seed-profile-v1',
        'category_priority', 1,
        'category_slug', 'hvac',
        'category_name', 'HVAC',
        'domain', 'acme.example',
        'website_url', 'https://acme.example/',
        'serp_rank', 1,
        'filter_version', 'business-controlled-domain-v3',
        'filter_version_accepted', true,
        'evidence_status', 'complete',
        'normalized_title', 'Acme Heating',
        'phone_candidates', '[]'::jsonb,
        'email_candidates', '[]'::jsonb,
        'service_candidates', '[]'::jsonb,
        'service_area_candidates', '[]'::jsonb,
        'photo_candidates', '[]'::jsonb,
        'source_urls', '[]'::jsonb,
        'page_count', 5,
        'completeness_score', 20
      )
    )
  ),
  0,
  'profile proposal ingestion is idempotent'
);

select extensions.ok(
  (
    public.enrichment_snapshot_status(
      (select id from private.enrichment_snapshots where manifest_sha256 = repeat('a', 64))
    )->>'complete'
  )::boolean,
  'snapshot status reconciles artifacts, bytes, and profiles'
);
select extensions.is(
  (
    public.enrichment_snapshot_status(
      (select id from private.enrichment_snapshots where manifest_sha256 = repeat('a', 64))
    )->>'accepted_filter_profile_count'
  )::integer,
  1,
  'accepted filter profile count is explicit'
);

select extensions.throws_ok(
  $$update private.enrichment_raw_artifacts set raw_text = '{}'$$,
  'P0001',
  'append-only record cannot be changed',
  'raw enrichment evidence cannot be mutated'
);

select extensions.ok(
  not has_table_privilege('anon', 'app.listing_enrichment_profiles', 'select'),
  'anonymous callers cannot read private profile proposals'
);
select extensions.ok(
  not has_function_privilege(
    'authenticated',
    'public.ingest_enrichment_profiles(bigint,jsonb)',
    'execute'
  ),
  'authenticated callers cannot ingest profile proposals'
);
select extensions.ok(
  has_function_privilege(
    'service_role',
    'public.enrichment_snapshot_status(bigint)',
    'execute'
  ),
  'service role can read a redacted aggregate reconciliation receipt'
);

select * from extensions.finish();
rollback;
