# CLE-104 SERP Enrichment

This workflow creates private research candidates. It never selects, publishes, or writes canonical Business Listings.

## Evidence contract

- The queue is derived from the licensed Local775 workbook. A category must have at least 20 source rows, except for the explicitly accepted launch categories.
- Each run processes at most 20 pending categories.
- DataForSEO is the Google mobile-organic ranking source. The runner requests depth 100, removes directory, social, search, and duplicate domains, and retains the first 20 business-controlled domains.
- Tavily and Exa provide category-level corroboration. Their results never replace DataForSEO rank.
- Firecrawl recursively crawls each retained domain with robots respected, same-domain links only, discovery depth 3, query parameters ignored, and a hard 25-page cap. A receipt records when the cap is hit.
- Every result remains `private_candidate` until the existing CLE-104 human review and audited publication command accepts it. Login, payment, a successful crawl, or category completion grants no authority.

## Durable state

Large and potentially sensitive raw artifacts stay outside Git at:

`/Users/chussey/Library/CloudStorage/Dropbox-AIA4/Cleverwork Main/Local775Directory/serp-enrichment`

The root contains the immutable category queue and resumable `progress.json`. Each fixed 20-category batch contains provider search receipts, one JSON crawl/evidence receipt per candidate, and a summary. Failed crawls are retried inside their original batch; completed candidates are idempotently skipped. An evidence-backed SERP shortfall becomes a terminal blocked category instead of looping forever or being padded.

## Operator command

Run only with DataForSEO credentials already present in the process environment. Exa, Tavily, and Firecrawl may use the private Global Web Intel config when their environment variables are absent; that config must be owner-only (`0600`) and is never printed or copied:

```sh
npm run enrich:serp -- \
  --queue "/Users/chussey/Library/CloudStorage/Dropbox-AIA4/Cleverwork Main/Local775Directory/serp-enrichment/category-queue.json" \
  --output "/Users/chussey/Library/CloudStorage/Dropbox-AIA4/Cleverwork Main/Local775Directory/serp-enrichment" \
  --stage all \
  --batch-size 20
```

The process fails closed when credentials or provider responses are unavailable. It does not lower the 20-result target, broaden crawl scope, or publish partial data to make a batch appear complete.

## Accounting

Every run must add a no-secret receipt to [CAT-76](https://linear.app/cleverwork/issue/CAT-76/trailcle-104-build-local775-multi-provider-serp-enrichment-pipeline) and [CLE-104](https://linear.app/cleverwork/issue/CLE-104/launch-slice-seed-ingestion-and-reviewed-publication-set), linking the batch summary and recording category count, complete/failed candidate counts, provider task/job receipts, measured cost or credit usage, and unresolved shortfalls. The current project handoff must be updated whenever the queue, schedule, evidence boundary, or blocker changes.

## Completion estimate

The accepted queue currently has 232 categories, or 12 batches at 20 categories per run. After the initial batch, 11 nightly runs remain. At one successful batch per night, the nominal research-completion date is September 5, 2026; September 7 is the conservative estimate with two retry nights. This is an estimate for private research coverage only, not human review or publication.
