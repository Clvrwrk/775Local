# CLE-104 SERP Enrichment

This workflow creates private research candidates. It never selects, publishes, or writes canonical Business Listings.

## Evidence contract

- The queue is derived from the licensed Local775 workbook. A category must have at least 20 source rows, except for the explicitly accepted launch categories.
- Each run processes at most 20 pending categories. A queue entry may request 10 or 20 retained results; the runner never pads a short result set.
- DataForSEO is the Google mobile-organic ranking source. The runner requests depth 100, removes directory, marketplace, editorial-listicle, social, search, synthetic reserved-phone, and duplicate domains, applies bounded category relevance rules, and retains the first 20 business-controlled domains. Screen Repair requires both explicit Reno/Sparks/Northern Nevada evidence and explicit repair, rescreening, fixing, damage, or screen-replacement language; it rejects phone/device repair, auto glass, fireplace/chimney screens, generic or non-local service pages, generic window replacement, known device-repair hosts, manufacturer-owned distributor pages, unbranded lead-form sites, and new-screen-only sellers.
- Tavily and Exa provide category-level corroboration. Their results never replace DataForSEO rank.
- Firecrawl recursively crawls each retained domain with robots respected, same-domain links only, discovery depth 3, query parameters ignored, and a hard 25-page cap. A receipt records when the cap is hit.
- Every result remains `private_candidate` until the existing CLE-104 human review and audited publication command accepts it. Login, payment, a successful crawl, or category completion grants no authority.

## Durable state

Large and potentially sensitive raw artifacts stay outside Git at:

`/Users/chussey/Library/CloudStorage/Dropbox-AIA4/Cleverwork Main/Local775Directory/serp-enrichment`

The root contains the immutable category queue, resumable `progress.json`, and append-only `provider-ledger.jsonl`. The ledger preserves each future search/crawl cost or credit event, including DataForSEO task retries and terminal failures, crawl failures, zero-cost filter revalidations, and unavailable-cost flags, even when a category receipt is replaced by a retry. Superseded search receipts are archived before replacement; repeated searches under the same accepted filter are retained in the batch's `superseded-searches/` directory with timestamp-and-content-hash filenames. An accepted current-filter search receipt is reused even when it contains a shortfall, preventing paid searches from looping in an attempt to manufacture unavailable results. Each fixed 20-category batch contains provider search receipts, one JSON crawl/evidence receipt per candidate, and a summary. Completion counts only evidence receipts for domains in the current search receipt; stale or superseded domains cannot satisfy the target. Failed crawls are retried at most three times; an exhausted failure and any honest result shortfall settle as `complete_with_partial_data`. Completed and exhausted candidates are idempotently skipped. Partial evidence can produce a Basic/Unverified Listing after the separate publication safety gate; it is never silently discarded or mislabeled as verified.

Before resuming a paused retry batch, rebuild the checkpoint and summary from the current-domain joins without calling a provider:

```sh
npm run enrich:serp -- \
  --queue "/Users/chussey/Library/CloudStorage/Dropbox-AIA4/Cleverwork Main/Local775Directory/serp-enrichment/category-queue.json" \
  --output "/Users/chussey/Library/CloudStorage/Dropbox-AIA4/Cleverwork Main/Local775Directory/serp-enrichment" \
  --stage reconcile \
  --batch-size 20
```

The `reconcile` stage does not call DataForSEO, Exa, Tavily, or Firecrawl and does not append provider spend. It updates only `progress.json` and the batch `run-summary.json`; historical Listing receipts remain intact for audit. A category cannot become complete or terminally blocked unless its search receipt uses the runner's current accepted filter version.

## Operator command

Run only with DataForSEO credentials already present in the process environment. Exa, Tavily, and Firecrawl may use the private Global Web Intel config when their environment variables are absent; that config must be owner-only (`0600`) and is never printed or copied:

```sh
npm run enrich:serp -- \
  --queue "/Users/chussey/Library/CloudStorage/Dropbox-AIA4/Cleverwork Main/Local775Directory/serp-enrichment/category-queue.json" \
  --output "/Users/chussey/Library/CloudStorage/Dropbox-AIA4/Cleverwork Main/Local775Directory/serp-enrichment" \
  --stage all \
  --batch-size 20
```

The process fails closed when credentials or provider responses are unavailable. It does not lower a queue entry's result target, broaden crawl scope, pad shortfalls, or publish directly. `complete_with_partial_data` means the private evidence attempt is settled, not that a Listing was reviewed, verified, or published.

## Accounting

Every run must add a no-secret receipt to [CAT-76](https://linear.app/cleverwork/issue/CAT-76/trailcle-104-build-local775-multi-provider-serp-enrichment-pipeline) and [CLE-104](https://linear.app/cleverwork/issue/CLE-104/launch-slice-seed-ingestion-and-reviewed-publication-set), linking the batch summary and recording category count, complete/failed candidate counts, provider task/job receipts, measured cost or credit usage, and unresolved shortfalls. The current project handoff must be updated whenever the queue, schedule, evidence boundary, or blocker changes.

## Completion estimate

The accepted queue currently has 232 categories, or 12 batches at 20 categories per run. The August 26 reconciliation invalidated the filter-v2 batch-01 completion claim because stale receipts and known non-business domains were counted. The August 27 filter-v3 run was stopped after fresh receipts still admitted marketplace, directory, editorial-listicle, Google-redirect, and off-category device-repair results; those receipts and costs remain auditable but cannot complete a category. The filter-v4 replacement audit found a smaller second set of marketplace, directory, editorial, employment, union, lead-generation, and off-region results. Filter v5 reused clean v4 receipts with zero provider calls, then its replacement audit found one reserved-fictional-phone domain and one manufacturer-owned distributor page. Filter v6 excluded those cases, and its Screen Repair replacement audit found one remaining Superpages directory result. Filter v7 excluded that directory, but its audit showed that seven retained Screen Repair results sold new screens or screen rooms without explicit repair/replacement evidence. Filter v8 recorded a five-result semantic source shortfall, then its manual audit found two unbranded lead-form sites and one off-category fireplace-screen installer. Filter v9 excluded those cases and recorded a four-result shortfall, but its audit found two generic national pages with no local evidence. Filter v10 requires explicit local evidence, preserves the full audit chain, and keeps batch 01 pending until every retained current-domain receipt is valid. This is an estimate for private research coverage only, not human review or publication.
