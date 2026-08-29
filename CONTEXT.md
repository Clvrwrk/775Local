# 775 Directory

775 Directory is the local business-finding and neighborhood-mail context for the 775. This glossary fixes the product language shared by residents, business owners, operators, and the product team.

## Place and people

**775 Directory**:
The customer-facing directory for local businesses and residents in the 775.
_Avoid_: 775 Local, Local775, 775 news

**The 775**:
The product's geographic community, spanning Nevada's 775 area from the California border to West Wendover.
_Avoid_: Northern Nevada when used as product chrome, Reno-only

**Resident**:
A person in the 775 who finds businesses or registers their town, ZIP, and interests for neighborhood mail.
_Avoid_: User, consumer, subscriber

**Newcomer**:
A person learning the towns, services, and local businesses of the 775.
_Avoid_: Tourist

**Business Owner**:
A person authorized to claim and manage a Business Listing.
_Avoid_: Vendor, merchant when referring to listing ownership

**Agency Representative**:
A person explicitly authorized to manage or fund directory participation for a Business without becoming its Business Owner.
_Avoid_: Business Owner, Featured Customer

**Local775 Operator**:
A person authorized to review, support, or administer directory operations without acquiring ownership of a Business Listing.
_Avoid_: Business Owner, Directory User, Admin

**Operator Allowlist**:
The explicit set of approved email identities eligible for Local775 Operator access. Membership is necessary but not sufficient: mandatory multi-factor authentication and application authorization still apply.
_Avoid_: Admin domain, anyone at the company

**Operator Grant**:
The reviewed, auditable act that gives an allowlisted and MFA-enrolled person specific Local775 Operator permissions in Supabase. A WorkOS login or organization membership alone never creates an Operator Grant.
_Avoid_: Admin toggle, WorkOS role

**Sensitive Operator Action**:
An operation that can publish or suspend a Listing, approve or revoke authority, access protected Lead or call information, change entitlements, export data, or alter security configuration. It requires a recently reauthenticated Operator session and a durable audit event.
_Avoid_: Admin action, ordinary page view

## Directory

**Business**:
A local shop or service provider represented in 775 Directory.
_Avoid_: Account, vendor

**Business Listing**:
The always-free public directory record for one physical location or service-area operation of a Business, whether claimed or unclaimed. A Business may have one or more Business Listings, each with independent NAP, categories, Claims, Leads, Featured entitlement, and tracking-number state.
_Avoid_: Directory entry, Profile when referring to the canonical directory record

**Claim**:
The evidence-based process by which a Business Owner establishes authority over a Business Listing. An authenticated claimant may view Claim status and supply proof, but cannot edit the public Listing until approval.
_Avoid_: Registration, verification

**Claim Proof**:
Evidence used to establish a Claim when an authorized business domain cannot do so directly.
_Avoid_: Upload, attachment

**Listing Participation**:
The explicit, scoped, evidenced, revocable, and optionally expiring relationship between a person and one or more Business Listings, including the person's role, authority, and participation status. Payment never creates Listing Participation.
_Avoid_: Directory User, Ownership when the participant is not a Business Owner

**Lead Recipient**:
An active Listing Participant explicitly designated to receive a Business Listing's Leads at verified delivery destinations. Authority, Featured payment, and Lead Recipient status are independent permissions.
_Avoid_: Owner when delivery permission is the specific meaning

**NAP**:
The canonical public identity fields for a Business: name, address, and phone.
_Avoid_: Contact info when the specific NAP contract is meant

**Information checked**:
A public trust label meaning a Local775 Operator reviewed the Business Listing's current NAP and active-business evidence. It does not mean the Business Owner claimed or endorsed the Listing.
_Avoid_: Verified, Owner verified

**Owner verified**:
A public trust label meaning an approved Claim established a person's authority over the Business Listing. It is distinct from the accuracy or freshness of Listing data.
_Avoid_: Information checked, Claimed when the public trust meaning is intended

**Service-area Business**:
A Business that serves an approved geographic area without publishing a storefront address. Local775 retains reviewed evidence privately and never substitutes or exposes a residential address.
_Avoid_: Virtual Business, Home address

**Studio**:
The Business Owner workspace for managing Business Listing identity and content, Featured materials, Offers, and Leads.
_Avoid_: Dashboard, admin, GHL portal

**Lead**:
A resident's quote request associated with a Business Listing and delivered only to its designated Lead Recipients. Its canonical lifecycle is submitted, queued, delivered, viewed, accepted, contacted, and then won, lost, or spam.
_Avoid_: Message, inquiry, Growth Lead

**Recorded Featured Call**:
A call to a Featured tracking number whose audio is captured in GoHighLevel only after an explicit caller keypress grants consent. A caller who declines recording continues unrecorded. Audio is retained for 90 days and accessible only to authorized Local775 Operators, with every access audited. Recording is separate from call attribution metadata.
_Avoid_: Tracking Call when audio capture is the specific meaning

**Growth Lead**:
A Business Owner who explicitly requests consulting or marketing help beyond the directory product.
_Avoid_: Lead, automatic claim conversion, Resident Lead

**Production Acceptance Packet**:
The written evidence bundle covering launch data, security, integrations, performance, accessibility, rollback, DNS, and provider readiness. It informs but never substitutes for Christopher Hussey's explicit go-live approval.
_Avoid_: Deployment checklist when approval evidence is the intended meaning

**Marketing Consent**:
A person's explicit, timestamped permission to receive marketing through specified channels. Listing Participation and service-request contact do not create Marketing Consent.
_Avoid_: Implied consent, Participation

## Packages and outreach

**Featured**:
The scarce enhanced package for a claimed Business Listing, with preferential discovery and additional owner capabilities.
_Avoid_: Premium, sponsored, promoted

**Featured Customer**:
The Business Owner or explicitly authorized agency that purchases Featured for a Business Listing. Payment alone does not grant authority over the Business Listing.
_Avoid_: Marketing client, Subscriber, Buyer

**Offer**:
The single active deal published by a Business Listing.
_Avoid_: Coupon when referring to the canonical record

**Campaign**:
An owner-authorized neighborhood-mail effort sent on behalf of a Business Listing to an eligible resident audience.
_Avoid_: Blast, broadcast

**Virtual Mail**:
A Campaign delivered through an approved digital channel to consented residents.
_Avoid_: Email blast, virtual direct mail

**Direct Mail**:
A Campaign fulfilled as physical postal mail to an approved audience.
_Avoid_: Mail estimate
