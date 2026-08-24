---
status: accepted
---

# Supabase owns the directory while GoHighLevel operates the CRM projection

775 Directory will use Vercel for the web application, WorkOS for identity, Supabase as the sole application backend and directory source of truth, and GoHighLevel for CRM, communications, phone, pipeline, invoice, and payment operations through its connected Stripe account. Convex is excluded from v1 because it duplicates Supabase database, realtime, storage, function, and workflow responsibilities without a distinct bounded purpose.

GoHighLevel contacts, Directory Listing objects, and Listing Participation objects are projections identified by canonical Supabase IDs. GoHighLevel-originated content changes enter Supabase as proposals requiring validation and review; they do not overwrite public directory records. Signed payment events prove transactions, while Supabase owns the normalized billing ledger and Featured entitlement state.

WorkOS AuthKit owns authentication and supplies identity to Supabase through the supported third-party authentication path; Supabase Row Level Security owns application authorization. Supabase Edge Functions own external integration execution. Domain transactions and outbound events are committed together through a transactional outbox. Signed inbound provider events are durably recorded in an inbox, deduplicated, translated, retried, and reconciled before they alter domain state.

In GoHighLevel, a Contact is a Person projection, a Directory Listing custom object is a Business Listing projection, and a Listing Participation custom object carries the relationship between them. Opportunities represent Leads and Growth Leads rather than listings or participation.

## Consequences

Cross-system work must use idempotent event delivery, immutable inbound receipts, explicit field ownership, replayable synchronization, and reconciliation. Listing Participation, service-request contact, and Marketing Consent remain separate facts. No direct dual writes or last-write-wins synchronization are permitted.
