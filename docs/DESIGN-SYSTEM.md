# 775 Directory — Design system

Single source of tokens: `src/styles.css` `@theme`. Consume via Tailwind (`bg-paper`, `text-ink`, `font-display`, `rounded-lg`). Do not sprinkle raw hex in new JSX.

If you need a new value, add a token first.

---

## 1. Color

**Five families, one accent.** Gold is the only loud color. Sage/pine are landscape, not a second CTA.

| Token | Hex | Tailwind | Role |
|---|---|---|---|
| `paper` | `#F6F3EC` | `bg-paper` `text-paper` | Page ground, overlay type on photos |
| `paper-2` | `#EBE4D4` | `bg-paper-2` | Hover wells, header chips |
| `ink` | `#1C1A16` | `text-ink` `bg-ink` | Primary type, photo scrim |
| `ink-soft` | `#3F3A34` | `text-ink-soft` | Secondary type |
| `muted` | `#7A7368` | `text-muted` | Meta, placeholders |
| `sage` | `#8FA17A` | `bg-sage` `text-sage` | Member strip, landscape |
| `sage-2` | `#6F8160` | `text-sage-2` | Sage hover / darker leaf |
| `pine` | `#1C3B34` | `bg-pine` | Mobile tab bar |
| `teal` | `#2F5D54` | `text-teal` | Text links, shortcut icons |
| `gold` | `#C9A227` | `bg-gold` `text-gold` | Primary CTA, Featured, mark |
| `gold-2` | `#B08C1A` | `bg-gold-2` `text-gold-2` | Gold hover / kicker |
| `line` | `#E4DCCB` | `border-line` | Hairlines |
| `card` | `#FFFDF8` | `bg-card` | Sheets, pills, inputs |
| `danger` | `#8F3D32` | `text-danger` | Errors only |

### Usage

| Job | Spec |
|---|---|
| Page background | `paper` |
| Primary button | `bg-gold text-ink` hover `bg-gold-2` |
| Destructive / pine button | `bg-pine text-paper` hover `bg-teal` |
| Text link | `text-teal` underline on hover |
| Featured chip | `bg-gold text-ink` rounded-full, 11px |
| Member strip | `bg-sage/40 text-ink` |
| Tab bar | `bg-pine`, active `text-gold`, idle `text-paper/70` |
| Input | `bg-card border-line`, focus `ring-gold/40` |
| Error | `text-danger` |

**Never:** gold fill + gold type. **Never:** muted type on sage fill (fails contrast). **Never:** a blue link color.

Ink-on-gold and paper-on-pine are the two high-contrast pairs. Check both when you change a fill.

---

## 2. Typography

Two families. No third.

| Role | Family | CSS | Tailwind |
|---|---|---|---|
| Display | Cormorant Garamond 500–700 | `--font-display` | `font-display` |
| UI / body | Outfit 400–700 | `--font-sans` | `font-sans` (default on `body`) |

Loaded from Google Fonts in `styles.css`. Headings `h1–h3` are display by default.

### Scale (use these, not random `text-[13px]`)

| Name | Size | Weight | Line | Use |
|---|---|---|---|---|
| Display XL | `text-4xl` 36px | 600 | tight | Rare page titles (towns index) |
| Display L | `text-3xl` 30px | 600 | tight / `leading-tight` | Listing name, login |
| Display M | `text-2xl` 24px | 600 | tight | Hero on home, card names (`sheet`) |
| Display S | `text-xl` 20px | 600 | snug | Section titles (“Offers this month”) |
| UI body | `text-sm` 14px | 400 | 1.5 | Default copy, forms |
| UI medium | `text-sm` 14px | 500 | 1.4 | Nav, buttons, member strip |
| Meta | `text-xs` 12px | 400–500 | 1.4 | Hours, reach, helper |
| Micro | `text-[11px]` | 500 | 1.3 | Tab bar, shortcut labels, chips, kickers |
| Kicker | `text-[11px]` uppercase `tracking-[0.16em]` | 500 | — | CATEGORY · TOWN, “Featured package” |

Phone numbers, ratings, ZIP: `tabular-nums`.

Heading wrap: `text-wrap: balance`. Body: `text-wrap: pretty`. Antialiased on `html`.

---

## 3. Spacing

4px base. Prefer the scale below.

| Token | px | Common use |
|---|---|---|
| 1 | 4 | Icon gaps |
| 1.5 | 6 | Chip padding-y, shortcut label gap |
| 2 | 8 | Tight stacks |
| 2.5 | 10 | Photo tile gaps on home |
| 3 | 12 | Card inner, header nav gap |
| 4 | 16 | **Page gutter** (`px-4`), section padding |
| 5 | 20 | Shortcut block / member offset |
| 6 | 24 | After body copy |
| 8 | 32 | Section breaks |
| 10 | 40 | Bottom of sheets |
| 12 | 48 | Desktop footer padding |

**Page gutter is always 16px** (`px-4`) inside canvases. Do not mix `px-3` and `px-6` on the same template.

Vertical rhythm on listing: 4 → 8 → 12 → 16 → 24. Don’t jump 4 to 48.

---

## 4. Layout canvases

Defined in `src/styles.css` (not Tailwind utilities — those failed to constrain desktop once). **Use the class names.**

| Class | Max width | Use |
|---|---|---|
| `.app-phone` | 26.75rem (428px); 30rem (480px) from `md` | Home, login-adjacent, offers, Circle modules |
| `.app-sheet` | 40rem (640px) | Listing, town × service, search results, studio |
| `.app-page` | 72rem (1152px) | Desktop header/footer only |
| Header inner | `max-w-6xl` | Nav bar |

Center with the class (`margin-inline: auto`). Width 100%.

Home cream sheet is **inside** `.app-phone`, `rounded-t-[28px]`, not full viewport.

Mobile main: `pb-20` so the pine tab bar (56px + safe area) does not cover content. Hide footer until `md`.

---

## 5. Radius

| Token | Value | Tailwind | Use |
|---|---|---|---|
| `sm` | 8px | `rounded-sm` | Tiny wells |
| `md` | 12px | `rounded-md` | Inputs, default buttons (`rounded-[12px]` in Button) |
| `lg` | 20px | `rounded-lg` | Photo cards, hero, tiles |
| `sheet` | 28px | `rounded-[28px]` | Cream sheet top, large panels |
| Pill | 9999 | `rounded-full` | Search, Sign in, shortcuts, chips, SSO, tab-like account filters |

Search, shortcuts, Sign in, Featured chips, login buttons: **pills**.  
Photos and content cards: **20px**.  
Owner/claim panels: **24–28px**.

---

## 6. Elevation

Keep shadows the same ink, low opacity — paper, not Material.

| Name | Value | Use |
|---|---|---|
| Search | `0 8px 30px rgba(28,26,22,0.06)` | Gold-pill search |
| Shortcut | `0 6px 18px rgba(28,26,22,0.06)` | Circular icons |
| Photo card | `0 8px 24px rgba(28,26,22,0.06)` | Discover tiles |
| Sheet lift | `0 -10px 32px rgba(28,26,22,0.05)` | Cream sheet over wash |
| Hairline | `border-line` | Forms, footer, unclaimed chip |

No 24px blur black shadows. No ring around the whole page.

---

## 7. Iconography

- Set: **Lucide**, `strokeWidth` 1.6–1.75
- Shortcut circles: 16px icon in a 48px (`size-12`) paper circle, `text-teal`
- Tab bar: 20px (`size-5`), gold vs paper/70
- NAP rows: 16px gold icons
- Do not mix filled and outline randomly; stay outline

Shortcut set (home): Search, DoorOpen, Utensils, Car, BadgeCheck, Mail.

---

## 8. Controls

### Buttons (`src/components/ui/button.tsx`)

| Variant | Look |
|---|---|
| `default` | Gold fill, ink type — primary |
| `ink` | Pine fill, paper type |
| `outline` | Card + line border |
| `ghost` | Ink, paper-2 hover |
| `link` | Teal, underline on hover |

| Size | Height | Radius |
|---|---|---|
| `sm` | 36px | 10px |
| `default` | 44px | 12px |
| `lg` | 48px | 14px |
| `icon` | 44px | full |

Disabled: 50% opacity, no pointer. Focus: `ring-2 ring-gold/50`. Transition 150ms.

Circle-style CTAs (Sign in, search submit, SSO, Add photo) override to `rounded-full`. Search submit is `size-9` gold circle inside the pill.

### Inputs

- Height 44px (`h-11`), 12px radius, `border-line`, `bg-card`
- Text `text-sm text-ink`, placeholder `text-muted`
- Focus `ring-2 ring-gold/40`
- Textarea: same chrome, min 3–4 rows
- Labels: `text-sm` ink, 6px above control

### Chips / badges

Default `Badge`: paper-2 fill, line border, full pill, 12px.  
Product chips (override):

| Chip | Classes |
|---|---|
| Featured | `bg-gold text-ink` 11px medium |
| Claimed | `bg-sage/20 text-teal` |
| Unclaimed | `border-line text-muted` |
| Offer code | `bg-gold text-ink` tabular |

---

## 9. Chrome

### Header
- Height 64px, `bg-paper/70 backdrop-blur-md`, sticky
- Left: mark 32px + “775”
- Center-right (md+): Towns, Services, List your business, Local mail — 14px, `text-ink-soft`, full-pill hover `bg-paper-2`
- Right: Sign in gold pill h-10, or Account + avatar

### Tab bar (md:hidden)
- Fixed bottom, pine, 4 columns
- Item `min-h-14`, 11px label
- Active gold, idle paper/70
- Explore is active for `/`, `/nv`, `/search`, `/categories`, `/cities`, `/biz`

### Footer (md+ only)
- Line border, 3 columns inside `.app-page` / max-w-6xl
- Fine print: “Not a newspaper…”

---

## 10. Motion & states

- Hover/focus: 150ms color
- Photo hover: 300ms transform
- Loading: `animate-pulse` on `bg-paper-2` wells (header auth slot, account)
- Empty: one sentence on card, plus a teal text link — no illustrations
- Error: `text-danger text-sm` under the control, not toast-spam

Reduced motion: all transitions/animations clamped in `styles.css`.

---

## 11. Breakpoints

Mobile-first.

| Name | Width | Behavior |
|---|---|---|
| default | 390 | Tab bar, phone canvas, `px-4` |
| `sm` 640 | Slightly taller covers |  |
| `md` 768 | Hide tab bar, show header nav + footer, phone canvas 30rem |  |
| `lg` 1024 | Same templates; do not add a 12-col marketing grid |  |

If you add a desktop extra, it is a second column *inside* `.app-sheet`, not a full-bleed dashboard.

---

## 12. Token checklist for PRs

- [ ] No new hex in JSX
- [ ] ≤ these colors; gold is the only primary
- [ ] Display vs Outfit only
- [ ] Canvas class used (not a guessed `max-w-*`)
- [ ] Tap target ≥ 44px
- [ ] Ink-on-gold or paper-on-pine if you change a fill
- [ ] No horizontal overflow at 390
- [ ] Photo or topo — no gray void
