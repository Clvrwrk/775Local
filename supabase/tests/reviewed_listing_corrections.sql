begin;
create extension if not exists pgtap with schema extensions;
select extensions.no_plan();
insert into app.actors(id,workos_user_id,primary_email) values
 ('91000000-0000-4000-8000-000000000001','correction-fixture-op','chussey@aia4.io'),
 ('91000000-0000-4000-8000-000000000002','correction-fixture-other','other@fixture.example'),
 ('91000000-0000-4000-8000-000000000003','correction-fixture-op-two','chussey@aia4.io');
insert into app.operator_grants(actor_id,allowlisted_email,permissions,status,approved_by,approved_at,workos_organization_id)
 select id,'chussey@aia4.io',array['listing_review','listing_publish'],'active','synthetic-fixture',statement_timestamp(),'org_local775'
 from app.actors where workos_user_id in ('correction-fixture-op','correction-fixture-op-two');
insert into app.businesses(id,canonical_name) values('92000000-0000-4000-8000-000000000001','Synthetic Correction Fixture');
insert into app.business_listings(id,business_id,current_slug,display_name,description,website_url,city_slug,postal_code,hide_street,is_service_area,publication_status,published_at,information_checked_at)
 values('93000000-0000-4000-8000-000000000001','92000000-0000-4000-8000-000000000001','correction-fixture','Synthetic Fixture','Original public description.','https://fixture.example','reno','89502',true,true,'published',statement_timestamp(),statement_timestamp()),
 ('93000000-0000-4000-8000-000000000002','92000000-0000-4000-8000-000000000001','correction-fixture-two','Second Fixture','Second public description.','https://fixture.example','reno','89502',true,true,'published',statement_timestamp(),null);
insert into app.listing_content(listing_id,about,services,content_status)
 select id,'Distinct existing About preserved.','{Home Repair}','approved' from app.business_listings where current_slug like 'correction-fixture%';
-- Existing private coordinates must remain private and must not survive a reveal.
update app.business_listings set street_address='1757 Synthetic Avenue',postal_code='89431',latitude=39.5296,longitude=-119.8138 where current_slug='correction-fixture';
update app.business_listings set street_address='Stored Service Area Address',latitude=39.6,longitude=-119.8 where current_slug='correction-fixture-two';
select extensions.throws_ok($$update app.business_listings set hide_street=false where current_slug='correction-fixture-two'$$,'23514',null,'foundation constraint rejects a service-area listing with an exposed street');
create function pg_temp.correction(changes_value jsonb) returns jsonb language sql as $$
 select jsonb_build_object('expectedSlug','correction-fixture','expectedDomain','fixture.example',
  'expectedVersion',public.listing_correction_snapshot('93000000-0000-4000-8000-000000000001')->>'version',
  'changes',changes_value,'reason','Reviewed synthetic source evidence',
  'fieldProvenance',(select jsonb_object_agg(k,jsonb_build_object('state',case when v='null'::jsonb then 'unknown' else 'verified' end,
    'url','https://fixture.example/verified','artifactSha256',repeat('a',64),'checkedAt',statement_timestamp(),'reason','Synthetic first-party fixture evidence')) from jsonb_each(changes_value) as e(k,v)));
$$;
create temporary table correction_fixture(command jsonb,receipt jsonb,rollback_receipt jsonb);
grant all on correction_fixture to authenticated;
select extensions.ok(not has_table_privilege('anon','app.reviewed_listing_correction_receipts','select'),'proof/provenance receipts are private');
select extensions.ok(not has_table_privilege('authenticated','app.reviewed_listing_correction_receipts','insert'),'no direct receipt writes');
select extensions.ok(not has_table_privilege('service_role','app.reviewed_listing_correction_receipts','insert'),'service role cannot bypass correction receipts');
select extensions.ok(not has_function_privilege('anon','public.apply_reviewed_listing_correction(uuid,jsonb,text)','execute'),'anonymous publication denied');
select set_config('request.jwt.claims','{"sub":"correction-fixture-other"}',true);
set local role authenticated;
select extensions.throws_ok($$select public.listing_correction_snapshot('93000000-0000-4000-8000-000000000001')$$,'P0001','reauth_required','unrelated user cannot read correction snapshot');
reset role;
select set_config('request.jwt.claims',jsonb_build_object('sub','correction-fixture-op','org_id','org_local775','auth_time',extract(epoch from statement_timestamp()-interval '16 minutes')::bigint)::text,true);
set local role authenticated;
select extensions.throws_ok($$select public.listing_correction_snapshot('93000000-0000-4000-8000-000000000001')$$,'P0001','reauth_required','stale authentication rejected');
reset role;
select set_config('request.jwt.claims',jsonb_build_object('sub','correction-fixture-op','org_id','org_local775','auth_time',extract(epoch from statement_timestamp())::bigint)::text,true);
update app.operator_grants set permissions=array['listing_review'] where actor_id='91000000-0000-4000-8000-000000000001';
set local role authenticated;
select extensions.throws_ok($$select public.listing_correction_snapshot('93000000-0000-4000-8000-000000000001')$$,'P0001','correction_forbidden','review permission alone cannot publish');
reset role;
update app.operator_grants set permissions=array['listing_review','listing_publish'] where actor_id='91000000-0000-4000-8000-000000000001';
set local role authenticated;
select extensions.ok((select latitude is null and longitude is null and postal_code is null from public.directory_listings where current_slug='correction-fixture'),'hidden coordinates and postal code are masked');
select extensions.ok((select street_address is null and latitude is null and longitude is null and postal_code is null from public.directory_listings where current_slug='correction-fixture-two'),'valid hidden service-area listing masks private street/postal/coordinates');
select extensions.ok((public.listing_correction_snapshot('93000000-0000-4000-8000-000000000001')->>'version') ~ '^[a-f0-9]{64}$','snapshot has target-specific optimistic version');
select extensions.throws_ok($$select public.apply_reviewed_listing_correction('93000000-0000-4000-8000-000000000002',pg_temp.correction('{"hide_street":false,"is_service_area":false}')||jsonb_build_object('expectedSlug','correction-fixture-two','expectedVersion',public.listing_correction_snapshot('93000000-0000-4000-8000-000000000002')->>'version'),'correction-service-reveal-without-evidence')$$,'P0001','correction_address_evidence_required','service-area reveal cannot reuse stored address without all independently reviewed fields');
insert into correction_fixture(command) values(pg_temp.correction('{"hours_text":"Office hours: Mon–Fri 9am–4pm; service visits require confirmation."}'));
select extensions.throws_ok($$select public.apply_reviewed_listing_correction('93000000-0000-4000-8000-000000000001',pg_temp.correction('{"content_tier":"premium"}'),'correction-tier-1')$$,'P0001','invalid_listing_correction','cannot change tier quality');
select extensions.throws_ok($$select public.apply_reviewed_listing_correction('93000000-0000-4000-8000-000000000001',pg_temp.correction('{"owner_verified_at":null}'),'correction-owner-1')$$,'P0001','invalid_listing_correction','cannot change ownership');
select extensions.throws_ok($$select public.apply_reviewed_listing_correction('93000000-0000-4000-8000-000000000001',jsonb_set(command,'{expectedSlug}','"wrong-listing"'),'correction-wrong-1') from correction_fixture$$,'P0001','correction_identity_conflict','wrong slug is not a crosswalk');
select extensions.throws_ok($$select public.apply_reviewed_listing_correction('93000000-0000-4000-8000-000000000001',jsonb_set(command,'{expectedDomain}','"lookalike.example"'),'correction-domain-1') from correction_fixture$$,'P0001','correction_identity_conflict','wrong domain rejected');
select extensions.throws_ok($$select public.apply_reviewed_listing_correction('93000000-0000-4000-8000-000000000001',command-'fieldProvenance','correction-evidence-1') from correction_fixture$$,'P0001','invalid_listing_correction','missing evidence rejected');
select extensions.throws_ok($$select public.apply_reviewed_listing_correction('93000000-0000-4000-8000-000000000001',jsonb_set(command,'{fieldProvenance,hours_text,url}','"https://fixture.example.evil.test/contact"'),'correction-source-1') from correction_fixture$$,'P0001','correction_source_identity_conflict','lookalike source cannot authorize data');
select extensions.throws_ok($$select public.apply_reviewed_listing_correction('93000000-0000-4000-8000-000000000001',jsonb_set(command,'{fieldProvenance,hours_text,checkedAt}',to_jsonb(statement_timestamp()-interval '31 days')),'correction-expired-1') from correction_fixture$$,'P0001','correction_evidence_expired','expired evidence cannot update');
select extensions.throws_ok($$select public.apply_reviewed_listing_correction('93000000-0000-4000-8000-000000000001',jsonb_set(command,'{fieldProvenance,hours_text,state}','"unknown"'),'correction-unknown-1') from correction_fixture$$,'P0001','invalid_correction_unknown','unknown cannot support nonnull hours');
select extensions.throws_ok($$select public.apply_reviewed_listing_correction('93000000-0000-4000-8000-000000000001',pg_temp.correction(jsonb_build_object('hours_text',E'9am\n4pm')),'correction-control-1')$$,'P0001','invalid_listing_correction','unrelated/control prose rejected');
select extensions.throws_ok($$select public.apply_reviewed_listing_correction('93000000-0000-4000-8000-000000000001',pg_temp.correction('{"hide_street":false}'),'correction-expose-1')$$,'P0001','correction_address_evidence_required','publishing stored hidden address requires complete field evidence');
update correction_fixture set receipt=public.apply_reviewed_listing_correction('93000000-0000-4000-8000-000000000001',command,'correction-valid-1');
select extensions.is((select receipt->>'idempotent' from correction_fixture),'false','explicit reviewed command publishes existing-record hours');
select extensions.is((select hours_text from public.directory_listings where current_slug='correction-fixture'),'Office hours: Mon–Fri 9am–4pm; service visits require confirmation.','exact hours scope reaches public projection');
reset role;
select extensions.ok((select latitude=39.5296 and longitude=-119.8138 from app.business_listings where current_slug='correction-fixture'),'hours-only correction preserves stored coordinates without exposing them');
select extensions.is((select about from app.listing_content where listing_id='93000000-0000-4000-8000-000000000001'),'Distinct existing About preserved.','hours-only correction preserves unrelated About');
select extensions.ok((select owner_verified_at is null and information_checked_at is not null and content_tier='basic' from app.business_listings where current_slug='correction-fixture'),'hours preserve trust/ownership/tier state');
select extensions.is((select count(*)::integer from app.reviewed_listing_correction_receipts),1,'one append-only before/after receipt');
select extensions.is((select before_values->>'hours_text' from app.reviewed_listing_correction_receipts),null::text,'receipt preserves previous unknown');
select extensions.ok((select before_version<>after_version from app.reviewed_listing_correction_receipts),'changed version protects rollback and future editors');
select extensions.is((select count(*)::integer from app.audit_events where action='listing.corrected'),1,'attributable audit exists');
select extensions.is((select count(*)::integer from app.integration_outbox),0,'no external-delivery side effects');
set local role authenticated;
select extensions.is((select public.apply_reviewed_listing_correction('93000000-0000-4000-8000-000000000001',command,'correction-valid-1')->>'idempotent' from correction_fixture),'true','duplicate click is idempotent');
select extensions.throws_ok($$select public.apply_reviewed_listing_correction('93000000-0000-4000-8000-000000000001',jsonb_set(command,'{reason}','"Changed reason"'),'correction-valid-1') from correction_fixture$$,'P0001','idempotency_conflict','key cannot replay changed request');
select extensions.throws_ok($$select public.apply_reviewed_listing_correction('93000000-0000-4000-8000-000000000001',command,'correction-stale-1') from correction_fixture$$,'P0001','listing_changed_since_correction','stale version cannot overwrite');
select extensions.throws_ok($$select public.apply_reviewed_listing_correction('93000000-0000-4000-8000-000000000002',command,'correction-wrong-location') from correction_fixture$$,'P0001','correction_identity_conflict','target UUID requires matching record identity');
reset role;
select set_config('request.jwt.claims',jsonb_build_object('sub','correction-fixture-op-two','org_id','org_local775','auth_time',extract(epoch from statement_timestamp())::bigint)::text,true);
set local role authenticated;
select extensions.throws_ok($$select public.apply_reviewed_listing_correction('93000000-0000-4000-8000-000000000001',command,'correction-valid-1') from correction_fixture$$,'P0001','idempotency_conflict','another operator cannot reuse actor-bound key');
reset role;
select set_config('request.jwt.claims',jsonb_build_object('sub','correction-fixture-op','org_id','org_local775','auth_time',extract(epoch from statement_timestamp())::bigint)::text,true);
set local role authenticated;
update correction_fixture set rollback_receipt=public.rollback_reviewed_listing_correction('93000000-0000-4000-8000-000000000001',(receipt->>'receiptId')::uuid,receipt->>'version','Restore synthetic prior content','correction-rollback-1');
select extensions.is((select hours_text from public.directory_listings where current_slug='correction-fixture'),null::text,'version-guarded rollback restores unknown');
select extensions.is((select public.rollback_reviewed_listing_correction('93000000-0000-4000-8000-000000000001',(receipt->>'receiptId')::uuid,receipt->>'version','Restore synthetic prior content','correction-rollback-1')->>'idempotent' from correction_fixture),'true','rollback retry does not repeat changes');
select extensions.throws_ok($$select public.rollback_reviewed_listing_correction('93000000-0000-4000-8000-000000000001',(receipt->>'receiptId')::uuid,rollback_receipt->>'version','Duplicate rollback attempt','correction-rollback-2') from correction_fixture$$,'P0001','correction_already_rolled_back','receipt can be reverted once');
update correction_fixture set command=pg_temp.correction('{"street_address":"1757 Synthetic Avenue","postal_code":"89431","hide_street":false,"is_service_area":false,"address_locality":"Sparks","service_area_names":["Reno","Sparks"]}');
update correction_fixture set receipt=public.apply_reviewed_listing_correction('93000000-0000-4000-8000-000000000001',command,'correction-location-1');
select extensions.is((select address_locality from public.directory_listings where current_slug='correction-fixture'),'Sparks','physical locality survives Reno discovery identity');
select extensions.ok((select latitude is null and longitude is null from public.directory_listings where current_slug='correction-fixture'),'reveal cannot publish stored unreviewed coordinates');
reset role;
select extensions.ok((select latitude is null and longitude is null from app.business_listings where current_slug='correction-fixture'),'reveal clears coordinates at source');
select extensions.ok((select (before_values->>'latitude')::numeric=39.5296 and after_values->'latitude'='null'::jsonb from app.reviewed_listing_correction_receipts where id=(select (receipt->>'receiptId')::uuid from correction_fixture)),'private receipt records coordinate invalidation');
set local role authenticated;
update correction_fixture set rollback_receipt=public.rollback_reviewed_listing_correction('93000000-0000-4000-8000-000000000001',(receipt->>'receiptId')::uuid,receipt->>'version','Restore hidden address without unreviewed coordinates','correction-location-rollback');
reset role;
select extensions.ok((select hide_street and latitude is null and longitude is null from app.business_listings where current_slug='correction-fixture'),'reveal rollback keeps stale coordinates cleared');
set local role authenticated;
update correction_fixture set command=pg_temp.correction('{"street_address":"1757 Synthetic Avenue","postal_code":"89431","hide_street":false,"is_service_area":false,"address_locality":"Sparks"}');
update correction_fixture set receipt=public.apply_reviewed_listing_correction('93000000-0000-4000-8000-000000000001',command,'correction-location-reveal-again');
reset role;
-- Simulate a separate prior reviewed geocode. An address move must invalidate it.
update app.business_listings set latitude=39.5400,longitude=-119.7500 where current_slug='correction-fixture';
set local role authenticated;
select extensions.throws_ok($$select public.rollback_reviewed_listing_correction('93000000-0000-4000-8000-000000000001',(receipt->>'receiptId')::uuid,receipt->>'version','Coordinate change is an intervening edit','correction-coordinate-version') from correction_fixture$$,'P0001','listing_changed_since_correction','coordinate-only changes participate in optimistic version');
update correction_fixture set command=pg_temp.correction('{"street_address":"2000 Synthetic Way","postal_code":"89502","address_locality":"Reno"}');
update correction_fixture set receipt=public.apply_reviewed_listing_correction('93000000-0000-4000-8000-000000000001',command,'correction-address-move');
select extensions.ok((select latitude is null and longitude is null and street_address='2000 Synthetic Way' from public.directory_listings where current_slug='correction-fixture'),'address move publishes no stale geocode');
update correction_fixture set rollback_receipt=public.rollback_reviewed_listing_correction('93000000-0000-4000-8000-000000000001',(receipt->>'receiptId')::uuid,receipt->>'version','Restore prior reviewed address only','correction-address-move-rollback');
select extensions.ok((select latitude is null and longitude is null and street_address='1757 Synthetic Avenue' and address_locality='Sparks' from public.directory_listings where current_slug='correction-fixture'),'address rollback restores address without republishing the prior coordinates');
update correction_fixture set command=pg_temp.correction('{"hours_text":"Current synthetic office hours"}');
update correction_fixture set receipt=public.apply_reviewed_listing_correction('93000000-0000-4000-8000-000000000001',command,'correction-before-intervening-edit');

reset role;
select extensions.ok((select city_slug='reno' and information_checked_at is null and owner_verified_at is null from app.business_listings where current_slug='correction-fixture'),'location correction preserves discovery geography and does not grant verification');
update app.listing_content set hours_text='An intervening edit',updated_at=clock_timestamp() where listing_id='93000000-0000-4000-8000-000000000001';
set local role authenticated;
select extensions.throws_ok($$select public.rollback_reviewed_listing_correction('93000000-0000-4000-8000-000000000001',(receipt->>'receiptId')::uuid,receipt->>'version','Do not overwrite intervening edit','correction-conflict-rollback') from correction_fixture$$,'P0001','listing_changed_since_correction','rollback abstains after an intervening edit');
reset role;
update app.operator_grants set status='revoked',approved_at=null,revoked_at=statement_timestamp() where actor_id='91000000-0000-4000-8000-000000000001';
set local role authenticated;
select extensions.throws_ok($$select public.apply_reviewed_listing_correction('93000000-0000-4000-8000-000000000001',command,'correction-location-1') from correction_fixture$$,'P0001','reauth_required','revoked operator cannot replay prior command');
reset role;
set local role anon;
select extensions.is((select address_locality from public.directory_listings where current_slug='correction-fixture'),'Sparks','anonymous sees only published reviewed locality');
select * from extensions.finish();
rollback;
