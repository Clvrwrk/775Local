# CLE-104 SERP Enrichment — Batch 01 — 2026-08-27

This is a private-research receipt. It does not select, review, publish, or write canonical Business Listings.

## Bounded run

- Branch: `codex/cle-104-serp-enrichment`
- Starting commit: `8b17a277d92336f06e025a729d2e79c9454b58ab`
- Queue: `/Users/chussey/Library/CloudStorage/Dropbox-AIA4/Cleverwork Main/Local775Directory/serp-enrichment/category-queue.json`
- Output: `/Users/chussey/Library/CloudStorage/Dropbox-AIA4/Cleverwork Main/Local775Directory/serp-enrichment`
- Window: batch 01, priorities 1–20 only
- Providers: DataForSEO rank, Exa and Tavily corroboration, Firecrawl same-domain evidence
- Crawl boundary: discovery depth 3, query parameters ignored, external/subdomain traversal disabled, 25-page cap

The initial filter-v3 run was stopped when `pro.porch.com` exposed that directories and other non-business results still passed the old filter. Search receipts v3 through v9 were preserved and archived. Filter v10 is the accepted current receipt version. It excludes the observed directory, marketplace, editorial, employment, union, lead-generation, synthetic reserved-phone, generic national, off-region, and off-category results. Clean receipts were promoted across filter versions only after all 20 retained domains passed the new filter; those promotions made zero provider calls and have explicit ledger events.

Screen Repair now requires explicit Reno/Sparks/Northern Nevada evidence plus explicit repair, rescreening, fixing, damage, or screen-replacement language. All bounded Reno/Sparks primary and accepted alias queries returned 14 eligible current domains, producing an evidence-backed source shortfall of six instead of padding with new-screen sellers, generic window replacement, fireplace screens, device repair, directories, lead forms, or non-local pages.

## Current batch state

| Measure                              | Result |
| ------------------------------------ | -----: |
| Current search candidates            |    394 |
| Evidence-complete current domains    |    383 |
| Current crawl failures               |     11 |
| Missing current receipts             |      0 |
| Invalid non-failure receipts         |      0 |
| Stale audit-only receipts            |    136 |
| Completed categories                 |     15 |
| Pending categories                   |      5 |
| Terminal source-shortfall categories |      0 |

Completed priorities are 2–6, 9, and 11–19. The next run must remain in batch 01 and retry only the five pending priorities:

| Priority | Category      | Current results | Evidence complete | Failures | Source shortfall |
| -------: | ------------- | --------------: | ----------------: | -------: | ---------------: |
|        1 | Screen Repair |              14 |                13 |        1 |                6 |
|        7 | Dentists      |              20 |                19 |        1 |                0 |
|        8 | Handyman      |              20 |                19 |        1 |                0 |
|       10 | Veterinarians |              20 |                19 |        1 |                0 |
|       20 | Accountants   |              20 |                13 |        7 |                0 |

Screen Repair is not terminally blocked yet because one of its 14 retained domains still has a crawl failure. It may become an evidence-backed terminal shortfall only after all 14 current domains have valid non-empty evidence.

## Provider accounting for this run

The baseline provider ledger had 22 lines. This run appended 259 events:

- 52 completed category-search events representing 82 successful DataForSEO tasks and $0.9275 DataForSEO cost.
- Two DataForSEO transient retry events with known cost of $0.0040 total.
- One reconciled pre-fix terminal failure after four observed attempts. Its task IDs and failed-task costs were not retained by the old code and are explicitly null/unavailable; the runner now ledgers every retry and terminal task failure before throwing.
- Known DataForSEO total: $0.9315, plus four pre-fix failed attempts whose cost is unavailable.
- Exa cost: $0.3640 across the completed search events.
- Tavily: 52 completed corroboration requests; the response receipts did not expose a cost or credit count.
- 108 filter revalidation events with zero provider calls and $0 DataForSEO cost.
- 96 Firecrawl events: 84 complete and 12 failed attempts, 1,768 pages retained, 60 successful jobs at the 25-page cap, and 1,775 measured credits. One failed event exposed no credit value. All 12 failed attempts retained a Firecrawl job ID.

The current failures are:

| Priority | Domain                  | Firecrawl job                          |     Credits | Failure                |
| -------: | ----------------------- | -------------------------------------- | ----------: | ---------------------- |
|        1 | `renoscreenrepair.com`  | `01a04282-37e8-7383-bc2e-66843bfe7e09` |           0 | zero pages             |
|        7 | `divinedentalsmile.com` | `01a04287-9d4b-704e-8690-1719ea79addb` |           0 | zero pages             |
|        8 | `ba-homeremodeling.com` | `01a04288-bf53-773b-8e23-885516387472` |           0 | zero pages             |
|       10 | `galenavet.net`         | `01a0428a-242f-73af-a5f7-db3954107588` |           0 | zero pages             |
|       20 | `albrightcpas.com`      | `01a04291-12ab-7736-aa04-4b2ddf910f00` |           0 | zero pages             |
|       20 | `dipietro-thornton.com` | `01a04291-3466-71b0-be3d-423e7bf381b1` |           0 | zero pages             |
|       20 | `irenestambaughcpa.com` | `01a04291-1370-7643-aeb6-852f4c31871b` |           0 | zero pages             |
|       20 | `jthayercpa.com`        | `01a04291-2ac9-7335-a0a1-834a34b0bb67` |           0 | zero pages             |
|       20 | `pangborncpa.com`       | `01a04291-13b6-7039-8915-9a8edde5a10d` |           0 | zero pages             |
|       20 | `ppg.cpa`               | `01a04291-1383-7049-b2e6-700fdb381526` | unavailable | HTTP 502 while polling |
|       20 | `sidleytax.com`         | `01a04291-36c1-76da-9d50-682b50f5f9e9` |           0 | zero pages             |

## Durable artifact checksums

- Queue: `e296ce14bf9ae4d82e10aaaa4e143103bc273b63cb9ba2f50aeeb7d08051161e`
- Progress: `09b1b527851f521f04a8766291b83ddd124d875e316cb7e462f0ccde6ff64ace`
- Provider ledger: `e9a13cd0564a9f0a5d5058ad66e9089364b517e86e36fc4e921560ca6a066ae8`
- Run summary: `90152dda107b1f8572402346c0ac96ef265c0d5d33622a496fd98f4e62fe513f`
- Batch-01 files: 723
- Archived search receipts: 20 each for filter versions v2 through v9

## Boundaries retained

No candidate was reviewed, selected, or published. No Supabase Preview or Production write, deployment, DNS change, provider message/call, payment, or production effect occurred. Provider effects were limited to the user-approved bounded search and crawl research. Incomplete categories remain pending, and batch 02 must not start.
