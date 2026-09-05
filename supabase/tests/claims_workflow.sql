begin;

create extension if not exists pgtap with schema extensions;
select extensions.plan(22);

insert into app.actors (id, workos_user_id, primary_email, display_name)
values
  ('81000000-0000-4000-8000-000000000001', 'claimant_domain', 'owner@claim-shop.example', 'Claimant'),
  ('81000000-0000-4000-8000-000000000002', 'claim_operator', 'chussey@aia4.io', 'Claim Operator');

insert into app.operator_grants (
  actor_id,
  allowlisted_email,
  permissions,
  status,
  approved_by,
  approved_at,
  workos_organization_id
) values (
  '81000000-0000-4000-8000-000000000002',
  'chussey@aia4.io',
  array['claim_review'],
  'active',
  'claim-test',
  statement_timestamp(),
  'org_local775'
);

insert into app.businesses (id, canonical_name)
values ('82000000-0000-4000-8000-000000000001', 'Claim Shop');

insert into app.business_listings (
  id,
  business_id,
  current_slug,
  display_name,
  website_url,
  city_slug,
  postal_code,
  publication_status,
  published_at
) values (
  '83000000-0000-4000-8000-000000000001',
  '82000000-0000-4000-8000-000000000001',
  'claim-shop',
  'Claim Shop',
  'https://www.claim-shop.example/',
  'reno',
  '89502',
  'published',
  statement_timestamp()
);

select extensions.ok(
  not has_function_privilege('anon', 'public.submit_listing_claim(uuid,text,text)', 'execute'),
  'anonymous callers cannot submit Claims'
);
select extensions.ok(
  has_function_privilege('authenticated', 'public.submit_listing_claim(uuid,text,text)', 'execute'),
  'authenticated callers may enter the guarded Claim command'
);
select extensions.ok(
  not has_function_privilege('authenticated', 'app.claim_email_matches_listing(uuid,uuid)', 'execute'),
  'authenticated callers cannot probe private domain evidence directly'
);
select extensions.ok(
  not has_table_privilege('authenticated', 'app.claims', 'insert'),
  'authenticated callers cannot bypass the Claim command with direct inserts'
);
select extensions.ok(
  not has_table_privilege('authenticated', 'app.claims', 'update'),
  'authenticated callers cannot bypass Claim decision commands with direct updates'
);

select set_config(
  'request.jwt.claims',
  jsonb_build_object('sub', 'claimant_domain', 'auth_time', extract(epoch from statement_timestamp())::bigint)::text,
  true
);
set local role authenticated;

select extensions.is(
  public.submit_listing_claim(
    '83000000-0000-4000-8000-000000000001',
    'business_domain',
    'claim-test-submit-1'
  ) ->> 'status',
  'submitted',
  'matching business-domain evidence submits a Claim for review'
);

reset role;
select extensions.is(
  (select count(*)::integer from app.claims where listing_id = '83000000-0000-4000-8000-000000000001'),
  1,
  'Claim submission creates exactly one Claim'
);
select extensions.is(
  (select count(*)::integer from app.listing_participations where listing_id = '83000000-0000-4000-8000-000000000001'),
  0,
  'Claim submission creates no Listing Participation'
);
select extensions.is(
  (select count(*)::integer from app.audit_events where action = 'claim.submitted'),
  1,
  'Claim submission appends one audit event'
);
select extensions.is(
  (select count(*)::integer from app.integration_outbox where event_type = 'claim.submitted'),
  1,
  'Claim submission appends one GHL outbox event'
);

select set_config(
  'request.jwt.claims',
  jsonb_build_object('sub', 'claimant_domain', 'auth_time', extract(epoch from statement_timestamp())::bigint)::text,
  true
);
set local role authenticated;
select extensions.is(
  public.submit_listing_claim(
    '83000000-0000-4000-8000-000000000001',
    'business_domain',
    'claim-test-submit-1'
  ) ->> 'status',
  'submitted',
  'Claim submission replay returns the existing Claim'
);
select extensions.is(
  (select count(*)::integer from app.claims where listing_id = '83000000-0000-4000-8000-000000000001'),
  1,
  'Claim submission replay is idempotent'
);
select extensions.is(
  public.get_my_listing_claim('83000000-0000-4000-8000-000000000001') ->> 'owner_authority',
  'false',
  'a submitted Claim reports no owner authority'
);

reset role;
select set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'sub', 'claim_operator',
    'org_id', 'org_local775',
    'auth_time', extract(epoch from statement_timestamp())::bigint
  )::text,
  true
);
set local role authenticated;

select extensions.is(
  public.decide_listing_claim(
    (select id from app.claims where listing_id = '83000000-0000-4000-8000-000000000001'),
    'approved',
    'Business domain evidence confirmed.',
    'claim-test-decision-1'
  ) ->> 'status',
  'approved',
  'recently authenticated claim reviewer can approve domain evidence'
);
select extensions.is(
  (select count(*)::integer from app.listing_participations where role = 'business_owner' and status = 'active'),
  1,
  'Claim approval creates exactly one active Business Owner participation'
);
select extensions.ok(
  (select owner_verified_at is not null from app.business_listings where id = '83000000-0000-4000-8000-000000000001'),
  'Claim approval updates the independent Owner verified label'
);
select extensions.is(
  (select count(*)::integer from app.audit_events where action = 'claim.approved'),
  1,
  'Claim approval appends one decision audit event'
);
select extensions.is(
  (select count(*)::integer from app.integration_outbox where event_type = 'claim.approved'),
  1,
  'Claim approval appends one decision projection event'
);
select extensions.is(
  (select count(*)::integer from app.integration_outbox where event_type = 'listing_participation.activated'),
  1,
  'Claim approval appends one participation projection event'
);

reset role;
insert into app.business_listings(id,business_id,current_slug,display_name,city_slug,postal_code,publication_status,published_at) values('83000000-0000-4000-8000-000000000002','82000000-0000-4000-8000-000000000001','proof-shop','Proof Shop','reno','89502','published',statement_timestamp());
insert into app.claims(id,listing_id,claimant_actor_id,method,status,submitted_at) values('85000000-0000-4000-8000-000000000001','83000000-0000-4000-8000-000000000002','81000000-0000-4000-8000-000000000001','document','needs_evidence',statement_timestamp());
insert into private.claim_proofs(claim_id,storage_path,sha256,media_type,delete_after) values('85000000-0000-4000-8000-000000000001','private-test-proof',repeat('a',64),'application/pdf',statement_timestamp()+interval '7 days');
set local role authenticated;
select extensions.throws_ok($$select public.decide_listing_claim('85000000-0000-4000-8000-000000000001','approved','Reviewed private evidence','proof-decision-1')$$,'P0001','Claim Proof is required before approval','unscanned proof cannot approve ownership');
reset role;
update private.claim_proofs set scan_status='clean',validated_at=statement_timestamp(),delete_after=statement_timestamp()-interval '1 day' where storage_path='private-test-proof';
set local role authenticated;
select extensions.throws_ok($$select public.decide_listing_claim('85000000-0000-4000-8000-000000000001','approved','Reviewed private evidence','proof-decision-1')$$,'P0001','Claim Proof is required before approval','expired proof cannot approve ownership');
reset role;
update private.claim_proofs set delete_after=statement_timestamp()+interval '7 days' where storage_path='private-test-proof';
set local role authenticated;
select extensions.is(public.decide_listing_claim('85000000-0000-4000-8000-000000000001','approved','Reviewed private evidence','proof-decision-1')->>'status','approved','only validated clean unexpired proof allows review approval');
select * from extensions.finish();
rollback;
