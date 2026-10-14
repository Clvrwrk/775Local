-- Public logo column. Approved media of kind logo is the company mark.
-- Gallery photos stay kind image and remain in photo_urls.
-- This statement does not reclassify existing files.

begin;

create or replace view public.directory_listings
with (security_invoker = true)
as
select
  bl.id,
  bl.stable_id,
  bl.current_slug,
  bl.display_name,
  bl.tagline,
  bl.description,
  bl.phone_e164,
  bl.website_url,
  case when bl.hide_street then null::text else bl.street_address end as street_address,
  bl.city_slug,
  bl.region_code,
  bl.postal_code,
  bl.latitude,
  bl.longitude,
  bl.is_service_area,
  bl.google_place_id,
  bl.information_checked_at,
  bl.owner_verified_at,
  bl.published_at,
  coalesce(array_agg(distinct c.slug) filter (where c.slug is not null), '{}'::text[]) as category_slugs,
  exists (
    select 1 from app.featured_entitlements fe
    where fe.listing_id = bl.id
      and fe.status = 'active'
      and (fe.ends_at is null or fe.ends_at > statement_timestamp())
  ) as is_featured,
  o.title as offer_title,
  o.details as offer_details,
  o.redemption_code as offer_code,
  o.ends_at as offer_ends_at,
  bl.content_tier,
  max(c.slug) filter (where lc.is_primary) as primary_category_slug,
  max(c.name) filter (where lc.is_primary) as primary_category_name,
  coalesce(content.services, '{}'::text[]) as services,
  coalesce(content.faqs, '[]'::jsonb) as faqs,
  coalesce(content.projects, '[]'::jsonb) as projects,
  coalesce((
    select array_agg(ma.public_path order by ma.created_at)
    from app.media_assets ma
    where ma.listing_id = bl.id and ma.status = 'approved' and ma.kind = 'image'
  ), '{}'::text[]) as photo_urls,
  (
    select ma.public_path
    from app.media_assets ma
    where ma.listing_id = bl.id and ma.status = 'approved' and ma.kind = 'logo'
    order by ma.created_at, ma.id
    limit 1
  ) as logo_url
from app.business_listings bl
left join app.listing_categories lc on lc.listing_id = bl.id
left join app.categories c on c.id = lc.category_id
left join app.offers o on o.listing_id = bl.id and o.status = 'active'
left join app.listing_content content on content.listing_id = bl.id and content.content_status = 'approved'
where bl.publication_status = 'published'
group by bl.id, o.id, content.listing_id;

comment on view public.directory_listings is
  'Published listings. logo_url is the approved company logo. photo_urls are approved gallery images and do not include the logo.';

commit;
