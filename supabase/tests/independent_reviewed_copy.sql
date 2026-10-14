begin;
create extension if not exists pgtap with schema extensions;
select extensions.no_plan();
insert into app.actors(id,workos_user_id,primary_email) values('f1000000-0000-4000-8000-000000000001','copy-contract-operator','chussey@aia4.io');
insert into app.operator_grants(actor_id,allowlisted_email,permissions,status,approved_at,workos_organization_id) values('f1000000-0000-4000-8000-000000000001','chussey@aia4.io',array['listing_review','listing_publish'],'active',statement_timestamp(),'org_copy_contract');
insert into app.businesses(id,canonical_name) values('f2000000-0000-4000-8000-000000000001','Preserved Canonical Business');
insert into app.business_listings(id,business_id,current_slug,display_name,description,website_url,city_slug,postal_code,publication_status,published_at) values('f3000000-0000-4000-8000-000000000001','f2000000-0000-4000-8000-000000000001','copy-contract-fixture','Copy Contract Fixture','Old reviewed short summary.','https://copy.fixture.example','reno','89502','published',statement_timestamp());
insert into app.listing_content(listing_id,about,projects,faqs,content_status) values('f3000000-0000-4000-8000-000000000001','Prior distinct long About remains until separately reviewed.','[{"title":"Unsupported legacy project","description":"A synthetic unverified narrative."}]','[{"question":"Unsupported legacy FAQ?","answer":"Synthetic unverified answer."}]','approved');
create function pg_temp.copy_command(changes jsonb) returns jsonb language sql as $$
 select jsonb_build_object('expectedSlug','copy-contract-fixture','expectedDomain','copy.fixture.example','expectedVersion',public.listing_correction_snapshot('f3000000-0000-4000-8000-000000000001')->>'version','reason','Apply exact separately reviewed public copy','changes',changes,'fieldProvenance',(select jsonb_object_agg(k,jsonb_build_object('state','verified','url','https://copy.fixture.example/services','artifactSha256',repeat('a',64),'checkedAt',statement_timestamp(),'reason','Exact independent synthetic source review')) from jsonb_object_keys(changes) k));
$$;
select set_config('request.jwt.claims',jsonb_build_object('sub','copy-contract-operator','org_id','org_copy_contract','auth_time',extract(epoch from statement_timestamp())::bigint)::text,true);set local role authenticated;
select public.apply_reviewed_listing_correction('f3000000-0000-4000-8000-000000000001',pg_temp.copy_command('{"description":"New exact short summary, independent of About."}'),'copy-description-only');
reset role;
select extensions.is((select about from app.listing_content where listing_id='f3000000-0000-4000-8000-000000000001'),'Prior distinct long About remains until separately reviewed.','description-only correction never flattens longer About');
set local role authenticated;
select extensions.throws_ok($$select public.apply_reviewed_listing_correction('f3000000-0000-4000-8000-000000000001',pg_temp.copy_command('{"projects":[{"title":"New invented project"}]}'),'copy-new-project')$$,'P0001','correction_clear_only_field','cleanup contract cannot introduce new project claims');
select extensions.throws_ok($$select public.apply_reviewed_listing_correction('f3000000-0000-4000-8000-000000000001',pg_temp.copy_command('{"faqs":[{"question":"Invented question?","answer":"Invented answer."}]}'),'copy-new-faq')$$,'P0001','correction_clear_only_field','cleanup contract cannot introduce new FAQ claims');
select extensions.throws_ok($$select public.apply_reviewed_listing_correction('f3000000-0000-4000-8000-000000000001',pg_temp.copy_command('{"canonical_name":"Unrequested business-wide name"}'),'copy-business-name')$$,'P0001','invalid_listing_correction','business-wide canonical name stays outside listing correction');
select public.apply_reviewed_listing_correction('f3000000-0000-4000-8000-000000000001',pg_temp.copy_command('{"content_about":"A longer independently reviewed About with its own exact wording.","projects":[],"faqs":[]}'),'copy-reviewed-cleanup');
reset role;
select extensions.is((select description from app.business_listings where id='f3000000-0000-4000-8000-000000000001'),'New exact short summary, independent of About.','About correction preserves exact short summary');
select extensions.is((select about from app.listing_content where listing_id='f3000000-0000-4000-8000-000000000001'),'A longer independently reviewed About with its own exact wording.','longer About is stored independently without paraphrasing');
select extensions.ok((select projects='[]'::jsonb and faqs='[]'::jsonb from app.listing_content where listing_id='f3000000-0000-4000-8000-000000000001'),'explicit reviewed cleanup removes legacy project and FAQ modules');
select extensions.is((select canonical_name from app.businesses where id='f2000000-0000-4000-8000-000000000001'),'Preserved Canonical Business','unrequested canonical name never changes');
set local role authenticated;
select extensions.throws_ok($$select public.rollback_reviewed_listing_correction('f3000000-0000-4000-8000-000000000001',r.id,r.after_version,'Do not restore unsupported old content','copy-block-old-content') from private.listing_presentation_receipts r$$,'42501',null,'private presentation receipts do not become accessible through this unrelated workflow');
reset role;
create temporary table copy_receipt as select id,after_version from app.reviewed_listing_correction_receipts where idempotency_key='copy-reviewed-cleanup';grant select on copy_receipt to authenticated;
set local role authenticated;
select extensions.throws_ok($$select public.rollback_reviewed_listing_correction('f3000000-0000-4000-8000-000000000001',id,after_version,'Do not restore unsupported old content','copy-block-old-content') from copy_receipt$$,'P0001','correction_content_review_required','cleaned public copy requires fresh review before any restoration');
reset role;
set local role anon;
select extensions.is((select about_text from public.directory_listings where current_slug='copy-contract-fixture'),'A longer independently reviewed About with its own exact wording.','approved About reaches anonymous public projection independently');
select extensions.ok((select projects='[]'::jsonb and faqs='[]'::jsonb from public.directory_listings where current_slug='copy-contract-fixture'),'no removed FAQ/project content is republished');
reset role;
select extensions.is((select count(*)::integer from app.integration_outbox),0,'copy cleanup sends no provider event');

-- Studio's existing description input edits About. Exercise real workspace,
-- submit and review calls after independently reviewed short/long corrections.
update app.business_listings set phone_e164='+17755550120' where id='f3000000-0000-4000-8000-000000000001';
insert into app.business_listings(id,business_id,current_slug,display_name,description,phone_e164,website_url,city_slug,postal_code,publication_status,published_at) values
('f3000000-0000-4000-8000-000000000002','f2000000-0000-4000-8000-000000000001','copy-null-about','Null About Fixture','Reviewed summary remains a fallback only.','+17755550120','https://copy.fixture.example','reno','89502','published',statement_timestamp()),
('f3000000-0000-4000-8000-000000000003','f2000000-0000-4000-8000-000000000001','copy-missing-content','Missing Content Fixture','Reviewed summary without a content row.','+17755550120','https://copy.fixture.example','reno','89502','published',statement_timestamp()),
('f3000000-0000-4000-8000-000000000004','f2000000-0000-4000-8000-000000000001','copy-draft-content','Draft Content Fixture','Reviewed summary with private draft content.','+17755550120','https://copy.fixture.example','reno','89502','published',statement_timestamp());
insert into app.listing_content(listing_id,about,services,content_status) values
('f3000000-0000-4000-8000-000000000002',null,array['Window repair'],'approved'),
('f3000000-0000-4000-8000-000000000004','Private About awaiting separate review.',array['Private draft service'],'draft');
create temporary table studio_copy_cases(scenario text primary key,listing_id uuid,payload jsonb,proposal_id uuid);
grant select,insert on studio_copy_cases to authenticated;
create function pg_temp.propose_copy(requested_scenario text,requested_listing uuid,edits jsonb,legacy_payload boolean default false) returns uuid language plpgsql as $$
declare submitted jsonb; proposal_id uuid;
begin
  submitted := public.pilot_workspace(requested_listing)->'editable' || edits;
  if legacy_payload then submitted := submitted-'services'; end if;
  proposal_id := (public.submit_listing_proposal(requested_listing,submitted,'copy-studio:'||requested_scenario)->>'id')::uuid;
  insert into studio_copy_cases values(requested_scenario,requested_listing,submitted,proposal_id);
  return proposal_id;
end;
$$;
set local role authenticated;
select extensions.is(public.pilot_workspace('f3000000-0000-4000-8000-000000000001')->'editable'->>'description','A longer independently reviewed About with its own exact wording.','Studio retains the existing About input contract');
select extensions.is(public.decide_listing_proposal(pg_temp.propose_copy('phone','f3000000-0000-4000-8000-000000000001','{"phone":"+17755550121"}'),'approved','Reviewed phone change')->>'status','approved','phone-only Studio edit is approved');
select extensions.is((select public.submit_listing_proposal(listing_id,payload,'copy-studio:phone')->>'idempotent' from studio_copy_cases where scenario='phone'),'true','submission retry returns the original proposal');
select extensions.is((select public.decide_listing_proposal(proposal_id,'approved','Reviewed phone change')->>'idempotent' from studio_copy_cases where scenario='phone'),'true','decision retry remains idempotent');
reset role;
select extensions.is((select description from app.business_listings where id='f3000000-0000-4000-8000-000000000001'),'New exact short summary, independent of About.','phone-only Studio approval preserves reviewed short summary');
select extensions.is((select about from app.listing_content where listing_id='f3000000-0000-4000-8000-000000000001'),'A longer independently reviewed About with its own exact wording.','phone-only Studio approval preserves reviewed long About');
select extensions.is((select phone_e164 from app.business_listings where id='f3000000-0000-4000-8000-000000000001'),'+17755550121','the reviewed phone edit still takes effect');
select extensions.is((select count(*)::integer from app.listing_revisions where reason_codes=array['studio-review']),1,'decision retry creates no duplicate revision');
select extensions.ok((select before_values->'listing'->>'description'=after_values->'listing'->>'description' and before_values->'content'->>'about'=after_values->'content'->>'about' and actor_id='f1000000-0000-4000-8000-000000000001' from app.listing_revisions where reason_codes=array['studio-review']),'Studio revision retains independent before/after copy and reviewer');
select extensions.is((select count(*)::integer from app.audit_events where action='listing.proposal_approved'),1,'decision retry creates no duplicate approval audit');
select extensions.is((select count(*)::integer from app.integration_outbox where event_type='listing.proposal_approved'),1,'decision retry creates no duplicate approval outbox event');
set local role authenticated;
select extensions.is(public.decide_listing_proposal(pg_temp.propose_copy('services','f3000000-0000-4000-8000-000000000001','{"services":["Door repair","Shelf installation"]}'),'approved','Reviewed service changes')->>'status','approved','services-only Studio edit is approved');
reset role;
select extensions.is((select services from app.listing_content where listing_id='f3000000-0000-4000-8000-000000000001'),array['Door repair','Shelf installation'],'services-only edit updates reviewed services');
select extensions.ok((select bl.description='New exact short summary, independent of About.' and lc.about='A longer independently reviewed About with its own exact wording.' from app.business_listings bl join app.listing_content lc on lc.listing_id=bl.id where bl.id='f3000000-0000-4000-8000-000000000001'),'services-only approval preserves both independent copy values');
set local role authenticated;
select extensions.is(public.decide_listing_proposal(pg_temp.propose_copy('about','f3000000-0000-4000-8000-000000000001','{"description":"Studio reviewed a new long About with additional business detail."}'),'approved','Reviewed explicit About')->>'status','approved','explicit Studio About edit is approved');
reset role;
select extensions.is((select about from app.listing_content where listing_id='f3000000-0000-4000-8000-000000000001'),'Studio reviewed a new long About with additional business detail.','explicit About edit reaches the intended field');
select extensions.is((select description from app.business_listings where id='f3000000-0000-4000-8000-000000000001'),'New exact short summary, independent of About.','explicit About edit never writes the short summary');
set local role authenticated;
select extensions.is(public.decide_listing_proposal(pg_temp.propose_copy('legacy-about','f3000000-0000-4000-8000-000000000001','{"description":"A legacy proposal still edits only the separately reviewed About."}',true),'approved','Reviewed legacy About')->>'status','approved','legacy proposal without services retains About semantics');
reset role;
select extensions.ok((select bl.description='New exact short summary, independent of About.' and lc.about='A legacy proposal still edits only the separately reviewed About.' and lc.services=array['Door repair','Shelf installation'] from app.business_listings bl join app.listing_content lc on lc.listing_id=bl.id where bl.id='f3000000-0000-4000-8000-000000000001'),'legacy About edit preserves summary and existing services');
set local role authenticated;
select extensions.is(public.pilot_workspace('f3000000-0000-4000-8000-000000000002')->'editable'->>'description','Reviewed summary remains a fallback only.','null About still displays the legacy short-summary fallback');
select extensions.is(public.decide_listing_proposal(pg_temp.propose_copy('null-phone','f3000000-0000-4000-8000-000000000002','{"phone":"+17755550122"}'),'approved','Reviewed fallback phone')->>'status','approved','phone edit with fallback About is approved');
reset role;
select extensions.is((select about from app.listing_content where listing_id='f3000000-0000-4000-8000-000000000002'),null::text,'unchanged fallback never materializes null About');
set local role authenticated;
select extensions.is(public.decide_listing_proposal(pg_temp.propose_copy('null-services','f3000000-0000-4000-8000-000000000002','{"services":["Screen repair"]}'),'approved','Reviewed fallback services')->>'status','approved','services edit with fallback About is approved');
select extensions.is(public.decide_listing_proposal(pg_temp.propose_copy('null-no-change','f3000000-0000-4000-8000-000000000002','{}'),'approved','Reviewed unchanged workspace')->>'status','approved','unchanged workspace retains existing decision behavior');
reset role;
select extensions.ok((select about is null and services=array['Screen repair'] from app.listing_content where listing_id='f3000000-0000-4000-8000-000000000002'),'services-only and no-change approvals preserve null About');
set local role authenticated;
select extensions.is(public.decide_listing_proposal(pg_temp.propose_copy('null-about-edit','f3000000-0000-4000-8000-000000000002','{"description":"An explicitly reviewed About replaces the display fallback."}'),'approved','Reviewed initial About')->>'status','approved','explicit About can replace a null About');
reset role;
select extensions.ok((select bl.description='Reviewed summary remains a fallback only.' and lc.about='An explicitly reviewed About replaces the display fallback.' from app.business_listings bl join app.listing_content lc on lc.listing_id=bl.id where bl.id='f3000000-0000-4000-8000-000000000002'),'new explicit About remains independent of the fallback summary');
set local role authenticated;
select extensions.is(public.decide_listing_proposal(pg_temp.propose_copy('missing-about','f3000000-0000-4000-8000-000000000003','{"description":"A reviewed legacy About creates the missing content record."}',true),'approved','Reviewed missing About')->>'status','approved','legacy explicit About can create a missing content row');
reset role;
select extensions.ok((select bl.description='Reviewed summary without a content row.' and lc.about='A reviewed legacy About creates the missing content record.' and lc.content_status='approved' from app.business_listings bl join app.listing_content lc on lc.listing_id=bl.id where bl.id='f3000000-0000-4000-8000-000000000003'),'new content row publishes only the explicit reviewed About');
set local role authenticated;
select pg_temp.propose_copy('draft-services','f3000000-0000-4000-8000-000000000004','{"services":["Reviewed service"]}');
select extensions.throws_ok($$select public.decide_listing_proposal(proposal_id,'approved','Review draft services') from studio_copy_cases where scenario='draft-services'$$,'P0001','content_draft_requires_separate_review','services cannot publish an existing private draft');
select pg_temp.propose_copy('draft-about','f3000000-0000-4000-8000-000000000004','{"description":"An explicit About edit must not overwrite a private draft."}',true);
select extensions.throws_ok($$select public.decide_listing_proposal(proposal_id,'approved','Review draft About') from studio_copy_cases where scenario='draft-about'$$,'P0001','content_draft_requires_separate_review','explicit legacy About cannot bypass draft review');
select extensions.is(public.decide_listing_proposal(pg_temp.propose_copy('draft-phone','f3000000-0000-4000-8000-000000000004','{"phone":"+17755550124"}',true),'approved','Review legacy phone')->>'status','approved','legacy phone-only proposal can preserve an untouched private draft');
reset role;
select extensions.ok((select bl.description='Reviewed summary with private draft content.' and bl.phone_e164='+17755550124' and lc.about='Private About awaiting separate review.' and lc.services=array['Private draft service'] and lc.content_status='draft' from app.business_listings bl join app.listing_content lc on lc.listing_id=bl.id where bl.id='f3000000-0000-4000-8000-000000000004'),'unrelated legacy phone approval never promotes or rewrites private draft content');
-- A prior persisted version makes the stale queue deterministic even when a
-- SQL runner executes this whole suite in one statement_timestamp batch.
insert into app.business_listings(id,business_id,current_slug,display_name,description,phone_e164,website_url,city_slug,postal_code,publication_status,published_at,updated_at) values
('f3000000-0000-4000-8000-000000000005','f2000000-0000-4000-8000-000000000001','copy-stale-queue','Stale Queue Fixture','Original short summary before the queued edit.','+17755550120','https://copy.fixture.example','reno','89502','published',statement_timestamp(),'2000-01-01T00:00:00Z');
insert into app.listing_content(listing_id,about,content_status) values('f3000000-0000-4000-8000-000000000005','Original distinct About before the queued edit.','approved');
set local role authenticated;
select pg_temp.propose_copy('stale-queued','f3000000-0000-4000-8000-000000000005','{"phone":"+17755550129"}',true);
select public.apply_reviewed_listing_correction('f3000000-0000-4000-8000-000000000005',pg_temp.copy_command('{"description":"Fresh correction summary after the legacy proposal was queued.","content_about":"Fresh independently reviewed About after the legacy proposal was queued."}') || jsonb_build_object('expectedSlug','copy-stale-queue','expectedVersion',public.listing_correction_snapshot('f3000000-0000-4000-8000-000000000005')->>'version'),'copy-after-queued-proposal');
reset role;
select set_config('request.jwt.claims',jsonb_build_object('sub','copy-contract-operator','org_id','org_copy_contract','auth_time',extract(epoch from statement_timestamp()-interval '1 hour')::bigint)::text,true);
set local role authenticated;
select extensions.throws_ok($$select public.decide_listing_proposal(proposal_id,'approved','Review stale queued proposal') from studio_copy_cases where scenario='stale-queued'$$,'P0001','review_forbidden','replacement decision function retains recent Operator auth gate');
reset role;
select set_config('request.jwt.claims',jsonb_build_object('sub','copy-contract-operator','org_id','org_copy_contract','auth_time',extract(epoch from statement_timestamp())::bigint)::text,true);
set local role authenticated;
select extensions.throws_ok($$select public.decide_listing_proposal(proposal_id,'approved','Review stale queued proposal') from studio_copy_cases where scenario='stale-queued'$$,'P0001','listing_changed_since_proposal','stale legacy queued proposal cannot overwrite a later reviewed correction');
reset role;
select extensions.ok((select bl.description='Fresh correction summary after the legacy proposal was queued.' and lc.about='Fresh independently reviewed About after the legacy proposal was queued.' and bl.phone_e164='+17755550120' from app.business_listings bl join app.listing_content lc on lc.listing_id=bl.id where bl.id='f3000000-0000-4000-8000-000000000005'),'stale decision leaves latest reviewed summary, About and phone unchanged');
select extensions.is((select status from app.listing_proposals where id=(select proposal_id from studio_copy_cases where scenario='stale-queued')),'pending_review','stale proposal remains undecided');
select extensions.is((select count(*)::integer from app.integration_outbox where idempotency_key='proposal-decision:'||(select proposal_id::text from studio_copy_cases where scenario='stale-queued')),0,'stale decision creates no provider event');
select extensions.is((select count(*)::integer from app.audit_events where target_id=(select proposal_id::text from studio_copy_cases where scenario='stale-queued') and action='listing.proposal_approved'),0,'stale decision creates no approval audit');
select * from extensions.finish();
rollback;
