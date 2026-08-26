# Project Handoff — 775 Directory (Local775)

**Project:** 775 Directory (Local775)
**Repo:** https://github.com/Clvrwrk/775Local.git
**Production URL:** not yet deployed; approved canonical target is https://775directory.com
**Date:** 2026-08-25
**Agent:** Project Lead / Lead Orchestrator
**Reason:** User-requested end of session

---

## 2026-08-25 — CLE-104 multi-provider SERP enrichment in progress

- **Accounting:** [CAT-76](https://linear.app/cleverwork/issue/CAT-76/trailcle-104-build-local775-multi-provider-serp-enrichment-pipeline) is the contemporaneous CAT trail for [CLE-104](https://linear.app/cleverwork/issue/CLE-104/launch-slice-seed-ingestion-and-reviewed-publication-set). The durable receipt is `/Users/chussey/Library/CloudStorage/Dropbox-AIA4/Cleverwork Main/CODEX/docs/linear/teams/CLE/2026-08-25-local775-serp-enrichment.md`.
- **Git:** `codex/cle-104-publication-command` was fast-forward merged into `codex/launch-foundation` at `3a200a8`. Enrichment work is isolated on `codex/cle-104-serp-enrichment`.
- **Implementation:** `scripts/serp-enrichment.mjs` is a resumable, receipt-producing DataForSEO/Exa/Tavily/Firecrawl pipeline. It processes no more than 20 pending categories, filters known aggregators/social/search platforms, retries only transient DataForSEO internal errors, crawls same-domain pages with robots respected and a 25-page cap, and writes private evidence outside Git. Tests and the operator contract live in `scripts/serp-enrichment.test.mjs` and `docs/SERP-ENRICHMENT.md`.
- **Queue and first search:** 232 categories produce 12 batches. Batch 1 has exactly 400 retained private candidates: 20 categories with 20 domains each. Window/Home Screen Repair reached 20 only through documented in-category `screen door repair service` and `patio screen repair` aliases after the narrower Reno/Sparks query returned 19; directories and phone/electronics repair still do not count. DataForSEO cost for the final strict batch receipts is $0.2530.
- **Artifacts:** `/Users/chussey/Library/CloudStorage/Dropbox-AIA4/Cleverwork Main/Local775Directory/serp-enrichment`. Firecrawl is currently enriching batch 1. All results remain private candidates and require the existing CLE-104 human review/publication gate.
- **Automation:** `local775-nightly-serp-enrichment` is active daily at 01:30 America/Los_Angeles. Every run must reconcile CAT-76, CLE-104, this handoff, provider cost/credit receipts, and the batch artifact path. Nominal private-research completion is 2026-09-05; conservative completion is 2026-09-07. Human review/publication is separate.
- **Hard boundaries:** No enrichment run may select/publish Listings, write Supabase, deploy, touch Production, weaken eligibility, expose credentials, or claim 20 when approved primary and in-category alias SERPs provide fewer than 20.

**Resume here:** inspect `progress.json` and the latest `batch-*/run-summary.json`; let the idempotent crawl retry only `crawl_failed` receipts. When batch 1 finishes, verify exact candidate/page/cap/failure/credit counts, update CAT-76 and CLE-104, then allow the nightly automation to advance. Do not mark CLE-104 complete until the reviewed publication acceptance is actually satisfied.

## 2026-08-25 — CLE-104 audited publication command ready for merge

- **Accounting:** [CAT-74](https://linear.app/cleverwork/issue/CAT-74/trailcle-104-build-audited-operator-publication-command) is the Codex trail for [CLE-104](https://linear.app/cleverwork/issue/CLE-104/launch-slice-seed-ingestion-and-reviewed-publication-set). The durable cross-team receipt is `/Users/chussey/Library/CloudStorage/Dropbox-AIA4/Cleverwork Main/CODEX/docs/linear/teams/CLE/2026-08-25-local775-publication-command.md`.
- **Branch:** `codex/cle-104-publication-command` is based on `origin/codex/launch-foundation` at `9bf9209`. Implementation commits are `a992217`, `696a543`, and reviewed fixed point `a3b2bb3`.
- **Command boundary:** recent, non-impersonated WorkOS authentication plus an allowlisted, organization-scoped Operator Grant is required for candidate review, exact-100 publication, suspension, and restoration. The application uses the human bearer token and Supabase publishable key only; malformed input and transport/provider failures return stable redacted codes.
- **Publication integrity:** publication is atomic, idempotent, singleton-locked, balanced at five Listings per launch category/city cell, bound to the immutable reviewed candidate snapshot, and rejected when evidence is older than 30 days. Distinct locations can share one reviewed canonical Business identity while retaining separate Business Listings. Service-area residential street and exact coordinates remain private.
- **Evidence and rollback:** every published Listing records draft, pending-review, and published revisions; attributable review/publication receipts; audit events; and durable outbox entries. Publication receipts preserve the actual `pending_review` before-state. Guarded, idempotent suspend/restore commands append their own receipts, revisions, audits, and outbox entries.
- **Independent review:** Standards and Spec independently approved exact commit `a3b2bb3` after three review passes. All review findings were remediated; no blocker remains.
- **Verification:** a fresh isolated local Supabase reset applied all migrations. pgTAP passed 82/82, schema lint reported no errors, and the AuthKit application-handler HTTP contract proved review, exact-100 publication, idempotent replay, wrong-organization denial, suspend/restore, 100 public rows, 100 publication receipts, 100 publication audits, 100 publication outbox records, and 302 lifecycle revisions. All 90 Node tests, typecheck, lint, secret scan, supported-file Prettier, diff check, and the Node 24/Vercel production build pass.
- **Effects:** no shared Preview or Production migration/data change, no source-batch apply, no real publication, no deployment, no DNS change, no provider call/spend, and no external send occurred. Verification used only the discarded local Supabase stack.
- **Real-corpus gate:** the saved corpus remains 14,993 raw rows and 1,134 private candidates: 40 eligible, 980 requiring review, and 114 ineligible. It cannot yet supply the exact reviewed 100 without evidence enrichment; do not weaken eligibility or silently publish review rows.
- **Next gate:** review and merge `codex/cle-104-publication-command` into `codex/launch-foundation`. After merge, continue CLE-104 with evidence enrichment and human review needed to assemble the real balanced 100. Shared Preview application and any real Listing publication remain separate, explicitly reconciled approvals.

## 2026-08-25 — CLE-104 reviewed-publication foundation merged

- **Accounting:** [CAT-73](https://linear.app/cleverwork/issue/CAT-73/trailcle-104-add-entity-risk-screening-and-reviewed-publication-gate) is the Codex trail for [CLE-104](https://linear.app/cleverwork/issue/CLE-104/launch-slice-seed-ingestion-and-reviewed-publication-set). The verified cross-team receipt is `/Users/chussey/Library/CloudStorage/Dropbox-AIA4/Cleverwork Main/CODEX/docs/linear/teams/CLE/2026-08-25-local775-reviewed-publication.md`.
- **CLE-73 merge:** `codex/cle-73-idempotent-import` passed independent standards/spec review. The duplicate hashing helper was centralized in `1deecd2`, then the branch was fast-forward merged and pushed to `origin/codex/launch-foundation` at `1deecd2`.
- **CLE-104 merge:** `codex/cle-104-reviewed-publication` passed fixed-point Standards and Spec review, then fast-forward merged and pushed to `origin/codex/launch-foundation` at `2be6c9c`. The implementation is `270322f`; merge-review remediations are `e35baf0` and `2be6c9c`.
- **Implementation:** deterministic review reasons now cover duplicate title/address, same-name multi-location evidence, shared-domain entity evidence, practitioners, service-area rows, and ambiguous launch categories. `launch-candidate-v2` preserves the CLE-73 category boundary, reconciles only pending/unselected private candidates, appends before/after audit events, and rejects malformed, contradictory, duplicate, reviewed, or selected replay inputs.
- **Selection gate:** `selected_for_launch` requires an attributable accepted review (`reviewed_by` and `reviewed_at`), `eligible` screening, and zero unresolved reasons. Authenticated Operators and `service_role` have read-only table privileges; ingestion and reconciliation mutations are limited to scoped command functions. No current path can create or mutate a canonical Business Listing or publish data.
- **Real-corpus receipt:** the saved four-ZIP Reno corpus remains 14,993 raw rows and 1,134 private candidates: 40 eligible, 980 requiring review, and 114 ineligible. Two final dry runs produced identical output SHA-256 `c9ba586cbb9a038982ffc557d7b3b90c771fa90be786ef2ebd5139ee46dacfcd`.
- **Verification:** independent Standards and Spec fixed-point reviews are clean at `1deecd2...2be6c9c`. All 82 Node tests, typecheck, lint, Prettier, secret scan, diff check, and production build pass. A fresh isolated local Supabase reset applied all migrations; pgTAP passed 25/25 and schema lint reported no errors. Relevant pull requests now run the pinned Supabase `2.105.0` database contract before any manual Preview migration dispatch.
- **Effects:** no shared Preview or Production migration/data change, no source-batch apply, no publication, no provider call/spend, and no external send occurred. The local Supabase test stack was stopped and discarded after verification.
- **Current next gate:** continue CLE-104 with the recent-authenticated, idempotent, audited Operator review/selection/publication command and structured receipt flow needed to choose the 100 human-reviewed launch Listings. Do not apply the duplicate Reno DataForSEO source batch to the populated shared Preview; Preview migration application and any real selection remain separate reconciled decisions.

## 2026-08-25 — CLE-73 Reno source-corpus adapter

- **Accounting:** [CAT-54](https://linear.app/cleverwork/issue/CAT-54/trailcle-73-build-and-verify-local775-idempotent-reno-seed-import) is the current Codex trail for [CLE-73](https://linear.app/cleverwork/issue/CLE-73/build-reproducible-import-for-the-reno-dataforseo-seed-corpus). The cross-team receipt is `/Users/chussey/Library/CloudStorage/Dropbox-AIA4/Cleverwork Main/CODEX/docs/linear/teams/CLE/2026-08-25-local775-dataforseo-seed-corpus.md`.
- **Branch:** `codex/cle-73-idempotent-import`, commit `3a04707`, based on `origin/codex/launch-foundation`. Do not move this work to stale `main`.
- **Implementation:** `scripts/import-listings.mjs` now accepts either the licensed seven-sheet workbook or the saved Local775 DataForSEO corpus directory. `scripts/dataforseo-corpus.mjs` binds the four Reno ZIPs (89502, 89509, 89511, 89521), validates provider/manifests/geography/counts/stable identities, hashes all 12 saved artifacts, preserves the four city-mismatch exclusions as immutable raw rows, and maps only qualified rows into the existing private candidate review transform.
- **Protection boundary:** apply mode can invoke only source-batch registration, append-only raw-row ingestion, insert-only candidate ingestion, and reconciliation status RPCs. It has no canonical Business Listing, Claim, ownership, participation, or publication RPC. Owner-verified fields cannot be overwritten by this import path.
- **Real-corpus dry-run receipt:** source SHA-256 `f8deefd620d7c406f6cd3cdabeeeb88a35facaef84d817ba28eae8b6aed77c98`; 14,989 qualified rows plus four preserved exclusions; 1,134 private launch-category candidates; zero canonical Listing writes. A repeated dry run returned the same hash and counts.
- **Verification:** Node 24 focused/full tests, typecheck, lint, secret scan, Prettier check, and production build pass. No DataForSEO API call, Supabase write, production change, paid effect, or external send occurred.
- **Next gate:** review/merge the committed branch. Do not apply this four-ZIP adapter to the already populated shared Preview without an explicit source-coexistence decision: the accepted seven-sheet workbook already contains the same Reno source records, and a second source batch would duplicate review candidates across batches. If an apply proof is later required, use a clean isolated Preview target with `--apply --expected-sha=f8deefd620d7c406f6cd3cdabeeeb88a35facaef84d817ba28eae8b6aed77c98`. Production remains prohibited without its retained approval.

## Accomplished This Session

### Project authority, specification, and delivery system

- `AGENTS.md`: Replaced inherited Grok-only authority with Local775 provider, safety, testing, and production-approval boundaries.
- `CONTEXT.md`: Established canonical product language for Businesses, Business Listings, Claims, Listing Participation, Leads, Lead Recipients, Featured entitlements, and Operators.
- `docs/SPEC.md`: Converted 154 Grill decisions into the accepted production-beta implementation contract.
- `docs/PROJECT-DECISIONS.md`: Preserved delegated reversible defaults, retained human gates, provider evidence, Preview activation receipts, and credential-remediation history.
- `docs/adr/0001-local-project-authority.md`: Made this repository and canonical SSD checkout authoritative for Local775.
- `docs/adr/0002-platform-ownership-and-integration-boundaries.md`: Assigned Vercel, WorkOS, Supabase, GoHighLevel, Stripe, and Cloudflare non-overlapping responsibilities; excluded Convex from v1.
- `.github/workflows/ci.yml`, `.github/workflows/database-preview.yml`, `package.json`: Established Node 24, deterministic builds, target-explicit database delivery, tests, type checking, linting, and secret scanning.
- Linear: Established the 775 Directory initiative/project/milestone structure and dependency-ready ticket frontier; CLE-101 is the spec pointer and CLE-106 is the active identity slice.

### Supabase Preview foundation and licensed corpus

- `supabase/migrations/20260824194500_initial_directory_foundation.sql` through `20260824223000_add_candidate_fk_indexes.sql`: Added the secure directory model, RLS, reviewed public projection, import staging, candidate review, and supporting indexes.
- `scripts/import-listings.mjs` and import/candidate libraries: Added deterministic, receipt-producing spreadsheet ingestion and launch-candidate transformation.
- Supabase Preview `dpxeldzunfxmjahgvjhm`: Applied the forward-only migration set; security-advisor review returned no findings after policy corrections.
- Seed workbook: Imported all 20,436 source rows from the authoritative Reno/Sparks workbook into immutable Preview staging with an exact reconciliation receipt and zero duplicates on rerun.
- Launch transformation: Produced 1,798 private candidates: 128 eligible, 1,500 requiring review, and 170 ineligible. Nothing was selected or published automatically.
- Supabase Production `hcfryjrajqftcnnbnybj`: Remains schema- and data-untouched.

### WorkOS authentication and authorization boundary

- `src/start.ts`, `src/routes/api/auth/sign-in.tsx`, `src/routes/api/auth/callback.tsx`: Added CSRF-ordered, fail-closed WorkOS AuthKit entry and callback handling.
- `src/lib/auth/policy.mjs`: Enforced required configuration, exact callback shape, safe local return paths, and the accepted seven-day maximum session.
- `src/lib/supabase/identity.server.ts`: Added server-only minimal WorkOS Actor projection through the service-role-only `sync_workos_actor` RPC.
- `supabase/migrations/20260824224500_add_workos_identity_projection.sql`: Separated authentication from Operator Grants, required the Operations organization and allowlisted email, rejected impersonation, and added a 15-minute recent-auth gate.
- `scripts/auth-contract.test.mjs` and `scripts/auth-policy.test.mjs`: Added contract tests for CSRF order, fail-closed behavior, controlled redirects, minimal identity projection, session limits, and authorization separation.
- WorkOS: Created the isolated `Local775 Directory` project with Staging only and application `775Directory.com`; enabled email Magic Auth and Google only, disabled password/enterprise SSO/passkeys/other social providers, set seven-day maximum and one-day inactivity sessions, five-minute access tokens, the Supabase JWT claims template, required MFA for the `Local775 Operations` organization, and kept impersonation disabled.
- Supabase Preview: Replaced the shared-Production issuer with only the isolated WorkOS Staging issuer and confirmed signing-key resolution.

### Vercel Preview activation and secret containment

- Canonical checkout: Linked `/Volumes/M1 Application SSD/Projects/Local775` to `cleverwork/reno-local-directory` without making provider state trackable.
- Vercel branch environment: Installed the isolated WorkOS client and replacement API credential only for Preview branch `codex/launch-foundation`; the API credential is Sensitive/Secret.
- Credential incident: The first isolated Staging key appeared in a browser accessibility tool result and was treated as disclosed. A replacement was generated without transcript exposure, transferred once, and removed from the clipboard. The disclosed key was scheduled for WorkOS's earliest one-hour expiration at 2026-08-24 17:13 America/Los_Angeles.
- Preview deployment: `dpl_7HjSx64Yx2ZkurdNj26cRdZzpdk2` built successfully and owns `https://reno-local-directory-git-codex-launch-foundation-cleverwork.vercel.app`.
- Acceptance: The protected sign-in endpoint returns `307` to WorkOS with the isolated client and exact branch callback. The isolated Staging AuthKit page shows email Magic Auth and Google, no password option, and no client, redirect, or configuration error.
- Linear CLE-106: Added a no-secret remediation receipt and retained In Progress for the human-authenticated callback test.

## Git State

- **Branch:** `codex/cle-104-publication-command`, based on `origin/codex/launch-foundation` at `9bf9209`
- **Last implementation commit:** `a3b2bb3` — "fix(CLE-104): enforce application publication boundary"
- **Uncommitted changes:** none after the handoff documentation commit.

## Task Cut Off

None — implementation and credential remediation ended at a clean boundary. CLE-106 remains intentionally open because completing a real test-user authentication requires human participation.

## Prior 2026-08-24 Next Task — CLE-106

This historical continuation remains valid but is superseded as the immediate next task by the CLE-104 gate at the top of this handoff.

**Task:** Complete the human-assisted WorkOS Preview callback and authorization acceptance for CLE-106.
**What to check / do:**

1. Open the stable branch Preview sign-in route and have Christopher authenticate as a controlled test user with Google or email Magic Auth; do not automate entry of another person's authentication credential.
2. Confirm the callback returns to `/account`, creates a valid protected session cookie, and creates or updates exactly one minimal `app.actors` row through `public.sync_workos_actor` in Supabase Preview.
3. Prove the ordinary authenticated test user has no Local775 Operator authority, cannot invoke Operator-only paths, and gains no Listing Participation or Business Listing authority from login alone.
4. If testing an Operator, add only an explicitly approved Supabase Operator Grant and WorkOS Operations-organization membership, then prove MFA, allowlist, organization, no-impersonation, and 15-minute recent-auth enforcement.
5. Record no-secret receipts in `docs/PROJECT-DECISIONS.md` and CLE-106. Mark CLE-106 complete only after callback, session, Actor projection, and negative authorization checks pass.

**If authentication returns `invalid_client`, `redirect-uri-invalid`, or `not_configured`:** Verify the stable branch alias still resolves to the latest Preview deployment and inspect branch-scoped Vercel environment metadata. Do not reuse the shared Cleverwork Production WorkOS application, pull the entire Vercel environment, print a credential, or change Production.

**If Actor projection returns an HTTP error:** Inspect Vercel runtime logs and the Supabase Preview RPC/migration state. Do not weaken RLS, grant `sync_workos_actor` to authenticated users, or touch Supabase Production.

**Prompt to use:** "Read docs/handoffs/current.md completely. Then continue CLE-106 by completing the human-assisted WorkOS Preview sign-in and verifying the callback, session cookie, minimal Actor projection, and negative Operator authorization. Do not touch Production or expose secrets."

## Decisions Made This Session

- **Canonical workspace:** GitHub `Clvrwrk/775Local` and `/Volumes/M1 Application SSD/Projects/Local775` are authoritative; the chat workspace is not the implementation checkout.
- **Delegated defaults:** Reversible implementation choices use the documented recommendation; production, spending, real external effects, security/privacy/legal changes, and irreversible architecture remain explicitly human-gated.
- **Provider ownership:** Vercel hosts; WorkOS authenticates; Supabase owns application truth and authorization; GoHighLevel owns CRM/communications/phone/payment operations; Stripe executes payments through GoHighLevel; Cloudflare controls public DNS.
- **Identity is not authority:** WorkOS login never creates Operator, Business Owner, Agency Representative, Lead Recipient, Claim, Listing Participation, or Featured authority.
- **Preview isolation:** WorkOS Staging and Supabase Preview are isolated from shared/Production environments; Preview has no real external effects.
- **Credential handling:** Any credential that appears in task input or a tool transcript is disclosed and must be contained. Never print secrets, pull the complete Vercel environment, or place credentials in repository files.
- **Data integrity:** The bulk workbook remains private and quarantined; only individually reviewed, evidence-complete rows may be selected for publication.
- **Production boundary:** No production Vercel deployment, domain attachment, Cloudflare DNS mutation, Supabase Production migration, paid WorkOS feature, real GoHighLevel send/call, or financial effect is authorized by Preview acceptance.

## Blockers Requiring Human Action

1. **Controlled test-user authentication** — Christopher must complete Google or Magic Auth on the isolated Staging AuthKit page so callback and session acceptance can be proven.
2. **Launch corpus coverage** — the current eligible set cannot satisfy five reviewed Listings in every accepted category/city cell. Resolve through evidence enrichment or an explicit policy decision; do not weaken eligibility silently.
3. **Production launch approval** — the Production Acceptance Packet and explicit approval are required before deploying to production or attaching `775Directory.com`.

## Verification Commands

1. `git status --short --branch` — should show `codex/cle-104-publication-command` tracking its remote with no uncommitted changes after the handoff commit.
2. `npm test` — should report 90 passing tests and zero failures.
3. `npm run typecheck` — should exit successfully with no TypeScript errors.
4. `npm run security:secrets` — should print `Secret scan passed.`
5. `npm run build` — should complete the deterministic Vite/Nitro Vercel build without migrations or provider effects.
6. `supabase db reset --local && supabase test db && supabase db lint --local --level warning --fail-on error` — should apply all migrations, pass 82 pgTAP assertions, and report no schema errors.
7. `node scripts/operator-publication-http.integration.mjs` — should prove the AuthKit handler and isolated HTTP/RPC publication/rollback contract.
8. `npx vercel@latest inspect reno-local-directory-git-codex-launch-foundation-cleverwork.vercel.app --scope cleverwork` — should resolve the stable alias to Ready deployment `dpl_7HjSx64Yx2ZkurdNj26cRdZzpdk2` until a newer accepted Preview replaces it.
9. `npx vercel@latest curl '/api/auth/sign-in?returnPathname=%2Faccount' --deployment https://reno-local-directory-git-codex-launch-foundation-cleverwork.vercel.app -- --silent --show-error --max-redirs 0 --dump-header - --output /dev/null` — should return `307` with a WorkOS location; do not paste or log the full redirect state.

## Full Context

### What was built across ALL sessions (complete feature list)

- Accepted PRD/specification, domain language, architecture decisions, approval gates, SEO/performance/accessibility/security targets, commercial model, and Wednesday production-beta boundary.
- Linear portfolio with the `775 Directory — Product & Trust Foundation` initiative, `775 Directory — Production Foundation` and `775 Directory — Identity, Claims & Trust` projects, TRUST milestones, CLE-101 spec pointer, and tracer-bullet launch issues.
- Local project authority and removal of inherited Grok/PGLite/Better Auth/runtime assumptions.
- Node 24 deterministic CI, separate Preview database workflow, secret scanner, unit tests, and public-delivery contracts.
- Secure Supabase directory schema, RLS, public projection, auditability, outbox/inbox foundations, review lifecycle, and private import staging.
- Exact 20,436-row source import, immutable batch receipt, deterministic candidate transformation, eligibility classification, and category/city gap evidence.
- Public directory runtime that reads only the reviewed Supabase public projection and fails safely when unconfigured; no synthetic production fallback.
- WorkOS AuthKit server middleware, sign-in and callback routes, safe return paths, session policy, minimal Actor projection, separate Operator authorization, recent-auth gate, and impersonation rejection.
- Isolated WorkOS Staging project/application, authentication methods, session/token policy, JWT template, Operations MFA organization, callback, and Supabase issuer integration.
- Branch-scoped Vercel Preview configuration, protected stable branch deployment, stale-alias correction, credential rotation, disclosure containment, repeat deployment, and hosted AuthKit acceptance.
- Durable evidence in `docs/PROJECT-DECISIONS.md`, commits through `58843a7`, and the CLE-106 Linear remediation comment.

### Architecture decisions

The application uses one source of truth per concern. Supabase owns directory records, participation, permissions, Claims, Leads, entitlements, audit events, media references, and integration state. WorkOS owns human authentication and session identity only. GoHighLevel is a projected operational system for CRM, email, SMS, phone, pipelines, invoices, and payments; it never overwrites public truth directly. Provider writes use durable outbox/inbox, signatures, idempotency, retries, receipts, dead-letter visibility, and reconciliation. Convex is intentionally absent from v1 because it duplicates Supabase capabilities without a bounded responsibility.

### Design system (if applicable)

Preserve the existing Circle × Sierra visual direction and the tokens in `docs/DESIGN-SYSTEM.md`, components in `docs/COMPONENTS.md`, and intent in `docs/DESIGN.md`. The product is mobile-first because approximately 90% of expected use is mobile. Maintain WCAG 2.2 AA, Lighthouse category scores above 90, good Core Web Vitals, clear Sponsored labels, and truthful public data.

### Key invariants (never violate)

- Authentication is not authorization: every privileged action requires server/database enforcement and explicit scoped authority.
- Production is human-gated: Preview success never authorizes production, DNS, spend, messages, calls, payments, or privacy/security changes.
- Supabase is the directory source of truth: GoHighLevel and provider payloads are projections or proposals, never co-equal owners.
- Public means reviewed: anonymous clients may read only the publication-eligible projection; source evidence, private contact details, review state, and residential data remain private.
- Secrets never enter source, command output, logs, analytics, issue text, or handoff documents.
- Build is side-effect free: migrations and provider operations are separate, target-explicit release actions.
- Bulk data is quarantined: import, eligibility, selection, and publication are distinct auditable transitions.
- Payment never grants authority and failed Featured payment never removes the always-free Listing.
- Preview has no real external effects by default.
- Do not weaken a failing eligibility, RLS, auth, security, accessibility, or performance gate to make it pass.

### Service / deployment map (if applicable)

| Service                 | Detail                                                                                                                                         |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Canonical checkout      | `/Volumes/M1 Application SSD/Projects/Local775` on `codex/launch-foundation`                                                                   |
| GitHub                  | https://github.com/Clvrwrk/775Local.git                                                                                                        |
| Linear initiative       | [775 Directory — Product & Trust Foundation](https://linear.app/cleverwork/initiative/775-directory-product-and-trust-foundation-9c300ffaeb3e) |
| Linear identity project | [775 Directory — Identity, Claims & Trust](https://linear.app/cleverwork/project/775-directory-identity-claims-and-trust-432396f134d4)         |
| Linear active issue     | [CLE-106](https://linear.app/cleverwork/issue/CLE-106/launch-slice-account-authentication-and-operator-authorization) — In Progress            |
| Vercel                  | `cleverwork/reno-local-directory`, project `prj_ZkcD7I7A6TDYLJ7Z4UAG2hfNoEth`                                                                  |
| Vercel Preview          | https://reno-local-directory-git-codex-launch-foundation-cleverwork.vercel.app — protected; deployment `dpl_7HjSx64Yx2ZkurdNj26cRdZzpdk2`      |
| WorkOS                  | Isolated `Local775 Directory` project, Staging only; application `775Directory.com`; no Local775 Production environment activated              |
| Supabase Preview        | `dpxeldzunfxmjahgvjhm` — migrations and private corpus applied                                                                                 |
| Supabase Production     | `hcfryjrajqftcnnbnybj` — infrastructure exists; schema/data untouched                                                                          |
| GoHighLevel             | Dedicated Local775 location approved but not confirmed provisioned; do not use the Homeworks Advantage location                                |
| Cloudflare              | Public domains are managed in Cloudflare; no production DNS change was made                                                                    |
| Sentry                  | Existing account/tool available; Local775 production wiring is not yet accepted as complete                                                    |
| Seed workbook           | `/Users/chussey/Library/CloudStorage/Dropbox-AIA4/Cleverwork Main/Local775Directory`                                                           |
