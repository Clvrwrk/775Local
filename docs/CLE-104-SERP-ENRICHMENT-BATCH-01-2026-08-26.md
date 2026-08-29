# CLE-104 SERP Enrichment — 2026-08-26 Batch 01 Receipt

This is a no-secret accounting receipt for private provider research. It does not select or publish a Business Listing, write Supabase, deploy, send a message, or authorize Production.

## Bounded run

- Branch: `codex/cle-104-serp-enrichment`
- Window: 2026-08-26 01:36–01:40 America/Los_Angeles
- Queue: 232 categories; fixed batch 01, priorities 1–20
- Pending categories attempted at run start: Screen Repair, Plumbing, Electrical, Auto Repair, and Restaurants
- DataForSEO: zero new tasks and $0.0000 new cost because the existing search receipts were reused
- Tavily and Exa: zero new calls because the existing corroboration receipts were reused
- Firecrawl: 22 retries, 16 successful and 6 failed; 334 pages retained, 10 successful crawls hit the 25-page cap, and 335 credits were measured for the successful jobs
- Failed-attempt cost limitation: the six failed retries exposed no credit amount in the client response. Their domains, timestamps, errors, null cost/job fields, and reconciliation marker are retained in `provider-ledger.jsonl`.

The 16 successful Firecrawl job IDs are retained in the append-only provider ledger. The six current failed receipts are five Screen Repair domains and one Restaurants domain. No failed receipt was counted as complete.

## Reconciliation finding and correction

The initial post-run progress update was not accepted. It counted stale crawl files from domains no longer present in the current SERP receipts and reported 19 completed categories. A strict join against the 400 current ranked domains found 382 evidence-complete and 18 failed current results across only 13 categories with 20/20 current crawl receipts.

A second eligibility audit found that the v2 search receipts themselves contain known aggregators/directories and off-category Screen Repair results, including phone repair, auto glass, generic window replacement, consumer rankings, restaurant guides, attorney directories, shopping guides, and accountant directories. Those records cannot satisfy the documented business-controlled-domain contract.

Accordingly, `progress.json` now records zero accepted completed categories for batch 01. All priorities 1–20 remain pending for filter-v3 search revalidation. The runner now:

- counts only crawl receipts for domains in the current category search receipt;
- removes a completion marker when the current receipt set falls below 20;
- records every failed crawl retry in the provider ledger, including a Firecrawl job ID and measured credits when the provider makes them available;
- archives a superseded search receipt before replacing it; and
- applies explicit known-aggregator exclusions plus strict Screen Repair relevance rules that reject phone/device repair, auto glass, and generic window replacement.

No provider rerun was made after this correction. The next bounded run must execute filter v3 on the same batch-01 window before batch 02 may start. A category with fewer than 20 approved business-controlled domains remains pending or becomes an evidence-backed source shortfall; it must not be padded.

Node 24 verification passed all 100 repository tests, typecheck, lint, secret scan, supported-file formatting, diff check, and the production build.

## Durable artifacts

Artifact root:

`/Users/chussey/Library/CloudStorage/Dropbox-AIA4/Cleverwork Main/Local775Directory/serp-enrichment`

| Artifact                    | SHA-256                                                            |
| --------------------------- | ------------------------------------------------------------------ |
| `category-queue.json`       | `e296ce14bf9ae4d82e10aaaa4e143103bc273b63cb9ba2f50aeeb7d08051161e` |
| `progress.json`             | `a4f74203b9e4dedb1de6ed4d335bde23dc01d938168548f060efd43d50650c6d` |
| `provider-ledger.jsonl`     | `b0740f20e93e41b0875946f33d006b302f7cda8f5de44d1f3d464b8592fb4370` |
| `batch-01/run-summary.json` | `ee08fab8eb44b7a9ed835929db9332ebefadb447153abe88d6ecab21dfc49b4e` |

Large page evidence and listing receipts remain private under `batch-01/listings/`. The root ledger has 22 events for this bounded run reconciliation: 16 successful crawls and 6 failed attempts, with 335 measured credits in total.

## Current blocker and estimate

Batch 01 has no accepted filter-v3 category completion yet. Assuming filter-v3 revalidation and remaining crawls clear in the next scheduled run, nominal private-research completion moves to 2026-09-07; the conservative estimate is 2026-09-09. These dates cover private research only, not human review, Listing selection, or publication.
