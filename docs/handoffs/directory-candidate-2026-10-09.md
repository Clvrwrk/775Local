# 775Directory candidate handoff — October 9, 2026

Status: implemented and tested locally; hosted staging and live release acceptance remain open. This is not a production release.

The current draft PR15 baseline is `92966e5e1f93bb3d3ab1ac93897febad7b56796c`; main remains `b9d2a247a99c4bd646c68327228e4128d8ef5f0d`. The candidate is on local branch `codex/directory-release-candidate-20261009`. Its final commit and portable recovery bundle are recorded in the accompanying evidence receipt. Nothing was pushed, merged, deployed or applied to hosted data.

People can now build a private profile with a display name, optional city and introduction. Saving, editing, response-loss retries and conflicting sessions have explicit behavior. A profile does not grant business authority. Account and Studio views reset when identity changes. Mobile navigation exposes Account. Anonymous account access now reaches sign-in once and retains its destination; a redirect loop found in actual-browser testing was fixed.

Existing claim, invitation, new-listing submission, review and owner-management implementation was preserved. Owner changes remain proposals requiring review. Database authorization rejects cross-owner access and does not accept client-supplied identity or roles. Actual claims remain shadow-only. No real ownership, business records, private proof, credentials or provider messages were created or changed.

Local verification passed: 263 unit tests; TypeScript, ESLint, secret scan and production build; all 34 migrations from an empty disposable PostgreSQL database; 20 database suites with 574 pgTAP assertions; real simultaneous claim and profile writes. Production dependency audit reports zero vulnerabilities; installation still reports one high development-only advisory.

Mac browser verification used locally launched Playwright Chromium, not a hosted browser. At 390px and 1280px, synthetic journeys passed claim evidence/status/retries, invitations, listing requests and review, profiles and stale edits, logout/relogin and identity isolation, keyboard save, owner proposals and least privilege. Their commands and identities are deterministic fixtures. The real local application also passed anonymous-account redirect and unconfigured-sign-in failure checks. These are separate boundary tests, not combined real authenticated acceptance. Cross-browser, full accessibility/performance, real WorkOS recovery and hosted persistence were not verified.

Independent read-only source review found no remaining substantive implementation defect after closing Unicode whitespace validation and scope inconsistencies. Review covered server-derived identity and bearer forwarding, actor policies, idempotency and migration guards.

The protected Vercel Preview exists at `https://reno-local-directory-6y8eb8i88-cleverwork.vercel.app` for the old PR head. Required environment names are present, but presence does not validate their values or the deployment runtime. Supabase Preview `dpxeldzunfxmjahgvjhm` still has the historical 27 migration receipts. The candidate forward package is prepared but neither applied nor rehearsed against that exact historical schema. See the blocker catalog for the controlled next steps.

The canonical checkout `/Volumes/M1 Application SSD/Projects/Local775` was verified and left untouched. Mac dataless files blocked the first isolated checkout; the same base was recovered at `/tmp/775Local-release-candidate-20261009` and edited files preserved. No system/security settings were changed. The evidence receipt and Git bundle preserve the result beyond the temporary checkout.
