# Site ↔ Supabase ↔ GoHighLevel Full Build Plan

**Status:** accepted architecture; implementation plan ready for credentialed execution
**Planning date:** 2026-08-31
**Canonical source of truth:** Supabase  
**Authentication:** WorkOS  
**CRM and communication execution:** dedicated Local775 GoHighLevel location
**Accepted projection:** one `Listings` custom object plus labeled Contact relations ([ADR 0003](./adr/0003-single-gohighlevel-listings-object.md))

## 1. Outcome

Build one complete, auditable workflow in which:

1. A person authenticates through WorkOS and Claims an existing published Business Listing on 775Directory.
2. Supabase validates evidence, stores private Claim Proof, controls review, and grants Listing Participation only after approval.
3. A role-filtered Listing Studio lets Listing Admins, Owners, Managers, Agencies, and Lead Recipients perform only authorized commands.
4. Supabase projects operational facts to a dedicated GHL location through a durable outbox.
5. GHL uses Contacts, one `Listings` custom object, labeled relations, workflows, and Opportunities to communicate about Claims, ownership, Listing changes, and Leads.
6. Signed GHL events are recorded in a Supabase inbox and translated into delivery receipts, Lead outcomes, billing facts, or proposed changes. They never directly overwrite public Listing truth or grant authority.
7. Every external effect is idempotent, attributable, replayable, observable, and reconcilable.

The public site, Studio, and GHL are interfaces over one authority model. They are not three peer databases.

## 2. Scope and effect boundary

### Included

- Complete Claim submission, proof upload, review, approval, rejection, withdrawal, revocation, and evidence retention.
- Listing invitations and active participation caps: two Owners, three Managers, and three Agencies per Listing.
- Separate Lead Recipient designation, verified destinations, and scoped Lead access.
- Dynamic Listing Studio modules for content, people, Leads, Offers, Claim state, and integration health.
- GHL Contact, `Listings` record, relation, workflow, and Opportunity projection.
- GHL-originated proposal, communication-status, Lead-status, and billing-event ingestion.
- Retry, dead-letter, replay, reconciliation, audit, redaction, monitoring, rollback, Preview acceptance, and Production canary.

### Excluded unless separately approved

- GHL becoming the public directory source of truth or the authorization system.
- Payment creating Claim, ownership, participation, publication, or Lead access.
- Direct GHL edits publishing protected Listing identity fields.
- Real email, SMS, calls, invoices, charges, refunds, phone-number purchases, DNS changes, or Production deployment before their named approval gates.
- Using or modifying the unrelated Homeworks Advantage GHL location.
- Self-service checkout, Voice AI, transcription, or broad marketing automation.

## 3. Baseline and known gaps

The branch already contains a local first slice: authenticated Claim commands, server-side domain evidence checking, idempotent Claim decisions, a transaction-locked two-Owner cap, audit/outbox writes, the `listing_manager` role, and a role-aware Studio shell. Its unit, type, lint, build, and secret checks passed. The database acceptance test has not run because the local Docker daemon was unavailable. Nothing in this branch has been pushed, migrated, provisioned, messaged, or deployed.

Before extending the slice, execution must rebase onto the current canonical `main`, run the existing pgTAP test in an isolated database, and close the outstanding human WorkOS Preview sign-in/Actor-projection acceptance. These are entry gates, not assumptions.

## 4. Authority model

| Concern                                              | Authoritative system                    | Projected or execution system                         |
| ---------------------------------------------------- | --------------------------------------- | ----------------------------------------------------- |
| Human identity and session                           | WorkOS                                  | minimal Actor projection in Supabase                  |
| Listing, Claim, evidence, participation, permissions | Supabase                                | Site UI and GHL operational projection                |
| Public publication and trust labels                  | Supabase                                | Site public projection; read-only GHL fields          |
| Lead request, assignment, consent, outcome           | Supabase                                | GHL Contact, Opportunity, and communication workflows |
| Email/SMS/phone execution                            | GHL                                     | immutable Supabase delivery receipts                  |
| Payment proof                                        | GHL/connected Stripe signed events      | normalized Supabase billing event                     |
| Featured entitlement                                 | Supabase                                | Site and GHL read-only projection                     |
| Provider state and failures                          | Supabase inbox/outbox/bindings/receipts | GHL API and webhook logs                              |

No route or worker may infer authority from login, `owner_verified_at`, a GHL relation, an Opportunity, payment, a tag, or an email address.

## 5. Roles, seat limits, and capabilities

“Listing Admin” is the Studio label for a canonical Local775 Operator grant. It is not a Listing Participation and has no per-Listing seat limit.

| Studio role     | Canonical role        | Active limit per Listing |
| --------------- | --------------------- | -----------------------: |
| Listing Admin   | Local775 Operator     |           separate grant |
| Listing Owner   | Business Owner        |                        2 |
| Listing Manager | Listing Manager       |                        3 |
| Listing Agency  | Agency Representative |                        3 |
| Lead Recipient  | Lead Recipient        |    separately designated |

| Capability                             |               Admin                |           Owner (max 2)           |      Manager (max 3)       | Agency (max 3) |     Lead Recipient      |
| -------------------------------------- | :--------------------------------: | :-------------------------------: | :------------------------: | :------------: | :---------------------: |
| View Listing Studio                    |            all Listings            |             assigned              |          assigned          |    assigned    | assigned Lead view only |
| Edit draft About/hours/contact routing |                yes                 |                yes                |            yes             |    propose     |           no            |
| Upload media                           |                yes                 |                yes                |            yes             |      yes       |           no            |
| Submit protected identity proposal     |                yes                 |                yes                |            yes             |      yes       |           no            |
| Approve protected/public changes       |                yes                 |                no                 |             no             |       no       |           no            |
| Publish, suspend, merge, or restore    |                yes                 |                no                 |             no             |       no       |           no            |
| Invite/revoke Owners                   |                yes                 | yes, except self-lockout controls |             no             |       no       |           no            |
| Invite/revoke Managers and Agencies    |                yes                 |                yes                |             no             |       no       |           no            |
| Designate Lead Recipients              |                yes                 |                yes                | scoped recommendation only |       no       |           no            |
| View all Listing Lead PII              |                yes                 |                yes                |       assigned Leads       | no by default  |     assigned Leads      |
| Assign and update Leads                |                yes                 |                yes                |       assigned scope       |       no       |  assigned outcome only  |
| Manage Offers/Featured request         |                yes                 |                yes                |            yes             |    propose     |           no            |
| Approve entitlement                    | yes through verified billing rules |                no                 |             no             |       no       |           no            |
| Reconcile/replay provider events       |                yes                 |        read health summary        |             no             |       no       |           no            |

Agency Lead access requires a separate active Lead Recipient participation. Revocation or expiry removes access on the next server request and cancels future workflow enrollment; it does not wait for GHL reconciliation.

### Pending claimant access state

`pending_claimant` is a non-authority Studio access state derived only from the authenticated Actor's open `submitted` or `needs_evidence` Claim. It is not a Listing Participation or GHL relation. It exposes only:

- Claim status and decision timeline;
- Claim Proof upload/finalization and evidence validation status;
- Claim withdrawal;
- the public Listing link.

It exposes no Listing content/private contacts, People, Lead, Offer, publication, entitlement, or integration command. Approval ends this state and activates Owner participation atomically; rejection, withdrawal, or revocation returns the Actor to ordinary public access.

### Stable capability identifiers

Every server function and RPC requires one named capability. The UI receives these identifiers but remains only a usability projection.

| Capability ID             | Allowed effective roles/states                   | Commands                                             |
| ------------------------- | ------------------------------------------------ | ---------------------------------------------------- |
| `claim.read_own`          | pending claimant, Owner for own history, Admin   | `get_listing_studio_snapshot` Claim slice            |
| `claim.proof_submit`      | pending claimant                                 | `create_claim_proof_upload`, `finalize_claim_proof`  |
| `claim.withdraw_own`      | pending claimant                                 | `withdraw_listing_claim`                             |
| `claim.review`            | Admin with recent auth                           | `decide_listing_claim`, `revoke_listing_authority`   |
| `listing.content_edit`    | Admin, Owner, Manager                            | `save_listing_content_draft`                         |
| `listing.change_propose`  | Admin, Owner, Manager, Agency                    | `submit_listing_change_proposal`                     |
| `listing.change_approve`  | Admin with recent auth                           | `decide_listing_change_proposal`                     |
| `listing.publish`         | Admin with recent auth                           | publish/suspend/restore commands                     |
| `listing.media_manage`    | Admin, Owner, Manager, Agency                    | media upload/remove/submit commands                  |
| `listing.people_read`     | Admin, Owner, Manager; Agency own relation only  | Studio People query                                  |
| `listing.people_manage`   | Admin, Owner                                     | invitation/revocation commands subject to role rules |
| `lead.read_all`           | Admin, Owner                                     | Listing Lead queue/detail                            |
| `lead.read_assigned`      | Manager or Lead Recipient with active assignment | assigned Lead queue/detail                           |
| `lead.assign`             | Admin, Owner                                     | `assign_listing_lead`, `designate_lead_recipient`    |
| `lead.outcome_update`     | Admin, Owner, assigned Manager/Lead Recipient    | `update_lead_outcome`                                |
| `offer.manage`            | Admin, Owner, Manager; Agency proposes           | Offer commands with entitlement checks               |
| `growth_help.request`     | Admin, Owner                                     | `request_growth_help`, `withdraw_growth_help`        |
| `growth_help.review`      | Admin                                            | `update_growth_lead_outcome`                         |
| `integration.health_read` | Admin; Owner summary only                        | integration-health query                             |
| `integration.repair`      | Admin with recent auth and reason                | replay/reconcile/repair commands                     |

Replace broad `app.can_manage_listing` policies with `app.has_listing_capability(listing_id, capability_id)` plus command-specific helpers. Direct authenticated table mutation remains revoked. An approved Claim is never an authorization fallback: only a currently active participation or Operator Grant supplies capabilities, so revocation cannot be bypassed through Claim history.

## 6. Target architecture

```text
Browser
  │ WorkOS session
  ▼
TanStack Start server functions
  │ validated commands/queries with user JWT
  ▼
Supabase RPC + RLS ─── canonical transaction ─── audit + outbox
  │                                              │
  │ read models                                  ▼
  ├── public.directory_listings          GHL dispatch Edge Function
  └── studio snapshot/capabilities               │
                                                 ▼
                                      GHL Contacts / Listings /
                                      Relations / Opportunities /
                                      Workflows / Messages
                                                 │
                                                 ▼
                                      signed webhook endpoint
                                                 │
                                                 ▼
                                  Supabase inbox → translator →
                                  receipt / proposal / Lead event
```

The deep application modules own policy and orchestration. GHL is a true external dependency behind a production adapter and deterministic fake. Tests exercise observable behavior through module interfaces, not provider calls scattered through routes.

## 7. Domain lifecycle

### Claim

```text
draft → submitted ───────────────→ approved
          │                           │
          ├→ needs_evidence ──────────┤
          ├→ rejected                 └→ ownership participation activated
          └→ withdrawn

approved ownership can later be revoked without rewriting Claim history
```

Rules:

- Claim submission never grants Listing access, Lead access, publication, or entitlement.
- Work-domain evidence is checked server-side against a Business-controlled domain. Consumer mailbox domains do not qualify.
- Document, storefront, vehicle, and manual methods require private accepted Claim Proof before approval.
- Approval locks the Listing, rechecks all evidence and seat limits, creates the Owner participation, updates the independent `owner_verified_at` label, and appends audit/outbox events in one transaction.
- Sensitive proof files are deleted 30 days after decision. The hash, method, reviewer, timestamps, decision, and deletion receipt remain.

Claim Proof accepts PDF, JPEG, or PNG only, with a 10 MiB file limit, a 20-page PDF limit, and a 20-megapixel decoded-image limit. Extension and browser MIME are untrusted: `ClaimProofScanner` uses pinned `libmagic` for type detection, `libvips` for full image decode/re-encode with metadata removed, `qpdf --check` plus QDF inspection to reject encryption, JavaScript, launch actions, forms, and embedded files, then a pinned ClamAV `clamd` adapter for malware scanning. Uploads remain in a service-role-only quarantine bucket until every check returns clean. Timeout, unavailable scanner, decode failure, password protection, malformed structure, or positive detection fails closed; the file is never reviewable or downloadable and is deleted within 24 hours while its hash and redacted scan receipt remain.

`FakeClaimProofScanner` supplies deterministic clean, infected, timeout, and malformed results for tests. Local execution uses the pinned ClamAV container. Preview and Production require a healthy approved container endpoint; if no existing runtime can host it, selecting and paying for that runtime is a separate infrastructure/spend gate. Claim evidence stays disabled until that gate and its health check pass—there is no unscanned fallback.

### Participation

```text
invited → active → expired
             └──→ revoked
```

Invitations are single-use, time-limited, bound to normalized email plus Listing and role, and do not create authority until the authenticated Actor accepts them. Acceptance rechecks the email, inviter permission, seat cap, expiry, and current Listing state in one locked transaction.

### Lead

```text
submitted → queued → delivered → viewed → accepted → contacted → won/lost
                 └→ delivery_failed → retry/dead-letter/escalation
                 └→ spam/deleted under policy
```

Service-request consent is distinct from marketing consent. A Lead is durable in Supabase before any GHL call. GHL communication status is evidence for a Lead event, not the Lead record itself.

### Growth Lead

```text
requested → qualified → review_offered → consultation_scheduled → proposal → won/lost
          └→ withdrawn
```

A Growth Lead begins only when an authenticated active Owner or Listing Admin explicitly submits `request_growth_help` from the Listing Studio with separate consulting-contact consent. It is never inferred from a Claim, Listing Participation, Resident Lead, Featured request, or payment. Supabase stores the canonical request and events before projecting a separate GHL Opportunity; withdrawing the request cancels future outreach but preserves the consent and audit receipt.

## 8. Supabase data changes

Use additive migrations and expand/contract deployment. Never combine migration execution with application build or deploy.

### Extend existing tables

- `app.claims`: retain submission and decision idempotency keys; add `withdrawn_at`, `withdrawn_by`, and `revocation_status` only if the lifecycle requires them after code review.
- `private.claim_proofs`: add `scan_status`, `validation_status`, `validated_at`, `decision_receipt`, and enforced `delete_after`; never expose storage paths through public or authenticated generic reads.
- `app.listing_participations`: retain `listing_manager`; add `invitation_id`, `accepted_at`, `granted_by`, and a normalized capability-scope schema. Do not store GHL relation IDs as authority.
- `app.leads`: keep source and service consent; add no GHL identifiers directly.
- `app.integration_outbox`: add `correlation_id`, `aggregate_version`, `lease_owner`, `lease_expires_at`, `next_attempt_at`, `last_attempt_at`, and redacted `last_error_summary`.
- `app.integration_inbox`: add `payload_sha256`, signature header type, event version, `processing_attempts`, `next_attempt_at`, and `last_error_summary`; preserve verified raw-body evidence in private storage or `private.integration_webhook_bodies`.

### Add canonical tables

| Table                                 | Purpose and critical constraints                                                                                                                                           |
| ------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `app.listing_invitations`             | Listing, role, normalized invite email, inviter, token hash, expiry, accepted/revoked timestamps; one live invitation per Listing/role/email; no plaintext token storage.  |
| `app.listing_change_proposals`        | Field-level requested changes, source (`site` or `gohighlevel`), requester, validation state, review decision, before/after references, correlation ID.                    |
| `app.lead_assignments`                | Lead-to-participation assignment, verified destination snapshot, assignment status, assigned/revoked timestamps; Lead PII access derives through this row.                 |
| `app.growth_leads`                    | Explicit Listing consulting-help request, requester, separate consent, lifecycle, source, idempotency key, withdrawal, and current projection version.                     |
| `app.growth_lead_events`              | Append-only lifecycle, consent, delivery, and GHL Opportunity evidence for one Growth Lead.                                                                                |
| `app.integration_bindings`            | Unique mapping of provider/location/object kind/canonical ID to provider record ID; includes schema version, last projected version, status, and reconciliation timestamp. |
| `app.integration_delivery_receipts`   | Outbox event, provider request fingerprint, response code/class, provider identifiers, attempt, delivered timestamp, and redacted response hash. Append-only.              |
| `app.integration_reconciliation_runs` | Run scope, cursor, counts, mismatches, repair proposal, approval state, start/finish times. A report is not permission to repair.                                          |
| `app.communication_destinations`      | Actor/participation destination, normalized email/phone, verification state, service/marketing purpose, channel, timestamps.                                               |
| `private.integration_webhook_bodies`  | Verified raw bytes or immutable object reference, SHA-256, retained headers, received time, deletion policy. Service-role only.                                            |

### Database commands and queries

Publicly exposed RPCs remain narrow and revoke direct table mutation from ordinary authenticated users:

- `submit_listing_claim`, `withdraw_listing_claim`, `decide_listing_claim`, `revoke_listing_authority`
- `create_listing_invitation`, `accept_listing_invitation`, `revoke_listing_participation`
- `get_listing_studio_snapshot`, `get_listing_capabilities`
- `save_listing_content_draft`, `submit_listing_change_proposal`, `decide_listing_change_proposal`
- `assign_listing_lead`, `update_lead_outcome`, `designate_lead_recipient`
- `request_growth_help`, `withdraw_growth_help`, `update_growth_lead_outcome`
- `lease_integration_outbox_batch`, `complete_integration_delivery`, `fail_integration_delivery`
- `record_integration_inbox`, `translate_integration_event`, `record_reconciliation_run`
- internal `apply_actor_email_change` invoked by identity projection to suspend privileged grants/destinations before updating the Actor email

All sensitive commands accept an idempotency key, derive Actor identity from the JWT, check recent authentication for protected Operator actions, lock the Listing or Lead aggregate, and write audit/outbox records in the same transaction.

### RLS and database acceptance

Add pgTAP coverage for:

- unauthenticated, authenticated-without-participation, suspended Actor, expired participation, revoked participation, and impersonation-negative paths;
- concurrent Owner, Manager, and Agency invitation acceptance at each cap;
- Agency denial of Lead PII without separate Lead Recipient assignment;
- Manager access limited to assigned Leads;
- direct-table bypass attempts for Claims, invitations, participation, proposals, Leads, entitlements, outbox, inbox, and bindings;
- idempotent retry, conflicting idempotency key, expired lease recovery, duplicate webhook, out-of-order event, and stale aggregate version;
- proof paths and raw provider payloads absent from public and Studio projections.

## 9. Site modules and interfaces

### `ClaimService`

- `submitClaim(input): ClaimReceipt`
- `createProofUpload(input): UploadGrant`
- `finalizeProof(input): ProofReceipt`
- `withdrawClaim(input): ClaimReceipt`
- `decideClaim(input): ClaimDecisionReceipt`
- `revokeAuthority(input): RevocationReceipt`

It hides WorkOS token extraction, Supabase RPC mapping, evidence policy, storage signing, scan/validation orchestration, retention, audit, and outbox creation.

### `ListingAccessService`

- `getStudioSnapshot(listingId): ListingStudioSnapshot`
- `getCapabilities(listingId): CapabilitySet`
- `inviteParticipant(input): InvitationReceipt`
- `acceptInvitation(input): ParticipationReceipt`
- `revokeParticipant(input): ParticipationReceipt`
- `designateLeadRecipient(input): ParticipationReceipt`

The snapshot returns only fields and actions allowed for the effective role. A UI tab is rendered from server capabilities, while every command independently reauthorizes.

### `ListingManagementService`

- `saveContentDraft`, `submitProtectedChange`, `uploadMedia`, `submitOffer`, `requestFeatured`
- Operator-only `reviewContent`, `reviewProtectedChange`, `publishListing`, `suspendListing`, `restoreListing`

Protected identity includes canonical name, slug, public phone, website, address/service area, city, category, and publication state. Owner-controlled content remains reviewable according to the accepted product contract.

### `LeadService`

- `submitLead`, `assignLead`, `getLeadQueue`, `getLeadDetail`, `recordLeadOutcome`, `requestDeletion`

It creates the Lead and service-consent fact before enqueueing GHL work. It returns stable delivery state even when GHL is unavailable.

### `GrowthLeadService`

- `requestHelp`, `withdrawRequest`, `getRequest`, Admin-only `recordOutcome`

It exposes the separate, consented consulting-help action in the Listing Studio and writes `growth_lead.requested` only from that explicit command. Its outbox mapper and GHL Opportunity use `supabase_growth_lead_id`; no Claim or Resident Lead handler can call it.

### Public Lead intake contract

The public Listing detail route renders a concise Lead form only when Supabase says the Listing is published, owner-verified, and has at least one active verified delivery destination. The form names the Business/recipient purpose, explains service-contact consent, and does not include marketing consent by default. Unclaimed or ineligible Listings show NAP and Claim actions only.

`submit_listing_lead` validates a Reno/Sparks service ZIP, a valid email or E.164 phone, clear service intent, source Listing/path, honeypot/rate controls, and required service-contact consent. It normalizes a seven-day duplicate fingerprint from Listing, requester contact, and request purpose; a duplicate returns the original public-safe receipt rather than creating another Lead or GHL Opportunity. One database transaction creates `app.leads`, initial `app.lead_events`, initial `app.lead_assignments`, audit evidence, and `lead.submitted` outbox work.

The success response contains a public-safe Lead receipt and honest delivery state; it never claims delivery before a delivery receipt exists. The target is queued immediately and delivered within one minute, measured from `submitted_at` to the first successful channel receipt. Failure is visible to Listing Admin and authorized Listing users. The privacy flow can request deletion of Lead PII while retaining allowed anonymized outcome events and a deletion receipt.

### `GhlProjectionService`

- `dispatch(outboxEvent): DeliveryReceipt`
- `ingest(rawWebhook): InboxReceipt`
- `translate(inboxEvent): TranslationReceipt`
- `reconcile(scope): ReconciliationReport`

The external port is implemented twice: `LeadConnectorGhlAdapter` for production and `FakeGhlAdapter` for deterministic tests. Routes and domain modules never call GHL directly.

## 10. Dynamic Listing Studio

Use one `/studio/$slug` route with server-returned role and capabilities, not separate dashboards per role.

| Module             | Admin               | Owner                      | Manager           | Agency                            | Lead Recipient                        |
| ------------------ | ------------------- | -------------------------- | ----------------- | --------------------------------- | ------------------------------------- |
| Overview           | full operations     | Listing health             | work queue        | campaign/content summary          | assigned Lead summary                 |
| Listing            | edit/review/publish | edit/propose               | edit/propose      | propose marketing fields          | hidden                                |
| Media              | review/manage       | manage                     | manage            | manage                            | hidden                                |
| People             | all seats/recovery  | invite/revoke within rules | read team         | read own relation                 | hidden                                |
| Leads              | all                 | all Listing Leads          | assigned          | hidden unless separately assigned | assigned only                         |
| Offers             | approve/manage      | manage if entitled         | manage if allowed | propose                           | hidden                                |
| Claim              | review/history      | own history                | authority summary | authority summary                 | hidden                                |
| Integration Health | replay/reconcile    | last-sync/read-only        | hidden            | hidden                            | delivery state for assigned Lead only |

Required states include loading, empty, stale, degraded provider, permission lost, validation error, idempotent replay, pending review, conflict, and success receipt. Mobile is primary; keyboard navigation, focus management, descriptive errors, and WCAG 2.2 AA are acceptance criteria.

## 11. GHL model

### `Listings` custom object

Provision only after the immutable manifest is reviewed in the dedicated Local775 location.

- Object key: `custom_objects.listings`
- Display label: `Listings`
- Singular label: `Listing`
- Primary display field: `listing_name`
- External reconciliation field: `supabase_listing_id`

| Field                       | Direction      | Purpose                                          |
| --------------------------- | -------------- | ------------------------------------------------ |
| `supabase_listing_id`       | Supabase → GHL | immutable canonical UUID and reconciliation key  |
| `stable_id`                 | Supabase → GHL | operator-friendly stable number                  |
| `listing_name`              | Supabase → GHL | protected display-name projection                |
| `listing_slug`              | Supabase → GHL | canonical route input                            |
| `city`                      | Supabase → GHL | operational filter                               |
| `primary_category`          | Supabase → GHL | operational filter                               |
| `publication_status`        | Supabase → GHL | read-only operational projection                 |
| `owner_verification_status` | Supabase → GHL | independent trust-state projection               |
| `featured_status`           | Supabase → GHL | computed entitlement projection                  |
| `studio_url`                | Supabase → GHL | canonical HTTPS URL without sensitive query data |
| `projection_version`        | Supabase → GHL | monotonic version for reconciliation             |
| `last_projected_at`         | Supabase → GHL | diagnostic timestamp                             |

Do not put Claim Proof, provider payloads, audit bodies, resident request text, Lead PII, payment authority, or secrets in this object.

### Contact and Opportunity custom-field manifest

`config/ghl/integration-manifest.json` is the single non-secret desired-state manifest. In addition to the `Listings` schema and association table below, it declares these logical fields. Provider-assigned field IDs are environment bindings, not source-controlled constants.

| Object      | Logical key                   | Type   | Search/use expectation                                | Uniqueness/ownership                                                          |
| ----------- | ----------------------------- | ------ | ----------------------------------------------------- | ----------------------------------------------------------------------------- |
| Contact     | `local775_actor_id`           | text   | exact lookup for an authenticated participant Contact | at most one bound Contact per Supabase Actor; enforced/reconciled by Supabase |
| Contact     | `local775_contact_version`    | number | reconciliation only                                   | monotonic Supabase-owned projection version                                   |
| Opportunity | `supabase_lead_id`            | text   | exact lookup for Resident Lead projection             | exactly one Opportunity per non-null value, enforced by bindings              |
| Opportunity | `supabase_growth_lead_id`     | text   | exact lookup for Growth Lead projection               | exactly one Opportunity per non-null value, enforced by bindings              |
| Opportunity | `supabase_listing_id`         | text   | filter/reconciliation                                 | canonical Listing UUID; not an authority grant                                |
| Opportunity | `local775_source`             | text   | operational reporting                                 | controlled enum from the versioned mapper                                     |
| Opportunity | `local775_consent_purpose`    | text   | audit/reconciliation                                  | immutable purpose snapshot; no marketing inference                            |
| Opportunity | `local775_projection_version` | number | stale-write detection                                 | monotonic Supabase-owned projection version                                   |

Where GHL cannot enforce uniqueness or exact indexing, the manifest records that limitation and the Supabase binding plus reconciliation worker enforces it. The manifest also declares the exact two pipeline names, ordered stage names, association keys/direction/limits, and disabled workflow names from this section. After gated UI provisioning, provider-assigned pipeline, stage, custom-field, association, and workflow IDs are stored as target-specific environment bindings; the source manifest remains provider-ID independent.

### Contacts and labeled relations

GHL Contacts support communication. Supabase stores canonical bindings after the first provider match/create and never uses email or phone as the permanent cross-system key.

Relation keys and labels:

| Relation key                      | Listing label | Contact label  | Supabase source                              |
| --------------------------------- | ------------- | -------------- | -------------------------------------------- |
| `local775_listing_owner`          | Listing       | Owner          | active `business_owner` participation        |
| `local775_listing_manager`        | Listing       | Manager        | active `listing_manager` participation       |
| `local775_listing_agency`         | Listing       | Agency         | active `agency_representative` participation |
| `local775_listing_lead_recipient` | Listing       | Lead Recipient | active `lead_recipient` participation        |

Supabase enforces seat limits; GHL association limits are configured as a defensive mirror and monitored for drift. Relation webhooks create inbox events and proposals only. A GHL-created Owner relation does not create a Supabase Owner.

The immutable association manifest is directional:

| API association key               | Source object             | Target object | Source label | Target label   |                               Listing → Contact limit | Contact → Listing limit             | Deletion behavior                                                                         |
| --------------------------------- | ------------------------- | ------------- | ------------ | -------------- | ----------------------------------------------------: | ----------------------------------- | ----------------------------------------------------------------------------------------- |
| `local775_listing_owner`          | `custom_objects.listings` | `contact`     | Listing      | Owner          |                                                     2 | provider default/unbounded; never 2 | delete projected relation after participation is revoked/expired; retain Supabase history |
| `local775_listing_manager`        | `custom_objects.listings` | `contact`     | Listing      | Manager        |                                                     3 | provider default/unbounded; never 3 | same                                                                                      |
| `local775_listing_agency`         | `custom_objects.listings` | `contact`     | Listing      | Agency         |                                                     3 | provider default/unbounded; never 3 | same                                                                                      |
| `local775_listing_lead_recipient` | `custom_objects.listings` | `contact`     | Listing      | Lead Recipient | no role-seat cap; bounded by approved delivery policy | provider default/unbounded          | delete relation and cancel future enrollments when designation ends                       |

Provisioning must prove in the GHL UI/API that the limit is applied from one Listing record to associated Contacts. If the provider cannot express that direction, omit the provider limit and rely on Supabase plus drift alerting; never apply a 2/3 limit from one Contact to Listings.

Before using `POST /contacts/upsert`, verify the dedicated location's duplicate-contact policy. Upsert may match email or phone according to that location setting. After a binding exists, use the stored Contact ID and `PUT /contacts/:contactId`; do not repeatedly rematch by mutable PII.

### Opportunities

Use two pipelines, never one overloaded pipeline:

- `Local775 Resident Leads`: Submitted, Delivery Pending, Delivered, Viewed, Accepted, Contacted, Won, Lost, Spam, Delivery Failed.
- `Local775 Growth Leads`: Requested, Qualified, Review Offered, Consultation Scheduled, Proposal, Won, Lost, Withdrawn.

Each Opportunity stores `supabase_lead_id` or `supabase_growth_lead_id` as the external object ID/custom field, the canonical Listing UUID, source, consent purpose, and projection version. It links to the requester Contact. Listing-owner notification is routed through labeled relations and Lead Recipient assignments; it does not make the owner the resident Opportunity Contact.

### GHL workflows

Create disabled workflows first, test with synthetic Contacts, and record workflow IDs in environment-specific configuration:

1. Claim submitted acknowledgement.
2. Claim evidence required and reminder.
3. Claim approved / Listing owned.
4. Claim rejected or withdrawn.
5. Participant invitation, accepted, expired, or revoked.
6. New resident Lead to each active verified Lead Recipient; if none succeeds, escalate to Listing Admin without routine Lead PII.
7. Lead delivery reminder and no-response escalation to Listing Admin.
8. Explicit Growth Lead requested, scheduled, withdrawn, or decided.
9. Listing proposal submitted, approved, or rejected.
10. Featured status and payment-operation notices, without granting entitlement.
11. Integration dead-letter or reconciliation mismatch alert to Listing Admin.

HighLevel supports adding associated Contacts to workflows by association label. Each workflow still receives an explicit immutable event ID, Listing ID, and canonical Site URL so retries and receipts can be correlated. GHL automation success is not treated as delivery proof until a provider event or reconciliation observation is stored.

Product-critical messages do not depend on copying event context into mutable Contact fields. The Supabase outbox creates one recipient-specific communication command with an immutable rendered payload hash and calls the GHL message/conversation API for that bound Contact. Scheduled reminders are new Supabase outbox commands with cancellation keys. Cross-object GHL workflows may support internal automation, but remain disabled for an event family until a synthetic canary proves that its exact immutable context survives association-label enrollment.

| Communication contract            | Trigger/initiating object                                                    | Recipient selection                                         | Immutable payload                                                                    | Enrollment/idempotency key                               | Cancellation key                    | Delivery evidence                                    | Fallback                                                                |
| --------------------------------- | ---------------------------------------------------------------------------- | ----------------------------------------------------------- | ------------------------------------------------------------------------------------ | -------------------------------------------------------- | ----------------------------------- | ---------------------------------------------------- | ----------------------------------------------------------------------- |
| Claim submitted                   | Supabase `claim.submitted`; direct GHL message                               | claimant Contact                                            | event/Claim/Listing IDs, status, Studio URL                                          | `claim:{claim_id}:submitted:{recipient_id}`              | Claim terminal state                | provider message ID/status webhook or reconciliation | email then SMS only when separately consented/verified                  |
| Evidence required                 | Supabase `claim.evidence_required`; direct message                           | claimant Contact                                            | Claim ID, accepted method list, expiring proof URL                                   | `claim:{claim_id}:evidence:{version}:{recipient_id}`     | proof finalized/Claim terminal      | message status                                       | Admin queue alert after reminder budget                                 |
| Claim approved/rejected/withdrawn | terminal Claim event; direct message                                         | claimant Contact                                            | decision, safe reason, Listing/Studio URL                                            | `claim:{claim_id}:{decision}:{recipient_id}`             | none after delivery                 | message status                                       | Admin sees failure                                                      |
| Invitation                        | Supabase `participation.invited`; direct message                             | invitee Contact                                             | invitation ID, role label, expiry, single-use Site URL                               | `invite:{invitation_id}:{recipient_id}`                  | accepted/revoked/expired            | message status                                       | inviter/Admin sees failure                                              |
| Participation changed             | Supabase active/revoked/expired event; direct message                        | affected Contact                                            | Listing, role, effective time, Studio/public URL                                     | `participation:{id}:{version}:{recipient_id}`            | newer participation version         | message status                                       | Admin queue                                                             |
| New resident Lead                 | Supabase `lead.assigned`; direct message; Opportunity is separate projection | each selected active verified Lead Recipient only           | Lead ID, Listing, safe request summary, authenticated Studio Lead URL; no PII in URL | `lead:{lead_id}:assigned:{assignment_id}:{recipient_id}` | assignment revoked/Lead terminal    | message status plus `lead_events.delivered`          | next verified Lead Recipient, then Admin alert without routine Lead PII |
| Lead reminder                     | Supabase scheduled outbox command                                            | unresponsive active assignment                              | Lead/assignment IDs and Studio URL                                                   | `lead:{lead_id}:reminder:{ordinal}:{assignment_id}`      | accepted/contacted/won/lost/revoked | message status                                       | Admin escalation after budget                                           |
| Growth help request               | explicit `growth_lead.*` event; direct message and separate Opportunity      | requesting Owner/Admin and approved internal Admin queue    | Growth Lead/Listing IDs, consent purpose, status, Studio URL                         | `growth:{growth_lead_id}:{status}:{recipient_id}`        | withdrawn/superseding status        | message status and Opportunity reconciliation        | Admin queue; never enroll Listing Lead Recipients                       |
| Listing proposal decision         | Supabase proposal event; direct message                                      | proposer Contact and authorized Owners as separate commands | proposal ID, changed-field names, decision, Studio URL                               | `proposal:{proposal_id}:{status}:{recipient_id}`         | superseded proposal                 | message status                                       | Admin queue                                                             |
| Featured/payment notice           | verified billing/entitlement event; direct message                           | authorized billing Contact                                  | billing-event reference, entitlement state, safe action URL                          | `billing:{event_id}:{recipient_id}`                      | corrected/superseding billing event | message status                                       | Admin financial queue; never grant from delivery                        |
| Integration failure               | dead-letter/reconciliation event; internal Admin workflow or direct message  | Listing Admin Contacts only                                 | correlation ID, error class, Admin health URL                                        | `integration:{event_id}:{admin_id}`                      | repaired/canceled                   | message status                                       | Sentry/Linear accountable alert                                         |

Each cross-object workflow action targets one association label at a time. Owner, Manager, Agency, and Lead Recipient routing therefore uses separate reviewed actions, never an implicit multi-label audience. Revocation writes the relation deletion and reminder cancellation commands in the same Supabase transaction that removes authority.

## 12. API and credential contract

### Credential set

Do not paste secrets into chat, source files, issue comments, or command output. Add them through the approved secret manager and target-specific environment configuration.

- `GHL_LOCATION_ID`: dedicated Local775 sub-account only.
- `GHL_RUNTIME_TOKEN`: least-privilege sub-account Private Integration token for steady-state server-to-server API calls.
- `GHL_PROVISIONING_TOKEN`: optional separately scoped temporary token used only for approved P06 API mutations and revoked immediately afterward; omit when the user performs the Admin-UI checkpoint.
- `GHL_WEBHOOK_MODE`: `oauth_signed` for native signed GHL webhooks or `disabled` while read-only polling/reconciliation is active.
- `GHL_OAUTH_CLIENT_ID` and `GHL_OAUTH_CLIENT_SECRET`: required when native event subscriptions use a Local775 OAuth app.
- `GHL_*_PIPELINE_ID`, `GHL_*_STAGE_ID`, and `GHL_*_WORKFLOW_ID`: non-secret environment-specific IDs created during provisioning.

Use three separate principals:

| Principal                              | Lifetime                                          | Allowed scopes/capabilities                                                                                                                                                                                                                                                                                                                                                                                                           | Prohibited                                                               |
| -------------------------------------- | ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| Temporary GHL provisioner              | Wave 6 only; revoke/rotate after manifest receipt | `locations.readonly`, `objects/schema.readonly`, reviewed `objects/schema.write` if the current endpoint supports it, `associations.readonly/write`, and reviewed `locations/customFields.readonly/write` for Contact/Opportunity custom fields where the current API supports them; pipeline/stage/workflow creation stays in the gated Admin UI checklist                                                                           | Contacts, messages, payments, routine runtime                            |
| Steady-state sub-account runtime token | ongoing, rotated every 90 days                    | `locations.readonly`, `locations/customFields.readonly`, `contacts.readonly/write`, `objects/schema.readonly`, `objects/record.readonly/write`, `associations.readonly`, `associations/relation.readonly/write`, `opportunities.readonly/write`, `workflows.readonly`, `conversations.readonly`, `conversations/message.readonly/write`                                                                                               | object schema write, location write, charges, refunds, unrelated objects |
| Local775 OAuth webhook app             | ongoing signed event channel                      | subscribe only to approved Contact/message delivery, Record, Relation, Opportunity, invoice/payment transaction/subscription events; scopes required by those events: corresponding readonly scopes, `associations/relation.readonly`, `opportunities.readonly`, `conversations/message.readonly`, `payments/transactions.readonly`, `payments/subscriptions.readonly`, and `invoices.readonly` only if invoice events remain enabled | record/schema writes and message sends                                   |

Private Integration credentials perform API work but do not establish native event subscriptions. The OAuth app owns the `X-GHL-Signature` webhook channel. If OAuth credentials/event subscription are unavailable, inbound translation remains disabled and a read-only poll/reconciliation mode is the only accepted fallback; a shared-secret workflow webhook cannot impersonate the native signed provider channel.

Schema write permission is not needed for steady-state runtime. Custom-object and custom-field provisioning is a separate admin checkpoint; the runtime token must not retain irreversible schema authority. The current API contract is verified before each planned mutation. Pipeline, stage, and workflow creation is never assumed to have a supported write API: it uses a gated manual Admin-UI checklist with before/after screenshots and read-only API verification. Payment scopes are read-only evidence scopes and do not authorize charges, refunds, invoices, or entitlement.

### Provider endpoints used by the adapter

- Contacts: create/upsert, get/update, and search/lookup.
- Objects: get schema, create/update/get/search `custom_objects.listings` records.
- Associations: get/create definitions and create/get/delete relations.
- Opportunities: get pipelines, search, create, update, and update status.
- Workflows: list and enroll/remove Contacts only if API enrollment is selected; otherwise the configured GHL workflow consumes the event path.
- Conversations/messages: send recipient-specific service messages and read delivery state using the steady-state token.
- Payments/invoices: read or receive only the explicitly subscribed evidence used by the billing translator; no financial write endpoint is in the adapter.

The adapter pins the documented API version per endpoint, sends a bounded timeout, classifies `429` and retryable `5xx`, redacts tokens/PII, records request fingerprints rather than bodies, and observes rate-limit headers. No endpoint is added from memory; implementation verifies its current official contract and fixture before use.

### Webhook security

- Capture the exact raw request bytes before JSON parsing.
- Prefer and require `X-GHL-Signature` Ed25519 verification for native GHL webhooks.
- Require `X-GHL-Signature` Ed25519 verification. Keep legacy `X-WH-Signature` RSA only as a disabled, date-bounded fixture; enable it only if credentialed discovery before 2026-09-01 proves the dedicated app still requires the transition path.
- Reject missing/invalid signatures before inserting a trusted inbox row.
- Check Location ID, event type allowlist, payload size, timestamp/replay window where available, and unique provider event ID.
- Store the verified payload hash and acknowledge quickly; process asynchronously and idempotently.

## 13. Event contracts

Every outbound envelope contains:

- `event_id`, `event_type`, `occurred_at`, `correlation_id`
- `aggregate_type`, `aggregate_id`, `aggregate_version`
- `location_id_ref` as a configuration key, never the secret value
- minimum required payload; no Claim Proof path or unrelated PII

Outbound families:

- `claim.submitted`, `claim.evidence_required`, `claim.approved`, `claim.rejected`, `claim.withdrawn`
- `listing.projected`, `listing.changed`, `listing.suspended`, `listing.restored`
- `listing_participation.invited`, `listing_participation.activated`, `listing_participation.revoked`, `listing_participation.expired`
- `lead.submitted`, `lead.assigned`, `lead.status_changed`, `lead.delivery_failed`
- `growth_lead.requested`, `growth_lead.status_changed`, `growth_lead.withdrawn`
- `listing_change.submitted`, `listing_change.approved`, `listing_change.rejected`
- `featured.activated`, `featured.past_due`, `featured.ended`

Allowed inbound translations:

- Contact/message delivery state → append communication or Lead delivery evidence.
- Opportunity stage/status → validated Resident Lead or Growth Lead outcome proposal/event according to the pipeline, external ID, and field-ownership table.
- `Listings` record update → Listing change proposal, never direct Listing mutation.
- Relation create/delete → participation-drift alert or proposal, never authority mutation.
- Invoice/payment events → immutable billing event; Supabase entitlement rules decide the result.

Unknown, stale, mismatched-location, invalid-transition, or unsupported events are retained as rejected/failed inbox records with redacted diagnostics and no domain effect.

### Versioned event registry

`src/lib/integrations/event-registry.ts` is the single registry for event names, schema versions, allowed aggregate types, minimum payloads, PII classification, destinations, and translators. Migration constraints and tests consume the same documented registry values. Version 1 retains the existing `listing_participation.*` namespace; the shorter `participation.*` alias is prohibited unless a future compatibility migration translates it explicitly.

`delivery_failed` remains a `lead_events.event_type` and assignment/delivery fact. It is not an `app.leads.status` in version 1. The canonical Lead status changes only through the accepted lifecycle; delivery attempts and failures can recur without corrupting that state.

## 14. Idempotency, ordering, and recovery

- Use the Supabase outbox UUID as the external event ID and a stable provider operation key.
- Commit the domain mutation, audit event, and outbox row atomically.
- Lease rows with `FOR UPDATE SKIP LOCKED`, bounded batches, lease expiry, and compare-and-set completion.
- Process each aggregate in version order. Delay or dead-letter a version gap rather than applying newer state first.
- Persist `integration_bindings` before considering a create successful. On ambiguous timeout, search/reconcile by canonical external ID before retrying create.
- Persist append-only attempt receipts. Never store raw authorization headers or unredacted provider responses.
- Retry `429`, timeouts, and classified `5xx` with exponential backoff and jitter; do not retry validation, authorization, or schema mismatch without intervention.
- Dead-letter after the configured attempt/age budget and surface it in Listing Admin Integration Health.
- Reconciliation compares Supabase canonical state to provider projection and produces a report. Repairs require an explicit replay/repair command and audit receipt.

## 15. Security, privacy, and consent

- Use a dedicated Local775 location and least-privilege sub-account credentials.
- Keep provider tokens server-only and rotate Private Integration tokens on a 90-day schedule or immediately after suspected exposure.
- Redact Resident PII, business private email, Claim Proof, message bodies, tokens, and provider payloads from logs, analytics, errors, URLs, and source control.
- Encrypt secrets through the approved platform secret manager; never store them in Supabase tables.
- Apply purpose-specific consent. A service request can trigger service communications; it cannot enroll the person in Local775 marketing.
- A verified WorkOS email change invokes one audited Supabase transition that suspends any Operator Grant, invalidates Lead Recipient destination verification, cancels queued sends to the old destination, and emits relation/workflow unenrollment events. The new address gains no privileged delivery or Operator capability until manual reapproval.
- Respect Contact DND/channel state. A failed channel does not justify bypassing consent through another channel.
- Enforce deletion requests in Supabase and define the GHL contact/Opportunity redaction or deletion action with a receipt, subject to documented legal/fraud holds.
- Keep private evidence and webhook bodies on shorter, explicit retention schedules; keep non-sensitive audit hashes and decisions.
- Add Sentry redaction tests before enabling integration traces.

## 16. Implementation waves

Each wave is a deployable vertical slice and has its own tests, rollback, and approval boundary.

### Wave 0 — Reconcile and prove the baseline

**Depends on:** none
**Files:** current Claim migration/modules/tests, handoff, ADRs
**Work:** rebase the branch, inspect current Preview/Production migration state, run the existing pgTAP Claim workflow in an isolated database, complete the human WorkOS Preview session/Actor projection check, and publish a no-effect baseline receipt.
**Exit:** all existing checks pass; no credential or environment ambiguity; no Production change.

### Wave 1 — Complete Claim evidence and Operator review

**Depends on:** Wave 0
**Work:** private signed upload, file validation/scan adapter, proof finalization, 30-day deletion scheduling, Claim withdrawal, Operator queue, approve/reject UI, authority revocation, complete audit history.
**Tests:** malicious filename/content, oversized file, wrong Listing, expired upload, rejected scan, missing proof, concurrent decisions, replay, retention deletion, public leakage negative.
**Exit:** one synthetic Claim completes every terminal path in Preview without GHL.

### Wave 2 — Participation, invitations, and capability engine

**Depends on:** Wave 1
**Work:** invitation lifecycle, two/three/three locked caps, separate Lead Recipient designation, capability query, revocation/expiry, owner self-lockout recovery, negative RLS.
**Tests:** concurrent last-seat acceptance, wrong email, reused/expired token, unauthorized inviter, revoked immediate denial, Agency Lead PII denial.
**Exit:** database and HTTP tests prove the exact role matrix.

### Wave 3 — Public Lead intake and assignment

**Depends on:** Wave 2
**Work:** implement the claimed/eligible Listing gate, public disclosure/form, `submit_listing_lead` transaction, seven-day duplicate receipt, initial assignment, service consent, deletion request, delivery metric, and outbox event. Add the separate authenticated `request_growth_help`/withdrawal flow, canonical Growth Lead/events, consulting-contact consent, and outbox event.
**Tests:** unclaimed/ineligible denial, malformed contact/ZIP/request, missing consent, spam/rate control, concurrent duplicate submission, atomic Lead/event/assignment/outbox, public-safe response, deletion receipt, explicit Growth Lead consent/idempotency/withdrawal, and negative proof that Claim/Resident Lead/Featured/payment events cannot create a Growth Lead.
**Exit:** a synthetic eligible Listing creates exactly one durable Resident Lead and queued assignment; an unclaimed Listing exposes no form; an explicit Owner request creates one separate Growth Lead, while every implicit path creates none.

### Wave 4 — Dynamic Listing Studio core

**Depends on:** Waves 2–3
**Work:** replace the shell with pending Claim, Overview, Listing, Media, People, Leads, Offers, and Claim modules; add proposals/review states, role-filtered Lead views, and mobile/accessibility coverage. Render Integration Health as unavailable until Wave 5 rather than claiming provider state.
**Tests:** pending-claimant isolation; role-by-role route and command tests; permission-loss mid-session; stale version conflict; keyboard/focus; mobile Playwright; public/private boundary.
**Exit:** each role and the non-authority pending claimant sees and can execute exactly its Supabase-backed capabilities against synthetic Preview data.

### Wave 5 — GHL adapter, outbox dispatcher, and Integration Health

**Depends on:** Waves 2–3; can overlap late Wave 4
**Work:** integration tables, `GhlPort`, fake adapter, LeadConnector adapter, lease/retry/dead-letter worker, bindings, receipts, reconciliation report, Integration Health query.
**Tests:** contract fixtures, timeout-after-create, `429`, `5xx`, invalid schema, duplicate event, version gap, expired lease, dead-letter/replay, secret/PII log scan.
**Exit:** deterministic fake proves Contact → Listing → relation → Opportunity flow with no network, and the Admin/Owner Integration Health projections are truthful.

### Wave 6 — Dedicated GHL schema provisioning

**Depends on:** Wave 5 and receipt of Location ID/token
**Effect gate:** explicit approval to mutate the dedicated Local775 location schema
**Work:** verify Location identity, snapshot current schema, and validate token scopes. Apply only currently supported object/custom-field/association API mutations from `integration-manifest.json`. Create pipelines, stages, and disabled workflows through the gated Admin-UI checklist, then verify all names/order/IDs through read-only endpoints and persist bindings outside source.
**Rollback:** delete only synthetic records/relations; disable workflows and runtime flag. Do not delete the immutable object schema as routine rollback.
**Exit:** schema verification matches the manifest exactly and no real Contact is touched.

### Wave 7 — Synthetic outbound projection

**Depends on:** Wave 6
**Work:** project one synthetic participant Contact, synthetic Listing, labeled relation, synthetic resident Contact, synthetic Resident Lead Opportunity, and separately consented synthetic Growth Lead Opportunity; update and revoke/withdraw them; reconcile every receipt.
**Tests:** repeat the full run twice, interrupt after every provider operation, mutate one provider field, remove one relation, and prove deterministic detection/repair proposal.
**Exit:** zero duplicates, zero unexplained drift, and a complete Site ↔ Supabase ↔ GHL receipt chain.

### Wave 8 — Communication workflows

**Depends on:** Wave 7
**Effect gate:** synthetic-recipient sends only
**Work:** configure Claim, participation, Resident Lead, explicit Growth Lead, Listing-change, Featured, and failure workflows; use labeled associated-Contact enrollment where appropriate; enforce purpose/channel/DND rules; store workflow and message receipts.
**Tests:** approved test inbox/phone only, recipient label filtering, fallback order, opt-out/DND, duplicate event, reminder cancellation, revocation unenrollment, delivery failure escalation.
**Exit:** approved synthetic recipients receive the correct Listing context once, and Supabase records delivery evidence.

### Wave 9 — Signed inbound events and proposals

**Depends on:** Waves 7–8
**Work:** raw-body signature verification, inbox dedupe, asynchronous translator, Record/Relation/Opportunity/Contact/message/billing handlers, proposal queue, rejected-event diagnostics.
**Tests:** Ed25519 fixtures, tampered body, missing signature, wrong Location, duplicate/out-of-order event, unsupported event, provider retry, and proposal review. A disabled, date-bounded RSA fixture is added only if credentialed discovery proves a still-active legacy subscription; it is never an enabled fallback and must be removed before 2026-09-01.
**Exit:** GHL edits create proposals or evidence only; no event can directly grant authority or publish.

### Wave 10 — Full Preview UAT and security review

**Depends on:** Waves 1–9
**Work:** run end-to-end role journeys, recovery drills, threat review, database advisors, secret scan, accessibility, performance, redaction, backup/rollback rehearsal, and reconciliation at scale with synthetic records.
**Exit:** signed Preview Acceptance Packet with every failure explained; no real send, charge, call, DNS, or Production effect.

### Wave 11 — Production canary

**Depends on:** accepted Preview packet
**Effect gates:** separately approve Production migrations, deployment, GHL production activation, named real recipients/channels, and any financial/phone effect
**Work:** backup/snapshot, additive migration, deploy with GHL writes disabled, verify read paths, enable one named canary Listing, send only approved communications, reconcile Site/Supabase/GHL, observe, then approve or roll back.
**Rollback:** disable integration flag/workflows, stop dispatch leases, roll the application back, and preserve inbox/outbox/receipts. Production database correction is forward-only through a reviewed corrective migration. Snapshot restoration is limited to an explicitly approved disaster-recovery procedure, never routine release rollback.
**Exit:** canary acceptance at the real public and authenticated URLs, not merely deployment health.

### Wave 12 — Controlled expansion and operations handoff

**Depends on:** accepted canary
**Work:** batch activation with caps, dashboards/alerts, dead-letter runbook, token rotation, schema-drift check, reconciliation schedule, on-call ownership, privacy deletion runbook, and post-launch review.
**Exit:** operating receipt identifies owners, schedules, thresholds, rollback authority, and retirement criteria for temporary compatibility paths.

## 17. Executable build plans

Each plan below is independently reviewable and maps one-to-one to its wave. Future paths are intentional deliverables; existing paths are named where they are extended. A task is complete only when its code, automated proof, and receipt land together.

### Execution accounting and Linear gate

Before implementation starts, every plan receives a dependency-ready CLE ticket linked to this document and its predecessor tickets. CLE-101 remains the accepted specification pointer and CLE-106 remains the existing identity slice; no new issue number is invented in this plan. Creating or updating Linear tickets is an execution action and occurs only after authorization.

Each ticket receipt records: plan ID, dependency state, branch and commit, affected environment, effect gate, exact verification commands/results, artifact links, rollback or forward-correction path, and the next approval owner. No plan begins without that receipt stub and no ticket closes on code completion alone.

### P00 — Baseline reconciliation (Wave 0)

1. Rebase and reconcile `docs/handoffs/current.md`, `docs/SPEC.md`, `docs/PROJECT-DECISIONS.md`, `docs/adr/0002-platform-ownership-and-integration-boundaries.md`, and `docs/adr/0003-single-gohighlevel-listings-object.md`; write the no-effect baseline receipt to `docs/evidence/claims-studio/p00-baseline.md`.
2. Pin the Supabase CLI in `devDependencies` and add `test:db` (`supabase db reset --local && supabase test db`) to `package.json`/`package-lock.json`; run `npm run test:db`, `npm test`, `npm run typecheck`, `npm run lint`, `npm run build`, and `npm run security:secrets`.
3. Complete the manual WorkOS Preview session/Actor projection journey and attach redacted evidence to the P00 receipt. Done means repository, database, and Preview identity state agree and no external system changed.

**Verification:** `npm run test:db && npm test && npm run typecheck && npm run lint && npm run build && npm run security:secrets`.

### P01 — Claim evidence and review (Wave 1)

1. Add `supabase/migrations/20260901090000_complete_claim_evidence.sql` and extend `supabase/tests/claims_workflow.sql` for private proof metadata, signed-upload finalization, scan state, withdrawal, decision concurrency, revocation, retention, and append-only audit/outbox invariants.
2. Extend `src/lib/directory/claim-handler.mjs`, `src/lib/directory/claims.ts`, and `src/lib/supabase/claim-commands.mjs`; add `src/lib/directory/claim-evidence.server.ts`, `src/lib/directory/claim-proof-scanner.ts`, `src/lib/directory/fake-claim-proof-scanner.ts`, `infra/claim-proof-scanner/Dockerfile`, `src/components/studio/claim-panel.tsx`, and `src/routes/ops.claims.tsx` for the fail-closed quarantine/scanner and claimant/Admin journeys.
3. Extend `scripts/claim-commands.test.mjs`; add `scripts/claim-evidence.test.mjs`, `scripts/claim-proof-scanner.integration.mjs`, and clean/malformed/infected/timeout fixtures under `tests/fixtures/claim-proof/`. Done means every Claim terminal path and evidence failure passes locally and in Preview without GHL; Preview cannot enable proof submission until the pinned scanner health receipt and any required runtime/spend approval exist.

**Verification:** `npm run test:db && node --test scripts/claim-commands.test.mjs scripts/claim-evidence.test.mjs`, then `docker build -t local775-claim-proof-scanner:test infra/claim-proof-scanner` and `node scripts/claim-proof-scanner.integration.mjs --image local775-claim-proof-scanner:test`.

### P02 — Capability, invitation, and destination authority (Wave 2)

1. Add `supabase/migrations/20260901092000_add_listing_invitations_and_capabilities.sql` and `supabase/tests/listing_access.sql` for the two/three/three seat caps, invitations, Lead Recipient designation, command-specific capabilities, revocation, and concurrent acceptance.
2. Add `src/lib/directory/listing-access.ts`, `src/lib/directory/listing-access-handler.mjs`, and `src/lib/supabase/listing-access-commands.mjs`; remove route dependence on broad `app.can_manage_listing` and expose only the stable capability identifiers in section 5.
3. Add `scripts/listing-access.test.mjs`, including `apply_actor_email_change` suspension, queued-send cancellation, old-destination invalidation, and manual reapproval. Done means pgTAP and server tests prove every allow and deny cell in the role matrix.

**Verification:** `npm run test:db && node --test scripts/listing-access.test.mjs`.

### P03 — Resident and explicit Growth Lead intake (Wave 3)

1. Add `supabase/migrations/20260901094000_add_lead_intake_and_assignments.sql`, `supabase/tests/lead_intake.sql`, and `supabase/tests/growth_leads.sql` for Resident Lead/assignment/consent/event/deletion/outbox transactions plus explicit Growth Lead/consent/event/withdrawal/outbox transactions.
2. Add `src/components/directory/lead-form.tsx`, `src/components/studio/growth-help.tsx`, `src/lib/directory/{leads,growth-leads}.ts`, `src/lib/directory/{lead,growth-lead}-handler.mjs`, and `src/lib/supabase/{lead,growth-lead}-commands.mjs`; integrate the public form into `src/routes/biz.$slug.tsx` and the explicit help action into `src/routes/studio.$slug.tsx`.
3. Add `scripts/lead-intake.test.mjs` and `scripts/growth-lead.test.mjs` for abuse controls, duplicate concurrency, public-safe responses, atomic failure, explicit consulting consent, withdrawal, mapping, and all implicit-creation negatives. Done means an eligible Listing produces one Resident Lead chain, an ineligible Listing renders no intake, and only an explicit authorized action produces one separate Growth Lead chain.

**Verification:** `npm run test:db && node --test scripts/lead-intake.test.mjs scripts/growth-lead.test.mjs`.

### P04 — Dynamic Listing Studio (Wave 4)

1. Add `src/lib/directory/studio.ts`, `src/lib/directory/studio-handler.mjs`, and `src/components/studio/{overview,listing,media,people,leads,offers,integration-health}.tsx`; refactor `src/routes/studio.$slug.tsx` to render only server-returned modules and capabilities.
2. Add proposal commands and read models in `src/lib/supabase/studio-commands.mjs` plus `supabase/migrations/20260901095000_add_listing_change_proposals.sql` and `supabase/tests/studio_capabilities.sql`.
3. Add `scripts/studio-capabilities.test.mjs`, `playwright.config.ts`, and `tests/e2e/studio-roles.spec.ts`. Done means Admin, Owner, Manager, Agency, Lead Recipient, pending claimant, and revoked Actor journeys pass on mobile and desktop with mid-session permission loss tested.

**Verification:** `npm run test:db && node --test scripts/studio-capabilities.test.mjs && npx playwright test tests/e2e/studio-roles.spec.ts`.

### P05 — Integration core and truthful health (Wave 5)

1. Add `supabase/migrations/20260901100000_add_integration_delivery_state.sql` and `supabase/tests/integration_delivery.sql` for bindings, leases, attempts, inbox/outbox, dead letters, replay, and correlation invariants.
2. Add `src/lib/integrations/event-registry.ts`, `src/lib/integrations/ghl/port.ts`, `src/lib/integrations/ghl/fake.ts`, `src/lib/integrations/ghl/leadconnector.ts`, and `src/lib/integrations/ghl/projection.ts`; routes may depend only on the port/application service.
3. Add `supabase/functions/dispatch-ghl-outbox/index.ts`, `supabase/functions/reconcile-ghl/index.ts`, and `scripts/ghl-adapter.test.mjs`. Done means the fake passes timeout-after-create, retry, ordering, lease, drift, repair, and redaction tests with no network.

**Verification:** `npm run test:db && node --test scripts/ghl-adapter.test.mjs && npm run security:secrets`.

### P06 — Dedicated GHL schema provisioning (Wave 6)

1. Add non-secret `config/ghl/integration-manifest.json` and `scripts/ghl/{verify-location,inventory,plan-schema,apply-schema,verify-schema}.mjs`; the manifest contains the Listing object fields, Contact/Opportunity custom fields, associations, exact pipeline/stage names, and workflow names/expected IDs. Every supported mutating API command requires both `--target` and `--apply` and otherwise emits a read-only plan.
2. Credentialed execution first writes a redacted inventory to `docs/evidence/claims-studio/p06-ghl-inventory.json`, then—after the separate schema gate—applies only supported object/custom-field/association mutations. Execute `docs/runbooks/ghl-ui-provisioning.md` for pipeline/stage/workflow creation, capture before/after receipts, verify everything read-only, and record provider IDs in the approved environment configuration.
3. Add `scripts/ghl-schema.test.mjs` for full manifest validation, target mismatch, scope denial, unsupported-write refusal, dry-run default, partial apply, repeat apply, and pipeline/stage/workflow read-only drift. Done means two verify runs match the complete manifest and no real Contact exists or changed.

**Verification:** local: `node --test scripts/ghl-schema.test.mjs`; after credentials, read-only: `node scripts/ghl/inventory.mjs --target preview` and `node scripts/ghl/verify-schema.mjs --target preview`. The gated apply command is `node scripts/ghl/apply-schema.mjs --target preview --apply`.

### P07 — Synthetic projection and reconciliation (Wave 7)

1. Add `src/lib/integrations/ghl/mappers/{contact,listing,relation,resident-lead-opportunity,growth-lead-opportunity}.ts` and handlers that persist bindings before completion and reconcile ambiguous creates by canonical external ID.
2. Add `scripts/ghl/synthetic-projection.mjs` and `scripts/ghl/reconcile.mjs`, both hard-coded to reject non-synthetic fixtures unless a later Production gate supplies the explicit canary ID.
3. Add `scripts/ghl-projection.test.mjs` and run the approved synthetic cycle twice with interruption injection. Tests prove Resident and Growth Opportunities use different pipelines/IDs/consent purposes and that no implicit event invokes the Growth mapper. Done means zero duplicates and one correlated receipt chain across Site, Supabase, and GHL.

**Verification:** local: `node --test scripts/ghl-projection.test.mjs`; after the synthetic-write gate: `node scripts/ghl/synthetic-projection.mjs --target preview --fixture local775-p07 --apply` twice, then `node scripts/ghl/reconcile.mjs --target preview --fixture local775-p07 --read-only`.

### P08 — Receipt-bearing communications (Wave 8)

1. Add `supabase/migrations/20260901104000_add_communication_jobs.sql`, `src/lib/communications/{policy,renderer,scheduler}.ts`, and Supabase commands for immutable payload hash, idempotency key, cancellation key, consent, DND, and delivery evidence.
2. Extend `src/lib/integrations/ghl/port.ts` and `leadconnector.ts` with direct conversation/message operations; configure GHL workflows only where the synthetic associated-Contact canary proves correct Listing context.
3. Add `scripts/communication-policy.test.mjs` and `scripts/ghl/synthetic-communications.mjs`, including Growth request/withdrawal isolation from Resident Lead recipients. Done means each approved test recipient receives the correct event once, revocation/reminder cancellation works, and no mutable Contact field carries event context.

**Verification:** local: `node --test scripts/communication-policy.test.mjs`; after the synthetic-send gate and approved fixture registration: `node scripts/ghl/synthetic-communications.mjs --target preview --fixture local775-p08 --apply`.

### P09 — Signed inbound translation (Wave 9)

1. Add `supabase/functions/ghl-webhook/index.ts`, `src/lib/integrations/ghl/signature.ts`, and `supabase/tests/ghl_inbox.sql`; verify the untouched raw body and Ed25519 signature before parsing or enqueueing.
2. Add `src/lib/integrations/ghl/translator.ts` and versioned handlers under `src/lib/integrations/ghl/events/` for Record, Relation, Opportunity, Contact, message, and billing evidence. Unsupported or invalid input is retained without domain mutation.
3. Add `scripts/ghl-webhook.test.mjs` with official/local fixtures for tampering, replay, wrong Location, ordering, and proposals. Done means no inbound event can publish, grant authority, or directly overwrite protected truth.

**Verification:** `npm run test:db && node --test scripts/ghl-webhook.test.mjs`.

### P10 — Preview acceptance (Wave 10)

1. Add `tests/e2e/claim-to-lead.spec.ts`, `tests/e2e/ghl-recovery.spec.ts`, and `tests/e2e/privacy-and-access.spec.ts`; run all role, Claim, Lead, communication, revocation, email-change, and outage journeys with synthetic data.
2. Add `scripts/preview-acceptance.mjs` to collect redacted test, schema, drift, security, accessibility, performance, and rollback evidence into `docs/evidence/claims-studio/p10-preview-acceptance.md`.
3. Update `docs/runbooks/ghl-integration.md` and `docs/handoffs/current.md`. Done means the human-signed packet explains every check and no real recipient, charge, call, DNS, or Production effect occurred.

**Verification:** `npx playwright test tests/e2e/claim-to-lead.spec.ts tests/e2e/ghl-recovery.spec.ts tests/e2e/privacy-and-access.spec.ts && npm run test:db && npm test && npm run typecheck && npm run lint && npm run build && npm run security:secrets`, followed by `node scripts/preview-acceptance.mjs --target preview`.

### P11 — Production canary (Wave 11)

1. Add `scripts/release/claims-studio-canary.mjs` and `docs/runbooks/claims-studio-release.md` with explicit environment, canary Listing, channel, migration, deploy, pause, and forward-correction gates; the script defaults to read-only.
2. Apply separately approved additive migrations/deploy, verify writes disabled, then enable only the named Listing and recipient/channel. Capture real public URL, authenticated Studio, Supabase, GHL, and communication receipts in `docs/evidence/claims-studio/p11-production-canary.md`.
3. Exercise application rollback/kill switches without database rollback. Done means the named acceptance owner signs the canary and reconciliation is clean throughout the observation window.

**Verification:** read-only rehearsal: `node scripts/release/claims-studio-canary.mjs --target production --canary-listing APPROVED_LISTING_ID --read-only`; the effectful form replaces `--read-only` with `--apply` only at the named gate, then repeats the command with `--verify`.

### P12 — Controlled expansion and operations (Wave 12)

1. Add `docs/runbooks/{ghl-outage,ghl-token-rotation,ghl-schema-drift,ghl-dead-letter,ghl-privacy-deletion}.md` and alert thresholds to `config/ghl/operations.json`.
2. Add `scripts/ghl/operations-health.mjs` and scheduled reconciliation with bounded batch activation and explicit stop thresholds; validate dashboards and alerts through injected failures.
3. Record ownership, schedules, escalation, privacy retention, temporary-path retirement, and expansion approvals in `docs/evidence/claims-studio/p12-operations-handoff.md`. Done means an operator who did not build the system can detect, pause, diagnose, reconcile, and recover it from the runbooks.

**Verification:** `node scripts/ghl/operations-health.mjs --target production --read-only && npm run test:db && npm test && npm run typecheck && npm run lint && npm run build && npm run security:secrets` plus alert-injection evidence in the P12 handoff.

### Build artifacts

The completed build produces: versioned Supabase migrations and pgTAP suites; stable capability and event registries; Claim, Lead, Studio, and integration application services; `GhlPort` plus fake and LeadConnector adapters; a non-secret GHL manifest and guarded provisioning scripts; outbox, inbox, dispatcher, webhook, reconciliation, and communication workers; role-based browser journeys; release/runbook artifacts; and correlated Preview/Production acceptance receipts.

## 18. Verification matrix

| Layer       | Required proof                                                                                   |
| ----------- | ------------------------------------------------------------------------------------------------ |
| Pure policy | unit tests for roles, transitions, event mapping, retry classification, redaction                |
| Database    | isolated Supabase migrations + pgTAP RLS, RPC, concurrency, idempotency, audit/outbox            |
| Site server | authenticated HTTP/server-function tests using real JWT claims and isolated data                 |
| GHL adapter | deterministic fake plus official request/response fixtures; no network in routine tests          |
| Contract    | read-only schema/scope verification against the dedicated location                               |
| Browser     | mobile-primary Claim and Studio journeys for every role; focused desktop/cross-browser smoke     |
| Preview E2E | synthetic Contact/Listing/relation/Opportunity/workflow/webhook/reconciliation receipt chain     |
| Security    | signature tampering, token redaction, PII leak search, RLS bypass, replay, wrong-location denial |
| Production  | one approved canary at real URLs with matching Supabase and GHL receipts                         |

Repository completion checks remain `npm test`, `npm run typecheck`, `npm run lint`, `npm run build`, `npm run security:secrets`, relevant pgTAP, and relevant Playwright journeys. Provider validation scripts must default to read-only/dry-run and require target plus effect flags for mutations.

## 19. Observability and operating controls

- Metrics: outbox age/depth, delivery latency, attempt count, dead letters, webhook rejection/failure, projection drift, Lead time-to-delivery, Lead time-to-contact, Claim age, invitation expiry, workflow failures.
- Alerts: oldest pending Lead event, any invalid signature spike, wrong-location event, dead letter, cap invariant failure, reconciliation mismatch above threshold, token nearing rotation.
- Correlation: one ID links Site request, domain command, audit row, outbox event, provider request, GHL record/message, webhook, inbox row, and Lead/Claim event.
- Admin UI: filter by Listing, event, status, correlation ID, and provider record; replay is a named command requiring reason and recent authentication.
- Runbooks: GHL outage, expired/rotated token, webhook circuit breaker, duplicate Contact, schema drift, stuck lease, dead letter, bad workflow, wrong recipient, privacy deletion, and Production disable.

## 20. Release gates and rollback rules

Planning completion does not authorize execution. These approvals are distinct:

1. Credential access and read-only location verification.
2. GHL schema/pipeline/workflow provisioning in the dedicated location.
3. Synthetic external writes.
4. Synthetic email/SMS/call effects.
5. Supabase Production migration.
6. Vercel Production deployment.
7. Named real communication canary.
8. Financial, phone-number, DNS, privacy/legal, or new-spend effects.

The application has kill switches for GHL writes, workflow enrollment, inbound translation, and each communication channel. Disabling an integration stops new effects without deleting canonical Supabase events or receipts.

## 21. Credential handoff checklist

When build execution is authorized, provide through the approved secret path rather than chat:

- confirmation that the Location ID belongs to the dedicated Local775 sub-account;
- `GHL_LOCATION_ID` and a distinct least-privilege steady-state runtime Private Integration token;
- either a separately scoped temporary provisioning token that will be revoked immediately after P06, or confirmation that the user will complete the gated `docs/runbooks/ghl-ui-provisioning.md` checkpoint instead of granting provisioning credentials;
- a screenshot/export of each token's selected scopes without exposing either token;
- the dedicated location's duplicate-contact setting and sending-domain/phone readiness;
- Local775 OAuth app client credentials and approved event-subscription access for the native Ed25519 webhook channel; without these, inbound translation remains disabled and read-only polling/reconciliation is used;
- approved synthetic recipient email and phone, if any external send tests are authorized;
- the specific permission for schema provisioning, synthetic writes, and synthetic sends—each independently.

The first credentialed action is read-only: fetch the location, enumerate schemas/associations/pipelines/workflows, compare them with this plan, redact the receipt, and stop if the location identity or scope differs.

## 22. Definition of done

- Claims are evidence-based, review-gated, auditable, revocable, and do not grant premature authority.
- Seat caps and diminishing capabilities hold under concurrent and adversarial tests.
- The Listing Studio is dynamic, mobile-accessible, and server-authorized for every role.
- Supabase is the sole authority for Listings, participations, Leads, entitlements, audit, and integration state.
- GHL contains one reconciled `Listings` object, correct Contacts/relations, separate Lead pipelines, and tested workflows.
- Provider failures lose no canonical event and create no unexplained duplicate.
- GHL edits become proposals/evidence, never direct public truth or authority.
- Service and marketing consent remain separate and enforceable.
- Every external effect has an immutable, correlated receipt and a tested recovery path.
- Preview acceptance, security review, rollback rehearsal, named Production canary, and public/authenticated URL verification all pass.
- Temporary compatibility behavior has an owner, cutover criterion, rollback path, and retirement date.

## 23. Current official GHL references

- Custom objects API: https://marketplace.gohighlevel.com/docs/ghl/objects/custom-objects-api/
- Create custom-object record: https://marketplace.gohighlevel.com/docs/ghl/objects/create-object-record/
- Associations and relations: https://marketplace.gohighlevel.com/docs/ghl/associations/associations/
- Private Integration tokens: https://marketplace.gohighlevel.com/docs/Authorization/PrivateIntegrationsToken/
- Scopes: https://marketplace.gohighlevel.com/docs/Authorization/Scopes/
- Webhook verification/retries: https://marketplace.gohighlevel.com/docs/2021-07-28/webhook/WebhookIntegrationGuide/
- Cross-object workflow routing: https://help.gohighlevel.com/support/solutions/articles/155000006701-custom-object-and-company-based-workflow-actions-triggers
- Association limits: https://help.gohighlevel.com/support/solutions/articles/155000005346-association-limits

Provider contracts are rechecked at implementation time because GHL APIs and workflow capabilities can change.
