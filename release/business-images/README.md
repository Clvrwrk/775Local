# Business image upload and review candidate

This local candidate adds image upload in the Business Listing Studio and an image queue in Operator Review. Owners provide an image, its intended use (logo or photograph), accurate alt text, a source statement and a rights attestation. Originals stay private. A recently authenticated, explicitly authorized Operator must inspect the sanitized preview, check rights and record a reason before publication. Authentication alone grants no listing or review authority.

The initial free scope permits one logo and three photographs per Reno listing, including pending submissions. Repeated submissions and interrupted uploads reuse an immutable submission identifier. An unfinished upload can be resumed after refresh by selecting the same file and confirming the saved details. Rejections remain private and receive a 30-day quarantine date; automatic cleanup and owner deletion are not implemented by this slice.

Public pages display approved logos separately from photographs, with matching visible captions, alt text and LocalBusiness schema. Managed media does not duplicate legacy gallery entries. Page title and description use the business, category and town. This does not establish rights to any real business imagery or certify a listing as complete.

## Local verification

Base: `6158658262b70a9022b967577133e2ce5aae3a63` on `main`. Branch: `codex/business-image-upload-20261011`. No PR15 bundle was merged. The evidence handoff records the final commit and patch.

Using Node 24 and the committed lockfile:

```sh
npm ci
npm test
npm run typecheck
npm run lint
npm run build
npm run security:secrets
node scripts/business-images.browser.mjs
npm audit
```

The clean install and checks used npm 11.19.0; the inherited repository package-manager declaration remains npm 10.9.8. The original candidate passed 206 tests; the independently reviewed version adds regressions for direct Operator storage bypass, inherited metadata exposure and column-level grants. The final evidence packet records the new test total. Tests execute actual PostgreSQL functions and row policies in isolated PGlite, HTTP upload/storage behavior, authorization denial, audit attribution, quota races, retry recovery, metadata removal and publication eligibility. Seven browser journeys run in installed Mac Chrome 154.0.8037.98, headless, at mobile and desktop widths. They use the actual React components and media commands with synthetic authentication transport and local database/storage fixtures. They do not verify WorkOS login, hosted JWT validation, hosted Supabase Storage, actual route head/SSR, full Supabase extension parity, Linux native-image runtime or live behavior. See [HOSTED-GATES.md](HOSTED-GATES.md) for exact test boundaries and required hosted checks.

## Release boundary

`BUSINESS_IMAGE_UPLOAD_ENABLED` defaults off. This flag controls application uploads, public projection and byte routes; it does not disable direct hosted RPC/Storage access once the SQL is installed. Therefore export/recovery and database security approval must precede real production SQL application. Disabling it hides images through the application but does not revoke approved direct Storage reads. No live environment flag, data, bucket, permission, deployment or ownership was changed.

Approval also requires a separately approved existing server writer credential bound to `SUPABASE_MEDIA_WRITER_KEY`. Only that trusted writer persists server-validated approved WebP bytes; owner and Operator JWTs cannot insert the approved key. The server verifies current Operator permission first, re-decodes the original, and retains the Operator JWT on the final audited decision RPC. Missing writer configuration fails closed, leaving the submission private. No credential was created or read during local implementation.

`forward.sql` is an independently reviewable, transactional forward change, **not** a repository migration replay or a production ledger repair. It creates a private bucket, a private rights/review sidecar, scoped command functions, safe public projections and restrictive object policies. It also revokes the existing direct media mutation grants to prevent bypassing review. Its baseline assumptions and impact on any existing media consumers require independent review. A name collision or incompatible constraint must stop application; do not silently replace production objects.

The authorized future rollout is five listings at a time, with live verification before the next five. The first proposed stable IDs are 19, 61, 2, 77 and 97. A listing is complete only when its logo, all verified and permitted images, and SEO page are verified live. Logos do not count as gallery photographs. No real listing in that batch has been changed by this candidate.

## Remaining gates

| Gate and cause | Removable by / owner | Allowed recovery | Closure evidence |
| --- | --- | --- | --- |
| Reviewed publication now requires a trusted server writer distinct from an Operator JWT; the existing key binding is not authorized or verified. | Target-specific server credential binding approval / Christopher and release operator | Bind an already approved server secret to the media writer setting under exact nonproduction authorization. Do not create credentials or expose values during this local phase. | Hosted Operator direct-write denial, server-sanitized approved write, and fail-closed missing-writer test. |
| Production baseline is not reconciled: 17 hosted versions versus 22 repository versions, with no timestamp matches. A production constraint/bucket metadata query was cancelled. Exact constraints and bucket configuration remain unverified. | Explicitly scoped release review / Christopher and release operator | Preserve the cancellation; do not retry the query or obtain the same data through another route. Review this isolated forward change against an independently authorized baseline. Never replay or repair the ledger blindly. | Approved target-specific forward plan with verified compatibility, rollback and grant impacts. |
| Real owner media requires encrypted external export and recovery; the destination remains an accepted implementation checkpoint in `docs/SPEC.md`. A previous backup-evidence read was denied. | Destination and scope approval / Christopher and release operator | Select an approved recovery destination and demonstrate export/restore under fresh authorization. Do not repeat the denied read or use an alternate route. | Recoverable encrypted media export and a tested recovery receipt before owner enablement. |
| Local fixtures do not establish hosted authentication, Storage policy or Linux Sharp acceptance. Publication and production security changes are outside this phase. | Nonproduction target and publication authorization / Christopher and release operator | Independently review the exact patch; authorize only the reconciled forward change and controlled nonproduction verification, including existing authentication and synthetic scoped actors. Verify staging approval scope before relying on any prior conditional approval. | Hosted owner/reviewer/anonymous/cross-owner tests, persisted retries, actual private Storage denial, approved-byte retrieval and Linux build/runtime smoke pass. |
| Real asset rights and complete listing evidence are not supplied by synthetic tests. | Rights and listing review / Christopher and content reviewer | Review separately supplied official sources and permission evidence. Publish only approved imagery under the later rollout authorization. | Logo/photo separation, all permitted images, accurate visible/schema data and SEO checked live for each of the five listings. |

Implemented and tested locally. Hosted staging and live verification are not complete. The broader login, profile, claim and owner-management release is not certified by this media slice. Actual Claims remain shadow-only; this workflow grants no ownership. Any separately approved future automated authority system still requires a strictly greater than 95% calibrated probability, verified identity and current authority, and deterministic gates. Unknown, uncalibrated and exactly 95% cases go to review.
