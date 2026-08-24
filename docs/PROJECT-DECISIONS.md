# 775 Directory — Project decisions

This log captures settled project-level decisions that guide planning but do not independently justify an architectural decision record.

## 2026-08-24 — Grill round 1

- **First proof:** Demonstrate attributable merchant value and willingness to pay.
- **Operational geography:** Reno and Sparks.
- **Category breadth:** Broad-category launch rather than a narrow service wedge.
- **Initial release boundary:** Production authentication, trustworthy Claims, accurate Business Listings, Leads, call tracking, and manually activated Featured. Self-service checkout and real Direct Mail remain follow-on work.
- **Commercial model:** Every Business Listing is always free. The first Featured cohort is a paid concierge pilot using manual invoicing and authorized activation. The directory also generates opportunities for the owner's consulting and marketing company.
- **Deadline:** Live by Wednesday, 2026-08-26.
- **Provider and spending authority:** Approve providers one at a time; no aggregate spending envelope has been granted.
- **Decision rights:** Christopher Hussey retains approval for production, spending, external sends, financial effects, security, privacy/legal decisions, and irreversible architecture. Codex leads execution within those boundaries.
- **Repository authority:** GitHub is the canonical source and `/Volumes/M1 Application SSD/Projects/Local775` is the canonical local checkout. Inherited Grok-only rules are to be removed and replaced with project-specific instructions. See [ADR 0001](./adr/0001-local-project-authority.md).
- **Featured buyer:** A Business Owner or explicitly authorized agency may pay for Featured. Payment alone does not grant authority over a Business Listing.

## Seed evidence — superseded by 2026-08-24 re-audit

The earlier 14,989-row count described the four Reno worksheets before the workbook received the three Sparks ZIP datasets. See the re-audit after grill round 10 for the current authoritative counts and quality findings.

## 2026-08-24 — Grill round 2

- **Meaning of live:** A public production beta on `775Directory.com`.
- **Wednesday data boundary:** Launch with the curated Reno/Sparks Business Listings across the existing product categories. Keep the bulk workbook out of production pending rights, normalization, deduplication, and QA. Christopher Hussey will add source data for three Sparks ZIP codes.
- **Lead ownership:** A resident's Lead is associated with a Business Listing and delivered to the Business Owner. The delivery path runs through the Local775 GoHighLevel account and a listing-assignment link. A separate explicit growth-review action creates a Growth Lead for the consulting and marketing company.
- **Featured founder offer:** $497 onboarding plus $297 per month. Featured is included or credited for qualifying consulting clients.
- **New free listings:** A missing Business may submit a listing request, but publication requires manual NAP and legitimacy review.

## Open technical-model questions

The exact meaning and lifecycle of the GoHighLevel listing-assignment link, the CRM tenancy and pipeline model, contact ownership, resident consent, notification channels, missed-lead behavior, consulting handoff, phone-number routing, audit events, and source-of-truth boundaries remain unresolved.

## Evidence discovered after round 2

- The available live GoHighLevel connector is authenticated to the **Homeworks Advantage** location, not a Local775 location. It must not be reused or modified for this project.
- No Local775 GoHighLevel location identifier, pipeline, workflow, custom fields, listing-assignment mechanism, webhook, phone inventory, or credential names exist in the repository or supplied Dropbox folder.
- The current quote form writes Leads only to the project database. There is no CRM delivery, retry, notification, assignment, consent record, or delivery receipt.
- The current add-business flow publishes immediately with a verified flag, which conflicts with the accepted manual-review decision.
- WorkOS, call tracking, payments, product analytics, and production DNS are not yet confirmed configured. Supabase Storage is the accepted v1 media store but no Local775 Supabase project currently exists.
- At that earlier check, no Sparks seed worksheets were present. This evidence was superseded when the workbook was updated and re-audited after grill round 10.

## 2026-08-24 — Grill round 3

- **CRM tenancy:** Create a new dedicated Local775 GoHighLevel location.
- **Proposed data platform:** Supabase, Convex, Vercel, and GoHighLevel. The exact system-of-record boundaries are not yet accepted.
- **GoHighLevel directory model:** A GoHighLevel custom-object association is intended to connect a directory participant to multiple Business Listings so participation can support future marketing outreach.
- **Business Owner interface:** Business Owners use Studio, not a GoHighLevel login. Studio manages logos, images, Offers, Leads, the Business description, and other owner-controlled listing content.
- **Communications and payments:** GoHighLevel should combine CRM, pipelines, email, SMS, phone, appointments, and payment operations through its connected Stripe account, while the directory application retains its own identity and product controls.
- **Lead delivery:** Persist the Lead, mirror it into GoHighLevel, notify the assigned Business Owner by email and SMS, record delivery, and escalate failures to Local775 operations.
- **Consent:** Consent to contact about a requested service is required and separate from optional Local775 marketing consent.
- **Phone model:** A Featured Business Listing receives a dedicated 775 tracking number; a free Business Listing displays its ordinary NAP phone.

## Architecture conflict to resolve

Calling Supabase the directory source of truth while allowing a GoHighLevel custom object to feed and overwrite the same directory records would create shared ownership and bidirectional conflict. Convex also overlaps with Supabase database, realtime, storage, function, and workflow capabilities. The next round must give each platform one explicit responsibility and prohibit unowned dual writes.

## 2026-08-24 — Grill round 4

- **Application backend:** Supabase is the sole application backend and directory source of truth. Convex has no v1 responsibility.
- **Platform ownership:** Vercel hosts the web application; WorkOS owns authentication; Supabase owns directory and portal state, media, authorization data, entitlements, audit history, and integration state; GoHighLevel owns CRM operations and communications; Stripe connected through GoHighLevel processes payments.
- **People and roles:** Do not use “Directory User” as a domain role. A person may explicitly participate as a Resident, Business Owner, Agency Representative, or Local775 Operator.
- **Listing relationship:** A canonical Listing Participation records a person's role, authority, status, consent source, lifecycle, and external identifiers. It is projected into GoHighLevel using custom-object associations.
- **GoHighLevel listing changes:** A GoHighLevel edit creates a proposed change in Supabase. Validation and manual review determine whether it becomes public directory truth.
- **Payments and entitlements:** GoHighLevel and Stripe prove the financial transaction. Signed provider events become immutable billing events in Supabase, and Supabase decides the resulting Featured entitlement.
- **Marketing permission:** Marketing Consent is explicit, timestamped, channel-specific, and independent from Listing Participation or service-request consent.

## Evidence discovered after round 4

- The existing Vercel Pro team **Cleverwork Dev World** already contains project `reno-local-directory` (`prj_ZkcD7I7A6TDYLJ7Z4UAG2hfNoEth`) linked to `Clvrwrk/775Local`.
- Its sole production-target deployment is READY at repository commit `2b40a96ad6716a8ad63bc043f1ce172f36feebe5`, but Vercel reports the project as not live and only lists `vercel.app` domains. `775Directory.com` is not attached.
- This project should be adopted and configured rather than duplicating it. Renaming it is optional and should not block Wednesday's launch.
- No connected WorkOS inventory capability is available in this workspace, so an existing Local775 WorkOS environment cannot yet be confirmed.

## 2026-08-24 — Grill round 5

- **Integration execution:** Supabase Edge Functions execute provider integrations. Database transactions write durable outbox events; inbound provider events enter a durable inbox before domain processing. Vercel remains the web runtime rather than the integration authority.
- **Authentication:** WorkOS AuthKit owns end-user authentication. Supabase accepts WorkOS-issued identity through its supported third-party authentication integration and enforces application authorization with Row Level Security.
- **GoHighLevel projection model:** A Contact projects a Person; a Directory Listing custom object projects a Business Listing; and a Listing Participation custom object links the Contact and Listing while carrying role, authority, status, and lifecycle. Opportunities represent Leads and Growth Leads, not listings.
- **Synchronization reliability:** Provider synchronization requires signed inbound webhooks, idempotency, deduplication, retries, dead-letter visibility, delivery receipts, and scheduled reconciliation. A provider outage must not lose a Lead or create duplicate Opportunities or entitlements.
- **Supabase placement:** Use the existing `Cleverwork` Supabase organization (`vgkhqxkqkmpbpiwwxtec`) in `us-west-1`, subject to separate confirmation of the provider's quoted project cost.

## Provider approval evidence

- Supabase quoted **$10 per month** on 2026-08-24 for a new project in the selected Cleverwork organization. Christopher Hussey explicitly approved that recurring charge in grill answer Q35; project creation is authorized.
- Supabase project `local775-production` (`hcfryjrajqftcnnbnybj`) was created in Cleverwork's `us-west-1` region on 2026-08-24. Its PostgreSQL 17 infrastructure reached `ACTIVE_HEALTHY`; no schema or production data has been applied yet.

## Provider research after round 7

- Official WorkOS pricing currently lists AuthKit as free for up to one million monthly active users. A production environment still requires billing information even when AuthKit usage remains within the free allowance.
- Paid WorkOS features are outside the present approval: a custom AuthKit domain is listed at $99 per month, and production enterprise SSO or Directory Sync connections can incur per-connection charges.
- No WorkOS account or Local775 environment has been confirmed through a connected tool. Provisioning requires the next explicit provider decision and, if necessary, an interactive account sign-in.

## 2026-08-24 — Grill round 8

- **WorkOS approval:** Provision standard hosted WorkOS AuthKit staging and production environments for Local775. AuthKit's currently free allowance is accepted, but no paid custom domain, enterprise SSO connection, Directory Sync connection, or other paid WorkOS feature is approved. Christopher Hussey retains production billing-information entry.
- **Identity-only boundary:** WorkOS owns people and authentication only. Do not mirror Businesses or Business Listings into WorkOS Organizations in v1; Supabase owns those relationships and permissions.
- **Launch login methods:** Enable email magic code and Google authentication only.
- **Pending Claim access:** An authenticated claimant may enter Studio in a read-only pending state to view Claim status and submit evidence. Public Listing edits require approved authority.
- **Lead lifecycle:** Supabase owns `submitted` → `queued` → `delivered` → `viewed` → `accepted` → `contacted` → `won` / `lost` / `spam`, while GoHighLevel mirrors the operational stages.
- **Recorded Featured calls:** Featured tracking calls are intended to be recorded through GoHighLevel. Recording may activate only with an approved disclosure/consent configuration and retention policy.

## Call-recording evidence after round 8

- HighLevel's current phone-number configuration supports both automatic call recording and a `Play Call Recording Message` control.
- Nevada interception law is nuanced; California Penal Code §632 expressly addresses recording confidential communications without all-party consent. Because callers may be in California or another all-party jurisdiction, Local775 will use an all-party disclosure standard rather than infer legality from the tracking number or presumed caller location.
- No Featured call recording may begin before the announcement, caller-decline behavior, access controls, deletion/retention period, privacy notice, and Business recipient obligations are accepted and implemented.

## 2026-08-24 — Grill round 9

- **Recording consent:** Before recording begins, the caller must make an explicit keypress choice: consent to recording or continue the call unrecorded. Declining recording must not prevent service or Lead delivery. Store the consent outcome with call metadata.
- **Audio retention:** Delete call audio after 90 days. Retain non-audio attribution, delivery, and outcome metadata under the separately approved Lead-retention policy.
- **Audio access:** Only authorized Local775 Operators may access recorded-call audio. Business Owners, Agency Representatives, and Lead Recipients receive the Lead and necessary call metadata but not the recording. Every playback or retrieval is audit logged.
- **Transcription:** Paid call transcription is disabled in v1.
- **Founder cohort:** Limit the initial Featured founder cohort to ten Businesses, still subject to the three-per-category-and-city inventory limit.
- **GoHighLevel approval:** Create a dedicated Local775 GoHighLevel location. A provider-specific ceiling of **$50 per month** is approved for LC Phone numbers, recording, initial voice usage, and basic Lead notifications, plus up to **$24 one time** for A2P registration. Transcription, Voice AI, and unrelated add-ons are excluded.

## Provisioning evidence after round 9

- The connected GoHighLevel API exposes no agency-level create-location capability and remains authorized to the unrelated Homeworks Advantage location. No Homeworks Advantage data or configuration may be used or modified.
- The local browser-control runtime failed before reaching either provider dashboard. WorkOS and GoHighLevel provisioning therefore require a later interactive dashboard checkpoint; the failure does not change the accepted architecture or spending limits.

## 2026-08-24 — Grill round 10

- **Seed rights attestation:** Christopher Hussey states that the supplied seed workbook is owned or licensed for public directory use. Preserve that attestation and source metadata with import receipts.
- **Sparks source correction:** The authoritative workbook now contains all three requested Sparks ZIP datasets; no manual web-curation fallback is needed solely because of missing ZIP coverage.
- **Claimed-free capability:** A claimed free Business Listing receives core Studio access, Business identity, About, hours, logo, a limited gallery, email delivery of web-form Leads, and basic Lead status. It does not receive a tracking number, recorded calls, an active Offer, enhanced analytics, or Featured placement.
- **Unclaimed behavior:** An unclaimed Business Listing shows verified NAP actions and a Claim call to action but no Lead form.
- **Media limits:** A claimed free Listing may publish one logo and three gallery images. A Featured Listing may publish one logo and twenty gallery images.
- **Offers:** A Featured Listing may publish one active Offer. Free Listings do not publish Offers in v1.
- **Resident Lead retention:** Christopher Hussey selected indefinite retention of identifiable Resident Lead data. This is a privacy-significant exception to the recommended 12-month minimization policy and remains open for controls governing purpose, access, deletion requests, security, and documented legal basis.
- **Audit history:** Listing revisions, Claims, Listing Participation, authority changes, moderation, and rollbacks remain durably auditable. Sensitive evidence files may use a separately approved shorter retention period.

## Seed workbook re-audit after round 10

The authoritative workbook was modified at 2026-08-24 16:09:08 UTC and re-audited directly from its seven raw ZIP worksheets:

- **20,436 raw rows:** 14,989 in Reno ZIP worksheets and 5,447 in Sparks ZIP worksheets.
- **ZIP coverage:** Reno 89502 (6,762), 89509 (2,786), 89511 (3,227), 89521 (2,214); Sparks-area 89431 (3,265), 89434 (1,030), 89436 (1,152).
- **City labels inside Sparks ZIPs:** Sparks 5,383; Spanish Springs 21; Lockwood 13; McCarran 30. Geography normalization must not silently relabel these 64 fringe rows.
- **Taxonomy:** 21 nonblank groups and 1,790 nonblank primary categories. Every used primary category appears in the Category Map and no category-to-group mismatch was found.
- **Status quality:** 1,709 rows are `closed_forever`, 454 are `temporarily_closed`, 6,007 lack work-time status, 217 lack both category and group, 1,699 lack a primary phone, 6,216 lack a domain/URL, and 6,736 lack rating fields.
- **Identity duplication:** `cid`, `place_id`, and `feature_id` are unique across all 20,436 raw rows. Exact normalized title-and-address comparison still finds five duplicate keys covering six extra rows, and practitioner/branch/entity modeling remains necessary.
- **Screening cut:** 8,651 rows have a category, are not `closed_forever`, have a 775 primary phone, domain, and rating. This is a screening pool—not a verified or publication-ready count.
- **Derived sheets:** `All Businesses` contains 20,219 rows, exactly excluding the 217 raw rows with no category/group. The pivot and category map include all seven ZIP datasets.

The current workbook resolves the missing-Sparks-coverage blocker but does not relax the accepted Wednesday gate: public records still require normalization, legitimacy/active-business checks, source receipt, and review receipt.

## 2026-08-24 — Grill round 11

- **Resident deletion:** Residents may request deletion of their Lead PII unless a documented legal or fraud hold applies. Anonymized Lead events and outcomes may remain indefinitely for merchant-value analytics.
- **Claim Proof retention:** Delete sensitive Claim Proof files 30 days after the Claim decision. Retain the evidence type, file hash, reviewer, timestamps, result, and audit receipt.
- **Import architecture:** Load the workbook into immutable raw-source staging, transform it into normalized Listing candidates, and publish only reviewed candidates. Direct raw-to-public import is prohibited.
- **Wednesday corpus:** Target 100 reviewed Business Listings: five per launch category in Reno and five per launch category in Sparks.
- **Public taxonomy:** Use curated top-level navigation while retaining the workbook's 1,790 mapped leaf categories for search, matching, and future taxonomy work.
- **Fringe geography:** Retain Spanish Springs, Lockwood, and McCarran rows in staging but exclude them from the Reno/Sparks launch. Do not silently relabel them.
- **Ratings:** Publicly display third-party ratings and review counts only with source attribution and a freshness timestamp. The source-specific compliance and live-refresh mechanism are part of the implementation contract.

The ten accepted launch categories currently defined by the product are Screen Repair, HVAC, Plumbing, Electrical, Auto Repair, Restaurants, Dentists, Handyman, Roofing, and Veterinarians.

## Google Maps content evidence after round 11

- The workbook's ratings and review counts identify Google Business/Maps as their source. Static workbook snapshots must not be presented as Local775-authored ratings.
- Current Google Maps Platform policy requires Google Maps attribution and clear visual separation when Google Maps content is displayed outside a Google map. Applications must also provide the required public terms and privacy references.
- Google permits indefinite storage of Place IDs, while caching/storage of broader Places content is restricted. The v1 design should keep `place_id` as the durable reference and retrieve compliant public rating content through an approved Google Maps Platform display path rather than making workbook rating snapshots canonical.
- `rating` and `userRatingCount` currently trigger the Place Details Enterprise SKU. The official price list provides 1,000 free monthly requests and then lists $20 per 1,000 requests at the first paid tier. Google Maps Platform billing and a provider-specific spend limit are not yet approved.

## 2026-08-24 — Grill round 12

- **Rating rendering:** Render live Google ratings with the Places UI Kit rating element and its included attribution. Do not make workbook rating snapshots or fetched Google Maps content canonical Supabase data; retain only the durable Place ID and permitted Local775 display telemetry.
- **Google Maps Platform approval:** Google Maps Platform Places functionality is approved with a provider-specific ceiling of **$25 per month**. Restrict keys by application/domain and API, configure quotas and billing alerts, and do not enable reviews, photos, maps, geocoding, or unrelated Google APIs without later approval.
- **Organic ranking:** Google ratings are display-only and do not influence organic Local775 ranking. Organic ranking uses Local775-controlled evidence such as location/category relevance, publication status, verified authority, completeness, freshness, and response reliability.
- **Launch selection:** Select the 100 launch Listings using a deterministic quality screen followed by operator review for five Listings per category and city. Avoid duplicate branches, chains, or practitioner records crowding out local Business diversity.
- **Active-Business verification:** Require an active first-party website on a Business-controlled domain, a working Business phone, and a domain-based Business email address; Gmail, Outlook, and other consumer mailbox domains do not satisfy the email evidence. Corroborate with an active/verified Google Business Profile.
- **Publication receipt:** Every published Listing requires a structured receipt containing candidate and Listing IDs, source URLs/timestamps, NAP/category/active-status checks, duplicate/branch/practitioner decision, reviewer/timestamp/outcome/reason codes, before/after values, and rollback reference.
- **Freshness:** Run monthly automated rechecks and event-driven review from owner/operator submissions. Source changes and possible closures create review work; automation does not overwrite canonical public NAP or status.

## Google Maps provisioning evidence after round 12

- No Google Cloud or Maps Platform connector is available in the workspace.
- The installed Google Cloud CLI identifies `chussey@aia4.io` as the active account, but its token requires interactive reauthentication before project inventory or configuration can be verified.
- No Google Cloud project, API, credential, billing attachment, quota, or charge was created. Provisioning remains an interactive checkpoint under the approved $25 monthly ceiling.

## 2026-08-24 — Grill round 13

- **Category crosswalk:** Maintain a deterministic, versioned crosswalk from the workbook's leaf categories to the ten public launch categories. Each candidate receives one reviewed primary launch category and may retain multiple searchable leaf tags. Ambiguous or unmapped candidates stay pending.
- **Launch-business eligibility:** Prioritize independent Businesses and locally operated franchises. Exclude national corporate branches from the initial 100 while preserving them in staging for later policy decisions.
- **Practitioners:** Exclude individual practitioner records unless the person operates an independently branded practice that qualifies as a Business. Do not publish every doctor, realtor, stylist, or agent as a separate Business Listing.
- **Service-area Businesses:** A verified service-area Business may publish without exposing a street address. Show its approved service area and require the same first-party website, working phone, domain email, and active-profile evidence.
- **Business email privacy:** Domain-based Business email supports verification and Lead delivery but is private by default and is not scraped into public Listing pages.
- **Trust labels:** `Information checked` means Local775 reviewed current NAP and active-business evidence. `Owner verified` means an approved Claim established authority. A Listing may carry either, both, or neither.
- **Google profile meaning:** An active Google Business Profile corroborates current Business activity only. It does not prove Local775 Claim authority or create Featured eligibility.

## 2026-08-24 — Grill round 14

- **Product analytics:** Enable Vercel Web Analytics with a provider-specific ceiling of **$5 per month**. Do not place Resident PII, Lead content, Claim Proof, call data, Business email addresses, or other sensitive values in page paths, query strings, custom events, or analytics metadata.
- **Performance monitoring:** Do not buy Vercel Speed Insights for v1. Use build checks and approved external performance tests for the Wednesday acceptance packet.
- **Application error monitoring:** Add Sentry and connect accountable follow-up to Linear. Provider cost, environment scope, redaction, alert thresholds, and issue-routing behavior require the next provider-specific decision before provisioning.
- **Outbound messages:** WorkOS sends authentication messages. The dedicated Local775 GoHighLevel location sends product email and SMS, subject to the accepted consent and provider boundaries.
- **Media moderation:** Validate file type, size, dimensions, and basic safety properties at upload, then require Local775 Operator review before publication. Owner media remains private until approved.
- **DNS authority correction:** All four Local775/775 Directory domains are now managed through Cloudflare. The `CW_Master` 1Password vault contains per-domain API credentials. Secret material must be injected by reference and must never be written into repository files, logs, planning documents, or command output.
- **Outbound-mail subdomain:** Reserve `mail.775directory.com` for GoHighLevel product email configuration. Continue using standard WorkOS-hosted authentication messages; no paid WorkOS custom auth domain is approved.
- **Operator access:** Local775 Operator access requires an explicit email allowlist and mandatory multi-factor authentication in addition to the ordinary WorkOS login policy.
- **Production gate:** Prepare a written acceptance packet covering data, security, integrations, performance, accessibility, rollback, DNS, and provider readiness. Christopher Hussey must explicitly approve that packet before a production deployment or launch DNS change.

## Cloudflare and DNS evidence after round 14

- A supplied 1Password screenshot was treated as evidence only. It showed four Cloudflare API credential items for `Local775.net`, `Local775.com`, `775Directory.net`, and `775Directory.com`.
- Read-only verification through the `775Directory.com` credential confirmed the Cloudflare zone is active, full, and not paused. Its assigned authoritative nameservers are `austin.ns.cloudflare.com` and `lara.ns.cloudflare.com`.
- The `.com` registry already delegates `775directory.com` to those Cloudflare nameservers, while some recursive resolvers still returned the prior Namecheap delegation during the propagation window.
- The authoritative Cloudflare DNS records still serve parking infrastructure: the apex is a proxied `A` record to `192.64.119.251`, and `www` is a proxied `CNAME` to `parkingpage.namecheap.com`.
- Existing apex MX and SPF records still support Namecheap email forwarding. They must be preserved unless Christopher Hussey separately approves an email-routing migration.
- No DNS record was changed. The go-live plan must snapshot current records, update only the approved web and mail-subdomain records, verify the result, and include a concrete rollback procedure.

## Sentry provider evidence after round 14

- Sentry's current Developer plan is **$0** for one user and includes error monitoring, tracing, email alerts, 5,000 errors, five million spans, and a 30-day lookback.
- Sentry's current Team plan is **$26 per month** and is the first tier that explicitly includes unlimited users, API access, and third-party integrations. The native Linear connection therefore introduces a recurring provider decision rather than fitting inside the free Developer plan.
- Sentry's TanStack Start React SDK can group errors, attach releases and source maps, and instrument Supabase operations. The Supabase integration can include query parameters and mutation bodies, so it must not be enabled with defaults that could export Lead, Claim, consent, call, or private Business data.
- Session Replay is not required for launch error monitoring and creates a materially larger privacy surface. Keep it disabled unless separately approved.
- Source-map upload credentials belong in the Vercel environment, not the repository. Uploaded maps should be removed from deploy artifacts so application source is not publicly exposed through `.map` files.
- The recommended Wednesday boundary is error monitoring for preview and production with aggressive `beforeSend` redaction, no Sentry user email/name/IP, no attachments, no Replay, no logs or profiling, narrowly sampled tracing, and Linear issue creation only for triaged actionable failures rather than every captured event.

## 2026-08-24 — Grill round 15

- **Existing Sentry account:** Reuse Christopher Hussey's existing Sentry organization through the installed Sentry integration. Do not create a second account, start a trial, purchase a plan, or upgrade the existing plan without separate approval.
- **Environment model:** Use one Local775 Sentry project with explicit `preview` and `production` environment tags.
- **Telemetry minimization:** Send strictly redacted technical diagnostics only: release, route template, error, browser/runtime, request ID, and non-sensitive internal correlation IDs. Do not send names, emails, IP addresses, Lead content, form bodies, Claim Proof, call data, payment data, tokens, or raw URLs/query strings.
- **Session Replay:** Disable Session Replay for launch.
- **Tracing:** Capture errors first; sample sanitized application traces at 100% in preview and 5% in production. Do not enable Supabase query/body instrumentation until explicit redaction tests prove that sensitive mutation and query data cannot leave the application boundary.
- **Linear routing:** Group repeated Sentry events into one Sentry issue and one linked Linear issue. Automatically route production regressions, repeated failures, and critical Lead, Claim, authentication, payment, and integration failures. Preview failures create Linear work only when they block acceptance.

## Sentry connection evidence after round 15

- The current Codex tool registry did not expose a callable Sentry MCP method even though the Sentry CLI plugin is installed.
- The plugin's supported fallback command, `sentry org list --json`, reported that the local CLI is not authenticated. No Sentry organization, plan, project, Linear integration, or billing state has therefore been verified, and no Sentry mutation was made.
- The next Sentry action requires either exposing the authenticated Sentry MCP connector to this task or completing `sentry auth login` interactively. This is an authentication checkpoint, not authorization to purchase or upgrade a plan.

## Supabase environment evidence after round 15

- A Supabase Preview Branch is an isolated environment with its own database and API credentials. The default Micro branch begins at **$0.01344 per hour**—approximately **$9.81 for 730 hours**—and branch compute is not protected by the organization's Spend Cap.
- Ephemeral Preview Branches are intended for focused testing and can be deleted when their pull request is closed. Keeping an unbounded persistent branch would create an open-ended usage charge.
- The current production project is empty, so the safest launch path is to prove migrations, Row Level Security, seed transformation, and destructive test cases in an isolated Preview Branch before applying the same migration artifacts to production.
- The existing Pro organization provides seven days of daily database backups. Database backups do not restore deleted Storage objects, so approved media requires a separate object-versioning/export and recovery procedure.
- Supabase Point-in-Time Recovery begins at approximately **$100 per month** for seven-day retention and requires at least Small compute. It is not necessary for the initial beta and is not approved.

## 2026-08-24 — Grill round 16

- **Persistent preview environment:** Maintain one persistent, data-less Supabase Preview Branch for Local775 staging. The approved live quote is **$0.01344 per hour**, approximately **$9.81 per 730-hour month**. This is a recurring branch-compute authorization only; PITR, larger compute, and unrelated usage are excluded.
- **Preview data:** The complete licensed seed workbook and synthetic test identities, Claims, Leads, payments, and call metadata may enter preview. Real Resident PII and real Claim Proof are prohibited.
- **Schema delivery:** Production schema changes use versioned SQL migrations tested in preview and CI. Undocumented production-dashboard schema edits and application-startup DDL are prohibited.
- **Production ingestion:** Import all 20,436 seed rows into a private, non-API raw-ingestion schema; transform them into private normalized candidates; expose only the 100 operator-reviewed launch Listings through the public contract.
- **Database recovery:** Use the included seven-day daily backups plus a verified logical export before high-risk migrations or imports. Do not enable paid PITR.
- **Media recovery:** Store originals privately, soft-delete to quarantine for 30 days, publish only operator-approved derivatives, and periodically export encrypted media outside Supabase. The external export destination requires a later explicit decision.
- **Production durability:** Production becomes non-resettable immediately after the first accepted production migration or real Listing import. Thereafter use forward migrations and explicit corrective operations; never use a blanket reset as a beta shortcut.

## Supabase provisioning evidence after round 16

- The live Supabase quote confirmed branch compute at **$0.01344 per hour** in the Cleverwork organization.
- Preview Branch `local775-preview` was created under production project `hcfryjrajqftcnnbnybj`. Its branch ID is `6d62aa23-be97-46c6-9ca2-d4f37eba8601` and project ref is `dpxeldzunfxmjahgvjhm`.
- The creation API initially returned `persistent: false`. Before applying schema or data, the branch was explicitly converted to persistent and reverified as `persistent: true`, data-less, and `ACTIVE_HEALTHY`.
- No migration, seed row, secret, Edge Function, PITR setting, or compute upgrade has been applied to preview or production.

## 2026-08-24 — Grill round 17

- **Initial Operator allowlist:** The initial Local775 Operator allowlist contains only `chussey@aia4.io`. Domain membership never grants Operator eligibility.
- **Operator MFA:** Create a `Local775 Operations` WorkOS organization solely for authentication policy. Require MFA for its non-SSO members. Do not use that organization to model Businesses, Listings, Claims, or Listing Participation.
- **Session policy:** Configure a seven-day maximum session, 24-hour inactivity timeout, and five-minute access tokens. Sensitive Operator actions require reauthentication within the preceding 15 minutes.
- **Operator grant ceremony:** Operator access requires an invitation, exact-email allowlist match, and a manual Supabase role grant. Record the granting Operator, timestamp, reason, and resulting permissions.
- **Impersonation:** Keep WorkOS user impersonation disabled. Operators use purpose-built, audited support views rather than assuming a Business Owner's identity.
- **Account creation:** Business Owners and Agency Representatives may create accounts only through a Claim or invitation flow. Operators are invitation-only. Residents do not need accounts.
- **Privileged email changes:** A verified email change may preserve ordinary authenticated access, but it suspends Operator and Lead Recipient privileges until the new address is manually reapproved. Never transfer those privileges solely because WorkOS accepted the new email.

## WorkOS implementation evidence after round 17

- AuthKit's environment-wide MFA setting applies to all non-SSO users. An organization authentication policy can instead require MFA for the internal Operations membership without imposing it on every Business Owner.
- WorkOS session length, access-token duration, and inactivity timeout are configurable. Reauthentication exposes a fresh `auth_time` claim that can gate sensitive actions.
- WorkOS impersonation is disabled by default and would bypass the user's ordinary authentication flow. It remains explicitly prohibited for Local775.
- No connected WorkOS management tool or authenticated Local775 WorkOS environment is currently available in this task. No WorkOS user, organization, application, credential, invitation, or billing setting has been created.

## 2026-08-24 — Grill round 18

- **Launch branch:** Implement launch work on `codex/launch-foundation` and use its Vercel Preview deployment. Do not merge into `main` before the Production Acceptance Packet is approved.
- **Production branch protection:** `main` requires a pull request, passing named CI checks once defined, resolved review conversations, and Christopher Hussey's explicit approval receipt. Direct pushes, force pushes, and branch deletion are prohibited.
- **Secret authority:** The `CW_Master` 1Password vault is the human source of truth. Provider secret stores receive least-privilege, environment-scoped runtime copies. Repository files contain only variable names and secret references—never secret values.
- **Preview external effects:** Preview has no real external effects by default. Use WorkOS staging, Stripe test mode, synthetic data, and sink destinations. A real GoHighLevel, email, SMS, phone, payment, or production-webhook test requires separate approval.
- **Production deployment event:** Approval of the written acceptance packet authorizes the reviewed pull-request merge and resulting Vercel production deployment. DNS changes remain a separately verified step in that approved runbook.
- **Cloudflare web-record mode:** Keep Cloudflare authoritative for DNS, but configure Vercel apex and `www` records as DNS-only. Do not add Cloudflare's reverse proxy in front of Vercel.
- **Canonical hostname:** `https://775directory.com` is canonical. `https://www.775directory.com` permanently redirects to the apex.
- **Rollback:** Preserve the prelaunch DNS snapshot and previous Vercel deployment. Prove application rollback, DNS restoration, feature disablement, and forward-only database correction before DNS launch.

## GitHub and Vercel control evidence after round 18

- The existing Vercel project `reno-local-directory` is Git-linked and targets `main` as production. It remains `live: false` with only Vercel-provided domains.
- Local branch `codex/launch-foundation` was created from `main`; current uncommitted planning artifacts moved with the working tree and remain uncommitted.
- GitHub authenticated as repository owner `Clvrwrk`, which is also the automation identity. GitHub cannot distinguish Christopher Hussey's human approval from a pull request authored under that same identity, so the human go-live approval must also exist as an external packet/Linear receipt.
- GitHub protection now enforces pull-request-only changes for administrators, linear history, resolved conversations, and prohibits force pushes and deletion. The approval count is intentionally zero until a distinct human GitHub identity is available; named required CI checks will be added after their workflow names exist.
- No branch was pushed, pull request opened, Vercel deployment created, domain attached, environment variable changed, or DNS record modified.

## Quality-system evidence after round 18

- The current repository has `typecheck`, Node test, ESLint, and Vite build scripts plus Playwright as a development dependency, but no GitHub Actions workflows and no configured required status-check names.
- The inherited `build` script runs `vite build && npm run db:migrate`. Coupling compilation to a database mutation violates the accepted preview-first, migration-only, and production-approval boundaries and must be removed before any Vercel build.
- The current migration code targets the inherited Postgres/Better Auth model rather than the accepted Supabase/WorkOS architecture. It is not authorized to run against either Local775 Supabase environment.
- Vercel currently selects Node.js 24.x. The repository does not yet declare an `engines.node` contract or a version file that keeps local development and CI on the same runtime.
- Existing tests concentrate on inherited app-builder/Grok behaviors and do not prove Local775 Listings, Claims, Leads, RLS, integration outbox/inbox, publication receipts, privacy deletion, accessibility, or rollback.

## 2026-08-24 — Grill round 19

- **Build isolation:** A Vercel build only compiles the application. It may never apply database migrations. Reviewed migrations run through a separate gated job with their own proof and approval boundary.
- **Runtime:** Standardize local development, CI, and Vercel on Node.js 24 and declare that contract in repository configuration.
- **Dependency installation:** Commit `package-lock.json`, use `npm ci`, and fail CI when manifest and lockfile drift.
- **Required checks:** Merge requires formatting, lint, typecheck, unit tests, production build, migration replay, RLS/security tests, integration-contract tests, seed-data validation, browser E2E, accessibility, dependency audit, and secret scanning.
- **Browser strategy:** Design and test mobile-first because approximately 90% of expected use is mobile. Cover mobile and desktop Chromium, with critical-flow smoke tests in Firefox and WebKit.
- **Accessibility:** Target WCAG 2.2 Level AA. Combine automation with keyboard, focus, zoom, screen-reader, contrast, form-error, target-size, and accessible-authentication review.
- **Security gates:** Block merge on unresolved secret exposure, high/critical dependency risk without an accepted exception, static-analysis findings, RLS negative-test failures, authorization defects, webhook signature/replay failures, unsafe upload behavior, or missing security headers.
- **Performance:** Require LCP at or below 2.5 seconds, INP at or below 200 milliseconds, CLS at or below 0.1, and Lighthouse scores above 90 on the accepted critical-page mobile test set. Define and enforce explicit JavaScript and image budgets during implementation.
- **End-to-end acceptance:** Prove browse/search/filter; Listing detail; Claim initiation/auth/evidence/status; Operator review/publish/reject; owner edits and media moderation; unclaimed behavior; Lead submission/delivery/failure; Featured entitlement; consent/deletion; audit/rollback; responsive behavior; and accessibility. Real external effects remain separately controlled tests.

## CI implementation boundary after round 19

- GitHub's named required-check list remains unset until workflows exist and their exact stable names have passed at least once. Adding invented names now could deadlock `main`.
- The inherited build-time migration, Better Auth schema, and Grok-specific checks are not accepted Local775 gates. They must be removed or replaced before the first launch-candidate Preview deployment.

## 2026-08-24 — Grill round 20

- **Canonical URLs:** Use `/nv/{city}` for city discovery, `/nv/{city}/{category}` for city/category discovery, and `/business/{business-slug}-{stable-id}` for a Business Listing. Listing URLs do not inherit mutable category placement.
- **Slug history:** Include a short immutable identifier, retain every prior slug as a permanent redirect, and never recycle an old Listing slug.
- **Indexable launch surface:** Index the homepage, Reno and Sparks pages, accepted city/category pages, published Listing pages, and substantive public information/legal pages. Search, authentication, Claim, Studio, account, preview, staging, pending, suspended, and internal surfaces are `noindex`.
- **Thin-page gate:** A city/category page requires at least three active reviewed Listings and useful unique context. Leaf-category pages remain searchable but `noindex` until they contain at least five active reviewed Listings plus non-template value.
- **Structured data:** Publish truthful `Organization` and `WebSite` data for Local775, `BreadcrumbList` where appropriate, and the most specific supported `LocalBusiness` subtype for each published Listing. Emit only reviewed public facts.
- **Rating markup:** Display live Google ratings only through the compliant attributed Google UI element. Do not emit Google rating content as Local775 `Review` or `AggregateRating` structured data. Revisit only if Local775 later operates a separately approved, compliant first-party review system.
- **Sitemap:** Include canonical, indexable, published URLs only. `lastmod` reflects significant public content, structured-data, or link changes—not routine live-rating refreshes or background checks.
- **Featured links:** Visibly label Featured placements as Sponsored. Mark paid outbound Business links with `rel="sponsored noopener noreferrer"`; ordinary organic Listing links remain ordinary outbound citations.
- **Removed Listing responses:** Duplicate or merged Listing redirects permanently to its survivor; a permanently removed Listing with no successor returns `410`; a temporarily suspended Listing returns a non-indexable `404`-style public response while preserving private history.
- **Search-engine setup:** Verify a Google Search Console domain property through Cloudflare, submit the sitemap, and configure Bing Webmaster Tools. This authorizes ownership verification and diagnostics only, with no advertising spend.

## Search implementation evidence after round 20

- The current route tree has city, city/category, Listing, search, Claim, account, and Studio concepts, but uses `/biz/{slug}` without immutable identity and supplies only minimal global metadata.
- The current Listing route emits generic LocalBusiness JSON-LD from synthetic seed data. It must be replaced with reviewed canonical fields, truthful subtypes, service-area privacy rules, and no third-party rating markup.
- No `robots.txt`, dynamic sitemap, verified canonical system, Search Console property, or Bing property has been confirmed. No search-engine account or DNS verification record was changed.

## 2026-08-24 — Grill round 21

- **Primary outcome:** The product's primary outcome is qualified Leads successfully delivered to participating Businesses, with merchant response and outcome evidence. Traffic and Listing count are supporting measures.
- **Qualified web Lead:** Requires a valid resident contact method, Reno/Sparks service location, clear service intent, required service-contact consent, non-spam classification, and no duplicate for the same resident, Listing, and request purpose within seven days.
- **Qualified phone Lead:** Requires a connected inbound call lasting at least 30 seconds or an explicit legitimate disposition by a Lead Recipient. Exclude abandoned, blocked, test, spam, and repeated same-purpose calls within seven days. Recording consent never determines qualification.
- **Featured response targets:** Target delivery within one minute, Lead Recipient acceptance within 15 minutes during stated business hours, and first resident contact within one business hour. Report actual performance and exceptions; do not promise residents a guaranteed response.
- **Thirty-day proof:** By 2026-09-25, achieve at least five paid Featured activations, including three directory-only cash-paying Businesses; at least 25 qualified web/call Leads across the cohort; 95% successful delivery; and at least 60% of Leads contacted within one business day.
- **Missed-proof response:** Pause paid-category expansion, diagnose acquisition, quality, delivery, and merchant-response constraints, interview participating merchants, and run a bounded corrective experiment before scaling. Do not automatically add inventory or discount.
- **Measurement ownership:** Supabase owns pseudonymous product and outcome events; Vercel supplies aggregated traffic; GoHighLevel supplies delivery, call, and payment evidence; scheduled reconciliation produces the trusted KPI view.
- **Attribution:** Preserve Listing, organic/Featured surface, city/category/search context, campaign parameters, channel, and timestamp. A Growth Lead exists only through a separate explicit consulting-help action.
- **Merchant outcomes:** Lead Recipients update accepted, contacted, won, lost, or spam in Studio or GoHighLevel. Automated reminders request completion. Operators may reconcile evidence but may never invent outcomes silently.
- **Review cadence:** Run daily launch-health review for seven days, weekly value/quality review for the first 30 days, then monthly cohort and category review.

## 2026-08-24 — Grill closure and delegated defaults

- Christopher Hussey declared the Grill phase complete after Q154 and approved future reversible implementation choices to default to Codex's documented recommendation.
- This delegated default does not waive the retained gates for production, new or increased spend, real external sends, financial effects, security/privacy/legal changes, or irreversible architecture. Those distinct decisions still require explicit input.
- Delivery proceeds through specification, tracer-bullet Linear tickets, test-driven implementation at agreed seams, code review, and a commit on `codex/launch-foundation`.

## 2026-08-24 — Grill round 6

- **Business Listing lifecycle:** `draft` → `pending_review` → `published`, with reversible `suspended` and `archived` states. Publication is an explicit reviewed transition rather than a creation side effect.
- **Claim verification:** Claim approval is evidence-based and manual. Accepted evidence may include a domain email, control of the listed-business phone, government registration, an authorization letter, or other operator-approved proof; no single automated signal is sufficient in every case.
- **Owner edits:** Publishing is risk-tiered. Validated low-risk content may publish without a manual queue, while ownership, business name, address, primary phone, URL, primary category, and operating-status changes require review. Published revisions remain auditable and reversible.
- **Resident access:** Residents browse and submit Leads without an account. WorkOS authentication is required for Business Owners, Agency Representatives, and Local775 Operators.
- **Wednesday listing gate:** Publish only individually reviewed Reno/Sparks Business Listings with validated NAP, category, active-business evidence, source attribution, and a review receipt. Keep the bulk workbook quarantined until rights and data-quality gates pass.

## 2026-08-24 — Grill round 7

- **Vercel adoption:** Adopt existing Cleverwork Vercel project `reno-local-directory` (`prj_ZkcD7I7A6TDYLJ7Z4UAG2hfNoEth`) as the Local775 production project. Configuration and preview-environment work are authorized. A new production deployment and connection of `775Directory.com` remain separate approval gates.
- **Business and location model:** A Business may have one or more Business Listings. Each physical location or service-area operation has independent NAP, categories, Claims, Leads, Featured entitlement, and tracking-number state.
- **Authority model:** Listing Participation is explicit, scoped, evidenced, revocable, and optionally expiring. A Business Owner may delegate specific Listings to an Agency Representative. Local775 may suspend or revoke participation. Payment never creates authority.
- **Featured inventory:** Permit at most three Featured Business Listings per category and city. Eligible listings rotate fairly within clearly labeled Featured placements.
- **Ranking integrity:** Featured affects only disclosed sponsored placements. Organic ranking remains independent of payment.
- **Failed-payment behavior:** A failed or canceled Featured subscription receives a seven-day grace period and then reverts to the always-free Business Listing. Payment state never unpublishes the underlying free Listing.
- **Lead recipients:** Leads go only to explicitly designated, active Lead Recipient participants with verified delivery destinations. Local775 Operators receive delivery-failure escalation rather than routine resident Leads.

## 2026-08-24 — Preview implementation evidence

- The forward-only Supabase migration set was applied to persistent Preview project `dpxeldzunfxmjahgvjhm`. Production project `hcfryjrajqftcnnbnybj` remains untouched; production apply still requires the exact retained approval.
- Preview security-advisor checks returned no findings after the Row Level Security and public-projection corrections. Anonymous access sees only the reviewed public projection; raw source rows, candidate evidence, private email, and review state remain private.
- Workbook SHA-256 `cece84ce2904d4448f9920afc92df2864b213b0d45d2fd59305a674016d303a7` was imported into immutable Preview staging as source batch `e1938274-f607-419a-9df7-1e48cfd33a52`. All 20,436 source rows reconciled exactly, and an idempotent rerun inserted zero duplicate raw rows.
- Deterministic launch transformation `launch-candidate-v1` created 1,798 private candidates: 128 eligible under the accepted evidence rules, 1,500 requiring review, and 170 ineligible. Zero candidates were selected or published automatically.
- The strict five-per-category-and-city target is not currently satisfiable from eligible rows alone. Reno has zero eligible Handyman and Screen Repair candidates, and several other cells have fewer than five. Sparks has zero eligible Handyman candidates, and several other cells have fewer than five. This is a launch-corpus acceptance blocker to resolve through evidence enrichment or an explicit eligibility-policy change; the implementation must not weaken the rule silently.

## 2026-08-24 — WorkOS boundary approval and website-preview correction

- Christopher Hussey explicitly approved the proposed WorkOS/Supabase authentication and Operator-authorization boundary for Preview. The approval covers CSRF-protected AuthKit sessions, minimal Actor projection, separate Operator Grants, Operations-organization/MFA enforcement, no impersonation, and 15-minute recent-auth checks for sensitive actions.
- The authorization is Preview-only. No production WorkOS configuration, Supabase migration, Vercel production deployment, or production-domain attachment is approved by this decision.
- “Supabase Preview” is a database integration environment and is not a user-facing website. At the time of this correction, the Vercel project had only its inherited `main` deployment and the canonical checkout had no local Vercel link, so a current branch website preview was not available.
- The feature branch must create an accessible Vercel Preview deployment before browser acceptance. Its eventual callback URL becomes the WorkOS staging redirect; production callback and domain configuration remain separately gated.

## 2026-08-24 — WorkOS and Supabase Preview activation evidence

- The branch deployment is protected by Vercel Authentication and is available at `https://reno-local-directory-git-codex-launch-foundation-cleverwork.vercel.app`; no production alias or Local775 domain was attached.
- The approved Supabase Preview URL and publishable/server keys are installed as branch-specific Vercel Preview variables. Secret values were injected directly and were not written to repository files or command output.
- A provider-level acceptance test proved that the available WorkOS Staging API key and client ID belong to different application contexts: WorkOS returned `invalid_client` for the pair, and an authorization request using the exact branch callback returned `redirect-uri-invalid` even after that callback was added through the key's application context.
- The mismatched WorkOS callback, Supabase third-party issuer integration, and five WorkOS Vercel variables were removed immediately. Preview authentication is back to the controlled `not_configured` failure path; the Supabase schema and authorization policies remain applied and fail closed.
- Christopher Hussey then supplied a temporary WorkOS Staging API key, client ID, and Operations organization. Pair validation returned `invalid_grant` for a deliberately invalid one-time code rather than `invalid_client`, the organization resolved under the same key, and the application's OIDC discovery document resolved successfully.
- Because the supplied client belongs to a secondary WorkOS application, Supabase Preview trusts the canonical issuer returned by OIDC discovery rather than constructing an issuer from the secondary client ID. The third-party integration resolved its WorkOS signing keys successfully.
- The exact branch callback is registered in the paired WorkOS application and an authorization probe reached hosted authentication without an error redirect. Five WorkOS values are installed as branch-specific Vercel Preview settings: the paired client/API credential, exact callback, generated cookie-encryption password, and seven-day cookie maximum.

## 2026-08-24 — Isolated WorkOS Staging boundary and credential containment

- Dashboard verification showed that the temporary WorkOS client, API key, and Operations organization supplied for Preview were created inside the shared Cleverwork **Production** environment, which already serves unrelated users and applications. Environment-wide authentication methods, token templates, and MFA policy were therefore not changed there under the Preview-only authorization.
- A separate `Local775 Directory` WorkOS project was created with **Staging only**; no WorkOS Production environment or paid feature was activated. Its default application was renamed `775Directory.com`, and the exact Vercel branch callback is registered only on that isolated Staging application.
- The isolated Staging application permits email Magic Auth and Google OAuth only. Email/password and enterprise SSO were disabled; passkeys remain disabled; Microsoft, GitHub, Apple, and the other OAuth providers remain disabled. Google uses WorkOS demo credentials in Staging.
- Application sessions are limited to seven days maximum, one day of inactivity, and five-minute access tokens. The JWT template fixes `role` to `authenticated` for Supabase and preserves the WorkOS organization-membership role as `user_role`.
- A Staging `Local775 Operations` organization was created. MFA is optional at the environment level so ordinary Business users are not forced into it, but the Operations organization requires MFA for every non-SSO member. User impersonation remains disabled.
- Supabase Preview now trusts only the isolated WorkOS Staging issuer and resolved its signing key successfully. The earlier shared-Production issuer integration was deleted.
- The temporary Production API key was exposed in task input and cannot be revoked immediately through WorkOS; its earliest supported expiration was set for 2026-08-24 16:06 America/Los_Angeles. Its Production callback remains unchanged because changing a Production redirect is outside the Preview-only approval.
- After Christopher Hussey explicitly approved a one-time clipboard transfer, the isolated Staging API key was copied directly from WorkOS into the branch-scoped Vercel sensitive variable, then the system clipboard was cleared. The isolated client ID was independently verified in WorkOS and replaced as a branch-scoped non-sensitive Vercel variable. No secret was written to the repository or printed by the transfer command.
- An initial fresh Preview deployment (`dpl_EkQf2zthT6q7kvKbpUxFhfqdtvn3`) built successfully with the rotated variables. The stable feature-branch alias was found still pointing to the prior deployment, so it was explicitly reassigned to the fresh deployment. A protected endpoint check returned `307` to WorkOS with the isolated client and exact branch callback, and browser acceptance reached the isolated Staging AuthKit host with email Magic Auth and Google as the only visible methods.
- During that acceptance pass, the browser accessibility representation included the full value from WorkOS's one-time key dialog in task tool output. The first isolated Staging key was therefore treated as disclosed. After explicit remediation approval, a replacement key named `Local775 Vercel Preview rotation 2026-08-24` was created, transferred directly into the same branch-scoped Vercel sensitive variable, and removed from the system clipboard. The disclosed Staging key is scheduled to expire at 2026-08-24 17:13 America/Los_Angeles, WorkOS's earliest available one-hour expiration. No Production setting was changed.
- Remediated Preview deployment `dpl_7HjSx64Yx2ZkurdNj26cRdZzpdk2` built successfully and now owns the stable feature-branch alias. The protected sign-in endpoint again returned `307` to WorkOS with the isolated client and exact callback; browser acceptance reached the isolated Staging AuthKit host with email Magic Auth and Google, no password option, and no `invalid_client`, redirect, or configuration error.
- Provider-level proof of the JWT claim template, login methods, session durations, Operations-organization MFA, Vercel secret remediation, and hosted sign-in entry is complete in isolated Staging. An end-to-end authenticated-user callback remains required before CLE-106 can close; it requires a human to authenticate as the test user.
