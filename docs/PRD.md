# 775 Directory — Product Requirements Document

**Product:** 775 Directory (`775Directory.com`)  
**Type:** Hyper-local business directory + registration-driven mail  
**Market:** Northern Nevada (area code 775) — California border to Utah border  
**Positioning:** Pure directory (not a newspaper). Direct competitor to 775buzz, built to win “near me” service searches.

---

## 1. Problem

When something breaks in Northern Nevada — a cat through a screen door, a dead AC, a locked truck in Elko — people search:

> “best local screen repair near me”

They need a trusted, local, complete directory — not Vegas results, not a news site, not a national aggregator that doesn’t know Fernley from Fallon.

## 2. Solution

**775 Directory** is the local business finder for the entire 775:

- Search by need + town
- City × category landing pages built for Google, Bing, DuckDuckGo, and AI answers
- Claimed listings with phone, hours, reviews, and quote requests
- Resident registration that powers **direct mail** and **virtual direct mail** campaigns

## 3. Audience

| Segment | Job to be done |
|---|---|
| Residents | Find a vetted local pro fast |
| Business owners | Get found, capture leads, mail neighbors |
| Newcomers | Learn the 775 (Reno–Tahoe to Wendover) |

## 4. Brand

- **Name:** 775 Directory  
- **Voice:** Direct, local, unhurried. No Vegas flash.  
- **Identity:** Area code 775 is the tribal marker for everything outside Clark County.  
- **Visual:** Warm paper, espresso ink, sagebrush green.

## 5. Coverage (v1)

All 775 municipalities, with seeded depth in:

Reno, Sparks, Carson City, Incline Village, Gardnerville, Minden, Fernley, Fallon, Dayton, Virginia City, Lovelock, Winnemucca, Elko, Ely, West Wendover.

Regions: Truckee Meadows, Tahoe Side, Carson Valley, I-80 Corridor, High Desert East.

## 6. Functional requirements

### 6.1 Public discovery (no account)

- Global search (query + city + category)
- Browse cities and categories
- City hubs (`/nv/reno`)
- City × category SEO pages (`/nv/reno/screen-repair`)
- Business profiles (`/biz/{slug}`) with NAP, hours, rating, reviews, quote form
- Schema.org `LocalBusiness` JSON-LD on profiles

### 6.2 Resident registration (account)

- Sign in (Google / X)
- Save ZIP + town + interest categories
- Become reachable for virtual/physical neighborhood mail

### 6.3 Business listings (account)

- List or claim a business
- See inbound quote leads
- Launch a **virtual postcard** or **direct-mail** campaign to matching ZIPs

### 6.4 Out of scope (v1)

- Payments / paid placement checkout
- Live USPS print fulfillment
- News / editorial CMS
- Multi-state expansion

## 7. Success metrics

- Rank for `{service} {city} NV` and `{service} near me` in the 775
- Quote requests per listing
- Resident registrations by ZIP
- Campaigns sent and estimated reach

## 8. SEO / AEO principles

- One URL per city × category
- Exact-need copy (“Screen repair in Reno, NV”)
- Unique intros, FAQs, and NAP
- Fast, mobile-first, crawlable HTML
- AI-readable: clear H1, FAQ, LocalBusiness schema, 775 geo entity
