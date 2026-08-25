export const REVIEW_ONLY_RPC_NAMES = Object.freeze([
  "register_source_batch",
  "ingest_source_rows",
  "ingest_listing_candidates",
  "source_batch_status",
  "listing_candidate_batch_status",
]);

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
  for (let offset = 0; offset < candidates.length; offset += chunkSize) {
    const requestedCandidates = candidates.slice(offset, offset + chunkSize);
    const inserted = await rpc(target, "ingest_listing_candidates", {
      requested_batch_id: batchId,
      requested_candidates: requestedCandidates,
    });
    if (!Number.isInteger(inserted))
      throw new Error("Preview returned an invalid candidate count.");
    candidatesInsertedThisRun += inserted;
  }

  const status = await rpc(target, "source_batch_status", { requested_batch_id: batchId });
  if (!status || status.complete !== true || status.stored_row_count !== receipts.length) {
    throw new Error("Preview raw import did not reconcile to the source row count.");
  }
  const candidateStatus = await rpc(target, "listing_candidate_batch_status", {
    requested_batch_id: batchId,
  });
  if (!candidateStatus || candidateStatus.candidate_count !== candidates.length) {
    throw new Error("Preview candidate import did not reconcile to the transformation count.");
  }

  return { batchId, insertedThisRun, candidatesInsertedThisRun, status, candidateStatus };
}
