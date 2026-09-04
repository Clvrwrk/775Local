begin;
create extension if not exists pgtap with schema extensions;
select extensions.plan(15);
insert into app.actors(id,workos_user_id,primary_email) values
('81000000-0000-4000-8000-000000000001','inquiry_owner','owner@example.com'),
('81000000-0000-4000-8000-000000000002','inquiry_recipient','recipient@example.com'),
('81000000-0000-4000-8000-000000000003','inquiry_agency','agency@example.com');
insert into app.businesses(id,canonical_name) values('82000000-0000-4000-8000-000000000001','Test');
insert into app.business_listings(id,business_id,current_slug,display_name,city_slug,postal_code,publication_status,published_at) values('83000000-0000-4000-8000-000000000001','82000000-0000-4000-8000-000000000001','inquiry-shop','Inquiry Shop','reno','89502','published',statement_timestamp());
insert into app.listing_participations(id,actor_id,listing_id,role,status) values
('84000000-0000-4000-8000-000000000001','81000000-0000-4000-8000-000000000001','83000000-0000-4000-8000-000000000001','business_owner','active'),
('84000000-0000-4000-8000-000000000002','81000000-0000-4000-8000-000000000002','83000000-0000-4000-8000-000000000001','lead_recipient','active'),
('84000000-0000-4000-8000-000000000003','81000000-0000-4000-8000-000000000003','83000000-0000-4000-8000-000000000001','agency_representative','active');
select extensions.ok(not has_function_privilege('anon','public.intake_reno_inquiry(uuid,jsonb,text,text)','execute'),'anonymous callers cannot bypass abuse checks');
select extensions.ok(not public.reno_inquiry_available('83000000-0000-4000-8000-000000000001'),'ownership alone cannot enable inquiries');
select extensions.throws_ok($$select public.intake_reno_inquiry('83000000-0000-4000-8000-000000000001','{"name":"Resident","email":"resident@example.com","phone":"","zip":"89502","message":"Please help with this repair.","consent":true}','inquiry-test-1',repeat('a',64))$$,'P0001','inquiries_unavailable','no recipient means no intake');
insert into private.lead_destinations(listing_id,participation_id,email,verified_at,verification_ref) values('83000000-0000-4000-8000-000000000001','84000000-0000-4000-8000-000000000002','recipient@example.com',statement_timestamp(),'isolated-test-verification');
select extensions.ok(public.reno_inquiry_available('83000000-0000-4000-8000-000000000001'),'verified active recipient enables intake');
select extensions.throws_ok($$select public.intake_reno_inquiry('83000000-0000-4000-8000-000000000001','{"name":"Resident","email":"resident@example.com","phone":"","zip":"89502","message":"Please help with this repair.","consent":false}','inquiry-test-1',repeat('a',64))$$,'P0001','invalid_inquiry','consent is required in database');
select extensions.is(public.intake_reno_inquiry('83000000-0000-4000-8000-000000000001','{"name":"Resident","email":"resident@example.com","phone":"","zip":"89502","message":"Please help with this repair.","consent":true}','inquiry-test-1',repeat('a',64))->>'status','received','committed inquiry returns received');
select extensions.is(public.intake_reno_inquiry('83000000-0000-4000-8000-000000000001','{"name":"Resident","email":"resident@example.com","phone":"","zip":"89502","message":"Please help with this repair.","consent":true}','inquiry-test-1',repeat('a',64))->>'idempotent','true','retry preserves receipt');
select extensions.is((select count(*)::integer from app.leads),1,'replay creates one lead');
select extensions.is((select status from app.leads limit 1),'submitted','database does not claim delivery');
select extensions.ok(not exists(select 1 from app.integration_outbox where payload::text like '%resident@example.com%'),'outbox payload excludes resident PII');
select set_config('request.jwt.claims','{"sub":"inquiry_agency"}',true);
set local role authenticated;
select extensions.is((select count(*)::integer from app.leads),0,'agency has no implicit resident PII');
reset role;
select set_config('request.jwt.claims','{"sub":"inquiry_recipient"}',true);
set local role authenticated;
select extensions.is((select count(*)::integer from app.leads),1,'assigned recipient can read inquiry');
reset role;
update app.listing_participations set status='revoked',revoked_at=statement_timestamp() where id='84000000-0000-4000-8000-000000000002';
select extensions.ok(not public.reno_inquiry_available('83000000-0000-4000-8000-000000000001'),'revocation immediately disables intake');
set local role authenticated;
select extensions.is((select count(*)::integer from app.leads),0,'revoked recipient loses PII access');
reset role;
select extensions.throws_ok($$select public.intake_reno_inquiry('83000000-0000-4000-8000-000000000001','{"name":"Resident","email":"resident@example.com","phone":"","zip":"89502","message":"A different repair request.","consent":true}','inquiry-test-2',repeat('a',64))$$,'P0001','inquiries_unavailable','revoked destination rejects new intake');
select * from extensions.finish();
rollback;
