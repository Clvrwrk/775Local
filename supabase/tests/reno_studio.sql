begin;
create extension if not exists pgtap with schema extensions;
select extensions.plan(16);
insert into app.actors(id,workos_user_id,primary_email) values
('81000000-0000-4000-8000-000000000001','studio_owner','owner@shop.example'),
('81000000-0000-4000-8000-000000000002','studio_other','other@example.com'),
('81000000-0000-4000-8000-000000000003','studio_operator','chussey@aia4.io');
insert into app.operator_grants(actor_id,allowlisted_email,permissions,status,approved_by,approved_at,workos_organization_id) values('81000000-0000-4000-8000-000000000003','chussey@aia4.io',array['listing_review'],'active','test',statement_timestamp(),'org_local775');
insert into app.businesses(id,canonical_name) values('82000000-0000-4000-8000-000000000001','Test');
insert into app.business_listings(id,business_id,current_slug,display_name,city_slug,postal_code) values
('83000000-0000-4000-8000-000000000001','82000000-0000-4000-8000-000000000001','studio-shop','Original Shop','reno','89502');
insert into app.listing_participations(actor_id,listing_id,role,status) values('81000000-0000-4000-8000-000000000001','83000000-0000-4000-8000-000000000001','business_owner','active');
select extensions.ok(not has_table_privilege('authenticated','app.listing_proposals','insert'),'no direct proposal mutation');
select extensions.ok(not has_function_privilege('anon','public.pilot_workspace(uuid)','execute'),'no anonymous workspace');
select set_config('request.jwt.claims','{"sub":"studio_other"}',true);
set local role authenticated;
select extensions.throws_ok($$select public.pilot_workspace('83000000-0000-4000-8000-000000000001')$$,'P0001','listing_access_forbidden','cross-listing access denied');
select extensions.throws_ok($$select public.submit_listing_proposal('83000000-0000-4000-8000-000000000001','{}','studio-test-1')$$,'P0001','listing_access_forbidden','unrelated actor cannot propose');
reset role;
select set_config('request.jwt.claims','{"sub":"studio_owner"}',true);
set local role authenticated;
select extensions.is(public.pilot_workspace('83000000-0000-4000-8000-000000000001')->>'role','business_owner','active owner gets scoped studio');
select extensions.is(public.submit_listing_proposal('83000000-0000-4000-8000-000000000001','{"name":"Updated Shop","description":"Accurate business description.","phone":"+17753339880","website":"https://shop.example"}','studio-test-1')->>'status','pending_review','owner proposes for review');
select extensions.is(public.submit_listing_proposal('83000000-0000-4000-8000-000000000001','{"name":"Updated Shop","description":"Accurate business description.","phone":"+17753339880","website":"https://shop.example"}','studio-test-1')->>'idempotent','true','retry uses original proposal');
select extensions.throws_ok($$select public.submit_listing_proposal('83000000-0000-4000-8000-000000000001','{"name":"Other Shop","description":"Accurate business description.","phone":"+17753339880","website":"https://shop.example"}','studio-test-1')$$,'P0001','idempotency_conflict','changed payload cannot reuse key');
select extensions.throws_ok($$select public.pilot_review_queue()$$,'P0001','reauth_required','owner cannot inspect operator queue');
reset role;
select extensions.is((select display_name from app.business_listings where current_slug='studio-shop'),'Original Shop','proposal does not change public facts');
select set_config('request.jwt.claims',jsonb_build_object('sub','studio_operator','org_id','org_local775','auth_time',extract(epoch from statement_timestamp())::bigint)::text,true);
set local role authenticated;
select extensions.is(jsonb_array_length(public.pilot_review_queue()->'proposals'),1,'reviewer sees pending proposal');
select extensions.is(public.decide_listing_proposal((public.pilot_review_queue()->'proposals'->0->>'id')::uuid,'approved','Evidence checked')->>'status','approved','authorized reviewer approves');
reset role;
select extensions.is((select display_name from app.business_listings where current_slug='studio-shop'),'Updated Shop','approved proposal changes listing');
select extensions.is((select count(*)::integer from app.audit_events where action='listing.proposal_approved'),1,'approval has audit receipt');
update app.listing_participations set status='revoked',revoked_at=statement_timestamp() where actor_id='81000000-0000-4000-8000-000000000001';
select set_config('request.jwt.claims','{"sub":"studio_owner"}',true);
set local role authenticated;
select extensions.throws_ok($$select public.pilot_workspace('83000000-0000-4000-8000-000000000001')$$,'P0001','listing_access_forbidden','revocation applies on next request');
select extensions.is(jsonb_array_length(public.pilot_account()->'listings'),0,'revoked access absent from account');
select * from extensions.finish();
rollback;
