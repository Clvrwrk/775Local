# CLE-104 SERP Enrichment — Batch 01 — 2026-08-28

This is a private-research receipt. It does not select, review, publish, or write canonical Business Listings.

## Bounded run

- Branch: `codex/cle-104-serp-enrichment`
- Starting commit: `d16aa81b4b0262bb24432e2619f1506c82437b03`
- Queue: `/Users/chussey/Library/CloudStorage/Dropbox-AIA4/Cleverwork Main/Local775Directory/serp-enrichment/category-queue.json`
- Output: `/Users/chussey/Library/CloudStorage/Dropbox-AIA4/Cleverwork Main/Local775Directory/serp-enrichment`
- Window: batch 01, priorities 1–20 only
- Providers: DataForSEO rank, Exa and Tavily corroboration, Firecrawl same-domain evidence
- Crawl boundary: discovery depth 3, query parameters ignored, external/subdomain traversal disabled, 25-page cap

The pre-run reconciliation found 15 complete and five pending categories with 11 current crawl failures. The bounded run reused accepted filter-v10 receipts except for Screen Repair, whose evidence-backed six-result shortfall required a fresh bounded DataForSEO search plus Exa and Tavily corroboration. The fresh search again retained exactly 14 eligible business-controlled domains and preserved the six-result shortfall without padding.

Firecrawl retried the 11 current failures. `ba-homeremodeling.com` recovered with five same-domain pages, completing Handyman. The other ten attempts returned zero pages and remain pending. A final no-provider reconciliation rebuilt the complete 20-category checkpoint.

## Current batch state

| Measure                              | Result |
| ------------------------------------ | -----: |
| Current search candidates            |    394 |
| Evidence-complete current domains    |    384 |
| Current crawl failures               |     10 |
| Missing current receipts             |      0 |
| Invalid non-failure receipts         |      0 |
| Stale audit-only receipts            |    136 |
| Completed categories                 |     16 |
| Pending categories                   |      4 |
| Terminal source-shortfall categories |      0 |

Completed priorities are 2–6, 8–9, and 11–19. Batch 01 remains fixed. The next run may retry only these pending priorities:

| Priority | Category      | Current results | Evidence complete | Failures | Source shortfall |
| -------: | ------------- | --------------: | ----------------: | -------: | ---------------: |
|        1 | Screen Repair |              14 |                13 |        1 |                6 |
|        7 | Dentists      |              20 |                19 |        1 |                0 |
|       10 | Veterinarians |              20 |                19 |        1 |                0 |
|       20 | Accountants   |              20 |                13 |        7 |                0 |

Screen Repair is not terminally blocked because `renoscreenrepair.com` still has a current crawl failure. It may become an evidence-backed six-result terminal source shortfall only after all 14 retained domains have valid non-empty evidence.

## Provider accounting for this run

The baseline provider ledger had 281 lines. This run appended 13 events:

- One successful Screen Repair category-search event representing six DataForSEO tasks and $0.0585 cost.
- One transient DataForSEO retry event with a retained task ID and $0.0020 cost.
- New known DataForSEO cost: $0.0605. Cumulative known batch-01 cost: $0.9920, plus the four pre-fix failed attempts whose costs remain unavailable.
- Exa cost: $0.0070 for this run; cumulative batch-01 Exa cost is $0.3710.
- Tavily: one completed corroboration request whose response did not expose cost or credits; cumulative completed requests are 53.
- Firecrawl: 11 events, one complete and ten failed, five pages retained, five measured credits, and zero 25-page cap flags. All attempts retained job IDs and exposed numeric credit values.
- Cumulative Firecrawl accounting: 107 events, 85 complete and 22 failed attempts, 1,773 pages retained, 60 cap flags, and 1,780 measured credits. One historical failed event still has unavailable credit usage.

The current failures are:

| Priority | Domain                  | Firecrawl job                          | Credits | Failure    |
| -------: | ----------------------- | -------------------------------------- | ------: | ---------- |
|        1 | `renoscreenrepair.com`  | `01a04afb-8939-7649-92f0-40bbff60e7c9` |       0 | zero pages |
|        7 | `divinedentalsmile.com` | `01a04afb-b23f-704e-b1e8-1daefb6c9f15` |       0 | zero pages |
|       10 | `galenavet.net`         | `01a04afc-2d3a-7154-94ca-be99ab257887` |       0 | zero pages |
|       20 | `albrightcpas.com`      | `01a04afc-645b-779e-8e94-30dda57d468b` |       0 | zero pages |
|       20 | `dipietro-thornton.com` | `01a04afc-9a6c-70fa-8bd9-db0062b53d85` |       0 | zero pages |
|       20 | `irenestambaughcpa.com` | `01a04afc-64b9-72b7-9d43-304f33b69c7d` |       0 | zero pages |
|       20 | `jthayercpa.com`        | `01a04afc-9a02-754d-9d4e-be0008b3324a` |       0 | zero pages |
|       20 | `pangborncpa.com`       | `01a04afc-64c3-765d-ac48-5cda04efade0` |       0 | zero pages |
|       20 | `ppg.cpa`               | `01a04afc-653f-75e0-b38f-db32ad6a144f` |       0 | zero pages |
|       20 | `sidleytax.com`         | `01a04afc-9c58-757e-92bc-1fe1d80e0124` |       0 | zero pages |

## Durable artifact checksums

- Queue: `e296ce14bf9ae4d82e10aaaa4e143103bc273b63cb9ba2f50aeeb7d08051161e`
- Progress: `a3a1e0a75be42c87be4b695db05ffefad4014296df0512edd3aacd2185b3bbf9`
- Provider ledger: `5d61cd5d3b7a5b6941154dd4c43fa8d92a65803e6a5abdcdeaf110cb7418b35d`
- Run summary: `be8956fa0949b4db24543ee0944687ab562e349417728dcf457715abee23a326`
- Batch-01 files: 723

## Boundaries retained

No candidate was reviewed, selected, or published. No Supabase Preview or Production write, deployment, DNS change, external message or call beyond the required Linear accounting, payment, or Production effect occurred. Provider effects were limited to the user-approved bounded research. Incomplete categories remain pending, and batch 02 must not start.
