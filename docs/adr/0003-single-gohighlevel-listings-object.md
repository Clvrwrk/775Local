---
status: accepted
---

# Project Listings through one GoHighLevel custom object

GoHighLevel will use one `Listings` custom object (`custom_objects.listings`) for the operational projection of a Supabase Business Listing. A GHL Contact represents a person, and labeled Contact-to-Listing relations represent active Owner, Manager, Agency, or Lead Recipient assignments; Supabase retains the canonical Listing Participation record, seat limits, authority scope, lifecycle, evidence, and audit history. This replaces ADR 0002's separate `Directory Listing` and `Listing Participation` custom objects because labeled relations provide the required CRM filtering and workflow routing without duplicating every participation as a second record.

## Consequences

- The immutable object key is `custom_objects.listings`; the primary display field is `listing_name`; `supabase_listing_id` is the external reconciliation key.
- Relation labels are projections only. Creating, editing, or deleting a GHL relation never grants or revokes Site authority.
- Supabase enforces at most two active Listing Owners, three active Listing Managers, and three active Listing Agencies per Listing. Lead Recipient is a separate designation and does not consume those seats.
- GHL workflows may route to associated Contacts by relation label, but Supabase delivery receipts and Lead events determine whether communication succeeded.
- If the dedicated Local775 location cannot pass the Preview association, workflow-routing, and reconciliation contract, integration activation stops. The fallback requires a new ADR rather than silently restoring the second custom object.
