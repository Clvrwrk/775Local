begin;

alter table app.business_listings
  add column if not exists content_tier text not null default 'basic'
    check (content_tier in ('basic', 'standard', 'premium'));

alter table app.listing_content
  add column if not exists services text[] not null default '{}',
  add column if not exists faqs jsonb not null default '[]'::jsonb
    check (jsonb_typeof(faqs) = 'array'),
  add column if not exists projects jsonb not null default '[]'::jsonb
    check (jsonb_typeof(projects) = 'array');

create policy media_read_approved_public on app.media_assets for select to anon, authenticated
using (
  status = 'approved'
  and exists (
    select 1 from app.business_listings bl
    where bl.id = media_assets.listing_id and bl.publication_status = 'published'
  )
);
grant select on app.media_assets to anon, authenticated;

comment on column app.business_listings.content_tier is
  'Free listing content completeness: Basic, Standard, or Premium. Independent of Claim, verification, and paid Featured placement.';

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
  case when bl.hide_street then null else bl.street_address end as street_address,
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
  coalesce(array_agg(distinct c.slug) filter (where c.slug is not null), '{}') as category_slugs,
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
  coalesce(content.services, '{}') as services,
  coalesce(content.faqs, '[]'::jsonb) as faqs,
  coalesce(content.projects, '[]'::jsonb) as projects,
  coalesce((
    select array_agg(ma.public_path order by ma.created_at)
    from app.media_assets ma
    where ma.listing_id = bl.id and ma.status = 'approved' and ma.kind = 'image'
  ), '{}') as photo_urls
from app.business_listings bl
left join app.listing_categories lc on lc.listing_id = bl.id
left join app.categories c on c.id = lc.category_id
left join app.offers o on o.listing_id = bl.id and o.status = 'active'
left join app.listing_content content on content.listing_id = bl.id and content.content_status = 'approved'
where bl.publication_status = 'published'
group by bl.id, o.id, content.listing_id;

revoke all on public.directory_listings from public;
grant select on public.directory_listings to anon, authenticated;

create or replace view public.directory_categories
with (security_invoker = true)
as
select
  c.slug,
  c.name,
  c.description,
  count(distinct bl.id)::integer as listing_count
from app.categories c
join app.listing_categories lc on lc.category_id = c.id
join app.business_listings bl on bl.id = lc.listing_id
where bl.publication_status = 'published'
group by c.id
having count(distinct bl.id) > 0;

create or replace view public.directory_city_categories
with (security_invoker = true)
as
select
  bl.city_slug,
  c.slug,
  c.name,
  c.description,
  count(distinct bl.id)::integer as listing_count
from app.categories c
join app.listing_categories lc on lc.category_id = c.id
join app.business_listings bl on bl.id = lc.listing_id
where bl.publication_status = 'published'
group by bl.city_slug, c.id
having count(distinct bl.id) > 0;

revoke all on public.directory_categories, public.directory_city_categories from public;
grant select on public.directory_categories, public.directory_city_categories to anon, authenticated;

comment on view public.directory_categories is
  'Public categories with at least one visible Listing; empty categories are intentionally absent.';
comment on view public.directory_city_categories is
  'Public city/category pairs with at least one visible Listing; empty pairs are intentionally absent.';

commit;
