# CLE-104 SERP Enrichment — Batch 01 — 2026-08-30

This is a private-research receipt. It does not select, review, publish, or write canonical Business Listings.

## Bounded run

- Branch: `codex/cle-104-serp-enrichment`
- Starting commit: `e423b5569406c0ab3e743c578b24c548081799f8`
- Trigger: `local775-nightly-serp-enrichment`
- Queue: `<private-enrichment-root>/category-queue.json`
- Output: `<private-enrichment-root>`
- Window: batch 01, priorities 1–20 only
- Providers: DataForSEO rank, Exa and Tavily corroboration, Firecrawl same-domain evidence
- Crawl boundary: discovery depth 3, query parameters ignored, external/subdomain traversal disabled, 25-page cap

The pre-run no-provider reconciliation confirmed 16 complete and four pending categories with ten current crawl failures. The bounded run reused accepted filter-v10 receipts except for Screen Repair, whose evidence-backed shortfall required another fresh bounded DataForSEO search plus Exa and Tavily corroboration. The fresh search retained 13 eligible business-controlled domains, one more than the prior run, and reduced the documented source shortfall from eight to seven without padding.

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

The baseline provider ledger had 320 lines. This run appended 11 events:

- One successful Screen Repair category-search event represented six DataForSEO tasks and $0.0660 cost; no task retry was required.
- New known DataForSEO cost: $0.0660. Cumulative known batch-01 cost: $1.1650, plus four pre-fix failed attempts whose costs remain unavailable.
- Exa cost: $0.0070 for this run; cumulative batch-01 Exa cost is $0.3920.
- Tavily: one completed corroboration request whose response did not expose cost or credits; cumulative completed requests are 56.
- Firecrawl: ten failed zero-page events, zero pages retained, zero measured credits, and zero 25-page cap flags.
- Current-filter lineage: 137 Firecrawl events, 85 complete and 52 failed attempts, 1,773 pages retained, 60 cap flags, and 1,780 measured credits. One failed event has unavailable credit usage.
- Full append-only ledger history additionally retains 22 superseded filter-v2 Firecrawl events. Across all 159 crawl events, 101 completed and 58 failed, with 2,107 pages, 70 cap flags, 2,115 measured credits, and seven unavailable failed-event credit values.

The current failures are:

| Priority | Domain                  | Firecrawl job                          | Credits | Failure    |
| -------: | ----------------------- | -------------------------------------- | ------: | ---------- |
|        1 | `renoscreenrepair.com`  | `01a051ce-b4e1-77b2-9500-c17715580279` |       0 | zero pages |
|        7 | `divinedentalsmile.com` | `01a051ce-c436-73bc-bb89-1b0cc1b943f0` |       0 | zero pages |
|       10 | `galenavet.net`         | `01a051cf-0673-735b-9602-b8ead440d95c` |       0 | zero pages |
|       20 | `albrightcpas.com`      | `01a051cf-3b98-705b-9aca-738f253ed41c` |       0 | zero pages |
|       20 | `dipietro-thornton.com` | `01a051cf-7cca-729b-9619-65fb920da1e2` |       0 | zero pages |
|       20 | `irenestambaughcpa.com` | `01a051cf-3ba8-74ee-a952-c448fc9c9d7e` |       0 | zero pages |
|       20 | `jthayercpa.com`        | `01a051cf-7c98-7688-8e89-0bee99f9dcb4` |       0 | zero pages |
|       20 | `pangborncpa.com`       | `01a051cf-3ba9-74df-aa99-02348fcf81a5` |       0 | zero pages |
|       20 | `ppg.cpa`               | `01a051cf-3aef-7588-a3e6-fc2cf7264d70` |       0 | zero pages |
|       20 | `sidleytax.com`         | `01a051cf-7d3f-73ee-94f4-8ee0d48c5646` |       0 | zero pages |

## Receipt-durability correction

The audit after this run found that repeated searches under the same accepted filter replaced the prior current search JSON without first archiving it. The append-only provider ledger still preserves the August 29 DataForSEO task IDs, costs, retry events, Exa cost, Tavily status, and its 12-result/eight-shortfall accounting, but the exact prior ranked-result payload is unavailable. This limitation is explicit rather than reconstructed.

The runner now archives every replaceable search receipt before a provider call. Same-filter retries use timestamp-and-content-hash filenames under `batch-01/superseded-searches/`; different-filter compatibility archives remain retained. The focused Node 24 enrichment suite passes 19/19 with this correction.

## Verification

The reviewed branch passes 109/109 Node 24 tests, TypeScript, ESLint, secret scan, supported-file Prettier, diff checks, and the deterministic Node 24 production build. The build reported the expected `nodejs24.x` runtime and performed no migration or provider operation.

## Durable artifact checksums

- Queue: `e296ce14bf9ae4d82e10aaaa4e143103bc273b63cb9ba2f50aeeb7d08051161e`
- Progress: `6ef1165a73379bfddc55d4bba6b539f70be331427b9be0fd3c52e6ccfda0057f`
- Provider ledger: `58d47554be84537f44d92136415615e9bdc262eda525aa7e000e58a41f345201`
- Run summary: `ff897a1aa827d8d073caa65a35e1dbe3939b9a0848a780ae0a6791dc7d67a923`
- Batch-01 files: 723

## Boundaries retained

No candidate was reviewed, selected, or published. No Supabase Preview or Production write, deployment, DNS change, external message or call beyond the required Linear accounting, payment, or Production effect occurred. Provider effects were limited to the user-approved bounded research. Incomplete categories remain pending, and batch 02 must not start.
