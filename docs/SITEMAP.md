# 775 Directory — Sitemap

## Public

| Path | Purpose | Canvas |
|---|---|---|
| `/` | Home: search, shortcuts, Discover, offers | `app-phone` |
| `/search?q=&city=&category=` | Intent results | `app-sheet` |
| `/cities` | All 775 towns | `app-sheet` |
| `/categories` | All service categories | `app-sheet` |
| `/categories/{category}` | Category across the 775 | `app-sheet` |
| `/nv/{city}` | City hub | `app-sheet` |
| `/nv/{city}/{category}` | Money page: service in town | `app-sheet` |
| `/biz/{slug}` | Profile, gallery, offer, quote, claim | `app-sheet` |
| `/offers` | Live coupons | `app-phone` |
| `/claim` | Find + claim unclaimed seeds | wash |
| `/register` | Resident mail registration | — |
| `/about` | What the 775 is | — |
| `/privacy` `/terms` | Legal | — |
| `/spec` | Live PRD / schema | — |
| `/login` | Join the 775 (SSO) | wash + gold ring |

## Authenticated

| Path | Purpose |
|---|---|
| `/account` | Listings → studio, leads, campaigns |
| `/studio/{slug}` | Featured, photos, coupon (must own listing) |
| `/list-your-business` | Create a listing |

## Auth API

| Path | Purpose |
|---|---|
| `/api/auth/*` | Better Auth today (Google, X). WorkOS is the production target. |

## Canonical SEO URLs

```
https://775directory.com/nv/{city-slug}/{category-slug}
https://775directory.com/business/{business-slug}-{stable-id}
```

Examples:

- `/nv/reno/screen-repair`
- `/nv/elko/auto-repair`
- `/nv/west-wendover/restaurants`
- `/business/{reviewed-business-slug}-{stable-id}`

## Indexability gate

- The launch sitemap contains only URLs that are currently eligible to index.
- City pages require at least three active reviewed Listings.
- City/category pages require at least five active reviewed Listings plus useful non-template content.
- Category pages require at least three active reviewed Listings across launch coverage.
- Empty and below-threshold discovery pages remain crawlable with `noindex, follow`; they are not listed in the sitemap.
- Search, authentication, Claim, Studio, account, pricing preview, registration, and internal specification routes are `noindex`.
