# PR and branch consolidation — September 5, 2026

User authorization: review and resolve all PR comments, resolve merge conflicts, and merge every branch into main so subsequent work starts from fresh branches/PRs. This authorizes the requested main merge and its normal Git integration. It does not run hosted database migrations or enable external communications.

Integration base: Reno PR12 at ef234b2; main at6fe4a60. PR13 at33c5e5d is integrated with explicit resolution of card/page conflicts. All live remote branch heads and retained historical remote-tracking heads are to be preserved as merge ancestors. Older public UI and routing are superseded by the corrected Reno implementation; history consolidation must not restore them.

## Preserved work

- PR13 Basic row, Standard side and Premium stack cards, valid telephone/map actions and project/case-study presentation.
- PR12 supplied listing page layouts, Reno routes and public-data source, Claim/Studio/inquiry guardrails.
- Enrichment pipeline, publication commands, seed rollout, launch/indexing/receipt history.
- Recovered private enrichment archive scripts, migrations, tests and handoffs from retained local ref3378c9b, and Claim plan handoff/ADR0002 supersession from df508eb. These refs were absent from the live14-branch GitHub list, so they are identified as retained historical refs, not current hosted branches.

## Actionable dispositions

- PR1 provider ranks: already preserved via item.serpRank and regression coverage; retained.
- PR1 mutable batch identity: persisted batch-layout binding rejects changed sizes before provider/receipt work. Pre-manifest legacy roots fail closed until an offline receipt inventory establishes their original window ownership. No legacy layout is guessed and no private artifact root was mutated here.
- PR13 contradictory homepage comments: homepage deliberately uses a uniform photo-above stack in its multi-column grid; search/category cards select their tier layouts. This resolves Greptile's mixed-shape finding. CodeRabbit's conflicting suggestion is declined with this explicit page-level decision; content-tier labels remain accurate.
- PR13 optional fetch: same atomic anonymous directory source, parallel bounded1.5s request and explicit unavailable state; primary transport/JSON errors normalized.
- PR13 client/consent and media privacy: public column grants for both anonymous/authenticated roles; full-table media SELECT revoked for both. Case-study participant writes remain denied until guarded editing/review commands are implemented in CLE-108; no unsafe alternate publication path is retained.
- PR13 media duplicates: preserve every existing media row/status/path/reference; record a primary slot with a partial unique index rather than deleting duplicate assets. Missing images use truthful placeholders.
- PR13 consent/public states and empty before/after URLs: prior corrections retained.
- PR13 archived evidence links repaired; portable-command comment superseded by current handoff. Removed listingPlan helper makes its proposed test obsolete; paid placement must not choose content tier.
- PR10 exact100-row and ten-distinct-category preflight, CLI argument validation and behavioral seed-publication tests added. Hash, replay, privacy and persisted-receipt behavior tested in SQL rather than relying only on text assertions.
- PR9 pricing: Basic/Standard/Premium remain free; only the accepted Featured founder package shows paid rates. No checkout or sales activation.
- Resolved historical PR3/6/7/8/9/10 comments checked against retained/superseding code: structured-data escaping, request bounds/failure receipts, evidence/TTL, link labels, forecast validation, slug deduplication, manifest verification and publication serialization retained.

## Review thread inventory

Every review thread across PRs1–13 was retrieved with pagination, including already-resolved threads. Discussion and review summaries, including outside-diff and nitpick findings, were also read. Bot instruction text was treated only as review evidence.

| PR  | Finding                                                                                              | Disposition                                                      |
| --- | ---------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| #1  | Stale receipts inflate completion                                                                    | Previously resolved; checked retained/superseding implementation |
| #1  | Batch directories use wrong divisor                                                                  | Previously resolved; checked retained/superseding implementation |
| #1  | Merge discards provider ranks                                                                        | Resolved in consolidation; see dispositions below                |
| #1  | Stale same-domain evidence                                                                           | Previously resolved; checked retained/superseding implementation |
| #1  | Mutable batch identity                                                                               | Resolved in consolidation; see dispositions below                |
| #3  | JSON-LD script breakout                                                                              | Previously resolved; checked retained/superseding implementation |
| #6  | Emit a receipt when the IndexNow request fails.                                                      | Previously resolved; checked retained/superseding implementation |
| #6  | Emit a receipt for sitemap read and validation failures.                                             | Previously resolved; checked retained/superseding implementation |
| #6  | Limit each IndexNow POST payload to 10,000 URLs.                                                     | Previously resolved; checked retained/superseding implementation |
| #7  | Machine-local evidence paths                                                                         | Previously resolved; checked retained/superseding implementation |
| #7  | Use durable references for go-live evidence.                                                         | Previously resolved; checked retained/superseding implementation |
| #7  | Record visual evidence for the final go-live state.                                                  | Previously resolved; checked retained/superseding implementation |
| #7  | Store Cloudflare TTL values in API-native form.                                                      | Previously resolved; checked retained/superseding implementation |
| #8  | Replace nested reference labels with plain text.                                                     | Previously resolved; checked retained/superseding implementation |
| #9  | Invalid scheduling divisors crash forecasting                                                        | Previously resolved; checked retained/superseding implementation |
| #9  | Validate forecast capacity inputs.                                                                   | Previously resolved; checked retained/superseding implementation |
| #9  | Remove or align the unapproved paid owner plan.                                                      | Previously resolved; checked retained/superseding implementation |
| #10 | Receipt hash is unverified                                                                           | Previously resolved; checked retained/superseding implementation |
| #10 | Concurrent retries break idempotency                                                                 | Previously resolved; checked retained/superseding implementation |
| #10 | Deduplicate by `slug` as well as `domain`.                                                           | Previously resolved; checked retained/superseding implementation |
| #10 | Guard the constraint drop and reduce the write-blocking window.                                      | Previously resolved; checked retained/superseding implementation |
| #10 | The idempotency key is caller-supplied and unverified.                                               | Previously resolved; checked retained/superseding implementation |
| #10 | Validate `isServiceArea` before casting.                                                             | Previously resolved; checked retained/superseding implementation |
| #10 | If two different valid seeds with overlapping domains or normalized slugs are published concurrently | Previously resolved; checked retained/superseding implementation |
| #13 | Anonymous case-study reads fail                                                                      | Previously resolved; checked retained/superseding implementation |
| #13 | Withdrawn consent stays public                                                                       | Previously resolved; checked retained/superseding implementation |
| #13 | Optional fetch blocks listings                                                                       | Previously resolved; checked retained/superseding implementation |
| #13 | Guard empty case-study media URLs.                                                                   | Previously resolved; checked retained/superseding implementation |
| #13 | Resolve live duplicates before creating the partial unique index.                                    | Previously resolved; checked retained/superseding implementation |
| #13 | Cleanup Can Delete Active Logo                                                                       | Previously resolved; checked retained/superseding implementation |
| #13 | Allow each listing to select its plan layout.                                                        | Previously resolved; checked retained/superseding implementation |
| #13 | Hero Reference Remains Retired                                                                       | Previously resolved; checked retained/superseding implementation |
| #13 | Homepage mixes card layouts                                                                          | Resolved in consolidation; see dispositions below                |

## Validation and retained work

179 unit tests, typecheck, ESLint, secret scan and production build passed before final review. Final isolated database run covers22 migrations and195 pgTAP assertions; exact final receipts are recorded in the handoff. Browser runtime setup still fails its trusted-dependency check, so no fresh screenshot/interaction acceptance is claimed. GitHub CI/review and merge results are appended after completion.

This is source consolidation, not GTM acceptance. Owner media/case-study editing and reviewed commands, full private proof lifecycle, delivery/GHL integration, measurement, recovery and browser/production acceptance remain in existing Linear workstreams. Hosted migrations are a separate explicit operation. Existing production security work CAT-145/CLE-118 remains distinct.
