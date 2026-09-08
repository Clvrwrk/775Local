begin;

create index listing_content_intelligence_listing_idx
  on app.listing_content_intelligence_candidates (listing_id);
create index listing_content_intelligence_fact_listing_idx
  on app.listing_content_intelligence_candidates (fact_set_id, listing_id);
create index listing_content_intelligence_audit_listing_idx
  on app.listing_content_intelligence_candidates (seo_audit_id, listing_id);
create index listing_content_intelligence_reviewed_by_idx
  on app.listing_content_intelligence_candidates (reviewed_by);

create index listing_intelligence_latest_capture_idx
  on private.listing_intelligence_accounts (latest_capture_id, listing_id);
create index listing_intelligence_latest_audit_idx
  on private.listing_intelligence_accounts (latest_seo_audit_id, listing_id);
create index listing_seo_audits_capture_listing_idx
  on private.listing_seo_audits (capture_id, listing_id);
create index listing_source_fact_sets_capture_listing_idx
  on private.listing_source_fact_sets (capture_id, listing_id);

commit;
