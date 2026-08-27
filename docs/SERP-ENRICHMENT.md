# CLE-104 SERP Enrichment

This workflow creates private research candidates. It never selects, publishes, or writes canonical Business Listings.

## Evidence contract

- The queue is derived from the licensed Local775 workbook. A category must have at least 20 source rows, except for the explicitly accepted launch categories.
- Each run processes at most 20 pending categories.
- DataForSEO is the Google mobile-organic ranking source. The runner requests depth 100, removes directory, social, search, and duplicate domains, applies bounded category relevance rules, and retains the first 20 business-controlled domains. Screen Repair explicitly rejects phone/device repair, auto glass, and generic window-replacement results.
- Tavily and Exa provide category-level corroboration. Their results never replace DataForSEO rank.
- Firecrawl recursively crawls each retained domain with robots respected, same-domain links only, discovery depth 3, query parameters ignored, and a hard 25-page cap. A receipt records when the cap is hit.
- Every result remains `private_candidate` until the existing CLE-104 human review and audited publication command accepts it. Login, payment, a successful crawl, or category completion grants no authority.

## Durable state

Large and potentially sensitive raw artifacts stay outside Git at:

`/Users/chussey/Library/CloudStorage/Dropbox-AIA4/Cleverwork Main/Local775Directory/serp-enrichment`

The root contains the immutable category queue, resumable `progress.json`, and append-only `provider-ledger.jsonl`. The ledger preserves each future search/crawl cost or credit event, including failures and unavailable-cost flags, even when a category receipt is replaced by a retry. Superseded search receipts are archived before replacement. Each fixed 20-category batch contains provider search receipts, one JSON crawl/evidence receipt per candidate, and a summary. Completion counts only evidence receipts for domains in the current search receipt; stale or superseded domains cannot satisfy the target. Failed crawls are retried inside their original batch; completed candidates are idempotently skipped. An evidence-backed SERP shortfall becomes a terminal blocked category instead of looping forever or being padded.

Before resuming a paused retry batch, rebuild the checkpoint and summary from the current-domain joins without calling a provider:

```sh
npm run enrich:serp -- \
  --queue "/Users/chussey/Library/CloudStorage/Dropbox-AIA4/Cleverwork Main/Local775Directory/serp-enrichment/category-queue.json" \
  --output "/Users/chussey/Library/CloudStorage/Dropbox-AIA4/Cleverwork Main/Local775Directory/serp-enrichment" \
  --stage reconcile \
  --batch-size 20
```

The `reconcile` stage does not call DataForSEO, Exa, Tavily, or Firecrawl and does not append provider spend. It updates only `progress.json` and the batch `run-summary.json`; historical Listing receipts remain intact for audit. A category cannot become complete or terminally blocked unless its search receipt uses the runner's current accepted filter version.

## Supabase Preview archive and seed proposals

The disk artifact tree remains the immutable provider receipt. `npm run sync:enrichment` creates a content-addressed, byte-verifiable copy in Supabase Preview so future enhancement work can reuse saved evidence instead of paying for a full crawl again. The archive stores every JSON/JSONL artifact, including superseded and failed receipts, with its exact UTF-8 text, parsed JSON when valid, SHA-256 digest, byte count, relative path, source batch, and snapshot manifest.

The same deterministic pass builds private `seed-profile-v1` proposals for exactly the current 400 SERP results. It extracts source-linked business facts and ranks website-photo URL candidates with page provenance, alt text, role hints, same-site evidence, and an evidence score. It does not download or republish image bytes, assert photo rights, write canonical Listings, approve candidates, or change publication state. Human review must still verify identity, accuracy, image rights, and suitability before any field or photo is published.

Run a no-write inventory first and retain the printed manifest SHA-256:

```sh
npm run sync:enrichment -- \
  "/Users/chussey/Library/CloudStorage/Dropbox-AIA4/Cleverwork Main/Local775Directory/serp-enrichment"
```

An apply is permitted only against the persistent Preview ref `dpxeldzunfxmjahgvjhm`, with its branch-scoped service credential already in the process environment and the exact dry-run manifest supplied:

```sh
IMPORT_TARGET=preview \
PREVIEW_SUPABASE_PROJECT_REF=dpxeldzunfxmjahgvjhm \
SUPABASE_URL="https://dpxeldzunfxmjahgvjhm.supabase.co" \
SUPABASE_SERVICE_ROLE_KEY="<Preview service role key>" \
npm run sync:enrichment -- \
  "/Users/chussey/Library/CloudStorage/Dropbox-AIA4/Cleverwork Main/Local775Directory/serp-enrichment" \
  --apply \
  --expected-manifest="<dry-run manifest SHA-256>"
```

The command validates that the URL contains the accepted Preview ref and rejects Production. Raw evidence is service-role-only; Operators may read only normalized profile/photo proposals through Row Level Security. If the archive sync fails, preserve the disk receipts and repair or retry the same manifest. Never call providers solely to repair a database-copy failure.

On an idempotent retry, the command checks the registered snapshot status before retransmitting raw artifact bytes. A fully reconciled manifest returns a zero-insert receipt immediately; a partial snapshot resumes bounded artifact/profile ingestion and then rechecks independent artifact, byte, profile, and photo aggregates.

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

Every run must add a no-secret receipt to [CAT-76](https://linear.app/cleverwork/issue/CAT-76/trailcle-104-build-local775-multi-provider-serp-enrichment-pipeline) and [CLE-104](https://linear.app/cleverwork/issue/CLE-104/launch-slice-seed-ingestion-and-reviewed-publication-set), linking the batch summary and recording category count, complete/failed candidate counts, provider task/job receipts, measured cost or credit usage, unresolved shortfalls, archive manifest, and Preview sync status. The current project handoff must be updated whenever the queue, schedule, evidence boundary, or blocker changes.

## Completion estimate

The accepted queue currently has 232 categories, or 12 batches at 20 categories per run. The August 26 reconciliation invalidated the filter-v2 batch-01 completion claim because stale receipts and known non-business domains were counted. Assuming filter-v3 revalidation and the remaining crawls clear in the August 27 run, the scheduled-only nominal research-completion date is September 7, 2026; September 9 is the conservative estimate with two additional retry nights. This is an estimate for private research coverage only, not human review or publication.
