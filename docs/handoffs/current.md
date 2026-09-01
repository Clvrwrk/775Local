# Project Handoff — 775 Directory (Local775)

**Project:** 775 Directory (Local775)
**Repo:** https://github.com/Clvrwrk/775Local.git
**Production URL:** https://775directory.com
**Date:** 2026-08-31 19:01 PDT
**Agent:** Lead Orchestrator
**Reason:** User-requested Linear handoff

---

## Accomplished This Session

### Review-gated Claim foundation

- `supabase/migrations/20260831120000_add_claim_commands_and_listing_manager.sql`: Added authenticated Claim commands, idempotent Admin decisions, audit/outbox writes, Listing Manager support, and the transaction-locked two-Owner cap.
- `supabase/tests/claims_workflow.sql`: Added the database acceptance contract for Claim transitions, authorization, idempotency, concurrency, and public/private boundaries; execution remains a P00 gate because Docker was unavailable.
- `src/lib/directory/claim-handler.mjs`, `src/lib/directory/claims.ts`, and `src/lib/supabase/claim-commands.mjs`: Added the server-side Claim domain and Supabase command seam with redacted failures and WorkOS-derived identity.
- `src/routes/studio.$slug.tsx`: Added the role-aware Studio shell and aligned visible roles to Listing Admin, Listing Owner, Listing Manager, and Listing Agency.
- `scripts/claim-commands.test.mjs`: Added focused Claim command and authority-boundary coverage.

### Full Site ↔ Supabase ↔ GHL build plan

- `docs/CLAIMS-STUDIO-GHL-INTEGRATION-PLAN.md`: Wrote the implementation-ready P00-P12 plan with exact files, dependencies, commands, acceptance criteria, effect gates, capability matrix, Claim/Lead/Growth Lead lifecycles, GHL manifest, message receipts, OAuth/Ed25519 webhook boundary, reconciliation, Preview acceptance, Production canary, and operations handoff.
- `docs/adr/0003-single-gohighlevel-listings-object.md`: Accepted one GHL `Listings` custom object plus labeled Contact relations while Supabase retains canonical authority.
- `docs/adr/0002-platform-ownership-and-integration-boundaries.md`: Marked the superseded two-custom-object projection and preserved all other platform boundaries.
- `docs/SPEC.md` and `docs/PROJECT-DECISIONS.md`: Reconciled the accepted single-object GHL projection, Supabase authority, and labeled role relations.
- Independent plan checker: passed the final goal-backward review with no blockers or warnings after Lead Recipient, manifest/API, credential-principal, Growth Lead, scanner, and exact-verification gaps were closed.

### Verification and Linear accounting

- Repository verification passed: 133 Node tests, TypeScript, ESLint, Production build, Prettier, `git diff --check`, and secret scan.
- `CAT-82 ↔ CLE-107`: Updated the existing Claim trail instead of creating a duplicate; wrote and reread the current retrospective receipt.
- `CAT-165 ↔ CLE-108`: Created and verified the retrospective Listing Studio planning trail and receipt.
- `CAT-164 ↔ CLE-109`: Created and verified the retrospective Resident/Growth Lead planning trail and receipt.
- `CAT-163 ↔ CLE-110`: Created and verified the retrospective Site/Supabase/GHL integration planning trail and receipt.
- Posted current-state comments to all eight CAT/CLE issues and `atRisk` project updates to the two owning projects. No credential, push, migration, GHL provisioning, Contact, Opportunity, message, webhook subscription, outreach, or deployment occurred.

## Linear Accounting

- **Projects:**
  - [775 Directory — Identity, Claims & Trust](https://linear.app/cleverwork/project/775-directory-identity-claims-and-trust-432396f134d4)
  - [775 Directory — Merchant Value & Revenue](https://linear.app/cleverwork/project/775-directory-merchant-value-and-revenue-e677ccc62961)
- **Milestones:** TRUST-1 — Claims & Evidence Production-Safe; REV-1 — Merchant Value Beta Proven
- **Issues created/updated:** CAT-82, CLE-107, CAT-165, CLE-108, CAT-164, CLE-109, CAT-163, CLE-110
- **CAT issue/trails:**
  - [CAT-82 — trail for CLE-107: Complete Local775 Claim flow and seed outreach](https://linear.app/cleverwork/issue/CAT-82/trailcle-107-complete-local775-claim-flow-and-seed-outreach)
  - [CAT-165 — trail for CLE-108: Plan role-filtered Local775 Listing Studio](https://linear.app/cleverwork/issue/CAT-165/trailcle-108-plan-role-filtered-local775-listing-studio)
  - [CAT-164 — trail for CLE-109: Plan Resident and Growth Lead workflows](https://linear.app/cleverwork/issue/CAT-164/trailcle-109-plan-resident-and-growth-lead-workflows)
  - [CAT-163 — trail for CLE-110: Plan Site-Supabase-GHL synchronization](https://linear.app/cleverwork/issue/CAT-163/trailcle-110-plan-site-supabase-ghl-synchronization)
- **Foreign issues:**
  - [CLE-107 — Launch slice: business claim through approved ownership](https://linear.app/cleverwork/issue/CLE-107/launch-slice-business-claim-through-approved-ownership) — In Progress
  - [CLE-108 — Launch slice: listing-owner studio and content moderation](https://linear.app/cleverwork/issue/CLE-108/launch-slice-listing-owner-studio-and-content-moderation) — Backlog
  - [CLE-109 — Launch slice: resident inquiry through merchant outcome](https://linear.app/cleverwork/issue/CLE-109/launch-slice-resident-inquiry-through-merchant-outcome) — Backlog
  - [CLE-110 — Launch slice: merchant operations synchronization and reconciliation](https://linear.app/cleverwork/issue/CLE-110/launch-slice-merchant-operations-synchronization-and-reconciliation) — Backlog
- **Disk receipts:**
  - `/Users/chussey/Library/CloudStorage/Dropbox-AIA4/Cleverwork Main/CODEX/docs/linear/teams/CLE/2026-08-31-local775-claim-build-plan.md`
  - `/Users/chussey/Library/CloudStorage/Dropbox-AIA4/Cleverwork Main/CODEX/docs/linear/teams/CLE/2026-08-31-local775-listing-studio-plan.md`
  - `/Users/chussey/Library/CloudStorage/Dropbox-AIA4/Cleverwork Main/CODEX/docs/linear/teams/CLE/2026-08-31-local775-lead-workflow-plan.md`
  - `/Users/chussey/Library/CloudStorage/Dropbox-AIA4/Cleverwork Main/CODEX/docs/linear/teams/CLE/2026-08-31-local775-ghl-integration-plan.md`
- **Artifact links:** `docs/CLAIMS-STUDIO-GHL-INTEGRATION-PLAN.md`, ADR 0003, Claim migration/modules/tests, commits `29ebb0f` and `d7ffea6`, and this handoff
- **Coverage:** full retrospective backfill across the two existing owning projects; no duplicate CLE issue or session project created
- **Accounting timing:** retrospective backfill
- **Verified:** 2026-08-31 19:01 PDT; all four Linear relations resolve in both directions, all four receipts were reread from the CODEX vault, and every referenced repository artifact/commit exists
- **Gate:** PASS — `CAT trail ↔ foreign issue ↔ disk receipt` resolves for CLE-107, CLE-108, CLE-109, and CLE-110

## Git State

- **Branch:** `codex/claim-studio-ghl-plan`
- **Last implementation commit:** `d7ffea6` — "docs: plan full Site Supabase GHL workflow"
- **Prior Claim commit:** `29ebb0f` — "feat: add review-gated listing claims"
- **Uncommitted changes before the handoff commit:** `docs/handoffs/current.md` and `docs/handoffs/archive/2026-08-31-1901.md` only

## Task Cut Off

None — the Claim first slice and full implementation plan are locally committed, repository checks pass, independent planning review passes, and the Linear accounting graph is complete. Credentialed execution has not started.

## Next Task — Start Here

**Task:** Execute P00 baseline reconciliation and the read-only Local775 GHL location inventory.

**What to check / do:**

1. Rebase `codex/claim-studio-ghl-plan` onto current canonical `main` and reconcile any newer Local775 migrations, published Listing state, and Linear dependencies before changing code.
2. Run the isolated Supabase reset/pgTAP Claim acceptance and complete the human WorkOS Preview session, Actor projection, and negative Operator authorization journey.
3. Receive the dedicated Local775 GHL Location ID and credentials only through the approved secret path: distinct runtime token; either a temporary provisioner token or the user-run UI checkpoint; and OAuth app/event-subscription access.
4. Perform only the P00/P06 read-only location, schema, association, pipeline, workflow, duplicate-contact, and scope inventory. Stop on any identity or scope mismatch.
5. Return the redacted inventory and request the next explicit gate before schema mutation, synthetic records, synthetic sends, Production migration, deployment, or any real communication.

**If Docker, WorkOS acceptance, credential scope, or GHL Location identity fails:** record the exact redacted blocker in the P00 receipt and stop. Do not bypass pgTAP, infer authorization from login, reuse the Homeworks Advantage GHL location, or proceed from a partial credential set.

**Prompt to use:** "Read /private/tmp/local775-claim-studio/docs/handoffs/current.md completely. Then execute P00 of docs/CLAIMS-STUDIO-GHL-INTEGRATION-PLAN.md: rebase and reconcile the baseline, run isolated pgTAP, complete the human WorkOS Preview authorization acceptance, and perform only the read-only GHL inventory using credentials from the approved secret path. Stop before any mutation or send and return the redacted receipt."

## Decisions Made This Session

- **Supabase remains canonical:** Listing, Claim, participation, capabilities, Leads, entitlements, audit, inbox/outbox, and reconciliation state are never granted by GHL records or relations.
- **One GHL custom object:** Project one `Listings` object and labeled Owner/Manager/Agency/Lead Recipient Contact relations; Supabase enforces the 2/3/3 seat limits.
- **Lead Recipient is explicit:** Owners receive Resident Lead PII only when separately designated as an active verified Lead Recipient; fallback otherwise escalates to Admin without routine Lead PII.
- **Growth Leads are separate:** A Growth Lead requires an explicit authenticated consulting-help command and separate consent; it is never inferred from Claim, Resident Lead, Featured, or payment state.
- **Messages are receipt-bearing commands:** Product-critical communications use recipient-specific Supabase commands and immutable payload hashes; mutable Contact fields never carry event context.
- **Native inbound requires OAuth Ed25519:** A Private Integration token does not create a signed webhook subscription. Without the OAuth channel, inbound translation stays disabled and reconciliation is read-only.
- **Provider writes remain gated:** GHL pipeline/stage/workflow creation uses a reviewed Admin-UI checklist where the current API is read-only. Production database correction is forward-only.
- **Claim Proof fails closed:** PDF/JPEG/PNG proof stays quarantined until pinned validation and ClamAV scanning pass; scanner failure never permits review or approval.

## Blockers Requiring Human Action

1. **GHL credential handoff** — provide the dedicated Local775 Location ID, distinct runtime token, provisioning choice/token, OAuth app credentials, scope screenshots, duplicate-contact setting, and any approved synthetic recipients through the approved secret manager, not chat.
2. **WorkOS Preview acceptance** — complete the human sign-in/session journey so callback, minimal Actor projection, and negative Operator authorization can be proven.
3. **Claim scanner runtime decision** — approve an existing container runtime or a separately gated new runtime/spend if no approved environment can host the pinned scanner.

## Verification Commands

1. `git status --short --branch` — should show `codex/claim-studio-ghl-plan` clean after the handoff commit.
2. `npm test` — should report 133 passing tests and zero failures.
3. `npm run typecheck && npm run lint && npm run build && npm run security:secrets` — should exit successfully and print `Secret scan passed.`
4. `git diff --check` — should exit with no output.
5. `npm run test:db` — after P00 adds the pinned Supabase CLI/script and Docker is available, should reset the isolated local database and pass all pgTAP suites.
6. `node scripts/ghl/inventory.mjs --target preview` — only after P06 creates the script and credentials are securely configured; should be read-only and produce a redacted Location/schema inventory.

## Full Context

### What was built across ALL sessions (complete feature list)

- Canonical GitHub/M1 SSD project authority, product vocabulary, specification, decision log, provider boundaries, ADRs, deterministic Node 24 checks, secret scanning, and target-explicit database delivery.
- Secure Supabase schema/RLS/public projection, audit/outbox foundations, private source import, deterministic candidate review, entity-risk screening, reviewed publication, and suspend/restore receipts.
- Licensed Reno/Sparks corpus ingestion plus private multi-provider enrichment with strict receipt, relevance, and publication boundaries.
- WorkOS Staging authentication, safe callbacks/return paths, session policy, minimal Actor projection, separate Operator Grants, recent-auth controls, and impersonation rejection.
- Mobile-first Circle × Sierra public directory, search/city/category/listing/offer/legal surfaces, commercial disclosures, accessibility controls, and HTML-safe structured data.
- Vercel/Cloudflare Production launch, canonical redirects, crawl controls, six-URL initial sitemap/IndexNow activation, visual evidence, and rollback receipts.
- Exactly 100 reviewed yet unclaimed/unverified seed Listings were later published with deterministic publication receipts and live leaf-route verification.
- Review-gated Claim first slice with server authority, idempotent decisions, two-Owner concurrency control, audit/outbox evidence, Listing Manager support, and role-aware Studio shell.
- Accepted P00-P12 Site/Supabase/GHL build plan with one GHL `Listings` object, role relations, dynamic Studio, Resident/Growth Leads, communications, reconciliation, and controlled release gates.
- Verified CAT/CLE/disk accounting across Claim, Studio, Lead, and GHL synchronization workstreams.

### Architecture decisions

Supabase owns application data and authorization; WorkOS owns authentication; Vercel hosts; Cloudflare controls DNS; GHL operates CRM/communication execution and projects Supabase state. GHL edits become proposals/evidence, never direct public truth or authority. Provider work uses an external port with a deterministic fake, transactional outbox/inbox, idempotent bindings, append-only attempts, dead letters, replay, and reconciliation. Production effects are individually gated.

### Design system

Preserve `docs/DESIGN.md`, `docs/DESIGN-SYSTEM.md`, and `docs/COMPONENTS.md`: pine/paper/gold palette, high-desert imagery, official Summit Seal/775Directory marks, mobile-first layouts, clear Sponsored labels, truthful empty/loading/degraded states, keyboard/focus support, and WCAG 2.2 AA.

### Key invariants

- Authentication is not authorization; every privileged route/RPC rechecks a stable server capability.
- Claim submission and payment never grant Listing authority, publication, Featured entitlement, or Lead access.
- Public means reviewed; private proof, contacts, Lead PII, audit bodies, and provider payloads never enter anonymous projections.
- Build is side-effect free; migrations, provider writes, sends, deployment, and publication have separate explicit gates and receipts.
- GHL is a projection and communication executor; Supabase remains canonical and repairs are explicit/reconciled.
- Service consent and marketing consent remain separate; DND and destination verification are enforced.
- Secrets never enter source, Linear, receipts, handoffs, logs, URLs, or command output.

### Service / deployment map

| Service            | Detail                                                                                          |
| ------------------ | ----------------------------------------------------------------------------------------------- |
| Active worktree    | `/private/tmp/local775-claim-studio`, branch `codex/claim-studio-ghl-plan`                      |
| Canonical checkout | `/Volumes/M1 Application SSD/Projects/Local775`; reconcile before execution                     |
| GitHub             | https://github.com/Clvrwrk/775Local.git; current session commits are local and unpushed         |
| Production         | https://775directory.com; no session deployment occurred                                        |
| WorkOS             | Isolated Local775 Staging app; human Preview acceptance still required                          |
| Supabase           | Canonical data/authorization; isolated Claim pgTAP remains P00; no session migration occurred   |
| GoHighLevel        | Dedicated Local775 location/credentials not yet supplied; do not reuse Homeworks Advantage      |
| CODEX receipts     | `/Users/chussey/Library/CloudStorage/Dropbox-AIA4/Cleverwork Main/CODEX/docs/linear/teams/CLE/` |

### Archived predecessor

- `docs/handoffs/archive/2026-08-31-1901.md` — archive of the previously current Local775 handoff before this session update.
