# Project handoff — consolidated main baseline

Date: September 5, 2026. Repository: https://github.com/Clvrwrk/775Local.git
Authoritative consolidation: [PR12](https://github.com/Clvrwrk/775Local/pull/12). Once merged, begin the next session from freshly fetched `origin/main` and create new `codex/` branches and PRs. Do not resume superseded feature branches.

## Authorization and scope

Christopher Hussey explicitly requested review and resolution of all PR comments, conflict resolution, and consolidation of all branches into main. This is source consolidation before full product/GTM acceptance. Hosted database migrations, provider sends, paid effects, and unrelated production security work were not executed by this consolidation.

Reno remains the active pilot. Basic, Standard and Premium describe free content completeness. Featured/Sponsored, ownership verification, information checking and authentication remain independent.

## Integrated work

- Reno discovery and supplied Basic/Standard/Premium page structures; anonymous public-data Preview configuration; guarded Claim, Studio and disabled-by-default inquiry foundations.
- PR13 Basic row, Standard side, Premium stack cards, valid contact actions, case-study presentation, brand-asset schema and public projections. Homepage intentionally uses uniform stack cards; search/category cards select content-tier layouts.
- All live remote branch heads and retained historical refs are preserved as merge ancestors after source reconciliation. Private enrichment archive scripts/schema/tests, historical receipts and ADR0002 supersession were recovered; archive profile selection now uses accepted filterv10.
- `docs/PR-CONSOLIDATION.md` records all review-thread dispositions and implementation decisions. Older route/UI versions are intentionally superseded rather than reintroduced.

## Main history policy

GitHub protects main with required linear history. PR12 therefore uses a squash merge of the reconciled tree. Original branch commits remain reachable through the retained consolidation branch and historical branches; they are not all ancestors of the squashed main commit. Older open PRs are closed as superseded by PR12 with explicit cross-links, not represented as individually merged. No branch protection is weakened and no branch is force-pushed or deleted.

## Validation

179 unit tests, TypeScript, ESLint, secret scan and production build passed. A fresh disposable local PostgreSQL database applied all22 migrations and passed195 pgTAP assertions across eight suites, including actual seed publication/replay/privacy and case-study/public media access. Independent Standards and Spec reviews closed all findings. Required GitHub checks and final merge status are recorded on PR12.

Browser setup still fails its trusted-dependency initialization check. No fresh screenshot, responsive interaction, full accessibility, or authenticated end-to-end acceptance is claimed. A Ready deployment is not product acceptance.

## Required next-session work

- CLE-107: complete private proof processing/retention and Claim lifecycle.
- CLE-108: participant/invitation UI, scoped owner media management and case-study draft/review/publish commands. Case-study participant direct CRUD is intentionally denied; a schema/public display is not a finished owner workflow. Primary asset metadata preserves duplicates, original paths, approval states and existing references.
- CLE-109/110: recipient provisioning, inquiry queues/outcomes, durable delivery/replay/reconciliation and dedicated Local775 GHL configuration. Keep inquiry activation off until acceptance. Do not use Homeworks Advantage.
- CLE-104: editorial cleanup and bounded evidence-backed enrichment. Existing pre-manifest artifact roots require an offline receipt inventory and immutable batch-layout binding before resumption; never infer old batch ownership from a new `--batch-size` flag. No private archive/root was changed or provider called here.
- CLE-113 through CLE-117: measurement, recovery, browser/accessibility/performance and authenticated integration/release acceptance. Apply hosted migrations only as a separate target-explicit operation.
- CAT-145/CLE-118: existing production security work remains separate; local tests do not close that disposition.

## Accounting and workspace

Scope CLE-101. Design CLE-105↔CAT-78; Claims CLE-107↔CAT-82; Studio CLE-108↔CAT-165; inquiries CLE-109↔CAT-164. Keep implementation tickets open for remaining product work even after PR consolidation.

Implementation checkout: `/Users/chussey/Documents/Codex/2026-09-04/pl/work/reno-pilot`; canonical external checkout `/Volumes/M1 Application SSD/Projects/Local775` remains untouched. GitHub/main is the source to refresh next session. Review outputs and local receipt: `/Users/chussey/Documents/Codex/2026-09-04/pl/outputs/775directory-audit/`. The previously rejected Dropbox receipt sync was not retried; local receipt and Linear contain current results.
