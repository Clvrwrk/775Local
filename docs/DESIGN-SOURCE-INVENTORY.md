# 775Directory design source inventory

Date: 2026-08-26  
Workstream: CLE-105 public discovery shell  
CAT trail: CAT-78

## Governing source

The visual source of truth for this build is:

`/Users/chussey/Library/CloudStorage/Dropbox-AIA4/Cleverwork Main/Local775Directory/Design system build guidance`

The repository remains the technical and publication authority. Design-system mock data is illustrative, not approved directory data.

## Source groups reviewed

- `SKILL.md`, `readme.md`, `brand-guide.md`, and `brand-guide.html`
- `tokens/` color, typography, shape, and base styles
- `.dc.html` screen files for Home, Pricing, Free, Standard, and Premium listings
- `components/`, `guidelines/`, and `ui_kits/775-directory/`
- `assets/logo/`, `assets/brand-imagery/`, `assets/media/`, and `assets/topo.svg`
- `collateral/`, `slides/`, and the supplied screen thumbnail

## Applied visual contract

- Warm paper and card surfaces, pine structural fields, and gold reserved for action or disclosure
- Cormorant Garamond display type and Outfit body type
- Official Summit Seal and 775Directory lockups; no redrawn logo
- A high-desert photographic hero, topographic wash, round cards, and restrained motion
- Mobile keeps the “local card in your pocket” behavior; desktop expands to a 72rem editorial directory layout
- Sentence case, dry local copy, 1.75px Lucide icons, visible focus states, and reduced-motion support

## Mock claims rejected

The following content from design examples is not approved for public use and must not be copied into the application:

- “4,200+ verified listings” or any unsupported listing count
- invented businesses, reviews, ratings, hours, addresses, licenses, response times, or “verified owner” states
- “#1 rated,” “every listing verified,” or other unsupported quality claims
- mock pricing values that conflict with the approved future pricing configuration
- undisclosed Featured placement or wording that blurs payment with ownership or verification

The application renders only reviewed public-projection data. Empty states remain visible instead of being padded with sample listings.

## Approved pricing exception

The isolated `/pricing` preview retains the approved four-plan configuration:

- Free: $0
- Basic: $10/month or $120/year
- Standard: $15/month or $180/year
- Premium: monthly rate intentionally unset; annual price will equal ten monthly payments for twelve months of service

The route stays `noindex, nofollow`, is not linked from public navigation, and has no enabled paid checkout action.

## Asset provenance

The selected design-system photographs are AI-generated brand imagery. The public site uses them only as regional/editorial brand art, never as evidence of a listed business, its work, or its location. Listing fallbacks are labeled as regional images.
