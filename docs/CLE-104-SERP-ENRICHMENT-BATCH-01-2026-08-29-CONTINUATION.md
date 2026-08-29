# CLE-104 SERP Enrichment — Batch 01 Continuation — 2026-08-29

This is a private-research receipt. It does not select, review, publish, or write canonical Business Listings.

## Bounded run

- Branch: `codex/cle-104-serp-enrichment`
- Starting commit: `50924b9ae3cea758f289b8189045a65d0eb9aafc`
- Trigger: explicit user direction to proceed after the scheduled August 29 run
- Queue: `/Users/chussey/Library/CloudStorage/Dropbox-AIA4/Cleverwork Main/Local775Directory/serp-enrichment/category-queue.json`
- Output: `/Users/chussey/Library/CloudStorage/Dropbox-AIA4/Cleverwork Main/Local775Directory/serp-enrichment`
- Window: batch 01, priorities 1–20 only
- Providers: DataForSEO rank, Exa and Tavily corroboration, Firecrawl same-domain evidence
- Crawl boundary: discovery depth 3, query parameters ignored, external/subdomain traversal disabled, 25-page cap

The pre-run no-provider reconciliation confirmed 16 complete and four pending categories with ten current crawl failures. The bounded continuation reused accepted filter-v10 receipts except for Screen Repair, whose evidence-backed shortfall required another fresh bounded DataForSEO search plus Exa and Tavily corroboration. The fresh search retained 12 eligible business-controlled domains, one fewer than the scheduled run, and increased the documented source shortfall from seven to eight without padding.

Firecrawl retried only the ten current failures. Every attempt returned zero pages with a retained job ID and zero measured credits. A final no-provider reconciliation rebuilt the complete 20-category checkpoint. No category completed, no shortfall became terminal while a current crawl failure remained, and batch 02 did not start.

## Current batch state

| Measure                              | Result |
| ------------------------------------ | -----: |
| Current search candidates            |    392 |
| Evidence-complete current domains    |    382 |
| Current crawl failures               |     10 |
| Missing current receipts             |      0 |
| Invalid non-failure receipts         |      0 |
| Stale audit-only receipts            |    138 |
| Completed categories                 |     16 |
| Pending categories                   |      4 |
| Terminal source-shortfall categories |      0 |

Completed priorities are 2–6, 8–9, and 11–19. Batch 01 remains fixed. The next run may retry only these pending priorities:

| Priority | Category      | Current results | Evidence complete | Failures | Source shortfall |
| -------: | ------------- | --------------: | ----------------: | -------: | ---------------: |
|        1 | Screen Repair |              12 |                11 |        1 |                8 |
|        7 | Dentists      |              20 |                19 |        1 |                0 |
|       10 | Veterinarians |              20 |                19 |        1 |                0 |
|       20 | Accountants   |              20 |                13 |        7 |                0 |

Screen Repair is not terminally blocked because `renoscreenrepair.com` still has a current crawl failure. It may become an evidence-backed eight-result terminal source shortfall only after all 12 retained domains have valid non-empty evidence.

## Provider accounting for this run

The baseline provider ledger had 307 lines. This run appended 13 events:

- Two transient DataForSEO retry events retained task IDs and cost $0.0020 each.
- One successful Screen Repair category-search event represented six DataForSEO tasks and $0.0450 cost.
- New known DataForSEO cost: $0.0490. Cumulative known batch-01 cost: $1.0990, plus four pre-fix failed attempts whose costs remain unavailable.
- Exa cost: $0.0070 for this run; cumulative batch-01 Exa cost is $0.3850.
- Tavily: one completed corroboration request whose response did not expose cost or credits; cumulative completed requests are 55.
- Firecrawl: ten failed zero-page events, zero pages retained, zero measured credits, and zero 25-page cap flags.
- Current-filter lineage: 127 Firecrawl events, 85 complete and 42 failed attempts, 1,773 pages retained, 60 cap flags, and 1,780 measured credits. One failed event has unavailable credit usage.
- Full append-only ledger history additionally retains 22 superseded filter-v2 Firecrawl events. Across all 149 crawl events, 101 completed and 48 failed, with 2,107 pages, 70 cap flags, 2,115 measured credits, and seven unavailable failed-event credit values.

The current failures are:

| Priority | Domain                  | Firecrawl job                          | Credits | Failure    |
| -------: | ----------------------- | -------------------------------------- | ------: | ---------- |
|        1 | `renoscreenrepair.com`  | `01a04d93-048a-76c6-8e91-4188f6b1ee46` |       0 | zero pages |
|        7 | `divinedentalsmile.com` | `01a04d93-2f8e-712f-bb15-9de2a66dd996` |       0 | zero pages |
|       10 | `galenavet.net`         | `01a04d93-652b-722e-8770-e6ad7aed2b03` |       0 | zero pages |
|       20 | `albrightcpas.com`      | `01a04d93-a6b2-779b-b6bf-c2c96e796b0e` |       0 | zero pages |
|       20 | `dipietro-thornton.com` | `01a04d93-dbd4-7550-a53e-4146141103a9` |       0 | zero pages |
|       20 | `irenestambaughcpa.com` | `01a04d93-a757-77e7-80f6-42def4bc8829` |       0 | zero pages |
|       20 | `jthayercpa.com`        | `01a04d93-dbf0-704d-8d14-24fd2fe6e9a6` |       0 | zero pages |
|       20 | `pangborncpa.com`       | `01a04d93-a758-737f-8302-04b4552ad250` |       0 | zero pages |
|       20 | `ppg.cpa`               | `01a04d93-a75c-70bb-b3c3-9f60a0d84dbd` |       0 | zero pages |
|       20 | `sidleytax.com`         | `01a04d93-dc6f-74d8-a50f-247873a11a02` |       0 | zero pages |

## Durable artifact checksums

- Queue: `e296ce14bf9ae4d82e10aaaa4e143103bc273b63cb9ba2f50aeeb7d08051161e`
- Progress: `3d3a526a6448d3763694c1d5cf46550319216af1dd3f22d80e5ffa606e69eae1`
- Provider ledger: `349e2d44891332e3e364feca53b648e49371b949c0e7ec94c996c68dfbbd3524`
- Run summary: `8f746f6d81db2b10db8bb0fa4f985390befd8dc4101ac2d27fe88101ddb6e69d`
- Batch-01 files: 723

## Boundaries retained

No candidate was reviewed, selected, or published. No Supabase Preview or Production write, deployment, DNS change, external message or call beyond the required Linear accounting, payment, or Production effect occurred. Provider effects were limited to the user-approved bounded research. Incomplete categories remain pending, and batch 02 must not start.
