---
status: accepted
---

> **Partially superseded:** [ADR 0003](./0003-single-gohighlevel-listings-object.md) replaces the two-custom-object GoHighLevel projection. All other ownership and integration boundaries in this ADR remain accepted.

# Supabase owns the directory while GoHighLevel operates the CRM projection

775 Directory will use Vercel for the web application, WorkOS for identity, Supabase as the sole application backend and directory source of truth, and GoHighLevel for CRM, communications, phone, pipeline, invoice, and payment operations through its connected Stripe account. Convex is excluded from v1 because it duplicates Supabase database, realtime, storage, function, and workflow responsibilities without a distinct bounded purpose.

GoHighLevel records are projections identified by canonical Supabase IDs. GoHighLevel-originated content changes enter Supabase as proposals requiring validation and review; they do not overwrite public directory records. Signed payment events prove transactions, while Supabase owns the normalized billing ledger and Featured entitlement state. ADR 0003 defines the accepted Contact, `Listings`, and labeled-relation shape.

WorkOS AuthKit owns authentication and supplies identity to Supabase through the supported third-party authentication path; Supabase Row Level Security owns application authorization. Supabase Edge Functions own external integration execution. Domain transactions and outbound events are committed together through a transactional outbox. Signed inbound provider events are durably recorded in an inbox, deduplicated, translated, retried, and reconciled before they alter domain state.

In GoHighLevel, a Contact is a Person projection and Opportunities represent Leads and Growth Leads rather than listings or participation. The custom-object shape described here is superseded by ADR 0003.

## Consequences

Cross-system work must use idempotent event delivery, immutable inbound receipts, explicit field ownership, replayable synchronization, and reconciliation. Listing Participation, service-request contact, and Marketing Consent remain separate facts. No direct dual writes or last-write-wins synchronization are permitted.
