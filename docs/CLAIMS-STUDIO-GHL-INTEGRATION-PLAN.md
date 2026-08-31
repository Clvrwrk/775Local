# Claims, Listing Studio, and GoHighLevel Integration Plan

**Status:** implementation started; integration provisioning and real effects remain gated  
**Canonical source of truth:** Supabase  
**Authentication:** WorkOS  
**Operational communication projection:** dedicated Local775 GoHighLevel location

## Outcome

775Directory will accept evidence-based Claims, let authorized Listing Participants use one role-filtered Listing Studio, and project approved operational facts to GoHighLevel for email, SMS, phone, Lead workflows, and internal operations. GoHighLevel never grants Listing authority and never overwrites public Listing truth.

The first local implementation slice provides authenticated, idempotent Claim submission; truthful pending and needs-evidence states; Operator decision commands; capped Business Owner creation; audit records; transactional outbox events; and a server-authorized Studio shell. It does not provision GHL, upload real Claim Proof, send a message, create a Contact, or change Production.

## Canonical roles and limits

“Listing Admin” is the Studio label for the canonical **Local775 Operator**. It is not a Listing Participation and has no per-Listing seat limit. The other roles are Supabase Listing Participations.

| Studio label    | Canonical role        |     Limit per Listing | Authority summary                                                                                                |
| --------------- | --------------------- | --------------------: | ---------------------------------------------------------------------------------------------------------------- |
| Listing Admin   | Local775 Operator     |        separate grant | Claim review, protected changes, publication, participant recovery, integration reconciliation                   |
| Listing Owner   | Business Owner        |                     2 | manage content and participants; propose protected changes; manage Leads and Lead Recipients                     |
| Listing Manager | Listing Manager       |                     3 | manage content and assigned Leads; no authority delegation; no protected-change approval                         |
| Listing Agency  | Agency Representative |                     3 | propose marketing content and Featured work; no ownership; no participant administration; no Lead PII by default |
| Lead Recipient  | Lead Recipient        | separately designated | receive assigned Leads and update outcomes; no Listing-management authority                                      |

All capabilities are server-authorized and enforced again by Supabase Row Level Security or command functions. Interface visibility is only a usability projection.

## Claim lifecycle

1. A claimant starts from one existing published Business Listing.
2. WorkOS authenticates the person and the callback projects one minimal Actor into Supabase.
3. `submit_listing_claim` validates the Listing, Actor, method, and idempotency key.
4. Work-email evidence is verified on the server against the Listing website or private business-email domain. Personal-email providers never qualify as domain evidence.
5. Domain Claims enter `submitted`. Document, storefront, and vehicle Claims enter `needs_evidence` until private Claim Proof exists.
6. The Claim creates an append-only audit event and a GHL outbox event in the same transaction. It creates no Listing authority, Lead Recipient, entitlement, or public mutation.
7. A recently authenticated Local775 Operator with `claim_review` permission approves or rejects the Claim.
8. Approval requires acceptable evidence, obtains a per-Listing transaction lock, enforces the two-Owner limit, creates active Business Owner participation, updates the independent Owner verified label, and appends decision/projection events atomically.
9. Rejection changes no Listing authority. Terminal decisions are idempotent and auditable.
10. Claim Proof objects remain private, are deleted 30 days after decision, and retain only the accepted hash and decision receipt. Secure upload, malware-safe decode/re-encode, retention scheduling, and Operator review UI are the next Claim slice.

## System seams

### Claim module

Small interface:

- `submitClaim(listingId, method, idempotencyKey)`
- `getMyClaimOrParticipation(listingId)`
- `decideClaim(claimId, decision, reason, idempotencyKey)`

The implementation hides WorkOS token extraction, Supabase RPC mapping, domain-evidence verification, concurrency control, audit, and outbox creation. Tests use the same command interface with a deterministic fetch adapter; database acceptance exercises the RPC and RLS surface.

### Studio-access module

One query returns the effective role and scoped capabilities for one Actor and Listing. Every mutation is a separate command with a named permission. Routes never infer authority from public `owner_verified_at`, WorkOS login, payment, or GHL state.

### GHL projection module

The dispatcher consumes committed Supabase outbox rows, maps canonical IDs to GHL records, records immutable delivery receipts, retries safely, dead-letters exhausted work, and supports reconciliation. A deterministic fake is the test adapter; the production adapter uses a least-privilege token for the dedicated Local775 location.

## GHL object design decision

The accepted ADR currently specifies two custom objects: **Directory Listing** and **Listing Participation**. The new request specifies a **Listings** custom object. Current HighLevel supports Contact-to-custom-object associations with labels and configurable association limits, and exposes custom-object records through its API. That makes a one-custom-object projection feasible:

- `Contact` = Actor/Person communication projection.
- `Listings` custom object = Business Listing operational projection.
- Contact ↔ Listings association label = Owner, Manager, Agency, or Lead Recipient.
- `Opportunity` = Lead or Growth Lead, associated with Contact and Listing where supported.

**Recommended decision:** supersede the two-custom-object ADR design with one `Listings` custom object plus labeled Contact associations. Supabase retains the full Listing Participation record and its evidence, status, scope, expiry, revocation, and receipts. This minimizes duplicate CRM records and matches the requested GHL surface. Do not provision the irreversible schema until the ADR is explicitly accepted.

If GHL association API behavior in the dedicated location cannot reliably create, limit, and reconcile the required labels, retain the existing `Listing Participation` custom object as the fallback projection.

HighLevel currently documents up to ten custom objects per location, up to 300,000 records per object, ten unique labels between an object pair, API/webhook support, and configurable association limits. Object internal names and primary display fields cannot be changed later; provisioning therefore remains a reviewed checkpoint.

HighLevel also currently documents two constraints that shape the interface: only location admins can create, update, or delete custom-object definitions, and custom-object data is not yet supported directly in Conversations or bulk email/SMS. Listing Owners therefore use the Site Studio, not the GHL object interface. Communication workflows must address GHL Contacts and use explicit, tested Listing context; they must not assume a conversation can read arbitrary Listings-object fields.

Official references:

- https://marketplace.gohighlevel.com/docs/ghl/objects/custom-objects-api/
- https://marketplace.gohighlevel.com/docs/ghl/objects/create-object-record/
- https://marketplace.gohighlevel.com/docs/ghl/associations/create-association/
- https://help.gohighlevel.com/support/solutions/articles/155000006631-custom-objects-in-all-plans-higher-limit
- https://help.gohighlevel.com/support/solutions/articles/155000005346-association-limits

## Proposed `Listings` custom object

The internal key and primary display field are immutable after creation, so use:

- Internal key: `listings`
- Primary display field: `listing_name`
- Unique canonical key: `supabase_listing_id`

Projected fields are operational and intentionally narrow:

| GHL field             | Supabase owner                         | Direction      | Notes                                    |
| --------------------- | -------------------------------------- | -------------- | ---------------------------------------- |
| `supabase_listing_id` | `business_listings.id`                 | Supabase → GHL | immutable idempotency/reconciliation key |
| `stable_id`           | `business_listings.stable_id`          | Supabase → GHL | operator-friendly stable number          |
| `listing_name`        | `business_listings.display_name`       | Supabase → GHL | protected identity projection            |
| `listing_slug`        | `business_listings.current_slug`       | Supabase → GHL | canonical site link input                |
| `city`                | `business_listings.city_slug`          | Supabase → GHL | operational filter                       |
| `primary_category`    | primary Listing category               | Supabase → GHL | operational filter                       |
| `publication_status`  | `business_listings.publication_status` | Supabase → GHL | never edited as authority in GHL         |
| `owner_verified_at`   | `business_listings.owner_verified_at`  | Supabase → GHL | trust-state projection                   |
| `featured_status`     | computed entitlement                   | Supabase → GHL | never a mutable entitlement boolean      |
| `studio_url`          | canonical route builder                | Supabase → GHL | no sensitive query data                  |
| `sync_version`        | projection receipt                     | Supabase → GHL | compare-and-reconcile marker             |

Do not project Claim Proof, private evidence paths, audit bodies, Lead PII into the Listings object, raw provider payloads, or payment authority.

## Events and field ownership

Outbound event families:

- `claim.submitted`, `claim.approved`, `claim.rejected`
- `business_listing.projected`, `business_listing.changed`, `business_listing.suspended`
- `listing_participation.activated`, `.changed`, `.revoked`, `.expired`
- `lead.submitted`, `.assigned`, `.status_changed`, `.delivery_failed`
- `featured_entitlement.activated`, `.past_due`, `.ended`

Inbound GHL events first enter the signed, deduplicated Supabase inbox. Allowed inbound translations are operational receipts, Lead communication/delivery events, and proposed Listing changes. A GHL edit never directly mutates public Listing identity, participation, Claim status, or entitlement.

## Delivery phases

### Phase 1 — Claim truth and access foundation

- Finish private Claim Proof upload, validation, retention, and deletion.
- Add Operator Claim queue and decision interface.
- Add Claim withdrawal and revocation paths.
- Add invitation commands with transaction-locked limits: 2 Owners, 3 Managers, 3 Agencies.
- Add capability-specific command authorization and negative RLS tests.
- Replace the Studio shell with Listing, People, Leads, Offers, and Integration Health modules.

### Phase 2 — GHL schema and deterministic adapter

- Accept the one-object versus two-object ADR.
- Confirm the dedicated Local775 location and token scopes without using another business location.
- Create the schema manifest, immutable key receipt, association labels, and rollback constraints.
- Implement Contact, Listings, association, and Opportunity projection with deterministic fake tests.
- Prove one synthetic Contact workflow can receive the intended Listing context without relying on unsupported custom-object Conversations or bulk-send behavior.
- Add outbox lease/retry/dead-letter and reconciliation reports.

### Phase 3 — Preview acceptance

- Use synthetic Contacts, Claims, Listings, Participations, Leads, and delivery receipts only.
- Prove replay safety, association limits, role changes, revocation, dead-letter recovery, and GHL-originated proposal handling.
- Prove Preview sends no real email, SMS, call, invoice, or payment effect.

### Phase 4 — Production acceptance

- Produce the integration and Claim evidence packet.
- Obtain explicit approval for Production migrations, GHL schema provisioning, real messages/calls, and deployment.
- Run one individually approved canary Listing and reconcile Site ↔ Supabase ↔ GHL receipts before broader activation.

## Acceptance gates

- Login alone grants no Listing access.
- Claim submission grants no authority or Lead delivery.
- Domain evidence is revalidated on the server.
- Non-domain approval fails without retained Claim Proof.
- The two-Owner limit remains correct under concurrent approvals.
- Manager and Agency caps remain correct under concurrent invitations.
- Revoked or expired participation loses access immediately.
- Agency access exposes no Lead PII unless a separate Lead Recipient designation exists.
- Every external write is idempotent, receipt-bearing, replayable, and reconcilable.
- GHL cannot overwrite public Listing truth, grant participation, or create entitlement.
- Real communication and Production effects remain separately approved.
