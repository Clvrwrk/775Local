begin;
create extension if not exists pgtap with schema extensions;
select extensions.no_plan();
insert into app.actors(id,workos_user_id,primary_email) values
 ('d1000000-0000-4000-8000-000000000001','presentation-operator','chussey@aia4.io'),
 ('d1000000-0000-4000-8000-000000000002','presentation-other','private@fixture.example');
insert into app.operator_grants(actor_id,allowlisted_email,permissions,status,approved_at,workos_organization_id)
 values('d1000000-0000-4000-8000-000000000001','chussey@aia4.io',array['listing_review','listing_publish'],'active',statement_timestamp(),'org_presentation_fixture');
insert into app.businesses(id,canonical_name) values('d2000000-0000-4000-8000-000000000001','Synthetic Public Presentation');
insert into app.business_listings(id,business_id,current_slug,display_name,website_url,city_slug,postal_code,publication_status,published_at)
 values('d3000000-0000-4000-8000-000000000001','d2000000-0000-4000-8000-000000000001','presentation-fixture','Synthetic Public Presentation','https://fixture.example','reno','89502','published',statement_timestamp()),
 ('d3000000-0000-4000-8000-000000000002','d2000000-0000-4000-8000-000000000001','presentation-other','Synthetic Other','https://other.example','reno','89502','published',statement_timestamp());
insert into app.listing_private_contacts(listing_id,business_email,lead_email) values('d3000000-0000-4000-8000-000000000001','private-business@fixture.example','private-leads@fixture.example');
insert into app.media_assets(id,listing_id,kind,original_path,public_path,media_type,byte_size,sha256,status,reviewed_by,caption) values
 ('d4000000-0000-4000-8000-000000000001','d3000000-0000-4000-8000-000000000001','logo','private/logo.png','https://fixture.example/logo.png','image/png',100,repeat('a',64),'approved','d1000000-0000-4000-8000-000000000001','Company logo'),
 ('d4000000-0000-4000-8000-000000000002','d3000000-0000-4000-8000-000000000001','storefront','private/photo.png','https://fixture.example/photo.png','image/png',100,repeat('b',64),'approved','d1000000-0000-4000-8000-000000000001','Reviewed storefront'),
 ('d4000000-0000-4000-8000-000000000003','d3000000-0000-4000-8000-000000000002','logo','private/other.png','https://other.example/logo.png','image/png',100,repeat('c',64),'approved','d1000000-0000-4000-8000-000000000001','Different company');
create function pg_temp.presentation() returns jsonb language sql as $$
 select jsonb_build_object('expectedSlug','presentation-fixture','expectedDomain','fixture.example','expectedVersion',public.listing_presentation_snapshot('d3000000-0000-4000-8000-000000000001')->>'version','reason','Publish independently reviewed synthetic public data',
 'contact',jsonb_build_object('email','office@fixture.example','sourceUrl','https://fixture.example/contact','checkedAt',statement_timestamp(),'artifactSha256',repeat('d',64),'publicContactConfirmed',true),
 'media',jsonb_build_array(
 jsonb_build_object('mediaId','d4000000-0000-4000-8000-000000000001','slot','logo','sourceUrl','https://fixture.example/about','sourceCredit','Fixture Company','rightsBasis','official_company_logo','rightsEvidenceSha256',repeat('e',64),'rightsValidUntil',null,'checkedAt',statement_timestamp()),
 jsonb_build_object('mediaId','d4000000-0000-4000-8000-000000000002','slot','gallery','sourceUrl','https://fixture.example/gallery','sourceCredit','Fixture Company, used with permission','rightsBasis','owner_permission','rightsEvidenceSha256',repeat('f',64),'rightsValidUntil',statement_timestamp()+interval '30 days','checkedAt',statement_timestamp())));
$$;
create temporary table presentation_fixture(command jsonb,receipt jsonb);grant all on presentation_fixture to authenticated;
select extensions.ok(not has_function_privilege('anon','public.apply_reviewed_listing_presentation(uuid,jsonb,text)','execute'),'anonymous cannot publish presentation');
select extensions.ok(not has_table_privilege('authenticated','app.listing_public_presentation','insert'),'no direct presentation writes');
select extensions.ok(not has_table_privilege('service_role','app.listing_public_presentation','insert'),'service role cannot bypass reviewed presentation command');
select extensions.ok(not has_table_privilege('anon','private.listing_presentation_receipts','select'),'private provenance receipts are not public');
set local role anon;
select extensions.is((select count(*)::integer from public.directory_listing_presentation),0,'existing private contacts and approved media are not backfilled or presumed reviewed');
select extensions.is((select count(*)::integer from public.directory_listing_assets),0,'unreviewed assets have no alternate public feed');
reset role;
select set_config('request.jwt.claims','{"sub":"presentation-other"}',true);set local role authenticated;
select extensions.throws_ok($$select public.listing_presentation_snapshot('d3000000-0000-4000-8000-000000000001')$$,'P0001','reauth_required','unrelated claimant cannot read operator snapshot');
reset role;
select set_config('request.jwt.claims',jsonb_build_object('sub','presentation-operator','org_id','org_presentation_fixture','auth_time',extract(epoch from statement_timestamp())::bigint)::text,true);set local role authenticated;
insert into presentation_fixture(command) values(pg_temp.presentation());
select extensions.throws_ok($$select public.apply_reviewed_listing_presentation('d3000000-0000-4000-8000-000000000001',jsonb_set(command,'{expectedSlug}','"wrong-listing"'),'presentation-wrong-slug') from presentation_fixture$$,'P0001','presentation_identity_conflict','wrong listing identity rejected');
select extensions.throws_ok($$select public.apply_reviewed_listing_presentation('d3000000-0000-4000-8000-000000000001',jsonb_set(command,'{contact,publicContactConfirmed}','false'),'presentation-private-email') from presentation_fixture$$,'P0001','presentation_public_contact_evidence_required','private contact must never be treated as reviewed public email');
select extensions.throws_ok($$select public.apply_reviewed_listing_presentation('d3000000-0000-4000-8000-000000000001',jsonb_set(command,'{contact,sourceUrl}','"https://fixture.example.evil.test/contact"'),'presentation-wrong-source') from presentation_fixture$$,'P0001','presentation_source_identity_conflict','lookalike contact source denied');
select extensions.throws_ok($$select public.apply_reviewed_listing_presentation('d3000000-0000-4000-8000-000000000001',jsonb_set(command,'{contact,checkedAt}',to_jsonb(statement_timestamp()-interval '31 days')),'presentation-expired-contact') from presentation_fixture$$,'P0001','presentation_evidence_expired','stale public email evidence denied');
select extensions.throws_ok($$select public.apply_reviewed_listing_presentation('d3000000-0000-4000-8000-000000000001',jsonb_set(command,'{media,0,mediaId}','"d4000000-0000-4000-8000-000000000002"'),'presentation-wrong-logo') from presentation_fixture$$,'P0001','presentation_approved_asset_required','first image must actually be an approved logo');
select extensions.throws_ok($$select public.apply_reviewed_listing_presentation('d3000000-0000-4000-8000-000000000001',jsonb_set(command,'{media,0,mediaId}','"d4000000-0000-4000-8000-000000000003"'),'presentation-other-logo') from presentation_fixture$$,'P0001','presentation_approved_asset_required','other company logo rejected');
select extensions.throws_ok($$select public.apply_reviewed_listing_presentation('d3000000-0000-4000-8000-000000000001',jsonb_set(command,'{media,1,rightsBasis}','"official_company_logo"'),'presentation-photo-rights') from presentation_fixture$$,'P0001','presentation_media_evidence_required','same-site photo is not proof of reuse rights');
select extensions.throws_ok($$select public.apply_reviewed_listing_presentation('d3000000-0000-4000-8000-000000000001',jsonb_set(command,'{media,1,rightsValidUntil}',to_jsonb(statement_timestamp()-interval '1 second')),'presentation-expired-rights') from presentation_fixture$$,'P0001','presentation_evidence_expired','expired rights rejected');
select extensions.throws_ok($$select public.apply_reviewed_listing_presentation('d3000000-0000-4000-8000-000000000001',jsonb_set(command,'{media,1,sourceCredit}','""'),'presentation-no-credit') from presentation_fixture$$,'P0001','presentation_media_evidence_required','source credit is mandatory');
update presentation_fixture set receipt=public.apply_reviewed_listing_presentation('d3000000-0000-4000-8000-000000000001',command,'presentation-valid');
select extensions.is((select public_email from public.directory_listing_presentation where listing_id='d3000000-0000-4000-8000-000000000001'),'office@fixture.example','only reviewed public business email reaches projection');
select extensions.is((select photo_urls[1] from public.directory_listings where id='d3000000-0000-4000-8000-000000000001'),'https://fixture.example/logo.png','legacy photo array also begins with reviewed company logo');
select extensions.is((select media->0->>'kind' from public.directory_listing_presentation where listing_id='d3000000-0000-4000-8000-000000000001'),'logo','image one is company logo');
select extensions.is((select media->1->>'sourceCredit' from public.directory_listing_presentation where listing_id='d3000000-0000-4000-8000-000000000001'),'Fixture Company, used with permission','gallery source credit preserved');
select extensions.is((select public.apply_reviewed_listing_presentation('d3000000-0000-4000-8000-000000000001',command,'presentation-valid')->>'idempotent' from presentation_fixture),'true','uncertain retry returns existing receipt');
select extensions.throws_ok($$select public.apply_reviewed_listing_presentation('d3000000-0000-4000-8000-000000000001',command,'presentation-stale') from presentation_fixture$$,'P0001','presentation_changed_since_review','stale command cannot overwrite newer review');
reset role;
select extensions.is((select count(*)::integer from private.listing_presentation_receipts),1,'one private immutable proof receipt');
select extensions.ok((select owner_verified_at is null and information_checked_at is null from app.business_listings where id='d3000000-0000-4000-8000-000000000001'),'media and contact publication grants no trust or ownership');
select extensions.is((select count(*)::integer from app.integration_outbox),0,'no provider delivery or paid effect');
update app.media_assets set sha256=repeat('9',64) where id='d4000000-0000-4000-8000-000000000001';
set local role anon;
select extensions.is((select media from public.directory_listing_presentation where listing_id='d3000000-0000-4000-8000-000000000001'),'[]'::jsonb,'substituted logo bytes suppress all gallery instead of promoting a non-logo');
select extensions.is((select count(*)::integer from public.directory_listing_assets where listing_slug='presentation-fixture'),0,'asset feed follows current logo integrity');
reset role;
update app.media_assets set sha256=repeat('a',64) where id='d4000000-0000-4000-8000-000000000001';
update app.listing_public_presentation set media=jsonb_set(media,'{1,rights_valid_until}',to_jsonb(statement_timestamp()-interval '1 second')) where listing_id='d3000000-0000-4000-8000-000000000001';
set local role anon;
select extensions.is((select jsonb_array_length(media) from public.directory_listing_presentation where listing_id='d3000000-0000-4000-8000-000000000001'),1,'expired gallery license disappears while reviewed logo remains first');
select extensions.is((select count(*)::integer from public.directory_listing_assets where id='d4000000-0000-4000-8000-000000000002'),0,'asset feed also hides a media license that has expired');
reset role;
-- A future or ended sponsorship never changes the current free image allowance.
insert into app.media_assets(id,listing_id,kind,original_path,public_path,media_type,byte_size,sha256,status,reviewed_by)
select ('d8000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'d3000000-0000-4000-8000-000000000001','product','private/catalog-'||n||'.webp','https://fixture.example/catalog-'||n||'.webp','image/webp',120,repeat('7',64),'approved','d1000000-0000-4000-8000-000000000001' from generate_series(1,3) n;
create function pg_temp.expanded_presentation() returns jsonb language sql as $$
 select jsonb_set(pg_temp.presentation(),'{media}',(pg_temp.presentation()->'media') ||
 (select jsonb_agg(jsonb_build_object('mediaId',('d8000000-0000-4000-8000-'||lpad(n::text,12,'0')),'slot','gallery','sourceUrl','https://fixture.example/catalog','sourceCredit','Fixture catalog photography','rightsBasis','licensed','rightsEvidenceSha256',repeat('6',64),'rightsValidUntil',statement_timestamp()+interval '2 days','checkedAt',statement_timestamp()) order by n) from generate_series(1,3) n));
$$;
insert into app.featured_entitlements(listing_id,status,starts_at,ends_at) values('d3000000-0000-4000-8000-000000000001','active',statement_timestamp()+interval '2 hours',statement_timestamp()+interval '2 days');
set local role authenticated;
select extensions.throws_ok($$select public.apply_reviewed_listing_presentation('d3000000-0000-4000-8000-000000000001',pg_temp.expanded_presentation(),'presentation-future-cap')$$,'P0001','presentation_media_limit','future sponsorship cannot raise the current gallery allowance');
reset role;
update app.featured_entitlements set starts_at=statement_timestamp()-interval '2 hours' where listing_id='d3000000-0000-4000-8000-000000000001';
set local role authenticated;
select public.apply_reviewed_listing_presentation('d3000000-0000-4000-8000-000000000001',pg_temp.expanded_presentation(),'presentation-active-cap');
reset role;
set local role anon;
select extensions.is((select jsonb_array_length(media) from public.directory_listing_presentation where listing_id='d3000000-0000-4000-8000-000000000001'),5,'current sponsorship can show the reviewed expanded gallery');
reset role;
update app.featured_entitlements set ends_at=statement_timestamp()-interval '1 minute',status='expired' where listing_id='d3000000-0000-4000-8000-000000000001';
set local role anon;
select extensions.is((select jsonb_array_length(media) from public.directory_listing_presentation where listing_id='d3000000-0000-4000-8000-000000000001'),4,'ended sponsorship shows only logo plus three images');
select extensions.is((select count(*)::integer from public.directory_listing_assets where listing_slug='presentation-fixture'),4,'legacy asset feed obeys the current free cap');
reset role;
select extensions.is((select jsonb_array_length(media) from app.listing_public_presentation where listing_id='d3000000-0000-4000-8000-000000000001'),5,'entitlement expiry preserves stored review history');
update app.business_listings set website_url='https://different.example' where id='d3000000-0000-4000-8000-000000000001';
set local role anon;
select extensions.is((select count(*)::integer from public.directory_listing_presentation),0,'changed business identity suppresses previously reviewed contact and assets');
reset role;
select * from extensions.finish();
rollback;
