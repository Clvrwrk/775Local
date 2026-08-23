# 775 Directory — Project handoff

**Product:** 775 Directory  
**Canonical domain:** `775Directory.com`  
**Also consider:** `775.directory`, `local775.com` → redirect  
**Type:** Hyper-local business directory + registration-driven mail (not a newspaper)  
**Market:** Area code **775** — California border to the Utah line (the better half of Nevada)  
**Competitor:** [775buzz](https://775buzz.com) — we win *find a shop*, they win *read the news*  
**Status:** Working preview. Seeded towns, claim, Featured, photos, coupons, mail demo.

This brief is the front door. Read it, then the linked specs. Do not invent a second product.

| Doc | What it is |
|---|---|
| [PRD.md](./PRD.md) | Original product requirements |
| [SCHEMA.md](./SCHEMA.md) | Postgres tables, NAP, claim, packages |
| [SITEMAP.md](./SITEMAP.md) | Routes and SEO URL contract |
| [DESIGN.md](./DESIGN.md) | Visual intent, page anatomy, do/don’t |
| [DESIGN-SYSTEM.md](./DESIGN-SYSTEM.md) | Tokens: color, type, space, radius, motion |
| [COMPONENTS.md](./COMPONENTS.md) | Component library and when to use each |

---

## 1. What we are building

When a cat goes through a patio screen in Sparks, someone searches:

> “my cat just tore thru my screen door, who is the best local screen repair shop near me”

775 Directory is the answer on Google, Bing, DuckDuckGo, and AI search. It is also the list a neighbor actually trusts: claimed shops, a phone that rings in the 775, one coupon, neighborhood mail.

**Tagline (locked):** *Who actually shows up.*  
**Search prompt:** *Discover your 775.*  
**Mail line:** *Call someone in the 775.*

Voice: direct, local, unhurried. Town names. Area code. No Vegas flash, no “premier Northern Nevada marketplace.”

---

## 2. Who it is for

| Person | Job |
|---|---|
| Resident | Find a local pro tonight |
| Newcomer | Learn the 775 (Reno–Tahoe to Wendover) |
| Shop owner | Claim the listing, photos, one offer, leads, ZIP mail |
| Marketing client | **Featured** package: rank, 12 photos, mail insert |

---

## 3. What’s shipped (do not regress)

- Seeded directory: towns, categories, ~40 businesses, reviews
- Public search + city × category SEO pages + LocalBusiness JSON-LD
- Claim-my-listing: domain-match skip **or** business card / storefront / service-vehicle proof
- Owner **studio** (`/studio/{slug}`): Featured toggle, photo gallery, one coupon
- Photo caps: **6** claimed / **12** Featured; first photo is cover
- One active offer per shop; Featured auto-inserts it into mail drops
- Resident ZIP registration + virtual / direct-mail campaign demo
- Circle-inspired UI: cream paper, gold CTAs, pine tab bar, centered phone canvas

---

## 4. What’s next (in this order)

1. **WorkOS auth** — SSO (Google + X preferred) + magic 6-digit email code. Replace Better Auth in production. See §8.
2. **Call tracking** — 775 marketing numbers, forward, no-answer / voicemail. Opt-in missed-call backup to a second shop. Nevada is one-party consent; still disclose tracking numbers.
3. **Punch cards** — high-frequency categories only (coffee, car wash, not HVAC).
4. **Video** — one clip under 60s on Featured listings.
5. **Paid Featured checkout** — inventory already enforced; payments are not in v1.
6. **Real USPS** — today’s direct-mail channel is an estimate + stored campaign row.

---

## 5. Stack (as built)

| Layer | Choice |
|---|---|
| App | TanStack Start (Vite, file routes) + React 19 |
| Style | Tailwind v4 (`src/styles.css` `@theme`) + CVA buttons |
| Icons | `lucide-react`, stroke ~1.6–1.75 |
| DB | Postgres: **PGLite** in preview, **Neon** when `DATABASE_URL` is set |
| Migrations | `migrations/0001_auth.sql` … `0004_package.sql` |
| Auth today | Better Auth, Google + X. `authMiddleware` on owner writes |
| Auth target | **WorkOS** (SSO preferred, magic code fallback) |
| Hosting | Vite preview on `0.0.0.0:8080` in this sandbox; Vercel-shaped output |

**Invariant:** every server function that reads/writes per-user data uses `authMiddleware` and scopes by `context.userId`. Never trust a client-supplied user id.

---

## 6. Repo map

```
src/routes/                 file-based pages (see SITEMAP.md)
src/components/brand/       CircleMark
src/components/layout/      SiteShell, tab bar
src/components/directory/   search, cards, gallery, claim, offers
src/components/ui/          Button, Input, Label, Textarea, Badge
src/lib/directory/          queries, seed, package (photos/offers/featured), domains
src/lib/auth/               Better Auth client, gates, middleware
src/data/seed.ts            cities, categories, businesses
src/styles.css              tokens + layout canvases
migrations/                 SQL
docs/                       this handoff
public/                     mark.svg, topo.svg, media/*.jpg, uploads/
```

---

## 7. Product rules (encode these, don’t “improve” them)

### Identity
- The region is **the 775**, not “Northern Nevada” in chrome.
- Coverage is every municipality from the Sierra to West Wendover.
- Unclaimed seed listings stay public (SEO). They cannot run offers or upload photos as an owner.

### NAP (name / address / phone / email)

| Field | Visitor | Owner |
|---|---|---|
| Name | Always public | Editable |
| Phone | Always public (NAP) | Editable |
| Street | Public unless `hide_street` | Always visible to owner |
| Email | Hidden unless `public_email` | Always visible; quote form is the public path |
| Website | Public if set | Used for domain-match claim |

### Claim
- Sign-in required. Prefer SSO.
- If session email **domain-matches** listing website / listing email → skip proof (`method: domain`).
- Else require a photo: **business card**, **storefront**, or **service vehicle**.
- Generic Gmail/Yahoo/etc. never skips.
- Proof metadata in `claim_proofs` (filename + method). Production should store the blob.

### Featured package (scarce)
- Claimed listings only (activation is owner-studio in this demo).
- **1** Featured per category × town; **2** in Reno and Sparks.
- Rank: `order by featured desc` on city × service pages.
- Includes: gold badge, homepage Featured/Discover, **12** photos, coupon **mail insert**.
- Cannot self-serve pay yet — treat studio toggle as sales/admin until checkout exists.

### Photos
- Real jobs, trucks, storefronts. No empty gray boxes.
- Unclaimed: 0 owner photos; city cover fallback is OK.
- JPG / PNG / WebP, ~650KB cap in the current upload path (`public/uploads`).

### Coupons
- One active offer per shop (`offers.business_id` unique).
- Listing + `/offers` + homepage strip.
- Mail insert is **Featured-only** (campaign checkbox, default on).

### Mail
- Residents register ZIP + town + interest slugs.
- Campaigns send from a listing the user **owns**.
- Virtual = instant to registered neighbors; direct_mail = reach estimate (min 120 in demo).

---

## 8. Auth handoff (WorkOS)

**Today (preview):** Better Auth Google + X. If auth is disabled, `authMiddleware` resolves `dev-user`.

**Production target (already specified by product):**

1. WorkOS as the auth layer.
2. SSO: **Google** and **X**, preference order SSO > magic.
3. Magic path: authorized email → **6-digit** login code.
4. Session user id remains `text` on `claimed_by`, `residents.user_id`, `campaigns.user_id`, `claim_proofs.user_id`.
5. Keep `authMiddleware` as the only way server fns learn who the caller is.

Do not ship a second login UI language. Login is the gold ring: “Join the 775.”

---

## 9. SEO / AEO contract

Money URLs:

```
/nv/{city}/{category}     e.g. /nv/reno/screen-repair
/biz/{slug}               e.g. /biz/high-sierra-screens-reno
```

- One URL per city × category. Unique H1, intro, FAQ, NAP.
- `LocalBusiness` JSON-LD on profiles.
- Fast, crawlable HTML. No client-only listing bodies.
- Copy answers “near me” in the 775, not Clark County.

---

## 10. How to run (engineering)

```bash
npm install
npm run dev          # 0.0.0.0:8080
npm run typecheck
npm run build && npm run preview
```

Migrations apply on boot via `src/lib/db.ts`. Seed runs once into empty `cities`. Package photos/offers backfill in `ensurePackages`.

Preview images: `public/media/*.jpg` (original Sierra / high-desert stills). Topographic wash: `public/topo.svg`.

---

## 11. Known gaps (honest)

| Gap | Notes |
|---|---|
| WorkOS not wired | UI copy already prefers SSO; magic code not implemented |
| Featured is a boolean toggle | No Stripe/invoice; inventory rules are real |
| Photo blobs | Written to `public/uploads` in this environment; use object storage in prod |
| Claim proof files | Filename only, not the image bytes |
| Call tracking | Specified, not built |
| Punch cards | Specified, not built |
| Direct mail | Campaign row + reach estimate, not USPS |
| Desktop | Phone canvas centered on cream — intentional Circle translation. Do not stretch home to 1280px |

---

## 12. Design north star

Visual language is **Shangri-La Circle** (iOS) filtered through Northern Nevada: cream paper, sagebrush, pine tab bar, gold as the only CTA. Implementation notes live in [DESIGN.md](./DESIGN.md) and tokens in [DESIGN-SYSTEM.md](./DESIGN-SYSTEM.md).

If a screen looks like a stretched marketing site, it is wrong. If it looks like a membership card sitting on topo maps, it is right.
