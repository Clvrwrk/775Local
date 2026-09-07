# Listing Intelligence Ledger

This workflow creates a complete, private, source-linked evidence account for each Business Listing that has an owned website or a Facebook, Yelp, Houzz, or other directory landing page. It does not publish content, expose business email, or confer ownership.

## Data contract

`private.listing_intelligence_accounts` is the one-row-per-Listing index. A database trigger creates the row for every current or future `app.business_listings.website_url`. The service-role-only `register_listing_intelligence_sources` command replaces its reviewed source inventory when additional landing pages are discovered.

The raw account is normalized beneath that index:

- `private.listing_source_captures` records each terminal Firecrawl job, exact crawl configuration, credit receipt, manifest, completeness basis, and explicit blockers.
- `private.listing_source_capture_pages` records every returned page and links it to the byte-preserving, SHA-256-addressed payload in `private.enrichment_raw_artifacts`.
- `private.listing_source_fact_sets` stores private extracted emails, phones, addresses, service areas, services, key differentiators, top-service evidence, and claim-level page provenance.
- `private.listing_seo_audits` records each terminal DataForSEO OnPage task, page counts, score, request configuration, cost, limitations, and task identity.
- `private.listing_seo_audit_artifacts` links the complete Task POST/status/summary/pages/Lighthouse responses to the raw-artifact store.
- `app.listing_content_intelligence_candidates` contains evidence-linked, uniqueness-checked content proposals. It is an Operator review queue, not publication authority.

All raw/fact/audit tables have Row Level Security enabled and no direct authenticated access. Provider ingestion is limited to service-role-only commands; page and audit evidence is append-only after finalization. Anonymous users cannot read candidate content. Business emails and residential addresses must never be copied into public content.

## Meaning of “complete”

For an owned website, complete means every page Firecrawl could discover and access under the recorded same-domain configuration was returned, all response pagination was drained, zero pages failed, no configured page limit was reached, and no robots/authentication/provider blocker remains. A website that hits its page cap is `partial`, never `complete`.

For Facebook, Yelp, Houzz, or another third-party directory, complete means the specific registered business landing page was captured. It does not mean crawling the third party's entire domain. A robots, authentication, terms, or provider restriction is recorded as `blocked` or `partial`; it is not bypassed.

The account-level capture status becomes complete only after every URL in the Listing's registered source inventory has a latest complete capture.

## Provider plan and spend gate

Create a source inventory JSON array containing `id`, `website_url`, and optional `source_urls`, then run:

```sh
npm run plan:listing-intelligence -- listing-sources.json --website-page-limit=500
```

The planner makes no provider call and no database write. It reports a worst-case Firecrawl credit envelope and DataForSEO dollar envelope before execution. A live runner must receive explicit caps at or above that reviewed estimate, stop before crossing either cap, retain task/job IDs and measured costs, and remain target-explicit to Supabase Preview. A Production migration or import remains separately gated.

The DataForSEO planner uses a conservative `$0.0018` per-page estimate for the selected Basic + resource-loading + JavaScript configuration. The provider's returned task cost remains authoritative and must be ledgered; the run stops if current pricing or actual task cost would cross the approved envelope. Targeted Lighthouse/browser-rendering checks require their own estimate because they use a different price tier.

Firecrawl uses whole-domain crawling only for owned websites, with subdomains and external links disabled and query parameters ignored. Third-party landing pages use a single-page capture. DataForSEO OnPage auditing applies only to owned websites; auditing Yelp/Facebook/Houzz as though they were the Listing's site would measure the platform rather than the business.

## Content acceptance

A proposed page must answer the local searcher's decision path for the supported top service: fit, service area, availability, relevant proof/differentiators, cost expectations where evidenced, process, risk/credentials where evidenced, and a truthful next step. Every factual claim must point to a source page or audit fact. Unsupported superlatives, inferred licenses, fabricated service areas, copied source prose, and copied competitor prose are prohibited.

Generation completion is not publication. The existing reviewed publication command and content-policy gates remain authoritative.
