# CLE-104 SERP Enrichment — Batch 01 — 2026-08-29

This is a private-research receipt. It does not select, review, publish, or write canonical Business Listings.

## Bounded run

- Branch: `codex/cle-104-serp-enrichment`
- Starting commit: `6d2f19fe8c5d222c320070e5b039ae575d9aaa74`
- Queue: `/Users/chussey/Library/CloudStorage/Dropbox-AIA4/Cleverwork Main/Local775Directory/serp-enrichment/category-queue.json`
- Output: `/Users/chussey/Library/CloudStorage/Dropbox-AIA4/Cleverwork Main/Local775Directory/serp-enrichment`
- Window: batch 01, priorities 1–20 only
- Providers: DataForSEO rank, Exa and Tavily corroboration, Firecrawl same-domain evidence
- Crawl boundary: discovery depth 3, query parameters ignored, external/subdomain traversal disabled, 25-page cap

The pre-run no-provider reconciliation confirmed 16 complete and four pending categories with ten current crawl failures. The bounded run reused accepted filter-v10 receipts except for Screen Repair, whose evidence-backed shortfall required another fresh bounded DataForSEO search plus Exa and Tavily corroboration. The fresh search retained 13 eligible business-controlled domains, one fewer than the prior run, and increased the documented source shortfall from six to seven without padding.

Firecrawl retried only the ten current failures. Every attempt returned zero pages with a retained job ID and zero measured credits. A final no-provider reconciliation rebuilt the complete 20-category checkpoint. No category completed, no shortfall became terminal while a current crawl failure remained, and batch 02 did not start.

## Current batch state

| Measure                              | Result |
| ------------------------------------ | -----: |
| Current search candidates            |    393 |
| Evidence-complete current domains    |    383 |
| Current crawl failures               |     10 |
| Missing current receipts             |      0 |
| Invalid non-failure receipts         |      0 |
| Stale audit-only receipts            |    137 |
| Completed categories                 |     16 |
| Pending categories                   |      4 |
| Terminal source-shortfall categories |      0 |

Completed priorities are 2–6, 8–9, and 11–19. Batch 01 remains fixed. The next run may retry only these pending priorities:

| Priority | Category      | Current results | Evidence complete | Failures | Source shortfall |
| -------: | ------------- | --------------: | ----------------: | -------: | ---------------: |
|        1 | Screen Repair |              13 |                12 |        1 |                7 |
|        7 | Dentists      |              20 |                19 |        1 |                0 |
|       10 | Veterinarians |              20 |                19 |        1 |                0 |
|       20 | Accountants   |              20 |                13 |        7 |                0 |

Screen Repair is not terminally blocked because `renoscreenrepair.com` still has a current crawl failure. It may become an evidence-backed seven-result terminal source shortfall only after all 13 retained domains have valid non-empty evidence.

## Provider accounting for this run

The baseline provider ledger had 294 lines. This run appended 13 events:

- Two transient DataForSEO retry events retained task IDs and cost $0.0020 each.
- One successful Screen Repair category-search event represented six DataForSEO tasks and $0.0540 cost.
- New known DataForSEO cost: $0.0580. Cumulative known batch-01 cost: $1.0500, plus four pre-fix failed attempts whose costs remain unavailable.
- Exa cost: $0.0070 for this run; cumulative batch-01 Exa cost is $0.3780.
- Tavily: one completed corroboration request whose response did not expose cost or credits; cumulative completed requests are 54.
- Firecrawl: ten failed zero-page events, zero pages retained, zero measured credits, and zero 25-page cap flags.
- Current-filter lineage: 117 Firecrawl events, 85 complete and 32 failed attempts, 1,773 pages retained, 60 cap flags, and 1,780 measured credits. One failed event has unavailable credit usage.
- Full append-only ledger history additionally retains 22 superseded filter-v2 Firecrawl events. Across all 139 crawl events, 101 completed and 38 failed, with 2,107 pages, 2,115 measured credits, and seven unavailable failed-event credit values.

The current failures are:

| Priority | Domain                  | Firecrawl job                          | Credits | Failure    |
| -------: | ----------------------- | -------------------------------------- | ------: | ---------- |
|        1 | `renoscreenrepair.com`  | `01a04ca7-c790-7591-bfea-3a3729dec798` |       0 | zero pages |
|        7 | `divinedentalsmile.com` | `01a04ca7-d7b0-73b6-8c1b-0e9ffaae936b` |       0 | zero pages |
|       10 | `galenavet.net`         | `01a04ca8-0daa-735c-83c1-89f57b400798` |       0 | zero pages |
|       20 | `albrightcpas.com`      | `01a04ca8-5065-74fd-9282-a20e448ab41b` |       0 | zero pages |
|       20 | `dipietro-thornton.com` | `01a04ca8-860b-737b-bded-ae10c5f6b3d0` |       0 | zero pages |
|       20 | `irenestambaughcpa.com` | `01a04ca8-5009-756a-b659-ebd8cc154400` |       0 | zero pages |
|       20 | `jthayercpa.com`        | `01a04ca8-854b-766a-a1a6-9b71dc3297cf` |       0 | zero pages |
|       20 | `pangborncpa.com`       | `01a04ca8-507b-74fa-9eb0-4025b0cc6545` |       0 | zero pages |
|       20 | `ppg.cpa`               | `01a04ca8-4fab-76fb-b8e7-82db7b4abe6c` |       0 | zero pages |
|       20 | `sidleytax.com`         | `01a04ca8-85ae-750c-8117-b3fba6ec40ac` |       0 | zero pages |

## Durable artifact checksums

- Queue: `e296ce14bf9ae4d82e10aaaa4e143103bc273b63cb9ba2f50aeeb7d08051161e`
- Progress: `4278799a86be9876d446cf47ee16887bf9279f198444a843ca2614848ef52c02`
- Provider ledger: `5acf82670e2933fb1a59ce3b3cbf356d1081239fffc4b5380534e4ad17582f71`
- Run summary: `fe53a381fd59bd5682aa88abd835edeb8bede76caa33f4d800add7fd36ec761f`
- Batch-01 files: 723

## Boundaries retained

No candidate was reviewed, selected, or published. No Supabase Preview or Production write, deployment, DNS change, external message or call beyond the required Linear accounting, payment, or Production effect occurred. Provider effects were limited to the user-approved bounded research. Incomplete categories remain pending, and batch 02 must not start.
