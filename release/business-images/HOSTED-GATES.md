# Exact hosted verification boundary

This packet describes the media slice only. Nothing here authorizes applying SQL, changing a bucket, granting access, publishing a branch or enabling real uploads.

## Existing access versus this candidate

The candidate reuses existing WorkOS authentication, active application actors, Listing Participation, Operator grants and the `listing_review` permission. It creates no actor, ownership, participation, grant, API key or provider credential. An owner must already hold active, current authority for that Reno listing; a Listing Manager or Agency Representative additionally needs the existing authority scope `media: propose`. An Operator additionally needs a matching active organization grant and authentication within 900 seconds. These checks execute in PostgreSQL, independently of the UI.

New API access consists of six authenticated command/query RPCs (`begin_business_image`, `finish_business_image`, `business_image_workspace`, `business_image_review_queue`, `inspect_business_image`, `decide_business_image`) and two anonymous-safe publication RPCs. The RPCs use the user's existing JWT and the configured publishable key. A distinct trusted server writer, configured through `SUPABASE_MEDIA_WRITER_KEY`, is now required solely to insert server-validated approved WebP bytes. That existing secret credential carries service authority and requires explicit target-specific binding approval; no credential was created, accessed or granted locally. The client cannot provide it. Application code verifies recent Operator authority and original hash, size and sanitization before the write, then uses the Operator JWT for the audited decision. Missing writer configuration fails closed. Public responses contain approved media IDs, kind, alt text, derivative URL and dimensions; private source notes, attesters and original paths are not exposed by them.

## Minimum database and bucket delta

Apply only an independently approved version of `forward.sql`, to an explicitly named, reconciled nonproduction target first:

1. One RLS-protected `app.business_image_submissions` table with a primary/foreign key, rights/alt/derivative metadata and review fields. No direct anonymous or authenticated table grants.
2. Five private helper functions with fixed empty search paths; only the storage-policy and managed-row predicate helpers have anonymous/authenticated execution.
3. Eight RPC functions and their narrowly enumerated execution grants, described above.
4. One private `business-images` bucket: maximum 2,097,152 bytes; JPEG, PNG and WebP MIME allowlist. Immutable UUID-prefixed `original`, `sanitized.webp` and `approved.webp` keys. No public bucket, overwrite or delete permission for ordinary users. Owner and Operator JWTs cannot insert `approved.webp`; only the trusted server writer has that capability.
5. Six policies on existing `storage.objects`: two permissive read/insert policies for this bucket plus four restrictive read/insert/update/delete guards that leave other bucket IDs alone. Existing Storage grants and hosted policy composition must already support the intended operations; this package does not grant additional Storage table access.
6. Revoke direct `INSERT`, `UPDATE`, `DELETE` on existing `app.media_assets` from `anon` and `authenticated`. This closes the baseline owner mutation path that could bypass review. It also affects any legacy direct media consumer across listings and kinds, including video. That effect must be independently accepted or replaced with a reviewed narrower boundary before release; do not silently restore the bypass.
7. Four restrictive policies on existing `app.media_assets`: hide sidecar-backed rows from direct SELECT despite the inherited approved-public policy; protect them from direct UPDATE/DELETE even if old column-level grants exist; reserve the UUID/original namespace from direct INSERT or path changes. Other legacy rows retain their existing SELECT behavior. The old `photo_urls` view no longer exposes new managed rows; the new safe RPC renders them.

Existing `app.media_assets`, `app.listing_content`, Listing Participation, actor, audit and Operator structures are reused; no columns are added to those tables and no presentation view or migration-ledger repair is included. The forward transaction creates objects without replacing existing names, so collision or incompatibility rolls the entire transaction back. Storage file bytes are not part of that transaction.

The production ledger discrepancy (17 versions versus 22 repository versions, no matching timestamps) remains unresolved. A cancelled production constraint/bucket metadata query must not be repeated or replaced with an alternative acquisition path. This packet makes no claim about those exact production constraints or existing bucket configuration.

## What the seven Mac Chrome journeys establish

All journeys run in installed Mac Chrome, headless, with a mobile viewport followed by a desktop resize. They exercise the real `BusinessImagePanel`, `ListingPage`, shell, image validation/commands, local HTTP storage adapter and candidate SQL functions/RLS in PGlite. They use generated pixels owned by the test, not downloaded business assets.

| Journey | Actual interaction | Synthetic or omitted boundary |
| --- | --- | --- |
| Upload/recovery | Form fields, file selection, rights attestation, an interrupted storage write, refresh, Resume upload, same-file retry and persisted pending receipt | Query-string test identity; existing authenticated Studio loader and server-function transport replaced |
| Cross-owner denial | Other synthetic owner opens the panel; private submission/form denied | Real JWT issuance and hosted RLS provider not exercised |
| Pending privacy | Public listing has no pending image | Fixture public loader replaces the actual business route loader |
| Stale Operator | Review panel rejects old synthetic authentication time | WorkOS reauthentication redirect/MFA/session flow not exercised |
| Rights and approval | Private sanitized preview, unchecked-rights rejection, checked-rights approval and receipt | Review reason is synthetic evidence; actual Operator route loader and server-function transport replaced |
| Logo | Separate logo submission and approval | No real logo permission or business identity assertion |
| Public display | Actual ListingPage shows logo/photo with correct alt text, separate schema fields, mobile/desktop rendering and no horizontal overflow | Fixture router omits actual route `head`/SEO tags, full SSR/hydration and production CDN |

This is one browser page and synthetic identity switching, not seven independent browser engines or real logout/relogin sessions. Other auth, claim and inquiry components are faked or disabled. PostgreSQL functions execute, but `auth.jwt`, Storage metadata/byte service and extension availability are shims. HTTP tests additionally cover audit, quotas, revoked/expired participation, immutable writes, repeated decisions and unpublishing; they do not establish hosted provider acceptance.

## Required hosted tests after exact authorization

Use only already authorized nonproduction identities and synthetic nonproduction listing authority. If those are unavailable, request those exact fixture prerequisites rather than creating credentials or granting ownership.

1. Build and run the actual candidate on the target Linux runtime; load Sharp, decode a generated file and verify the resulting WebP. Use the real application routes and server functions, SSR/head tags and configured domain. Verify the hosted body-size limit accepts a 2 MB multipart upload and rejects larger inputs.
2. Use actual WorkOS sessions and hosted JWT validation: already scoped owner success, anonymous denial, cross-owner denial, Lead Recipient denial, manager scope enforcement, revoked/expired authority denial, wrong Operator organization denial and stale Operator reauthentication. Refresh, logout and relogin must preserve the expected submission while denying signed-out private requests.
3. Verify real private Storage APIs with the existing publishable key and user JWT. Anonymous and cross-owner original/sanitized reads must fail; forged paths, immutable overwrite/upsert, delete and both owner and Operator writes to `approved.webp` must fail even alongside broader policies. Owner upload uses no secret/service key. Verify that only the explicitly approved server writer persists sanitized approved bytes, and that removing its configuration leaves the item private. Check direct anonymous/authenticated media table SELECT cannot expose managed original paths, hashes or actor IDs, and that legacy public rows remain compatible.
4. Inspect the pending item through a real recent Operator session. Verify raw size/hash and server decoding, removal of EXIF/ICC metadata, bounded dimensions, rights gate, approved sanitized bytes and complete audit attribution. MIME-spoofed, animated, corrupt, SVG and over-limit files must fail without public output.
5. Interrupt storage and decision responses, refresh and retry. Confirm a single submission, no overwrites, one terminal audit event and truthful statuses. Reject an item and confirm private quarantine, released submission quota and retained rights/audit evidence; no automatic byte cleanup is claimed.
6. Verify anonymous approved-byte reads and publication projection, logo/photo separation, visible caption and schema agreement, actual SEO title/description/OG tags, mobile/desktop interactions and no private metadata in logs or responses. Unpublish only the synthetic fixture and verify new byte and projection requests fail. Previously downloaded/publicly cached derivatives cannot be recalled.
7. Demonstrate encrypted media export and authorized recovery before real owner enablement. Verify the chosen rollback operation below and restore only the synthetic fixture. Record exact commit, environment, SQL version, fixture IDs and pass/fail evidence.

## Rollback and cleanup

Before any SQL commit, an error rolls back the database/bucket metadata transaction. After commit, use an application rollback with the feature disabled while retaining the database security guards and evidence. The flag suppresses application upload, projection and byte routes; **it does not disable direct owner upload RPCs/Storage or revoke approved derivatives through direct Supabase Storage access**. SQL application itself enables provider-level owner uploads, so database security approval and encrypted export/recovery evidence must precede production SQL commit rather than a later UI flag flip. Approved derivative reads remain tied to approved status and listing publication. Removing an already public item requires an independently authorized, target-specific status/publication change, with an audit and recovery record. Do not use broad revocation or mutate real business records to test rollback.

There is no automatic down migration. Dropping tables, policies or functions after media has been accepted would lose rights evidence or reopen baseline access. A later approved schema removal must first preserve media/sidecar/audit records and affected listing logo associations, account for the bucket's file bytes, and reconcile the actual original grants. Never blindly regrant the direct owner media mutations. Rejected or abandoned upload rows/bytes are retained; a cleanup worker, storage reclamation and owner deletion workflow are outside this slice and must remain explicit operational follow-up.

## Smallest remaining approval

The smallest next approval is publication of the exact independently reviewed commit to its `codex/business-image-upload-20261011` review branch only. It does not cover merging, deploying, SQL, credentials or production data. The reviewed patch remains usable locally until that publication is approved.

Subsequent hosted verification requires an explicitly identified nonproduction target and separate authorization for the enumerated database/bucket delta (including direct-media grant impact), an actual candidate deployment/feature setting, and binding an already-authorized secret server credential to `SUPABASE_MEDIA_WRITER_KEY` on that same target. These can reuse prior staging permission only if its exact scope covers each operation and prerequisite. If no approved writer credential or already scoped synthetic actors exist, their provisioning is a separate unmet prerequisite; do not create either as part of a test. No production migration, ownership/Operator grants or live batch publication are included. Resolve the already required encrypted media export destination/recovery scope before production SQL application or real owner enablement. Permission is not requested for these local review documents or tests.
