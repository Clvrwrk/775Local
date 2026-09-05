# Reno pilot completion

Status: implementation in progress, 2026-09-04. Owner: Christopher Hussey. Execution: Codex.

## Accepted scope

The user directed: “shrink our scope to just Reno - then fix everything and complete all design updates” and “make sure everything gets documented via linear.” This supersedes Reno/Sparks launch breadth and any September bulk-expansion launch commitment. Reno is the active pilot market. Preserve existing Sparks records and historical URLs; do not delete or mislabel businesses. Restrict active discovery and new onboarding to Reno.

Complete the audited contact, navigation, design/accessibility, content-presentation, search, sitemap, claims, Studio, inquiry, integration and measurement work. Existing provider, production and external-effect gates remain release boundaries. Record evidence rather than equating local implementation with a live release.

Design authority: supplied `Design system build guidance 2` pack. Retain 775 Directory branding, warm paper, pine, gold primary actions, Summit Seal, Cormorant Garamond and Outfit. Correct contrast math. Preserve free Basic/Standard/Premium content tiers and separately paid Featured unless the user selects a pricing change. No demo business facts or unearned verification labels.

## Baseline

- GitHub main verified: `6fe4a60ec0a48c1e9a6f878f81a1283b9d42549c`.
- Isolated implementation checkout: `/Users/chussey/Documents/Codex/2026-09-04/pl/work/reno-pilot`.
- Branch: `codex/reno-pilot-completion`; canonical source repository: `https://github.com/Clvrwrk/775Local.git`.
- Recover relevant claim commit `29ebb0f` and plan/ADR commit `d7ffea6`, preserving current-main publication migrations and leaf routes.

## Execution and acceptance

- [x] Reconcile source, decisions and existing Linear accounting.
- [x] Reno discovery boundary, honest non-pilot historical pages, Reno copy and existing-listing claim entry.
- [x] Valid phone actions, early mobile contact, continuous navigation, reachable policies.
- [ ] Complete design-system application and truthful content/error/empty states.
- [x] Search category aliases, pagination, eligible dynamic sitemap.
- [ ] Claim evidence and operator decisions; listing-scoped permissions and Studio.
- [ ] Durable resident inquiry, verified recipient, delivery/reconciliation and outcome.
- [ ] Privacy-preserving product signals and operations/recovery evidence.
- [x] Unit, TypeScript, lint, secrets, production build and relevant browser verification.
- [ ] Isolated database and Preview identity/integration acceptance.
- [ ] Concrete production acceptance packet; approved release and live verification.

## Linear

Scope pointer: CLE-101. Public implementation: CLE-105 / CAT-78. Data: CLE-104. Claims/auth: CLE-106/107. Studio: CLE-108. Inquiries/integration: CLE-109/110. Measurement: CLE-113. Acceptance/recovery: CLE-114/115/116/117. Existing production security disposition: CAT-145 / CLE-118.

Each material slice gets a linked code/evidence receipt and an accurate issue update. Do not mark production acceptance or unresolved provider/identity gates Done from local checks.

## Implementation checkpoint — 2026-09-04

Implemented locally: Reno discovery, contact normalization/placement, navigation/policies, accessible muted text, gold primary actions, actual Account/Claim/Studio/review states, protected listing proposals with replay protection and stale-edit rejection, dynamic eligible sitemap, search aliases/pagination, private verified-recipient inquiry intake with consent, idempotency, database rate limit and restricted resident PII. Inquiry UI remains disabled unless all required environment configuration and a verified active recipient exist. API receipt means received, never delivered.

Local evidence currently: 165 Node tests; 22 Claim + 19 Studio + 20 inquiry pgTAP assertions, plus existing publication suites. TypeScript, lint and secret scan pass at checkpoint. Production build passes. Browser checks cover 390, 820 and 1440 px widths; 24-row pagination has no overlap; sitemap returns 121 URLs including 95 Reno business URLs and no Sparks city paths. Primary mobile call action is y=320.44 px. These are local preview observations, not live production acceptance. No hosted database migration, live inquiry, provider message, production deployment or paid operation has occurred.

Still open, not acceptance-complete: private proof upload/scan/retention and operator evidence display, invitations and participant management, new-listing self-service review, assigned inquiry queue/outcome UI and delivery/reconciliation worker, authenticated Preview flows, provider provisioning, measurements/recovery drills and production security disposition. Do not label this checkpoint as completed launch scope.

Inquiry dependencies: `LOCAL775_INQUIRIES_ENABLED`, `LOCAL775_PUBLIC_ORIGIN`, `TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY`, `INQUIRY_ABUSE_SECRET`, Supabase service/public credentials, and separately verified active recipients. Service credentials stay server-only. Defaults fail closed. Abuse digest is keyed email, not raw network address; challenge validation plus the per-email limit is a baseline, and edge/global abuse capacity must be established before activation. Turnstile server contract: https://developers.cloudflare.com/turnstile/get-started/server-side-validation/ . Dedicated GHL location/credential reference and live end-to-end acceptance remain pending.

## Review fixes

Standards review: all 3 findings closed (Operator PII read bypass, missing delegation scope, missing reversible revision history). Spec review: all 4 original findings and 1 retry-key edge case closed (proof acceptance, owner-qualified inquiries, loaded edit version, seven-day fingerprint and alias-key binding). Added regression tests. Scanner-dependent proof approval and Operator protected Lead reads fail closed while their full workflows remain incomplete. Inquiry acknowledgment persists each used key to the original receipt/payload.

Full database verification: 19 migrations; 143 assertions across five pgTAP suites. A syntax error introduced during the final inquiry edit was caught by the fresh-database run, rolled back, corrected and rerun successfully.

GTM remains not ready. Implementing a working public discovery experience and guarded workflow foundations does not complete proof processing, participant management, new-listing onboarding, delivery/outcomes or product measurement. These remain explicit Linear work, not assumed external-only blockers.

## Preview listing configuration correction — September 4, 2026

The pilot Preview branch had no environment variables: existing Preview settings belonged only to `codex/launch-foundation`; the public SUPABASE pair otherwise targeted Production only. Missing configuration previously returned an empty directory. Public listing/category reads now accept an atomic `DIRECTORY_SUPABASE_URL` / `DIRECTORY_SUPABASE_PUBLISHABLE_KEY` override and reject missing or partial configuration. The existing SUPABASE pair remains the default and the separate protected-command target.

The two DIRECTORY variables were added only to Preview branch `codex/reno-pilot-completion`, using anonymous access to the already-published public projections. No hosted rows, production settings, protected credentials, or inquiry activation changed. This is a public design review environment; authenticated workflow acceptance still requires isolated Preview configuration and data.

Regression coverage proves both public adapters select the read source without mixing credential pairs, protected commands retain their own target, and public-only configuration does not activate them. Deployment acceptance must prove listing links on the actual branch URL, search/category/detail pages, and the Reno sitemap count. CLE-105 and CAT-78 retain this correction with CLE-116/CLE-101.
