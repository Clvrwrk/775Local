begin;
create extension if not exists pgtap with schema extensions;
select extensions.plan(9);
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
select extensions.ok(not has_function_privilege('anon','private.publish_serp_seed(jsonb)','execute'),'anonymous seed publication denied');
select extensions.throws_ok($$select private.publish_serp_seed(pg_temp.seed_envelope(rows - 99)) from seed_fixture$$,'P0001','SERP seed must contain 100 unique Listings across 10 categories','short seed rejected by behavior');
select extensions.throws_ok($$select private.publish_serp_seed(pg_temp.seed_envelope(jsonb_set(rows,'{0,contentTier}','"basic"'))) from seed_fixture$$,'P0001','SERP seed must use the exact 60/30/10 tier mix','wrong tier mix rejected');
select extensions.throws_ok($$select private.publish_serp_seed(jsonb_set(pg_temp.seed_envelope(rows),'{receiptSha256}',to_jsonb(repeat('f',64)))) from seed_fixture$$,'P0001','SERP seed receipt hash does not match its normalized Listing manifest','forged hash rejected');
select extensions.is((select private.publish_serp_seed(pg_temp.seed_envelope(rows))->>'listingCount' from seed_fixture),'100','valid seed persists all100 listings');
select extensions.is((select count(*)::integer from app.business_listings where current_slug like 'seed-test-%' and owner_verified_at is null and information_checked_at is null and hide_street),100,'published seed retains privacy and unclaimed unverified state');
select extensions.is((select count(*)::integer from app.serp_seed_publication_receipts r join app.business_listings b on b.id=r.listing_id where b.current_slug like 'seed-test-%'),100,'per-listing receipts persisted');
select extensions.is((select private.publish_serp_seed(pg_temp.seed_envelope(rows))->>'idempotent' from seed_fixture),'true','same seed replays idempotently');
select extensions.is((select count(*)::integer from app.business_listings where current_slug like 'seed-test-%'),100,'replay creates no duplicate listing');
select * from extensions.finish();
rollback;
