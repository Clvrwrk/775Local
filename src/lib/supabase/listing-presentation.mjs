import { callOperatorRpc } from "./operator-publication.mjs";
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
/** @param {any} input @param {any} options */
export async function listingPresentationSnapshot(input, options) {
  if (
    !input ||
    Object.keys(input).some((k) => k !== "listingId") ||
    !uuid.test(input.listingId ?? "")
  )
    return { ok: false, code: "invalid_operator_command" };
  return callOperatorRpc({
    ...options,
    rpc: "listing_presentation_snapshot",
    body: { requested_listing_id: input.listingId },
  });
}
/** Full reviewed replacement; null contact / empty media are explicit removals. @param {any} input @param {any} options */
export async function applyReviewedListingPresentation(input, options) {
  if (
    !input ||
    Object.keys(input).some((k) => !["listingId", "presentation", "idempotencyKey"].includes(k)) ||
    !uuid.test(input.listingId ?? "") ||
    !/^[A-Za-z0-9][A-Za-z0-9._:-]{7,199}$/.test(input.idempotencyKey ?? "") ||
    !input.presentation ||
    typeof input.presentation !== "object" ||
    Array.isArray(input.presentation) ||
    new TextEncoder().encode(JSON.stringify(input.presentation)).length > 32768
  )
    return { ok: false, code: "invalid_operator_command" };
  return callOperatorRpc({
    ...options,
    rpc: "apply_reviewed_listing_presentation",
    body: {
      requested_listing_id: input.listingId,
      requested_presentation: input.presentation,
      requested_key: input.idempotencyKey,
    },
  });
}
