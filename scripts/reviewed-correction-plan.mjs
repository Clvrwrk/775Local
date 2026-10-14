/**
 * Offline preparation only. No fetch, credentials, publication or migrations.
 * Target snapshots must be collected through the protected snapshot RPC on the
 * named target. Independent certificate/artifact hashes are retained, not scored
 * or certified by this planner. The database rechecks authority/evidence/version.
 */
import { createHash } from "node:crypto";
const fields = new Set([
  "display_name",
  "description",
  "phone_e164",
  "street_address",
  "postal_code",
  "hide_street",
  "is_service_area",
  "hours_text",
  "services",
  "address_locality",
  "service_area_names",
  "content_about",
  "projects",
  "faqs",
]);
const hash = /^[a-f0-9]{64}$/;
const slug = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const domain = /^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$/;
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;

export function prepareReviewedCorrectionPlan({
  targetRef,
  inventory,
  targetSnapshots,
  reviewedDrafts = [],
}) {
  if (
    !/^[a-z0-9]{20}$/.test(targetRef ?? "") ||
    !Array.isArray(inventory) ||
    inventory.length !== 100 ||
    !Array.isArray(targetSnapshots) ||
    targetSnapshots.length !== 100
  )
    throw new Error("exact_100_target_inventory_required");
  const identities = new Set();
  for (const row of inventory) {
    if (!slug.test(row?.slug ?? "") || !domain.test(row?.domain ?? "") || identities.has(row.slug))
      throw new Error("ambiguous_listing_inventory");
    identities.add(row.slug);
  }
  const snapshots = new Map();
  const ids = new Set();
  for (const row of targetSnapshots) {
    if (
      row?.targetRef !== targetRef ||
      !identities.has(row.slug) ||
      snapshots.has(row.slug) ||
      !uuid.test(row.listing_id ?? "") ||
      ids.has(row.listing_id) ||
      !hash.test(row.version ?? "") ||
      !row.values ||
      typeof row.values !== "object" ||
      Array.isArray(row.values)
    )
      throw new Error("target_snapshot_identity_required");
    snapshots.set(row.slug, row);
    ids.add(row.listing_id);
  }
  const drafts = new Map();
  for (const draft of reviewedDrafts) {
    if (
      !identities.has(draft?.slug) ||
      drafts.has(draft.slug) ||
      !hash.test(draft.artifactSha256 ?? "") ||
      !hash.test(draft.certificateSha256 ?? "") ||
      !draft.changes ||
      typeof draft.changes !== "object" ||
      Array.isArray(draft.changes) ||
      Object.keys(draft.changes).some((f) => !fields.has(f))
    )
      throw new Error("reviewed_draft_required");
    for (const field of ["projects", "faqs"]) {
      if (
        Object.hasOwn(draft.changes, field) &&
        (!Array.isArray(draft.changes[field]) || draft.changes[field].length !== 0)
      )
        throw new Error("correction_clear_only_field");
    }
    drafts.set(draft.slug, draft);
  }
  return {
    targetRef,
    total: 100,
    mode: "offline_operator_review_required",
    entries: inventory.map((identity) => {
      const snapshot = snapshots.get(identity.slug);
      const draft = drafts.get(identity.slug);
      if (snapshot.domain !== identity.domain || (draft && draft.domain !== identity.domain))
        throw new Error("listing_domain_conflict");
      if (!draft)
        return {
          slug: identity.slug,
          domain: identity.domain,
          status: "held_missing_reviewed_evidence",
          command: null,
          unknowns: [...fields],
        };
      const nextHideStreet = draft.changes.hide_street ?? snapshot.values.hide_street;
      const nextServiceArea = draft.changes.is_service_area ?? snapshot.values.is_service_area;
      const revealingAddress =
        (snapshot.values.hide_street === true && nextHideStreet === false) ||
        (snapshot.values.is_service_area === true &&
          nextServiceArea === false &&
          nextHideStreet === false);
      const revealFields = ["street_address", "postal_code", "address_locality"];
      if (revealingAddress && revealFields.some((f) => !Object.hasOwn(draft.changes, f)))
        throw new Error("correction_address_evidence_required");
      // A reveal is a new publication decision even when private stored values match.
      // Retain only explicitly supplied, reviewed fields; never infer them from storage.
      const changes = Object.fromEntries(
        Object.entries(draft.changes).filter(
          ([f, v]) =>
            (revealingAddress && revealFields.includes(f)) ||
            JSON.stringify(v) !== JSON.stringify(snapshot.values[f]),
        ),
      );
      const changedFields = Object.keys(changes);
      if (changedFields.some((f) => !draft.fieldProvenance?.[f]))
        throw new Error("field_evidence_required");
      return {
        slug: identity.slug,
        domain: identity.domain,
        status: changedFields.length ? "prepared_for_operator_review" : "no_change",
        sourceArtifactSha256: draft.artifactSha256,
        independentCertificateSha256: draft.certificateSha256,
        before: Object.fromEntries(changedFields.map((f) => [f, snapshot.values[f]])),
        after: changes,
        unknowns: [...fields].filter((f) => !Object.hasOwn(draft.changes, f)),
        command: changedFields.length
          ? {
              listingId: snapshot.listing_id,
              idempotencyKey: `correction:${targetRef}:${createHash("sha256")
                .update(
                  JSON.stringify([identity.slug, draft.artifactSha256, snapshot.version, changes]),
                )
                .digest("hex")}`,
              correction: {
                expectedSlug: identity.slug,
                expectedDomain: identity.domain,
                expectedVersion: snapshot.version,
                changes,
                fieldProvenance: Object.fromEntries(
                  changedFields.map((f) => [f, draft.fieldProvenance[f]]),
                ),
                reason: "Apply independently reviewed first-party field correction",
              },
            }
          : null,
        rollback: changedFields.some((field) =>
          ["description", "content_about", "projects", "faqs"].includes(field),
        )
          ? "Fresh independent field review and a new correction are required to restore changed public copy."
          : "Use returned receiptId/version with protected rollback RPC; any intervening edit requires fresh human reconciliation.",
      };
    }),
  };
}
