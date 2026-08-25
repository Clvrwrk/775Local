# Project Handoff — 775 Directory (Local775)
**Project:** 775 Directory (Local775)
**Repo:** https://github.com/Clvrwrk/775Local.git
**Production URL:** not yet deployed; approved canonical target is https://775directory.com
**Date:** 2026-08-24 19:21 PDT
**Agent:** Project Lead / Lead Orchestrator
**Reason:** User-requested end of session

---

## 2026-08-25 — CLE-73 Reno source-corpus adapter

- **Accounting:** [CAT-54](https://linear.app/cleverwork/issue/CAT-54/trailcle-73-build-and-verify-local775-idempotent-reno-seed-import) is the current Codex trail for [CLE-73](https://linear.app/cleverwork/issue/CLE-73/build-reproducible-import-for-the-reno-dataforseo-seed-corpus). The cross-team receipt is `/Users/chussey/Library/CloudStorage/Dropbox-AIA4/Cleverwork Main/CODEX/docs/linear/teams/CLE/2026-08-25-local775-dataforseo-seed-corpus.md`.
- **Branch:** `codex/cle-73-idempotent-import`, based on `origin/codex/launch-foundation`. Do not move this work to stale `main`.
- **Implementation:** `scripts/import-listings.mjs` now accepts either the licensed seven-sheet workbook or the saved Local775 DataForSEO corpus directory. `scripts/dataforseo-corpus.mjs` binds the four Reno ZIPs (89502, 89509, 89511, 89521), validates provider/manifests/geography/counts/stable identities, hashes all 12 saved artifacts, preserves the four city-mismatch exclusions as immutable raw rows, and maps only qualified rows into the existing private candidate review transform.
- **Protection boundary:** apply mode can invoke only source-batch registration, append-only raw-row ingestion, insert-only candidate ingestion, and reconciliation status RPCs. It has no canonical Business Listing, Claim, ownership, participation, or publication RPC. Owner-verified fields cannot be overwritten by this import path.
- **Real-corpus dry-run receipt:** source SHA-256 `f8deefd620d7c406f6cd3cdabeeeb88a35facaef84d817ba28eae8b6aed77c98`; 14,989 qualified rows plus four preserved exclusions; 1,134 private launch-category candidates; zero canonical Listing writes. A repeated dry run returned the same hash and counts.
- **Verification:** Node 24 focused/full tests, typecheck, lint, secret scan, Prettier check, and production build pass. No DataForSEO API call, Supabase write, production change, paid effect, or external send occurred.
- **Next gate:** commit and review this branch, then decide whether to execute the separately target-gated Preview apply using `--apply --expected-sha=f8deefd620d7c406f6cd3cdabeeeb88a35facaef84d817ba28eae8b6aed77c98`. Production remains prohibited without its retained approval.

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
- **Branch:** `codex/launch-foundation`
- **Last commit:** `58843a7` — "docs(CLE-106): record WorkOS key remediation"
- **Uncommitted changes:** none before handoff generation; this handoff and its archive are the generated session-close artifacts and will be committed together.

| File | Status | Note |
|------|--------|------|
| `docs/handoffs/current.md` | Added | Canonical current handoff generated this session |
| `docs/handoffs/archive/2026-08-24-1921.md` | Added | Immutable archive copy of this handoff |

## Task Cut Off
None — implementation and credential remediation ended at a clean boundary. CLE-106 remains intentionally open because completing a real test-user authentication requires human participation.

## Next Task — Start Here

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
1. `git status --short --branch` — should show `codex/launch-foundation` tracking its remote with no uncommitted changes after the handoff commit.
2. `npm test` — should report 69 passing tests and zero failures.
3. `npm run typecheck` — should exit successfully with no TypeScript errors.
4. `npm run security:secrets` — should print `Secret scan passed.`
5. `npm run build` — should complete the deterministic Vite/Nitro Vercel build without migrations or provider effects.
6. `npx vercel@latest inspect reno-local-directory-git-codex-launch-foundation-cleverwork.vercel.app --scope cleverwork` — should resolve the stable alias to Ready deployment `dpl_7HjSx64Yx2ZkurdNj26cRdZzpdk2` until a newer accepted Preview replaces it.
7. `npx vercel@latest curl '/api/auth/sign-in?returnPathname=%2Faccount' --deployment https://reno-local-directory-git-codex-launch-foundation-cleverwork.vercel.app -- --silent --show-error --max-redirs 0 --dump-header - --output /dev/null` — should return `307` with a WorkOS location; do not paste or log the full redirect state.

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
| Service | Detail |
|---------|--------|
| Canonical checkout | `/Volumes/M1 Application SSD/Projects/Local775` on `codex/launch-foundation` |
| GitHub | https://github.com/Clvrwrk/775Local.git |
| Linear initiative | [775 Directory — Product & Trust Foundation](https://linear.app/cleverwork/initiative/775-directory-product-and-trust-foundation-9c300ffaeb3e) |
| Linear identity project | [775 Directory — Identity, Claims & Trust](https://linear.app/cleverwork/project/775-directory-identity-claims-and-trust-432396f134d4) |
| Linear active issue | [CLE-106](https://linear.app/cleverwork/issue/CLE-106/launch-slice-account-authentication-and-operator-authorization) — In Progress |
| Vercel | `cleverwork/reno-local-directory`, project `prj_ZkcD7I7A6TDYLJ7Z4UAG2hfNoEth` |
| Vercel Preview | https://reno-local-directory-git-codex-launch-foundation-cleverwork.vercel.app — protected; deployment `dpl_7HjSx64Yx2ZkurdNj26cRdZzpdk2` |
| WorkOS | Isolated `Local775 Directory` project, Staging only; application `775Directory.com`; no Local775 Production environment activated |
| Supabase Preview | `dpxeldzunfxmjahgvjhm` — migrations and private corpus applied |
| Supabase Production | `hcfryjrajqftcnnbnybj` — infrastructure exists; schema/data untouched |
| GoHighLevel | Dedicated Local775 location approved but not confirmed provisioned; do not use the Homeworks Advantage location |
| Cloudflare | Public domains are managed in Cloudflare; no production DNS change was made |
| Sentry | Existing account/tool available; Local775 production wiring is not yet accepted as complete |
| Seed workbook | `/Users/chussey/Library/CloudStorage/Dropbox-AIA4/Cleverwork Main/Local775Directory` |
