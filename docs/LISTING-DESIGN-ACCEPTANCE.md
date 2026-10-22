# Shared Business Listing templates

## Approved Premium template — October 22, 2026

Christopher approved the [Premium listing concept](https://chatgpt.com/api/library/files/libfile_7edcfd409afc8191924314b37fdcca43/download) (`pauls-premium-listing-concept.png`) and requested the shared, site-wide rollout. This decision supersedes the earlier Premium pine hero, oversized logo backdrop and category-first visible title. Basic and Standard structures and entitlements remain unchanged.

The reference establishes presentation, not business facts or reusable media. Its reconstructed photos and logo must never become listing assets.

- **Palette and type:** retain the existing ivory paper `#F6F3EC`, light card `#FFFDF8`, restrained gold `#C9A227`, dark ink and accessible muted text. Use the existing Cormorant display face and Outfit interface face.
- **Identity:** business name alone is the H1. A small, contained, crisp business logo sits beside it; category and location are secondary. Preserve the existing SEO title, description, canonical URL and structured data separately.
- **Composition:** a generous desktop canvas, large lead business photo and aligned, consistently cropped thumbnails on the left; a defined contact card on the right. Below 1024px, stack identity, gallery, contact and the lower content columns so tablet contact details stay readable. Small screens must not clip or scroll horizontally.
- **Contact:** validated Call is primary and the business website is secondary when both exist. Missing actions are omitted; no empty links or invented contact details. Keep existing sponsored-link attributes.
- **Media:** use only the listing's existing published business photographs. Preserve logos without cropping and keep them out of the photo gallery. Gallery illustrations do not fill Premium photo slots. When usable photos or a logo are absent, show a polished, explicitly factual fallback. Broken images receive the same treatment.
- **Truth:** show factual owner/Claim and information-check status clearly. Premium is a presentation tier, never verification, quality, ownership or payment evidence. Sponsored placement remains independent. No fabricated ratings, hours, service areas, trust badges or claims.
- **Scope:** one shared Premium component serves every `contentTier === "premium"` listing. No database, identity, Claim-command, entitlement, provider or account-flow changes belong in this rollout.

Implementation starts from production commit `6bc3ddce43c3e3a1a4a81177052f2e12cf35bd5b`; unrelated enrichment and blocked Claim-test branches are excluded. Acceptance requires actual-component desktop/mobile rendering, varying photo counts and logo shapes, long names, missing contacts, keyboard gallery operation, truthful statuses, privacy-safe location, preserved routing/SEO and unchanged Basic/Standard capabilities, plus the repository's full test/type/lint/build gates and independent review.

## Earlier correction — September 4, 2026

The user's rejection supersedes earlier statements implying that brand refinements completed listing design integration. Restoring95 listings solved data visibility only. The previous listing page was one generic layout and did not implement the three supplied screen files.

## Historical September reference (Premium superseded above)

Source directory: `/Users/chussey/Library/CloudStorage/Dropbox-AIA4/Cleverwork Main/Local775Directory/Design system build guidance 2`.

| Supplied screen          | Application tier | Implemented structure                                                                                                                                                |
| ------------------------ | ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Listing Free.dc.html     | Basic            | 880px container, breadcrumb band,42px title, contact/location and hours cards, dashed claim panel, location and listing summary sidebar, no photo hero               |
| Listing Standard.dc.html | Standard         | 1000px container,42px title, contact actions,2:1:1 photo mosaic,1.5:1 About/reviews and details/hours columns                                                        |
| Listing Premium.dc.html  | Premium          | 1060px container, full-width pine hero,44px category/town/business heading, stacked contact actions, three-photo row,1.55:1 service/FAQ and business-details columns |

All use14px cards, paper surfaces, supplied fonts, slim paper footer and responsive single-column behavior below768px. Existing mobile navigation, accessible focus, truthful authority and valid contact actions remain. Light-surface gold labels use darker #80620e for contrast; brand gold remains on pine. Primary actions retain the accepted gold-action brand convention. The real775Directory identity, policies and free content tiers supersede the mockup's775Local name, paid plans and unsupported SEO promises.

## September data constraints (historical)

Anonymous published projection inspection found57 Basic,28 Standard and10 Premium Reno listings. All95 have zero published business photos. Until the user chooses clearly labeled supplied illustrative images or actual business photos become available, photo areas show honest styled placeholders. Mock staff, vehicles, reviews, licenses, rankings, hours, prices and offers are not copied into live business claims. Unknown hours and absent reviews are expressed honestly. No service-area residential address is exposed in map links. Content tier never creates owner authority, inquiry eligibility or Sponsored placement.

## September verification and limits (historical)

166 application tests, TypeScript, lint, secrets and build are required before Preview update. Focused review closed: small-label contrast, stale gallery index guard, Standard tier visibility, historical Sparks claim shortcut, inquiry independence from content tier and Sponsored visibility across tiers.

Local rendered HTTP checks cover actual Basic/Standard/Premium examples, their tier marker, content sections, telephone actions, gallery presence, and Premium hero. The old regional-image hero is absent.

Fresh browser screenshot/interaction acceptance remains pending: the designated browser runtime fails its trusted dependency setup check. Do not describe source/HTTP checks as visual comparison or pixel-perfect acceptance. The pending imagery question is also not approval to invent business media.

Linear: CLE-105 ↔ CAT-78, coordinated through CLE-101 and CLE-115. The work remains on draft PR12 and Preview only; no production release, hosted migration, provider send or paid operation is part of this correction.
