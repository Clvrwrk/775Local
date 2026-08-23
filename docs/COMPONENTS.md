# 775 Directory — Component library

Build new screens from these. If a pattern repeats twice, it belongs here — not as a one-off in a route.

Paths are from `src/`.

---

## Layout

### `SiteShell` — `components/layout/site-shell.tsx`

App chrome: sticky header, main, desktop footer, mobile pine tab bar.

```tsx
<SiteShell wash>{children}</SiteShell>
```

| Prop | Default | Notes |
|---|---|---|
| `wash` | `false` | Topo background (home, login, studio, claim) |
| `children` | — | Page body; already padded for the tab bar (`pb-20 md:pb-0`) |

**Contains (not exported):** `AuthSlot`, `TabBar`.

Use on every public and account route. Do not nest two shells.

---

### Canvases — `styles.css`

Not React components. Wrap page interiors:

| Class | When |
|---|---|
| `app-phone` | Home modules, offers, Circle-tight screens |
| `app-sheet` | Listing, search, city × category, studio, account |
| `app-page` | Only if you truly need 1152px (header/footer already do) |

```tsx
<section className="app-sheet px-4 py-8">{...}</section>
```

---

## Brand

### `CircleMark` — `components/brand/mark.tsx`

```tsx
<CircleMark className="size-8 text-gold" />
```

SVG, `currentColor`, `aria-hidden`. Sizes: 24 footer, 32 header, 40 login ring.

---

## Directory

### `SearchBox` — `components/directory/search-box.tsx`

Gold-pill search. Submits to `/search?q&city`.

```tsx
<SearchBox cities={cities} defaultQ={q} defaultCity={city} />
```

- Left: CircleMark
- Input placeholder **Discover your 775**
- Right: gold circular submit
- Town `<select>` sits **under** the pill (not inside — that stretched desktop)

---

### `BusinessCardView` — `components/directory/business-card.tsx`

```tsx
<BusinessCardView biz={biz} variant="photo" | "sheet" />
```

| Variant | Look | Use |
|---|---|---|
| `photo` (Discover) | 4:3 image, gold Featured chip, name + tagline below | Home grid |
| `sheet` (default) | Full-bleed photo, gradient, Cormorant name, stars, NAP whisper | Search, city × category list |

Cover: `biz.coverUrl` or city still from `listingCover(citySlug, id)`.

Always a `Link` to `/biz/$slug`. Do not nest buttons.

---

### `PhotoGallery` — `components/directory/gallery.tsx`

```tsx
<PhotoGallery photos={photos} name={biz.name} />
```

16:10 hero + horizontal thumbs (gold ring on active). Pass a 1-item fallback cover when the listing has no gallery so the hero never collapses.

---

### `OfferBanner` / `OfferTile` — `components/directory/offer-card.tsx`

| Component | Use |
|---|---|
| `OfferBanner` | On the listing — gold wash, title, code pill, expiry |
| `OfferTile` | Home / `/offers` — links to the listing |

```tsx
<OfferBanner offer={offer} featured={biz.featured} />
<OfferTile slug cityName businessName featured title details code />
```

---

### `ClaimListingPanel` — `components/directory/claim-listing.tsx`

Owner gate on a public listing.

- Already claimed by you → “You own this listing” + account link
- Claimed by other → one muted line
- Unclaimed + signed out → Sign in CTA
- Unclaimed + signed in + domain match → skip proof, one button
- Unclaimed + generic email → card / storefront / vehicle file + last-4 phone check

Do not duplicate this form on `/claim` with different rules.

---

### `Stars` — `components/directory/stars.tsx`

Read-only rating. Use next to `tabular-nums` rating text.

---

## Primitives (`components/ui`)

### `Button`

CVA. Variants: `default` | `ink` | `outline` | `ghost` | `link`.  
Sizes: `default` | `sm` | `lg` | `icon`.

```tsx
<Button>Activate Featured</Button>
<Button variant="outline" className="w-full rounded-full">Continue with X</Button>
<Button size="icon" aria-label="Search"><Search /></Button>
```

Primary in product screens = `default` (gold). Login Google = `default` + `rounded-full`. Secondary SSO = `outline` + `rounded-full`.

### `Input` / `Textarea` / `Label`

Shared 12px radius, line border, gold focus ring. Always pair `<Label htmlFor>` with the control.

### `Badge`

Neutral pill. For Featured / Claimed / Unclaimed, prefer the explicit class sets in DESIGN-SYSTEM §8 rather than restyling `Badge` five ways.

---

## Auth gates — `lib/auth/gates.tsx`

| Export | Use |
|---|---|
| `SignedOut` | Wrap Sign in |
| `UserButton` | Header avatar when session exists |
| `RedirectToSignIn` | Account / studio if `!user` |

`useCurrentUser` / `useCurrentUserState` for owner checks (`biz.claimedBy === user.id`).

---

## Page modules (route-local, keep in the route until reused)

| Module | Route | Notes |
|---|---|---|
| `MemberStrip` | `index.tsx` | Sage rail into the cream sheet |
| `Discover` | `index.tsx` | Gold-underline city tabs + photo grid |
| `QuoteForm` | `biz.$slug.tsx` | Public lead insert |
| `FeaturedPanel` | `studio.$slug.tsx` | Inventory-aware toggle |
| `GalleryPanel` | `studio.$slug.tsx` | Cap 6 / 12, upload, remove |
| `OfferPanel` | `studio.$slug.tsx` | One offer upsert |
| `MailTab` | `account.tsx` | Campaign compose + Featured insert checkbox |

If studio panels are needed on account, extract to `components/directory/studio-*`. Until then, leave them in the route.

---

## Server functions (not UI, but the library boundary)

Public reads: `src/lib/directory/queries.ts`  
Owner package: `src/lib/directory/package.ts`

| Fn | Auth | Purpose |
|---|---|---|
| `searchBusinesses` | no | Rank Featured first |
| `getBusiness` | no | Detail + photos + active offer |
| `claimListing` | yes | Domain skip or proof |
| `createListing` | yes | New shop |
| `submitLead` | no | Quote form |
| `sendCampaign` | yes | Mail; Featured offer insert |
| `setFeaturedPackage` | yes | Scarcity 1 (2 in reno/sparks) |
| `addListingPhoto` | yes | Cap + `public/uploads` |
| `saveOffer` | yes | Upsert one offer |
| `listActiveOffers` | no | `/offers` + home |

Owner mutations go through `ownedBiz()` — claimed_by must match session.

---

## Adding a component

1. Token classes only (`bg-card`, `text-ink`, `rounded-[20px]`).
2. Lucide if you need an icon.
3. Mobile 390 first; wrap in `app-phone` or `app-sheet`.
4. If it is a CTA, it is gold or it is a teal text link — not both competing.
5. Document it in this file in the same PR.
