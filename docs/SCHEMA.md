# 775 Directory — Data schema

Postgres (Neon in production, PGLite in preview). Auth tables from Better Auth (`0001_auth.sql`). App tables:

- `0002_directory.sql` — cities, categories, businesses, leads, residents, campaigns
- `0003_claim_proof.sql` — NAP flags, claim_proofs
- `0004_package.sql` — listing_photos, offers, campaigns.included_offer

## Entity relationship

```
cities 1──* businesses *──* categories
                │
                ├──* reviews
                ├──* leads
                ├──* listing_photos
                ├──  offers          (0..1)
                ├──* claim_proofs
                └──* campaigns
residents (user_id) — mail registrations, ZIP + interests
```

## Tables

### cities
- `id serial PK`
- `slug text unique` — `reno`
- `name`, `county`, `region`, `zip`, `blurb`
- `lat`, `lng`
- Regions: Truckee Meadows | Tahoe Side | Carson Valley | I-80 Corridor | High Desert East

### categories
- `id serial PK`
- `slug text unique` — `screen-repair`
- `name`, `description`, `synonyms`, `icon` (lucide key)

### businesses
- `id serial PK`, `slug text unique`
- `name`, `tagline`, `description`
- `phone`, `email`, `website`, `street`, `zip`
- `city_id` FK, `lat`, `lng`
- `rating numeric`, `review_count int`, `hours`
- `featured boolean` — scarce package
- `verified boolean`
- `claimed_by text null` — auth user id
- `claim_method text` — `domain` | `card` | `storefront` | `vehicle`
- `public_email boolean` default false — visitors see email only if true
- `hide_street boolean` default false — visitors see “Service area” if true
- `created_at`

### business_categories
- `business_id`, `category_id`, `is_primary`
- PK `(business_id, category_id)`

### reviews
- `id`, `business_id`, `author`, `rating`, `body`, `created_at`

### leads
- Public insert from quote form; owner read via `claimed_by`

### residents
- `user_id` unique, `display_name`, `zip`, `city_slug`, `interests` (comma slugs)

### campaigns
- `user_id`, `business_id`, `name`
- `channel` — `virtual` | `direct_mail`
- `city_slug`, `category_slug`, `message`, `status`, `reach`
- `included_offer text` — snapshot of Featured coupon line

### claim_proofs
- `business_id`, `user_id`, `method`, `filename`
- Production: store the image blob (today: filename only)

### listing_photos
- `business_id`, `url`, `caption`, `sort_order`
- Cap 6 claimed / 12 Featured. First by sort_order is cover.

### offers
- `business_id unique` — one row per shop
- `title`, `details`, `code`, `expires_on`, `active`

## Public vs authenticated

| Data | Read | Write |
|---|---|---|
| cities, categories, businesses, reviews, photos, active offers | public | seed + claimed owner |
| leads | owner | public quote form |
| residents, campaigns | owner | owner |
| claim_proofs | owner/admin | claim flow |
| featured flag | public read | owner studio (inventory rules) |

## Featured inventory

On activate: count other `featured` rows with the same city slug + primary category slug. Cap **1**, except **2** for `reno` and `sparks`.
