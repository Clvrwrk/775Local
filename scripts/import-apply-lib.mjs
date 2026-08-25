export const REVIEW_ONLY_RPC_NAMES = Object.freeze([
  "register_source_batch",
  "ingest_source_rows",
  "ingest_listing_candidates",
  "reconcile_listing_candidate_screening",
  "source_batch_status",
  "listing_candidate_batch_status",
]);

function screeningMatrix(candidates) {
  const grouped = new Map();
  for (const candidate of candidates) {
    const key = `${candidate.city_slug}\u0000${candidate.launch_category_slug}`;
    const row = grouped.get(key) ?? {
      city: candidate.city_slug,
      category: candidate.launch_category_slug,
      candidate_count: 0,
      transform_current_count: 0,
      risk_current_count: 0,
      eligible_count: 0,
      needs_review_count: 0,
      ineligible_count: 0,
    };
    row.candidate_count += 1;
    if (candidate.evidence?.transform_version === "launch-candidate-v2") {
      row.transform_current_count += 1;
    }
    if (candidate.evidence?.corpus_review_risk_version === "entity-risk-v2") {
      row.risk_current_count += 1;
    }
    if (candidate.screening_status === "eligible") row.eligible_count += 1;
    if (candidate.screening_status === "needs_review") row.needs_review_count += 1;
    if (candidate.screening_status === "ineligible") row.ineligible_count += 1;
    grouped.set(key, row);
  }
  return [...grouped.values()].sort((left, right) =>
    `${left.city}\u0000${left.category}`.localeCompare(`${right.city}\u0000${right.category}`),
  );
}

function statusMatrix(matrix) {
  if (!Array.isArray(matrix)) return null;
  return matrix.map((row) => ({
    city: row.city,
    category: row.category,
    candidate_count: row.candidate_count,
    transform_current_count: row.transform_current_count,
    risk_current_count: row.risk_current_count,
    eligible_count: row.eligible_count,
    needs_review_count: row.needs_review_count,
    ineligible_count: row.ineligible_count,
  }));
}

/**
 * Apply an import only to immutable raw staging and the private review queue.
 * This function deliberately has no RPC for app.business_listings, publication,
 * ownership, Claims, or Listing Participation.
 */
export async function applyReviewOnlyImport({
  target,
  sourceName,
  sourceSha256,
  receipts,
  candidates,
  importedBy,
  notes,
  rpc,
  chunkSize = 500,
}) {
  const batchId = await rpc(target, "register_source_batch", {
    requested_source_name: sourceName,
    requested_source_sha256: sourceSha256,
    requested_workbook_row_count: receipts.length,
    requested_imported_by: importedBy,
    requested_notes: notes,
  });
  if (typeof batchId !== "string") throw new Error("Preview did not return a source batch id.");
  const transformVersion = candidates[0]?.evidence?.transform_version ?? "unknown";
  const riskVersion = candidates[0]?.evidence?.corpus_review_risk_version ?? "unknown";
  const correlationId = `listing-import:${sourceSha256}:${transformVersion}:${riskVersion}`;

  let insertedThisRun = 0;
  for (let offset = 0; offset < receipts.length; offset += chunkSize) {
    const requestedRows = receipts.slice(offset, offset + chunkSize);
    const inserted = await rpc(target, "ingest_source_rows", {
      requested_batch_id: batchId,
      requested_rows: requestedRows,
    });
    if (!Number.isInteger(inserted))
      throw new Error("Preview returned an invalid inserted-row count.");
    insertedThisRun += inserted;
  }

  let candidatesInsertedThisRun = 0;
  let candidatesReconciledThisRun = 0;
  for (let offset = 0; offset < candidates.length; offset += chunkSize) {
    const requestedCandidates = candidates.slice(offset, offset + chunkSize);
    const inserted = await rpc(target, "ingest_listing_candidates", {
      requested_batch_id: batchId,
      requested_candidates: requestedCandidates,
    });
    if (!Number.isInteger(inserted))
      throw new Error("Preview returned an invalid candidate count.");
    candidatesInsertedThisRun += inserted;
    const reconciled = await rpc(target, "reconcile_listing_candidate_screening", {
      requested_batch_id: batchId,
      requested_candidates: requestedCandidates,
      requested_correlation_id: correlationId,
    });
    if (!Number.isInteger(reconciled))
      throw new Error("Preview returned an invalid reconciled-candidate count.");
    candidatesReconciledThisRun += reconciled;
  }

  const status = await rpc(target, "source_batch_status", { requested_batch_id: batchId });
  if (!status || status.complete !== true || status.stored_row_count !== receipts.length) {
    throw new Error("Preview raw import did not reconcile to the source row count.");
  }
  const candidateStatus = await rpc(target, "listing_candidate_batch_status", {
    requested_batch_id: batchId,
  });
  const expectedMatrix = screeningMatrix(candidates);
  const actualMatrix = statusMatrix(candidateStatus?.matrix);
  if (
    !candidateStatus ||
    candidateStatus.candidate_count !== candidates.length ||
    candidateStatus.transform_current_count !== candidates.length ||
    candidateStatus.risk_current_count !== candidates.length ||
    JSON.stringify(actualMatrix) !== JSON.stringify(expectedMatrix)
  ) {
    throw new Error("Preview candidate import did not reconcile to the transformation count.");
  }

  return {
    batchId,
    insertedThisRun,
    candidatesInsertedThisRun,
    candidatesReconciledThisRun,
    status,
    candidateStatus,
  };
}
