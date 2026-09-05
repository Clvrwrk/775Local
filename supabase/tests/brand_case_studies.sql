begin;
create extension if not exists pgtap with schema extensions;
select extensions.plan(13);
insert into app.businesses(id,canonical_name) values ('92000000-0000-4000-8000-000000000001','Case Study Test');
insert into app.business_listings(id,business_id,current_slug,display_name,city_slug,postal_code,publication_status,published_at) values
('93000000-0000-4000-8000-000000000001','92000000-0000-4000-8000-000000000001','case-study-test','Case Study Test','reno','89502','published',now());
insert into app.media_assets(id,listing_id,kind,original_path,public_path,media_type,byte_size,sha256,status) values
('95000000-0000-4000-8000-000000000001','93000000-0000-4000-8000-000000000001','image','private/before.jpg','public/before.jpg','image/jpeg',10,repeat('a',64),'approved'),
('95000000-0000-4000-8000-000000000002','93000000-0000-4000-8000-000000000001','image','private/after.jpg','public/after.jpg','image/jpeg',10,repeat('b',64),'approved');
insert into app.case_studies(id,listing_id,slug,title,client_name,client_consented,client_consented_at,client_need,approach,results,before_media_id,after_media_id,status,published_at) values
('96000000-0000-4000-8000-000000000001','93000000-0000-4000-8000-000000000001','screen-project','Screen Project','Private Client Name',true,now(),repeat('Need ',8),repeat('Approach ',8),repeat('Result ',8),'95000000-0000-4000-8000-000000000001','95000000-0000-4000-8000-000000000002','published',now());
select extensions.ok(not has_column_privilege('anon','app.case_studies','client_name','select'),'anonymous client names denied');
select extensions.ok(not has_column_privilege('authenticated','app.case_studies','client_name','select'),'unrelated authenticated client names denied');
select extensions.ok(not has_column_privilege('authenticated','app.case_studies','client_consented_at','select'),'consent evidence denied');
select extensions.ok(not has_column_privilege('anon','app.media_assets','original_path','select'),'anonymous media originals denied');
select extensions.ok(not has_column_privilege('authenticated','app.media_assets','original_path','select'),'private media originals denied');
select extensions.ok(not has_table_privilege('authenticated','app.case_studies','insert'),'unreviewed case-study creation denied');
select extensions.ok(not has_table_privilege('authenticated','app.case_studies','update'),'direct publication and narrative changes denied');
select extensions.ok(not has_table_privilege('authenticated','app.case_study_media','insert'),'case-study media mutation denied');
set local role anon;
select extensions.is((select count(*)::integer from public.directory_case_studies where listing_slug='case-study-test'),1,'anonymous reads approved projection without manager permission');
reset role;
select set_config('request.jwt.claims','{"sub":"unrelated_case_reader"}',true);
set local role authenticated;
select extensions.is((select count(*)::integer from public.directory_case_studies where listing_slug='case-study-test'),1,'unrelated authenticated readers get public projection');
select extensions.throws_ok($$select client_name from app.case_studies$$,'42501',null,'private fields cannot be selected');
reset role;
select extensions.throws_ok($$update app.case_studies set status='archived',is_featured=true,archived_at=now(),client_consented=false where id='96000000-0000-4000-8000-000000000001'$$,'23514',null,'archived featured still requires consent');
update app.case_studies set status='archived',archived_at=now() where id='96000000-0000-4000-8000-000000000001';
set local role anon;
select extensions.is((select count(*)::integer from public.directory_case_studies where listing_slug='case-study-test'),0,'non-featured archived projects are not public');
reset role;
select * from extensions.finish();
rollback;
