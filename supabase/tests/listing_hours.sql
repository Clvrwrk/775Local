begin;
create extension if not exists pgtap with schema extensions;
select extensions.plan(15);
create function pg_temp.seed_envelope(rows_value jsonb) returns jsonb language sql as $$
 select jsonb_build_object('schemaVersion',1,'filterVersion','business-controlled-domain-v10','listings',rows_value,'receiptSha256',
 encode(extensions.digest(string_agg(concat_ws('|',item->>'domain',item->>'slug',item->>'categorySlug',item->>'serpRank',item->>'contentTier',item->>'evidenceStatus',item->>'sourceCheckedAt'),E'\n' order by ordinal),'sha256'),'hex'))
 from jsonb_array_elements(rows_value) with ordinality as x(item,ordinal);
$$;
create temporary table seed_fixture as
select jsonb_agg(jsonb_build_object(
 'domain','seed-test-'||n||'.example','slug','seed-test-'||n,'displayName','Seed Test '||n,
 'categorySlug',(array['screen-repair','hvac','plumbing','electrical','auto-repair','restaurants','dentists','handyman','roofing','veterinarians'])[(n-1)/10+1],
 'serpRank',(n-1)%10+1,'contentTier',case when n<=10 then 'premium' when n<=40 then 'standard' else 'basic' end,
 'evidenceStatus','partial','sourceCheckedAt','2026-09-05T00:00:00Z',
 'websiteUrl','https://seed-test-'||n||'.example','citySlug','reno','postalCode','89502','isServiceArea',true,
 'description','Synthetic test content only','services','[]'::jsonb,'faqs','[]'::jsonb,'projects','[]'::jsonb,
 'sourceUrls',jsonb_build_array('https://seed-test-'||n||'.example'),
 'tierEvidence','{"moduleCount":3,"modules":{"faqs":true}}'::jsonb) order by n) as rows
from generate_series(1,100) n;

update seed_fixture set rows = jsonb_set(jsonb_set(jsonb_set(rows,
 '{0,hours}',to_jsonb('Mon–Fri 9am–4pm office hours; job scheduling requires confirmation'::text)),
 '{1,hours}','null'::jsonb),'{2,hours}',to_jsonb('   '::text));
select extensions.throws_ok($$select private.publish_serp_seed(pg_temp.seed_envelope(jsonb_set(rows,'{0,hours}','42'::jsonb))) from seed_fixture$$,'P0001','SERP seed contains an invalid or verified Listing','numeric hours rejected');
select extensions.throws_ok($$select private.publish_serp_seed(pg_temp.seed_envelope(jsonb_set(rows,'{0,hours}','{}'::jsonb))) from seed_fixture$$,'P0001','SERP seed contains an invalid or verified Listing','object hours rejected');
select extensions.throws_ok($$select private.publish_serp_seed(pg_temp.seed_envelope(jsonb_set(rows,'{0,hours}',to_jsonb(repeat('x',301))))) from seed_fixture$$,'P0001','SERP seed contains an invalid or verified Listing','overlong hours rejected');
select extensions.throws_ok($$select private.publish_serp_seed(pg_temp.seed_envelope(jsonb_set(rows,'{0,hours}',to_jsonb(E'9am\n4pm'::text)))) from seed_fixture$$,'P0001','SERP seed contains an invalid or verified Listing','control character hours rejected');
select extensions.is((select private.publish_serp_seed(pg_temp.seed_envelope(rows))->>'listingCount' from seed_fixture),'100','valid hours seed publishes');
select extensions.is((select c.hours_text from app.listing_content c join app.business_listings b on b.id=c.listing_id where b.current_slug='seed-test-1'),'Mon–Fri 9am–4pm office hours; job scheduling requires confirmation','exact hours and office scope persist');
select extensions.is((select hours_text from public.directory_listings where current_slug='seed-test-1'),'Mon–Fri 9am–4pm office hours; job scheduling requires confirmation','public projection preserves reviewed scope');
select extensions.is((select hours_text from public.directory_listings where current_slug='seed-test-2'),null::text,'unknown hours remain null');
select extensions.is((select hours_text from public.directory_listings where current_slug='seed-test-3'),null::text,'blank hours remain unknown');
select extensions.is((select count(*)::integer from app.business_listings where current_slug like 'seed-test-%' and owner_verified_at is null and information_checked_at is null and hide_street),100,'hours do not grant authority or reduce privacy');
select extensions.is((select private.publish_serp_seed(pg_temp.seed_envelope(rows))->>'idempotent' from seed_fixture),'true','identical hours replay is idempotent');
select extensions.throws_ok($$select private.publish_serp_seed(pg_temp.seed_envelope(jsonb_set(rows,'{0,hours}',to_jsonb('Different hours'::text)))) from seed_fixture$$,'P0001','SERP seed receipt hash conflicts with a different payload','conflicting replay cannot change hours');
select extensions.is((select hours_text from public.directory_listings where current_slug='seed-test-1'),'Mon–Fri 9am–4pm office hours; job scheduling requires confirmation','rejected replay leaves original hours');
select extensions.ok(not has_function_privilege('anon','private.publish_serp_seed(jsonb)','execute'),'anonymous user cannot publish hours');
set local role anon;
select extensions.is((select hours_text from public.directory_listings where current_slug='seed-test-1'),'Mon–Fri 9am–4pm office hours; job scheduling requires confirmation','anonymous public projection reads approved hours');
reset role;
select * from extensions.finish();
rollback;
