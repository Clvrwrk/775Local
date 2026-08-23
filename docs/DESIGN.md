# Design.md — 775 Directory

A membership directory that feels like a local card in your pocket, not a SaaS table of businesses.

**North star:** Shangri-La Circle iOS (cream wash, gold ring, circular shortcuts, photo-forward cards, dark tab bar) × Sierra / high-desert material (topo lines, pine, sage, real job photos).

**Tagline on product:** *Who actually shows up.*  
**Search:** *Discover your 775.*

---

## 1. Principles

1. **Phone first, then sit it on a desk.** Home and listing live in a centered canvas (`.app-phone` / `.app-sheet`). Desktop is cream paper around that canvas — never blow the Circle layout to 1280px.
2. **One gold action.** Primary CTAs are gold on ink. Everything else is quiet.
3. **Photos over chrome.** Listings are photographs with a name on them. Empty gray tiles are a defect.
4. **Membership, not CMS.** Gold ring on login, sage member strip, pine tab bar. Owners have a *studio*, not a dashboard.
5. **The 775 is the brand.** Wordmark is the numerals **775** in Cormorant. “Directory” is subtitle, not the logo.
6. **Local material.** Topographic line art, sagebrush, pine. No neon, no Vegas, no purple, no Inter-on-white generic AI look.

---

## 2. Brand mark

**CircleMark** — gold (or `currentColor`) circle with two nested Sierra peaks. File: `src/components/brand/mark.tsx`, also `public/mark.svg`.

Lockup:

```
[ CircleMark 24–32px ]  775
```

- Mark: gold (`#C9A227`)
- Numerals: Cormorant Garamond 600, ink, tracking tight
- Do not set the mark in sage or pine except as a footer whisper
- Do not add a drop shadow to the mark
- Favicon / app icon: mark on paper or pine, never on gold-on-gold

---

## 3. Atmosphere

| Layer | Treatment |
|---|---|
| Page | `--color-paper` `#F6F3EC` |
| Home / login / studio | `.topo-wash` — `public/topo.svg` at top, cream showing through |
| Content sheet | Cream card `#FFFDF8`, top radius 28px, lifts off the wash |
| Member strip | Sage 40% over the sheet’s top radius — the Circle “member” rail |
| Mobile nav | Pine `#1C3B34`, gold active icon, paper labels |
| Desktop header | Paper 70% + backdrop blur, 64px tall |

Topo art is original line work. Do not swap in a stock contour map.

Photography is original stills in `public/media/` (Reno dusk, Tahoe pines, Washoe, Carson valley, Elko desert, shop interior). Listing covers: owner gallery first, else city still.

---

## 4. Page anatomy

### Home (`/`) — Circle home

```
[ sticky header: mark + 775 | desktop nav | Sign in gold pill ]
          topo wash
     [ gold-pill search, 12px radius-full ]
     [ 6 circular shortcuts, 48px, teal icons ]
     [ sage member strip, rounded top 22px ]
[ cream sheet, radius-top 28px ]
     hero photo 192px + gold overlay title
     2-up photo tiles
     Discover tabs (gold underline)
     2-up photo cards (Featured)
     Offers stack
[ pine tab bar on < md ]
```

Shortcuts (fixed set): Find · Home · Dine · Auto · Claim · Mail  
One row of six. `grid-cols-6`. Never wrap, never `justify-between` across the viewport.

### Listing (`/biz/{slug}`) — Circle hotel detail

```
photo gallery (16:10, thumbs if >1)
kicker: CATEGORY · TOWN
display name (Cormorant ~30px)
tagline
stars + Featured/Claimed/Unclaimed chip
offer banner (if any)
body
NAP rows (icon + label + value, 16px radius cards)
quote form
claim panel (if unclaimed)
reviews
```

Photo is the first thing. Do not put a 2-column “website sidebar” on desktop.

### Town × service (`/nv/{city}/{category}`) — Circle hotel list

Kicker + H1 (“Screen repair in Reno, NV”) + stacked **sheet** cards (photo with gradient, name in Cormorant, gold Featured chip). Width: `.app-sheet` (40rem), not full bleed.

### Login — gold ring

Centered `size-56` circle, `border-gold/70`, mark + “Join the 775”. SSO buttons: Google = gold fill, X = outline. Full-width, `rounded-full`.

### Account — membership card

Name, gold ring with **775**, pill tabs (Listings / Leads / Campaigns). Active tab = gold fill. Listings deep-link to **studio**.

### Owner studio (`/studio/{slug}`)

Three stacked cards: Featured package, Photos, Coupon. Same cream cards, gold primary buttons.

---

## 5. Imagery rules

- **Do:** trucks, storefronts, finished jobs, Basque dining rooms, high desert, Sierra light.
- **Don’t:** stock handshakes, clipart screens, empty gray `bg-muted` rectangles, watermarks, Vegas Strip.
- Unclaimed listings may use the city still as a single cover.
- Featured chip sits **top-right** of the photo, gold fill, ink text, 11px.
- Overlay text on photos is paper (`#F6F3EC`) over a `from-ink/70` gradient — never raw white on a busy photo without the scrim.

---

## 6. Copy in the UI

| Place | Copy |
|---|---|
| Search placeholder | Discover your 775 |
| Hero | When the cat goes through the screen |
| Hero sub | Who actually shows up — Reno to Wendover. |
| Sign in | Sign in / Join the 775 |
| Member strip (out) | Join the 775 · Local mail |
| Tab bar | Explore · Mail · Claim · Account |
| Featured chip | Featured |
| Unclaimed | Unclaimed |
| Footer | Not a newspaper. A directory for the better half of Nevada. |

Buttons are verbs: Search, Claim this listing, Send campaign, Add photo, Activate Featured.

---

## 7. Do / don’t

**Do**
- Keep home in `.app-phone` (26.75rem, 30rem at md+)
- Gold for primary, teal for text links, pine for the tab bar
- Cormorant on display names and H1–H3; Outfit on UI
- 44px+ tap targets (h-11 controls, tab min-h-14)
- `text-wrap: balance` on headings, `pretty` on paragraphs

**Don’t**
- Stretch Circle modules to `max-w-6xl` (that was the haywire desktop)
- Introduce a third font or a blue primary
- Use emoji as icons
- Put “Business Directory” in the logo
- Gradient-blob heroes, Inter-only marketing pages, purple AI-SaaS kits
- Dark mode (not in v1)

---

## 8. Motion

- 150–250ms color/opacity, ease default
- Photo cards: `scale 1.03` over 300ms on hover
- Respect `prefers-reduced-motion` (already global in `styles.css`)
- No layout-jank animations, no auto-playing carousels on home

---

## 9. Accessibility

- Search field has a visible label (`sr-only` “What do you need?”)
- Icon-only search button has `aria-label="Search"`
- Contrast: ink on paper, ink on gold, paper on pine. Do not put muted gray on sage.
- Focus: `ring-2 ring-gold/40` (inputs) or `/50` (buttons)
- Tab bar sits above home indicator (`pb-[env(safe-area-inset-bottom)]`)
- Main content `pb-20` on mobile so the pine bar does not cover CTAs

---

## 10. QA screens (must look right)

1. Home desktop 1280 — canvas centered, shortcuts one row, search not full-bleed
2. Home mobile 390 — six shortcuts, member strip, hero, no horizontal overflow
3. `/biz/high-sierra-screens-reno` — gallery, CAT775 offer, Featured chip
4. `/nv/reno/screen-repair` — Featured first, photo cards, unclaimed still claimable
5. `/login` — gold ring
6. `/offers` — coupon stack in the phone canvas
