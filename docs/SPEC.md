# 775 Directory — Production Beta Specification

Status: Approved for implementation  
Owner: Christopher Hussey  
Project lead: Codex  
Target public beta: 2026-08-26  
Canonical product: `775Directory.com` — “Who actually shows up.”

## Current implementation scope — September 4, 2026

The user authorized a Reno-only pilot and completion of all audit/design fixes. `RENO-PILOT-COMPLETION.md` supersedes the historical Reno/Sparks launch geography and bulk-expansion deadline below. Existing records are preserved. Free content tiers, explicit authority, consent and release gates remain binding. ADR 0003 supersedes the older two-object GHL projection.

## Problem Statement

Residents in Reno and Sparks need a fast, trustworthy way to find a local Business that is active, reachable, and likely to respond. Existing directories often contain stale records, confusing ads, duplicate practitioners, national chains crowding out local operators, or unverifiable claims of ownership. A pageview or a large scraped corpus does not prove that the directory helps a resident or creates value for a merchant.

Local Businesses need an always-free, accurate Business Listing and a safe way for an authorized Business Owner or Agency Representative to Claim it, maintain approved content, receive qualified Leads, and optionally buy a scarce Featured placement. Payment must never create authority over a Listing, and sponsored placement must never corrupt organic ranking.

Local775 needs one operational system that can launch a credible 100-Listing Reno/Sparks seed, preserve data provenance, visibly demonstrate Basic, Standard, and Premium content tiers, prove Lead delivery and merchant response, and test willingness to pay for the separate $497 onboarding plus $297/month Featured founder offer. The product must integrate WorkOS, Supabase, GoHighLevel, Stripe, Vercel, Sentry, Linear, Google Maps Platform, and Cloudflare without creating conflicting systems of record or uncontrolled external effects.

## Solution

Build a mobile-first public directory and authenticated Studio on a single explicit authority model:

- Vercel hosts the TanStack Start application.
- WorkOS AuthKit owns authentication and sessions.
- Supabase is the sole application backend and source of truth for Business Listings, Claims, Listing Participation, Leads, media, entitlements, audit history, publication receipts, product events, and integration state.
- GoHighLevel owns CRM operations, email/SMS/phone delivery, call tracking, operational pipelines, and payment operations through its connected Stripe account.
- Signed provider events become durable Supabase inbox records; Supabase transactions write durable outbox records; idempotent workers deliver, retry, dead-letter, and reconcile provider projections.
- Google Places UI Kit displays live attributed Google ratings without storing Google rating content as canonical data or emitting it as Local775 review markup.
- Vercel Web Analytics provides aggregated traffic; Sentry provides redacted errors and sampled traces; Linear owns accountable delivery work.
- Cloudflare remains authoritative DNS while Vercel serves the DNS-only apex and `www` web records.

Launch with the top ten SERP results in each of the ten accepted seed categories. The 100 seed Listings target a 60% Basic, 30% Standard, and 10% Premium content-tier mix using approved enrichment evidence. Unclaimed and Unverified are visible labels, not exclusion states. Empty categories are absent from public navigation. The complete 20,436-row licensed workbook is imported into private immutable staging and normalized into private candidates; the 20,219 categorized company rows become the final cumulative directory round by the end of September 2026.

The principal proof is not traffic. It is qualified Leads delivered reliably, accepted and contacted by participating Businesses, followed by measurable outcomes and at least five paid Featured activations within 30 days.

## User Stories

1. As a Resident, I want the directory to load quickly on my phone, so that I can find help while I am away from a desktop.
2. As a Resident, I want to browse Reno or Sparks, so that results are relevant to where I need service.
3. As a Resident, I want to browse the ten curated launch categories, so that I do not need to understand the source taxonomy.
4. As a Resident, I want to search the complete mapped leaf taxonomy, so that specific service terms can still find an appropriate Business.
5. As a Resident, I want search synonyms to match common local language, so that vocabulary differences do not hide useful Businesses.
6. As a Resident, I want organic results to be independent of payment, so that I can trust their relevance.
7. As a Resident, I want Featured placements clearly labeled Sponsored, so that I can distinguish paid visibility from organic discovery.
8. As a Resident, I want no more than three Featured Listings per category and city, so that sponsored inventory stays scarce and useful.
9. As a Resident, I want eligible Featured Listings to rotate fairly, so that one sponsor does not monopolize visibility.
10. As a Resident, I want a Business Listing to show reviewed name, address or service area, phone, website, hours, categories, and current activity evidence, so that I can decide whether to contact it.
11. As a Resident, I want service-area Businesses to hide residential addresses, so that directory usefulness does not expose private homes.
12. As a Resident, I want “Information checked” to mean Local775 reviewed current NAP and activity, so that the label is understandable.
13. As a Resident, I want “Owner verified” to mean an approved Claim established authority, so that it is not confused with data freshness.
14. As a Resident, I want live Google ratings displayed with Google attribution, so that I understand their source and freshness.
15. As a Resident, I want Google ratings excluded from organic ranking, so that Local775 does not launder a third-party score into its own recommendation.
16. As a Resident, I want an unclaimed Listing to provide direct NAP actions and a Claim invitation but no Lead form, so that my request is not sent to an unverified recipient.
17. As a Resident, I want a claimed eligible Listing to offer a concise Lead form, so that I can ask for service without creating an account.
18. As a Resident, I want the Lead form to explain who will receive my request, so that service-contact consent is informed.
19. As a Resident, I want optional Local775 marketing consent separated from my service request, so that requesting help does not subscribe me to advertising.
20. As a Resident, I want to submit a valid contact method, service ZIP, request, and timing, so that the Business can respond effectively.
21. As a Resident, I want duplicate submissions handled safely, so that retries do not create multiple merchant opportunities.
22. As a Resident, I want a clear success receipt after submission, so that I know the request was accepted without being promised an unverified outcome.
23. As a Resident, I want delivery failures escalated to Local775, so that my Lead is not silently lost.
24. As a Resident, I want to request deletion of my Lead PII unless a documented legal or fraud hold applies, so that I retain meaningful privacy rights.
25. As a Resident, I want anonymized outcome evidence retained without my identity, so that product learning does not require indefinite personal-data retention.
26. As a caller, I want a Featured tracking call to disclose recording and ask for an explicit keypress, so that recording never begins silently.
27. As a caller, I want to continue unrecorded if I decline recording, so that consent is freely given.
28. As a caller, I want recording audio deleted after 90 days, so that sensitive conversations are not retained indefinitely.
29. As a Resident, I want keyboard, zoom, screen-reader, contrast, focus, target-size, and accessible-authentication support, so that the directory works with my access needs.
30. As a Resident, I want removed and merged Listing URLs to behave truthfully, so that stale search results do not redirect deceptively.
31. As a Business Owner, I want to begin a Claim from the correct Business Listing, so that identity is anchored to an existing record.
32. As a Business Owner, I want to authenticate with email magic code or Google, so that access is convenient without another password.
33. As a claimant, I want a read-only pending Studio, so that I can see Claim status and provide evidence before authority is approved.
34. As a claimant, I want domain email or listed-phone control to serve as strong evidence when available, so that legitimate Claims are efficient.
35. As a claimant, I want alternate evidence such as registration or an authorization letter to be reviewed manually, so that unusual but valid cases are supported.
36. As a claimant, I want sensitive Claim Proof private and deleted 30 days after decision, so that evidence is not retained longer than necessary.
37. As a claimant, I want the evidence type, hash, reviewer, timestamps, outcome, and receipt retained, so that the decision remains auditable after file deletion.
38. As a Business Owner, I want an approved Claim to create explicit, scoped, revocable Listing Participation, so that authority is not inferred from payment or authentication.
39. As a Business Owner, I want one identity to participate in multiple Business Listings, so that multi-location ownership is manageable.
40. As a Business Owner, I want each Business Listing to retain independent NAP, Claims, Leads, Featured entitlement, and tracking-number state, so that locations do not bleed into one another.
41. As a Business Owner, I want to designate verified Lead Recipients explicitly, so that requests go only to approved destinations.
42. As a Business Owner, I want the claimed-free Studio to manage core identity, About, hours, one logo, and three gallery images, so that the always-free Listing is genuinely useful.
43. As a Business Owner, I want low-risk content edits validated and published efficiently, so that ordinary maintenance does not become a bottleneck.
44. As a Business Owner, I want ownership, business name, address, phone, URL, primary category, and status changes reviewed, so that a compromised account cannot silently rewrite Listing identity.
45. As a Business Owner, I want every public revision reversible and auditable, so that mistakes can be corrected without losing history.
46. As a Business Owner, I want uploads validated and kept private until Operator approval, so that unsafe or accidental media never appears publicly.
47. As a Business Owner, I want deleted media quarantined for 30 days, so that accidental deletion can be recovered.
48. As a Featured Customer, I want up to 20 gallery images and one active Offer, so that Featured provides meaningful enhancement.
49. As a Featured Customer, I want a dedicated 775 tracking number, so that attributable calls can demonstrate value.
50. As a Featured Customer, I want a clear $497 onboarding plus $297/month founder offer, so that pricing is predictable.
51. As a Featured Customer, I want failed payment to create a seven-day grace period and then revert only the Featured entitlement, so that my always-free Listing remains published.
52. As a Business Owner, I want Lead statuses in Studio, so that I can record accepted, contacted, won, lost, or spam outcomes.
53. As a Lead Recipient, I want email and SMS notification through Local775 GoHighLevel, so that I can respond quickly.
54. As a Lead Recipient, I want delivery within one minute and visible failure state, so that operational reliability is measurable.
55. As a Lead Recipient, I want response reminders without outcome fabrication, so that follow-up improves while the record remains honest.
56. As a Business Owner, I want a separate explicit way to request consulting or marketing help, so that a Growth Lead is never inferred from a directory Claim or service Lead.
57. As an Agency Representative, I want a Business Owner to delegate specific Listings and permissions, so that I can help without becoming the owner.
58. As an Agency Representative, I want delegation to be optionally expiring and revocable, so that temporary engagements do not create permanent access.
59. As a privileged user, I want an email change to suspend Operator and Lead Recipient privileges until reapproval, so that inbox verification does not transfer authority automatically.
    59a. As a Business Owner, I want to delegate a Listing Manager with less authority than an Owner, so that staff can operate the Listing without gaining ownership or delegation rights.
    59b. As a Business Owner, I want each Business Listing limited to two active Business Owners, three Listing Managers, and three Agency Representatives, so that authority remains bounded and reviewable.
    59c. As a Listing Participant, I want Studio capabilities derived from my server-authorized role and scope, so that hidden interface controls never substitute for authorization.
60. As a Local775 Operator, I want access limited to one exact initial email allowlist, so that a company domain does not create broad administrative eligibility.
61. As a Local775 Operator, I want MFA required through the Local775 Operations authentication policy, so that privileged access uses a second factor.
62. As a Local775 Operator, I want a manual Operator Grant recorded separately from authentication, so that login never equals authorization.
63. As a Local775 Operator, I want sensitive actions to require reauthentication within 15 minutes, so that a stale session cannot publish or expose protected data.
64. As a Local775 Operator, I want no user impersonation capability, so that support does not bypass a Business Owner's normal authentication.
65. As a Local775 Operator, I want audited support views, so that I can diagnose problems without assuming another person's identity.
66. As a Local775 Operator, I want to review Listing candidates with source evidence and normalized differences, so that publication is deliberate.
67. As a Local775 Operator, I want deterministic category crosswalk results and ambiguity queues, so that taxonomy decisions are reproducible.
68. As a Local775 Operator, I want duplicate, branch, chain, practitioner, franchise, and service-area decisions recorded, so that launch diversity rules are reviewable.
69. As a Local775 Operator, I want to publish exactly five accepted Listings per category and city for launch, so that the 100-Listing corpus is balanced.
70. As a Local775 Operator, I want the remaining licensed rows kept in private staging, so that future coverage work does not expose unreviewed data.
71. As a Local775 Operator, I want a structured publication receipt for every Listing, so that source, checks, reviewer, outcome, before/after values, and rollback are provable.
72. As a Local775 Operator, I want monthly automated rechecks to create review work rather than overwrite public truth, so that automation cannot silently corrupt NAP.
73. As a Local775 Operator, I want GoHighLevel edits to enter Supabase as proposed changes, so that the CRM cannot become a second directory source of truth.
74. As a Local775 Operator, I want signed inbound webhooks deduplicated in a durable inbox, so that retries do not create duplicate Leads or entitlements.
75. As a Local775 Operator, I want domain transactions to write durable outbox events, so that provider outages cannot lose approved work.
76. As a Local775 Operator, I want retry, dead-letter, delivery-receipt, and reconciliation views, so that failed integrations become actionable work.
77. As a Local775 Operator, I want only Operators to access call audio, so that recipients receive necessary Lead data without sensitive recordings.
78. As a Local775 Operator, I want every call-audio playback audited, so that protected-media access is accountable.
79. As a Local775 Operator, I want errors redacted before they enter Sentry, so that observability does not export Lead, Claim, call, payment, or identity data.
80. As a Local775 Operator, I want production regressions and critical integration failures linked to grouped Linear issues, so that operational failures have accountable owners without duplicate noise.
81. As a Local775 Operator, I want daily launch-health, weekly value/quality, and monthly cohort reviews, so that alerts and product learning reinforce each other.
82. As a project owner, I want the app to launch only after a written acceptance packet and explicit approval, so that DNS and production effects are intentional.
83. As a project owner, I want Preview to have no real external effects by default, so that testing cannot message, call, charge, or modify real recipients accidentally.
84. As a project owner, I want secrets referenced from `CW_Master` and copied only into scoped provider stores, so that no repository or log contains secret values.
85. As a project owner, I want Vercel builds separated from database migrations, so that compilation can never mutate production.
86. As a project owner, I want `main` protected by pull requests and evidence gates, so that production history remains reviewable.
87. As a project owner, I want DNS-only Cloudflare records to point to Vercel while existing mail records remain preserved, so that web launch does not silently break email routing.
88. As a project owner, I want rapid Vercel rollback, DNS restoration, feature disablement, and forward-only database correction tested before launch, so that failure has bounded recovery.
89. As a project owner, I want production to become non-resettable after its first accepted migration or real Listing import, so that beta is treated as durable production.
90. As a project owner, I want a 30-day proof of five paid Featured activations, 25 qualified Leads, 95% delivery, and 60% one-business-day contact, so that scaling rests on evidence.

## Implementation Decisions

### Product boundary and domain model

- The public beta covers Reno and Sparks only. Spanish Springs, Lockwood, McCarran, and all other 775 places remain staged until separately accepted.
- Launch publishes up to 100 valid Business Listings across the ten accepted categories using the top-ten SERP contract and no result padding. National corporate branches and unbranded individual practitioners are excluded from the initial cohort. Independent Businesses and locally operated franchises are eligible.
- Basic, Standard, and Premium are free content-completeness tiers. Featured remains a separate paid and visibly Sponsored entitlement. Claim and information verification do not change content tier.
- An otherwise valid Listing is not hidden because it is unclaimed or only partially enriched. It appears as Basic/Unverified after the minimum identity, relevance, closure, duplicate, rights, and safety gates pass.
- Public category navigation and city/category navigation include only destinations with at least one visible Listing.
- A Business can have multiple Business Listings. A Business Listing represents one physical location or service-area operation and owns its own NAP, categories, Claims, Listing Participation, Leads, entitlement, and call-tracking state.
- Listing lifecycle is `draft → pending_review → published`, with reversible `suspended` and `archived` states. Publication is an explicit reviewed transition.
- Claim lifecycle records submission, evidence, review, decision, revocation, and audit receipt. An approved Claim may create or update Listing Participation; a rejected Claim never changes public ownership.
- Listing Participation records person, Listing, role, scope, authority basis, status, consent source, start, optional expiry, revocation, and external identifiers. Payment never creates Listing Participation.
- Each Business Listing permits at most two active Business Owners, three Listing Managers, and three Agency Representatives. Local775 Operators are separately granted and are not counted as Listing Participants.
- The Studio may display Local775 Operator as “Listing Admin,” but the canonical authorization role remains Local775 Operator. Capability decreases from Operator to Business Owner to Listing Manager to Agency Representative, and every command remains default-deny at the server and Row Level Security layers.
- Lead lifecycle is `submitted → queued → delivered → viewed → accepted → contacted → won | lost | spam`. Transitions are append-audited and idempotent.
- Featured entitlement is derived from immutable billing events and accepted commercial rules. It is not a mutable CRM boolean.
- Trust labels are independent: Information checked describes Local775 data review; Owner verified describes Claim authority.

### Data ownership and storage

- Supabase is the sole application source of truth. Convex is excluded from v1.
- Public API exposure is allowlisted through explicit views/functions. Raw ingestion, candidates, Claim Proof, private Business email, Lead PII, integration inbox/outbox, billing events, and audit tables are never exposed as unrestricted public tables.
- Row Level Security defaults to deny. Public anonymous access can read only published public projections. Authenticated access derives the WorkOS identity from verified JWT claims and joins through active Listing Participation or Operator Grant.
- Local775 Operations WorkOS organization membership proves the MFA policy only; Supabase Operator Grant remains authoritative for application permission.
- Production ingests the entire workbook into an immutable private raw schema with source batch and row receipts. Transformations create normalized candidates and explicit exclusion/review reasons. Only an accepted publication transition creates the public projection.
- Durable identifiers preserve workbook source IDs and Google Place ID. Google Place ID may be stored; live rating content is not cached as canonical data.
- Sensitive Claim Proof files are private and deleted 30 days after decision. File hash and decision metadata remain.
- Lead PII is deletable on request absent hold. Anonymized outcome events remain indefinitely. Call audio stays in GoHighLevel for 90 days and is not copied into Supabase or Sentry.
- Media originals remain private. Approved derivatives become publicly addressable. Deletion first moves an object into 30-day quarantine. Encrypted external export is required before real owner media is enabled; the destination is a retained implementation checkpoint.

### Application and API contract

- TanStack Start provides server-rendered public pages and server-only command/query handlers. No privileged provider key reaches the browser.
- The primary application test seam is the public/authenticated HTTP command-query boundary against an isolated Supabase database. Handlers validate input, authorize the actor, invoke one use case, commit domain changes plus outbox/audit records atomically, and return stable error codes.
- Commands accept idempotency keys for Lead submission, Claim actions, provider callbacks, billing effects, publication, and other retryable mutations.
- External responses never expose whether a private email, Claim Proof, Lead, or participation record exists beyond the caller's authorization.
- Business email is private. Public contact actions use the reviewed phone/website or the Lead workflow.
- Sensitive Operator commands require an active Operator Grant, allowlist match, WorkOS MFA policy, and `auth_time` within 15 minutes.

### Authentication and authorization

- WorkOS AuthKit supports email magic code and Google only. Business Owners and Agency Representatives enter through Claim or invitation. Operators are invitation-only. Residents do not authenticate.
- Standard hosted AuthKit is used; no paid custom domain, enterprise SSO, or Directory Sync is enabled.
- One Local775 WorkOS application has staging and production environments. Maximum session is seven days, inactivity timeout 24 hours, access token duration five minutes.
- The initial Operator allowlist contains only `chussey@aia4.io`. Operator authority requires a separately recorded manual grant.
- User impersonation is disabled.

### Provider integrations

- Supabase Edge Functions and scheduled jobs execute integration adapters. Provider behavior is behind a narrow adapter seam so tests can use deterministic fakes without real effects.
- A durable transactional outbox owns outbound work. A durable inbox records raw signed provider events before processing. Both enforce unique provider/event/idempotency keys.
- GoHighLevel uses a dedicated Local775 location. Contact projects Person; Directory Listing custom object projects Business Listing; Listing Participation custom object projects the relationship; Opportunities represent Leads and Growth Leads.
- Supabase-to-GoHighLevel projection is authoritative. GoHighLevel Listing edits become proposed changes requiring validation/review in Supabase.
- Lead delivery persists first, projects to GoHighLevel, notifies verified Lead Recipients by email/SMS, records receipts, retries failures, dead-letters exhausted work, and escalates to Operators.
- Stripe connected through GoHighLevel processes payment. Signed transaction events enter the inbox and append billing events; Supabase computes entitlement.
- Preview uses provider staging/test modes or deterministic sinks. Real external tests are individually approved and receipt-bearing.
- Featured tracking numbers are dedicated per Listing. Recording requires explicit keypress consent or continues unrecorded. No transcription or Voice AI.

### Public discovery, SEO, and ratings

- Canonical paths are `/nv/{city}`, `/nv/{city}/{category}`, and `/business/{slug}-{stable-id}`. Historical slugs permanently redirect and are never recycled.
- Indexable launch pages are intentionally allowlisted. Search, auth, Claim, Studio, account, preview/staging, pending, suspended, and internal pages are noindex.
- City/category pages require at least three active reviewed Listings and unique useful context. Leaf pages require five active reviewed Listings and non-template value before indexing.
- Structured data includes truthful Local775 Organization/WebSite, BreadcrumbList, and the most specific supported LocalBusiness subtype. Service-area Listings never expose a residential address.
- Google Places UI Kit renders live rating/count with included attribution. Google rating content is display-only, absent from organic rank and Review/AggregateRating JSON-LD.
- Sitemap includes canonical indexable published URLs only. `lastmod` changes only for significant public content, link, or structured-data updates.
- Featured placement is visibly Sponsored. Paid outbound links use sponsored relation metadata; ordinary organic citations do not.
- Duplicate/merged Listing returns 301 to survivor; permanent removal returns 410; temporary suspension returns a non-indexable 404-style response.

### Observability, analytics, and privacy

- Vercel Web Analytics is enabled under the approved $5/month ceiling. Sensitive or identifying values never enter paths, query strings, or custom events.
- Sentry uses one Local775 project with preview/production tags. Session Replay, attachments, logs, profiling, user email/name/IP, raw URLs/query strings, Lead/Claim/call/payment content, and default Supabase body/query instrumentation are disabled.
- Sanitized tracing samples 100% in preview and 5% in production. Source maps upload through scoped CI credentials and are removed from public artifacts.
- Linear receives grouped actionable production regressions, repeated failures, and critical auth/Claim/Lead/payment/integration issues. Preview routes only acceptance blockers.
- Supabase owns pseudonymous product/outcome events. Scheduled reconciliation compares Supabase, GoHighLevel, Stripe, call, and delivery evidence.

### Security and operational controls

- Secrets live in `CW_Master`; runtime copies are environment-specific and least-privilege. No secret value appears in Git, documentation, logs, issue descriptions, or command output.
- File uploads are validated for accepted type, size, dimensions, and safe decoding, stored under generated keys, kept private, scanned/re-encoded where appropriate, and manually reviewed before publication.
- Webhooks require provider-specific signature verification, timestamp tolerance, replay protection, and raw-body handling.
- Audit events are append-only from the application role and contain actor, action, target, reason, before/after reference, request/correlation IDs, and time.
- Sentry redaction and telemetry tests fail closed when an unknown sensitive field appears.
- Dependency, static analysis, secret scanning, security headers, authorization, RLS, upload, and webhook tests block merge.

### Deployment and recovery

- Node 24 and npm lockfile are authoritative. CI uses deterministic install.
- Application build never mutates a database. Migration replay and production promotion are separate gated jobs.
- The persistent Supabase Preview Branch is the integration environment. It may contain the licensed workbook and synthetic identities/Claims/Leads/payments/calls, never real Resident PII or Claim Proof.
- Production becomes non-resettable after the first accepted migration or real Listing import. Corrections are forward-only.
- `codex/launch-foundation` feeds Vercel Preview. `main` is production and remains protected. Merge occurs only after the Production Acceptance Packet is explicitly approved.
- Cloudflare remains authoritative. Launch attaches `775directory.com` and `www.775directory.com` to Vercel, uses DNS-only web records, redirects `www` to apex, preserves unrelated MX/SPF, and reserves `mail.775directory.com` for GoHighLevel.
- Recovery includes seven-day Supabase daily backups, logical export before risky changes, media export, prior Vercel deployment, DNS snapshot, feature disablement, and tested runbooks.

### Acceptance and business proof

- The Production Acceptance Packet covers data, security, integrations, performance, accessibility, rollback, DNS, provider readiness, and outstanding human checkpoints.
- Mobile is primary. Critical paths cover mobile and desktop Chromium and smoke coverage in Firefox/WebKit.
- Target WCAG 2.2 AA, LCP ≤2.5s, INP ≤200ms, CLS ≤0.1, and Lighthouse scores above 90 on the accepted critical mobile page set.
- Thirty-day proof by 2026-09-25: five paid Featured activations including three directory-only cash payers, 25 qualified Leads, 95% delivery, and 60% contacted within one business day.

## Testing Decisions

- Tests assert externally observable behavior, permissions, receipts, durable state transitions, and provider contracts. They do not assert internal function layout or incidental query shape.
- The primary seam is the HTTP command/query boundary against an isolated Supabase database. This single seam proves validation, authentication mapping, authorization, RLS, persistence, audit, state transitions, and outbox creation together.
- Provider adapters form the necessary secondary seam. Contract tests use deterministic fakes and signed fixtures to prove request mapping, idempotency, retry, receipts, inbox/outbox handling, redaction, and failure escalation without real external effects.
- Browser tests exercise the highest-value journeys on mobile first: browse/search/filter, Listing detail, Claim/auth/status, Operator review, owner edits/media, Lead delivery/failure, Featured display, privacy deletion, and rollback-visible states.
- Migration tests recreate an empty database, apply every migration, seed synthetic fixtures, run RLS positive/negative matrices, and verify a forward corrective migration path.
- Import tests use representative workbook fixtures for closed status, missing fields, duplicate title/address, multi-location, franchise, practitioner, service-area, fringe geography, ambiguous category, and deterministic rerun behavior.
- Security tests prove anonymous denial, cross-Listing denial, revoked/expired participation denial, stale Operator reauthentication denial, webhook forgery/replay denial, path/media rejection, secret absence, and telemetry redaction.
- Accessibility testing combines automated rules with keyboard, focus, zoom, screen-reader, contrast, target size, error messaging, and accessible authentication checks.
- Performance tests use the production build and accepted mobile profiles; they verify Core Web Vitals/Lighthouse thresholds and explicit JavaScript/image budgets.
- Existing Node tests provide prior art for isolated deterministic helper behavior, and the existing browser smoke runner provides prior art for rendering/console checks. Inherited Grok-specific assertions are removed or replaced when they no longer represent Local775 behavior.
- TDD sequence for each ticket: write a failing behavior test at the agreed seam, implement the smallest coherent slice, run the focused test and typecheck, then run the full required suite at integration boundaries.

## Out of Scope

- Self-service Featured checkout, automated subscription management UI, prorations, refunds, and complex plan changes.
- Physical Direct Mail fulfillment and paid Virtual Mail campaigns.
- Convex.
- Resident accounts or saved favorites.
- Public Local775 first-party reviews or rating collection.
- Paid Google reviews/photos/maps/geocoding, Google Ads, or unrelated Maps APIs.
- WorkOS custom auth domain, enterprise SSO, Directory Sync, or Business organization mirroring.
- GoHighLevel transcription, Voice AI, or automated call-content analysis.
- Business Owner access to recorded call audio.
- National corporate branches in the launch 100.
- Public fringe-geography Listings outside Reno and Sparks.
- Paid Sentry upgrade, Sentry Session Replay, Vercel Speed Insights, Supabase PITR, or unapproved provider overages.
- Automatic production deployment, DNS mutation, real provider messaging/calls/charges, or external campaign sends without their retained approval gates.

## Further Notes

- The licensed source workbook contains 20,436 rows across seven ZIP worksheets. It is a source corpus, not a publication list.
- The existing repository is an inherited demo with synthetic data, Better Auth/Postgres coupling, Grok-specific build behaviors, and a build-time database migration. Implementation must remove these inherited authority assumptions before the first launch-candidate build.
- The production Supabase project is `local775-production`; the persistent integration branch is `local775-preview`. The reviewed schema and licensed source corpus are proven in Preview only. Production remains schema-less and data-less until the retained production-apply gate is explicitly approved.
- The existing Vercel project is adopted rather than duplicated. It is not yet live on the canonical domain.
- Search Console, Bing, WorkOS, dedicated GoHighLevel, Google Maps credentials, Sentry connection, real provider tests, DNS launch, and production deployment retain operational checkpoints described in the acceptance packet.
- Default future reversible choices use the recommendation recorded in the project decision log. Retained human gates remain binding.
