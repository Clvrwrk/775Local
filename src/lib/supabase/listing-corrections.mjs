import { callOperatorRpc } from "./operator-publication.mjs";

const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
/** @param {unknown} input @param {string[]} fields */
function validate(input, fields) {
  if (!input || typeof input !== "object" || Array.isArray(input))
    throw new Error("invalid_operator_command");
  const value = /** @type {Record<string, any>} */ (input);
  if (Object.keys(value).some((k) => !fields.includes(k)) || !uuid.test(value.listingId ?? ""))
    throw new Error("invalid_operator_command");
  if (
    fields.includes("idempotencyKey") &&
    (typeof value.idempotencyKey !== "string" ||
      !/^[A-Za-z0-9][A-Za-z0-9._:-]{7,199}$/.test(value.idempotencyKey))
  )
    throw new Error("invalid_operator_command");
  return value;
}
/** @typedef {{accessToken: string, env?: NodeJS.ProcessEnv, fetchImpl?: typeof fetch}} Options */
/** @param {unknown} input @param {Options} options */
export async function listingCorrectionSnapshot(input, options) {
  try {
    const v = validate(input, ["listingId"]);
    return callOperatorRpc({
      ...options,
      rpc: "listing_correction_snapshot",
      body: { requested_listing_id: v.listingId },
    });
  } catch {
    return { ok: false, code: "invalid_operator_command" };
  }
}
/** @param {unknown} input @param {Options} options */
export async function applyReviewedListingCorrection(input, options) {
  try {
    const v = validate(input, ["listingId", "correction", "idempotencyKey"]);
    if (
      !v.correction ||
      typeof v.correction !== "object" ||
      Array.isArray(v.correction) ||
      new TextEncoder().encode(JSON.stringify(v.correction)).length > 32768
    )
      throw new Error("invalid_operator_command");
    return callOperatorRpc({
      ...options,
      rpc: "apply_reviewed_listing_correction",
      body: {
        requested_listing_id: v.listingId,
        requested_correction: v.correction,
        requested_key: v.idempotencyKey,
      },
    });
  } catch {
    return { ok: false, code: "invalid_operator_command" };
  }
}
/** @param {unknown} input @param {Options} options */
export async function rollbackReviewedListingCorrection(input, options) {
  try {
    const v = validate(input, [
      "listingId",
      "receiptId",
      "expectedVersion",
      "reason",
      "idempotencyKey",
    ]);
    if (
      !uuid.test(v.receiptId ?? "") ||
      !/^[a-f0-9]{64}$/.test(v.expectedVersion ?? "") ||
      typeof v.reason !== "string" ||
      v.reason.trim().length < 3 ||
      v.reason.length > 500
    )
      throw new Error("invalid_operator_command");
    return callOperatorRpc({
      ...options,
      rpc: "rollback_reviewed_listing_correction",
      body: {
        requested_listing_id: v.listingId,
        requested_receipt_id: v.receiptId,
        requested_expected_version: v.expectedVersion,
        requested_reason: v.reason,
        requested_key: v.idempotencyKey,
      },
    });
  } catch {
    return { ok: false, code: "invalid_operator_command" };
  }
}
