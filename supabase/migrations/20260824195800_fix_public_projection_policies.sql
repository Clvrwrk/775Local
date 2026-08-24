begin;

drop policy if exists listings_read_published on app.business_listings;
create policy listings_read_published on app.business_listings for select to anon
using (publication_status = 'published');
create policy listings_read_authenticated on app.business_listings for select to authenticated
using (publication_status = 'published' or app.can_manage_listing(id));

drop policy if exists businesses_read_for_public_listing on app.businesses;
create policy businesses_read_for_public_listing on app.businesses for select to anon
using (exists (
  select 1 from app.business_listings bl
  where bl.business_id = businesses.id and bl.publication_status = 'published'
));
create policy businesses_read_authenticated on app.businesses for select to authenticated
using (exists (
  select 1 from app.business_listings bl
  where bl.business_id = businesses.id
    and (bl.publication_status = 'published' or app.can_manage_listing(bl.id))
));

drop policy if exists listing_slugs_read_public on app.listing_slugs;
create policy listing_slugs_read_public on app.listing_slugs for select to anon
using (exists (
  select 1 from app.business_listings bl
  where bl.id = listing_slugs.listing_id and bl.publication_status = 'published'
));
create policy listing_slugs_read_authenticated on app.listing_slugs for select to authenticated
using (exists (
  select 1 from app.business_listings bl
  where bl.id = listing_slugs.listing_id
    and (bl.publication_status = 'published' or app.can_manage_listing(bl.id))
));

drop policy if exists listing_categories_read_public on app.listing_categories;
create policy listing_categories_read_public on app.listing_categories for select to anon
using (exists (
  select 1 from app.business_listings bl
  where bl.id = listing_categories.listing_id and bl.publication_status = 'published'
));
create policy listing_categories_read_authenticated on app.listing_categories for select to authenticated
using (exists (
  select 1 from app.business_listings bl
  where bl.id = listing_categories.listing_id
    and (bl.publication_status = 'published' or app.can_manage_listing(bl.id))
));

drop policy if exists listing_content_read_public on app.listing_content;
drop policy if exists listing_content_manage_authorized on app.listing_content;
create policy listing_content_read_public on app.listing_content for select to anon
using (exists (
  select 1 from app.business_listings bl
  where bl.id = listing_content.listing_id and bl.publication_status = 'published'
));
create policy listing_content_read_authenticated on app.listing_content for select to authenticated
using (exists (
  select 1 from app.business_listings bl
  where bl.id = listing_content.listing_id
    and (bl.publication_status = 'published' or app.can_manage_listing(bl.id))
));
create policy listing_content_insert_authorized on app.listing_content for insert to authenticated
with check (app.can_manage_listing(listing_id));
create policy listing_content_update_authorized on app.listing_content for update to authenticated
using (app.can_manage_listing(listing_id)) with check (app.can_manage_listing(listing_id));
create policy listing_content_delete_authorized on app.listing_content for delete to authenticated
using (app.can_manage_listing(listing_id));

drop policy if exists offers_read_active on app.offers;
drop policy if exists offers_manage_authorized on app.offers;
create policy offers_read_active on app.offers for select to anon
using (status = 'active' and exists (
  select 1 from app.business_listings bl
  where bl.id = offers.listing_id and bl.publication_status = 'published'
));
create policy offers_read_authenticated on app.offers for select to authenticated
using (
  (status = 'active' and exists (
    select 1 from app.business_listings bl
    where bl.id = offers.listing_id and bl.publication_status = 'published'
  )) or app.can_manage_listing(listing_id)
);
create policy offers_insert_authorized on app.offers for insert to authenticated
with check (app.can_manage_listing(listing_id));
create policy offers_update_authorized on app.offers for update to authenticated
using (app.can_manage_listing(listing_id)) with check (app.can_manage_listing(listing_id));
create policy offers_delete_authorized on app.offers for delete to authenticated
using (app.can_manage_listing(listing_id));

create index if not exists audit_events_actor_id_idx on app.audit_events (actor_id);
create index if not exists billing_events_listing_id_idx on app.billing_events (listing_id);
create index if not exists business_listings_business_id_idx on app.business_listings (business_id);
create index if not exists business_listings_information_checked_by_idx on app.business_listings (information_checked_by);
create index if not exists business_listings_source_row_id_idx on app.business_listings (source_row_id);
create index if not exists businesses_merged_into_id_idx on app.businesses (merged_into_id);
create index if not exists claims_claimant_actor_id_idx on app.claims (claimant_actor_id);
create index if not exists claims_decided_by_idx on app.claims (decided_by);
create index if not exists lead_events_actor_id_idx on app.lead_events (actor_id);
create index if not exists lead_events_lead_id_idx on app.lead_events (lead_id);
create index if not exists leads_duplicate_of_id_idx on app.leads (duplicate_of_id);
create index if not exists listing_categories_category_id_idx on app.listing_categories (category_id);
create index if not exists listing_content_hero_media_id_idx on app.listing_content (hero_media_id);
create index if not exists listing_content_logo_media_id_idx on app.listing_content (logo_media_id);
create index if not exists listing_content_updated_by_idx on app.listing_content (updated_by);
create index if not exists listing_participations_revoked_by_idx on app.listing_participations (revoked_by);
create index if not exists media_assets_created_by_idx on app.media_assets (created_by);
create index if not exists media_assets_listing_id_idx on app.media_assets (listing_id);
create index if not exists media_assets_reviewed_by_idx on app.media_assets (reviewed_by);
create index if not exists offers_created_by_idx on app.offers (created_by);
create index if not exists product_events_listing_id_idx on app.product_events (listing_id);
create index if not exists claim_proofs_claim_id_idx on private.claim_proofs (claim_id);

commit;
